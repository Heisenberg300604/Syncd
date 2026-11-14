import Foundation
import Observation

/// The room-side commands the coordinator may issue on the host's behalf.
/// Implemented by `RoomSession`; the server re-checks host status on every one.
@MainActor
protocol RoomPlaybackCommanding: AnyObject {
    func sendPlaybackControl(_ action: PlaybackAction, position: TimeInterval) async throws(SocketError) -> TimedPlayback
    func sendAdvanceQueue() async throws(SocketError)
}

/// Maps the room's current track to a renderable source.
protocol PlaybackSourceResolving: Sendable {
    func source(for snapshot: PlaybackSnapshot) -> PlaybackSource?
}

/// The backend only knows YouTube video ids today
/// (Documentation/BACKEND_CONTRACT.md §4.1).
struct RoomSourceResolver: PlaybackSourceResolving {
    func source(for snapshot: PlaybackSnapshot) -> PlaybackSource? {
        snapshot.videoId.map { .youtube(videoId: $0) }
    }
}

/// Owns synchronized listening: interprets authoritative room state, drives
/// the single `AudioEngine`, corrects drift, and routes every control surface
/// (in-app, lock screen, Control Center, headphones) through one permission
/// check. It never owns SwiftUI presentation state beyond what views read.
@MainActor
@Observable
final class PlaybackCoordinator: PlaybackCommandHandling {
    enum Session: Equatable {
        case none
        case room(code: String)
        case local
    }

    enum Status: Equatable {
        case idle
        case loading
        case buffering
        case playing
        case paused
        case ended
        case failed(PlaybackError)
    }

    enum AudioAvailability: Equatable {
        case none
        /// This device is producing audio through AVPlayer.
        case native
        /// Following the room's timeline without local audio.
        case unavailable(reason: String)
    }

    // MARK: Observable state for the UI

    private(set) var session: Session = .none
    private(set) var item: PlaybackItem?
    private(set) var status: Status = .idle
    private(set) var position: TimeInterval = 0
    private(set) var audioAvailability: AudioAvailability = .none
    private(set) var isHost = false
    /// A participant (or host, for route loss/interruptions) paused audio on
    /// this device only. The room keeps playing; resuming rejoins live.
    private(set) var isLocallyPaused = false
    private(set) var isRoomPlaying = false
    private(set) var lastDrift: TimeInterval?
    var commandError: PresentableError?

    var duration: TimeInterval? {
        usesEngine ? (engine.duration ?? item?.duration) : item?.duration
    }

    /// What the play/pause button should show — real state, not intent.
    var isPlaying: Bool {
        if usesEngine { return engine.state.isActivelyPlaying }
        return isRoomPlaying
    }

    var hasActiveItem: Bool { item != nil }

    var canSeek: Bool {
        switch session {
        case .none: false
        case .local: usesEngine
        case .room: isHost
        }
    }

    var canSkip: Bool {
        if case .room = session { return isHost && item != nil }
        return false
    }

    /// Participants can't toggle audio they aren't producing.
    var canTogglePlayback: Bool {
        switch session {
        case .none: false
        case .local: true
        case .room: isHost || usesEngine
        }
    }

    // MARK: Dependencies

    @ObservationIgnored private let engine: any AudioEngine
    @ObservationIgnored private let audioSession: AudioSessionManager?
    @ObservationIgnored private let nowPlayingCenter: NowPlayingManager?
    @ObservationIgnored private let remoteCommands: RemoteCommandManager?
    @ObservationIgnored private let clock: any MonotonicClock
    @ObservationIgnored private let resolver: any PlaybackSourceResolving
    @ObservationIgnored let driftPolicy: DriftPolicy
    @ObservationIgnored private weak var commander: (any RoomPlaybackCommanding)?

    // MARK: Internal state

