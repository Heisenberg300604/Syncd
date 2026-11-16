import AVFoundation
import Observation

/// `AudioEngine` backed by a single `AVPlayer` that lives for the whole app
/// session. Items are swapped with `replaceCurrentItem`; the player itself is
/// never recreated, so the audio session and Now Playing ownership stay stable.
@MainActor
@Observable
final class AVPlayerAudioEngine: AudioEngine {
    private(set) var state: EngineState = .idle {
        didSet {
            guard state != oldValue else { return }
            onStateChange?(state)
        }
    }
    private(set) var currentItem: PlaybackItem?
    private(set) var currentTime: TimeInterval = 0
    private(set) var duration: TimeInterval?
    private(set) var rate: Double = 1

    var supportsRateAdjustment: Bool { true }

    @ObservationIgnored var onStateChange: ((EngineState) -> Void)?

    @ObservationIgnored private let player = AVPlayer()
    @ObservationIgnored private var timeObserver: Any?
    @ObservationIgnored private var playerObservations: [NSKeyValueObservation] = []
    @ObservationIgnored private var itemObservations: [NSKeyValueObservation] = []
    @ObservationIgnored private var itemNotificationTokens: [any NSObjectProtocol] = []
    /// What the user/coordinator asked for, used to tell a stall from a pause.
    @ObservationIgnored private var wantsToPlay = false
    @ObservationIgnored private var isSeeking = false
    @ObservationIgnored private var seekGeneration = 0
    @ObservationIgnored private var loadGeneration = 0

    init() {
        player.automaticallyWaitsToMinimizeStalling = true
        player.actionAtItemEnd = .pause
        observePlayer()
    }

    // MARK: AudioEngine

    func load(_ item: PlaybackItem) async throws(PlaybackError) {
        let url: URL
        switch item.source {
        case let .remoteStream(streamURL): url = streamURL
        case let .localFile(fileURL): url = fileURL
        case .youtube:
            throw .unsupportedSource("YouTube tracks can only play in YouTube's own player.")
        }

        loadGeneration += 1
        let generation = loadGeneration
        wantsToPlay = false
        player.pause()
        clearItemObservers()
        currentItem = item
        currentTime = 0
        duration = item.duration
        state = .loading

        let asset = AVURLAsset(url: url)
        do {
            let (isPlayable, assetDuration) = try await asset.load(.isPlayable, .duration)
            guard generation == loadGeneration else { return } // superseded
            guard isPlayable else { throw PlaybackError.unplayableFormat }
            if assetDuration.isNumeric, assetDuration.seconds > 0 {
                duration = assetDuration.seconds
            }
        } catch let error as PlaybackError {
            state = .failed(error)
            throw error
        } catch {
            guard generation == loadGeneration else { return }
            let mapped = Self.map(error)
            state = .failed(mapped)
            throw mapped
        }

        let playerItem = AVPlayerItem(asset: asset)
        // Keep a modest forward buffer; long-form music, not video.
        playerItem.preferredForwardBufferDuration = 10
        observe(playerItem)
        player.replaceCurrentItem(with: playerItem)
        state = .ready
    }

    func play() {
        guard player.currentItem != nil else { return }
        if state == .ended {
            player.seek(to: .zero)
        }
        wantsToPlay = true
        player.playImmediately(atRate: Float(rate))
    }

    func pause() {
        wantsToPlay = false
        player.pause()
        if player.currentItem != nil, state != .ended, !isFailed {
            state = .paused
        }
    }

    @discardableResult
    func seek(to position: TimeInterval) async -> Bool {
        guard player.currentItem != nil, position.isFinite else { return false }
        seekGeneration += 1
        let generation = seekGeneration
        isSeeking = true
        state = .seeking
        let target = CMTime(seconds: max(0, position), preferredTimescale: 600)
        let finished = await player.seek(to: target, toleranceBefore: .zero, toleranceAfter: .zero)
        guard generation == seekGeneration else { return false }
        isSeeking = false
        currentTime = player.currentTime().seconds.isFinite ? player.currentTime().seconds : position
        updateStateFromPlayer()
        return finished
    }

    func setRate(_ newRate: Double) {
        let clamped = min(max(newRate, 0.5), 2.0)
        guard abs(clamped - rate) > 0.0001 else { return }
        rate = clamped
        player.defaultRate = Float(clamped)
        if player.timeControlStatus != .paused {
            player.rate = Float(clamped)
        }
    }