    @ObservationIgnored private(set) var serverClock = ServerClock()
    @ObservationIgnored private var sequencer = SnapshotSequencer()
    @ObservationIgnored private(set) var roomState: RoomPlaybackState?
    @ObservationIgnored private var reconcileGeneration = 0
    @ObservationIgnored private var lastSeekAt: Date = .distantPast
    @ObservationIgnored private var advanceRequestedFor: Date?
    @ObservationIgnored private var tickTask: Task<Void, Never>?
    @ObservationIgnored private var tickCount = 0
    /// Local-mode intent: the user wants audio. Used for interruption policy.
    @ObservationIgnored private var localWantsPlayback = false
    @ObservationIgnored private var isInterrupted = false
    @ObservationIgnored private var wasPlayingBeforeInterruption = false
    @ObservationIgnored private var userPausedDuringInterruption = false

    static let seekCooldown: TimeInterval = 3
    static let tickInterval: Duration = .milliseconds(500)
    /// Drift is evaluated every N ticks (2 s), not every UI refresh.
    static let driftCheckEveryTicks = 4

    init(
        engine: any AudioEngine,
        audioSession: AudioSessionManager?,
        nowPlaying: NowPlayingManager?,
        remoteCommands: RemoteCommandManager?,
        clock: any MonotonicClock,
        resolver: any PlaybackSourceResolving = RoomSourceResolver(),
        driftPolicy: DriftPolicy = DriftPolicy()
    ) {
        self.engine = engine
        self.audioSession = audioSession
        self.nowPlayingCenter = nowPlaying
        self.remoteCommands = remoteCommands
        self.clock = clock
        self.resolver = resolver
        self.driftPolicy = driftPolicy

        engine.onStateChange = { [weak self] state in self?.engineStateChanged(state) }
        audioSession?.onEvent = { [weak self] event in self?.handleAudioSessionEvent(event) }
        remoteCommands?.handler = self
        audioSession?.configure()
    }

    private var usesEngine: Bool { audioAvailability == .native }

    // MARK: Room lifecycle

    func attachRoom(code: String, commander: any RoomPlaybackCommanding) {
        if session != .room(code: code) {
            resetPlayback()
        }
        session = .room(code: code)
        self.commander = commander
        startTicking()
    }

    func detachRoom() {
        guard case .room = session else { return }
        resetPlayback()
        session = .none
        commander = nil
    }

    func updateRole(isHost: Bool) {
        guard self.isHost != isHost else { return }
        self.isHost = isHost
        updateRemoteCommandAvailability()
    }

    /// Applies an authoritative snapshot from a broadcast, an ack, or a join.
    /// - Parameter isResync: join/rejoin snapshots force a re-seek even when
    ///   unchanged, so a reconnect always reconciles position.
    func applyRoomSnapshot(_ timed: TimedPlayback, isResync: Bool) {
        guard case .room = session else { return }
        serverClock.record(timed)

        switch sequencer.evaluate(timed.snapshot, isResync: isResync) {
        case .stale:
            Log.sync.info("Rejected stale playback snapshot")
            return
        case .duplicate:
            return
        case .apply:
            break
        }

        let state = RoomPlaybackState(snapshot: timed.snapshot)
        let trackChanged = state.trackId != roomState?.trackId
        roomState = state
        isRoomPlaying = state.isPlaying
        if trackChanged {
            advanceRequestedFor = nil
            isLocallyPaused = false
        }

        guard let trackId = state.trackId, let source = resolver.source(for: timed.snapshot) else {
            clearItem()
            return
        }

        item = PlaybackItem(
            id: trackId,
            title: state.title?.isEmpty == false ? state.title! : "Untitled track",
            subtitle: source.displayName,
            artworkURL: state.artworkURL,
            duration: state.duration,
            source: source
        )

        guard source.capabilities.nativeEngine else {
            if engine.currentItem != nil { engine.stop() }
            nowPlayingCenter?.clear()
            audioAvailability = .unavailable(reason: Self.unavailableReason(for: source))
            status = state.isPlaying ? .playing : .paused
            position = state.expectedPosition(atServerTime: serverNow())
            updateRemoteCommandAvailability()
            return
        }

        audioAvailability = .native
        reconcileEngine(forceReload: trackChanged || engine.currentItem?.id != trackId, forceSeek: isResync)
    }

    // MARK: Local mode

    /// Plays a file from this device. Not shared with any room.
    func playLocalFile(_ url: URL, title: String) {
        if case .room = session { return }
        resetPlayback()
        session = .local
        let item = PlaybackItem(id: url.absoluteString, title: title, subtitle: PlaybackSource.localFile(url).displayName,
                                artworkURL: nil, duration: nil, source: .localFile(url))
        self.item = item
        audioAvailability = .native
        localWantsPlayback = true
        startTicking()
        Task {
            do {
                try await engine.load(item)
                audioSession?.activate()
                engine.play()
            } catch {
                status = .failed(error as? PlaybackError ?? .unknown("This track couldn't be played."))
            }
            publishNowPlaying()
        }
    }

    func stopLocal() {
        guard session == .local else { return }
        resetPlayback()
        session = .none
    }

    // MARK: Intents (in-app + remote commands)

    func play() {
        commandError = nil
        switch session {
        case .none:
            return
        case .local:
            localWantsPlayback = true
            audioSession?.activate()
            engine.play()
        case .room:
            if isHost {
                sendControl(.play)
            } else if usesEngine {
                isLocallyPaused = false
                reconcileEngine(forceReload: false, forceSeek: true)
            }
        }
    }

    func pause() {
        commandError = nil
        if isInterrupted { userPausedDuringInterruption = true }
        switch session {
        case .none:
            return
        case .local:
            localWantsPlayback = false
            engine.pause()
        case .room:
            if isHost {
                sendControl(.pause)
            } else if usesEngine {
                isLocallyPaused = true
                engine.pause()
            }
        }
        publishNowPlaying()
    }

    func togglePlayPause() {
        if case .room = session, isHost {
            isRoomPlaying ? pause() : play()
            return
        }
        if case .room = session, isLocallyPaused {
            play()
            return
        }
        isPlaying ? pause() : play()
    }

    func seek(to target: TimeInterval) {
        commandError = nil
        let clamped = max(0, min(target, duration ?? target))
        switch session {
        case .none:
            return
        case .local:
            Task { await engine.seek(to: clamped); publishNowPlaying() }
        case .room:
            guard isHost else {
                commandError = PresentableError(title: "Host only", message: "Only the host can seek the room.", isRetryable: false)
                return
            }
            sendControl(.seek, position: clamped)
        }
    }

    func skipToNext() {
        commandError = nil
        guard case .room = session else { return }
        guard isHost else {
            commandError = PresentableError(title: "Host only", message: "Only the host can skip tracks.", isRetryable: false)
            return
        }
        requestAdvance()
    }

    /// Call when the app returns to the foreground: the socket may have been
    /// suspended, so re-align to the last known authoritative state.
    func handleBecameActive() {
        guard case .room = session, usesEngine, roomState?.hasTrack == true else { return }
        reconcileEngine(forceReload: false, forceSeek: false)
    }

    // MARK: Engine reconciliation

    private func reconcileEngine(forceReload: Bool, forceSeek: Bool) {
        guard case .room = session, let room = roomState, let item else { return }
        reconcileGeneration += 1
        let generation = reconcileGeneration

        Task {
            if forceReload {
                status = .loading
                do {
                    try await engine.load(item)
                } catch {
                    guard generation == reconcileGeneration else { return }
                    status = .failed(error as? PlaybackError ?? .unknown("This track couldn't be played."))
                    publishNowPlaying()
                    return
                }
            }
            guard generation == reconcileGeneration else { return }

            let shouldPlay = room.isPlaying && !isLocallyPaused && !isInterrupted
            let expected = room.expectedPosition(atServerTime: serverNow())
            if forceReload || forceSeek || abs(engine.currentTime - expected) >= driftPolicy.ignoreBelow {
                lastSeekAt = clock.now()
                await engine.seek(to: expected)
                guard generation == reconcileGeneration else { return }
            }
            engine.setRate(1)
            if shouldPlay {
                audioSession?.activate()
                engine.play()
            } else {
                engine.pause()
            }
            publishNowPlaying()
            updateRemoteCommandAvailability()
        }
    }