    func setVolume(_ volume: Float) {
        player.volume = min(max(volume, 0), 1)
    }

    func stop() {
        loadGeneration += 1
        wantsToPlay = false
        player.pause()
        clearItemObservers()
        player.replaceCurrentItem(with: nil)
        currentItem = nil
        currentTime = 0
        duration = nil
        setRate(1)
        state = .idle
    }

    // MARK: Observation

    private var isFailed: Bool {
        if case .failed = state { return true }
        return false
    }

    private func observePlayer() {
        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.25, preferredTimescale: 600),
            queue: .main
        ) { [weak self] time in
            MainActor.assumeIsolated {
                guard let self, !self.isSeeking, time.isNumeric else { return }
                self.currentTime = time.seconds
            }
        }
        // KVO can fire off the main thread; hop explicitly.
        playerObservations = [
            Self.observeChanges(of: player, \.timeControlStatus) { [weak self] in
                Task { @MainActor [weak self] in self?.updateStateFromPlayer() }
            },
        ]
    }

    private func observe(_ item: AVPlayerItem) {
        itemObservations = [
            Self.observeChanges(of: item, \.status) { [weak self] in
                Task { @MainActor [weak self] in self?.handleItemStatusChange() }
            },
        ]
        let center = NotificationCenter.default
        itemNotificationTokens = [
            center.addObserver(forName: AVPlayerItem.didPlayToEndTimeNotification, object: item, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated {
                    guard let self else { return }
                    self.wantsToPlay = false
                    if let duration = self.duration { self.currentTime = duration }
                    self.state = .ended
                }
            },
            center.addObserver(forName: AVPlayerItem.failedToPlayToEndTimeNotification, object: item, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated {
                    self?.wantsToPlay = false
                    self?.state = .failed(.network)
                }
            },
        ]
    }

    private func clearItemObservers() {
        itemObservations.forEach { $0.invalidate() }
        itemObservations = []
        itemNotificationTokens.forEach(NotificationCenter.default.removeObserver)
        itemNotificationTokens = []
    }

    private func handleItemStatusChange() {
        guard let item = player.currentItem else { return }
        switch item.status {
        case .failed:
            wantsToPlay = false
            state = .failed(item.error.map(Self.map) ?? .sourceUnavailable)
        case .readyToPlay:
            if let seconds = Optional(item.duration.seconds), seconds.isFinite, seconds > 0 {
                duration = seconds
            }
            updateStateFromPlayer()
        case .unknown:
            break
        @unknown default:
            break
        }
    }

    /// Derives state from AVPlayer, so the UI reflects reality (e.g. iOS
    /// pausing us for a phone call shows as paused, not playing).
    private func updateStateFromPlayer() {
        guard player.currentItem != nil, !isSeeking, !isFailed, state != .ended, state != .loading else { return }
        switch player.timeControlStatus {
        case .playing:
            state = .playing
        case .waitingToPlayAtSpecifiedRate:
            state = .buffering
        case .paused:
            if wantsToPlay, player.reasonForWaitingToPlay != nil {
                state = .buffering
            } else {
                // Includes iOS-initiated pauses (interruptions, route loss).
                wantsToPlay = false
                state = player.currentItem?.status == .readyToPlay ? .paused : .ready
            }
        @unknown default:
            break
        }
    }

    /// Built outside the main actor: KVO may call back on any thread, and a
    /// closure formed in a `@MainActor` method would be inferred main-isolated.
    nonisolated private static func observeChanges<Object: NSObject, Value>(
        of object: Object,
        _ keyPath: KeyPath<Object, Value>,
        onChange: @escaping @Sendable () -> Void
    ) -> NSKeyValueObservation {
        object.observe(keyPath, options: [.new]) { _, _ in onChange() }
    }

    private static func map(_ error: any Error) -> PlaybackError {
        if let error = error as? PlaybackError { return error }
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain { return .network }
        if nsError.domain == AVFoundationErrorDomain {
            switch AVError.Code(rawValue: nsError.code) {
            case .fileFormatNotRecognized, .decoderNotFound, .formatUnsupported: return .unplayableFormat
            case .mediaServicesWereReset: return .mediaServicesReset
            case .contentIsUnavailable, .noLongerPlayable: return .sourceUnavailable
            default: break
            }
        }
        return .unknown("This track couldn't be played.")
    }
}