    private func engineStateChanged(_ state: EngineState) {
        guard usesEngine else { return }
        switch state {
        case .idle: status = .idle
        case .loading: status = .loading
        case .ready: status = .paused
        case .playing: status = .playing
        case .paused: status = .paused
        case .buffering, .seeking: status = .buffering
        case .ended:
            status = .ended
            if case .room = session, isHost { requestAdvance() }
            if session == .local { localWantsPlayback = false }
        case let .failed(error):
            status = .failed(error)
            Log.playback.error("Engine failed: \(error.title, privacy: .public)")
        }
        publishNowPlaying()
    }

    // MARK: Ticking (UI position, drift, host auto-advance)

    private func startTicking() {
        guard tickTask == nil else { return }
        tickTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: Self.tickInterval)
                self?.tick()
            }
        }
    }

    func tick() {
        tickCount &+= 1
        if usesEngine {
            position = engine.currentTime
        }
        guard case .room = session, let room = roomState, room.hasTrack else { return }
        let serverNow = serverNow()

        if !usesEngine {
            position = room.expectedPosition(atServerTime: serverNow)
        }

        // Timeline-based auto-advance so an iOS host advances the queue even
        // when no local player reports "ended" (e.g. YouTube tracks).
        if isHost, room.hasEnded(atServerTime: serverNow, grace: 2) {
            requestAdvance()
        }

        guard
            usesEngine, room.isPlaying, !isLocallyPaused, !isInterrupted,
            engine.state == .playing,
            tickCount % Self.driftCheckEveryTicks == 0,
            clock.now().timeIntervalSince(lastSeekAt) > Self.seekCooldown
        else { return }

        let expected = room.expectedPosition(atServerTime: serverNow)
        let drift = engine.currentTime - expected
        lastDrift = drift

        switch driftPolicy.correction(forDrift: drift, supportsRateAdjustment: engine.supportsRateAdjustment) {
        case .none:
            if engine.rate != 1 {
                engine.setRate(1)
                publishNowPlaying()
            }
        case .monitor:
            break
        case let .adjustRate(rate):
            Log.sync.debug("Drift \(drift, format: .fixed(precision: 3), privacy: .public)s → rate \(rate, format: .fixed(precision: 3), privacy: .public)")
            engine.setRate(rate)
        case .seek:
            Log.sync.info("Drift \(drift, format: .fixed(precision: 3), privacy: .public)s → seek")
            engine.setRate(1)
            lastSeekAt = clock.now()
            Task {
                await engine.seek(to: room.expectedPosition(atServerTime: self.serverNow()))
                publishNowPlaying()
            }
        }
    }

    // MARK: Commands to the room

    private func currentRoomPosition() -> TimeInterval {
        if usesEngine { return engine.currentTime }
        return roomState?.expectedPosition(atServerTime: serverNow()) ?? 0
    }

    private func sendControl(_ action: PlaybackAction, position: TimeInterval? = nil) {
        guard let commander else {
            commandError = PresentableError(SocketError.notConnected)
            return
        }
        let target = position ?? currentRoomPosition()
        Task {
            do {
                let timed = try await commander.sendPlaybackControl(action, position: target)
                applyRoomSnapshot(timed, isResync: false)
            } catch {
                commandError = PresentableError(error)
            }
        }
    }

    private func requestAdvance() {
        guard let room = roomState, let commander else { return }
        let key = room.updatedAt ?? .distantPast
        guard advanceRequestedFor != key else { return }
        advanceRequestedFor = key
        Task {
            do {
                try await commander.sendAdvanceQueue()
            } catch {
                // Allow a retry on the next tick if the room didn't move on.
                if advanceRequestedFor == key { advanceRequestedFor = nil }
                commandError = PresentableError(error)
            }
        }
    }

    // MARK: Audio session events

    func handleAudioSessionEvent(_ event: InterruptionPolicy.Event) {
        if event == .interruptionBegan {
            wasPlayingBeforeInterruption = intendsToProduceAudio
            userPausedDuringInterruption = false
        }
        let action = InterruptionPolicy.action(
            for: event,
            wasPlayingBeforeInterruption: wasPlayingBeforeInterruption,
            userPausedDuringInterruption: userPausedDuringInterruption
        )
        Log.audioSession.info("Audio session event \(String(describing: event), privacy: .public) → \(String(describing: action), privacy: .public)")

        switch action {
        case .none:
            if case .interruptionEnded = event { isInterrupted = false }
        case .markInterrupted:
            isInterrupted = true
        case .resume:
            isInterrupted = false
            if case .room = session {
                reconcileEngine(forceReload: false, forceSeek: true)
            } else if session == .local {
                audioSession?.activate()
                engine.play()
            }
        case .stayPaused:
            isInterrupted = false
            if case .room = session { isLocallyPaused = true } else { localWantsPlayback = false }
            publishNowPlaying()
        case .pauseLocally:
            guard usesEngine else { return }
            engine.pause()
            // Never pauses the room, even for the host: pulling headphones is
            // a local event.
            if case .room = session { isLocallyPaused = true } else { localWantsPlayback = false }
            publishNowPlaying()
        case .rebuildSession:
            isInterrupted = false
            if case .room = session, usesEngine {
                reconcileEngine(forceReload: true, forceSeek: true)
            } else if session == .local {
                status = .failed(.mediaServicesReset)
            }
        }
    }

    private var intendsToProduceAudio: Bool {
        guard usesEngine else { return false }
        switch session {
        case .none: return false
        case .local: return localWantsPlayback
        case .room: return isRoomPlaying && !isLocallyPaused
        }
    }

    // MARK: Helpers

    func serverNow() -> Date {
        serverClock.serverNow(localNow: clock.now())
    }

    private func clearItem() {
        if engine.currentItem != nil { engine.stop() }
        item = nil
        status = .idle
        position = 0
        audioAvailability = .none
        isLocallyPaused = false
        nowPlayingCenter?.clear()
        updateRemoteCommandAvailability()
    }

    private func resetPlayback() {
        reconcileGeneration += 1
        tickTask?.cancel()
        tickTask = nil
        clearItem()
        roomState = nil
        isRoomPlaying = false
        sequencer.reset()
        serverClock = ServerClock()
        advanceRequestedFor = nil
        lastDrift = nil
        localWantsPlayback = false
        isInterrupted = false
        commandError = nil
        audioSession?.deactivate()
    }

    private func publishNowPlaying() {
        guard usesEngine, let item, item.source.capabilities.systemMediaControls else {
            nowPlayingCenter?.clear()
            return
        }
        nowPlayingCenter?.update(
            item: item,
            elapsed: engine.currentTime,
            duration: duration,
            isPlaying: engine.state == .playing,
            rate: engine.rate
        )
    }

    private func updateRemoteCommandAvailability() {
        guard let remoteCommands else { return }
        guard usesEngine, item != nil else {
            remoteCommands.update(.none)
            return
        }
        remoteCommands.activate()
        switch session {
        case .none:
            remoteCommands.update(.none)
        case .local:
            remoteCommands.update(.init(playPause: true, next: false, seek: true))
        case .room:
            remoteCommands.update(.init(playPause: true, next: isHost, seek: isHost))
        }
    }

    static func unavailableReason(for source: PlaybackSource) -> String {
        switch source {
        case .youtube:
            "YouTube tracks can't play through SyncD's native player, so this iPhone follows the room without audio."
        case .remoteStream, .localFile:
            "This source can't play on this device."
        }
    }
}
