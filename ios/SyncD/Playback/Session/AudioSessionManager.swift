import AVFoundation

/// What the coordinator should do after an audio-session event.
/// Pure, so interruption behaviour is unit-tested without AVAudioSession.
enum InterruptionPolicy {
    enum Event: Equatable {
        case interruptionBegan
        case interruptionEnded(shouldResume: Bool)
        /// Headphones unplugged / Bluetooth device disconnected.
        case outputDeviceLost
        case mediaServicesReset
    }

    enum Action: Equatable {
        case none
        /// Record that playback was interrupted (iOS already paused us).
        case markInterrupted
        /// Resume: room mode re-syncs to the authoritative position first.
        case resume
        /// Stay paused; the user must resume deliberately.
        case stayPaused
        /// Pause locally (Apple HIG: never keep playing out of the speaker
        /// after headphones are pulled).
        case pauseLocally
        case rebuildSession
    }

    /// - Parameters:
    ///   - wasPlayingBeforeInterruption: we were producing audio when it began.
    ///   - userPausedDuringInterruption: the user hit pause while interrupted —
    ///     an intentional pause that must win over `shouldResume`.
    static func action(
        for event: Event,
        wasPlayingBeforeInterruption: Bool,
        userPausedDuringInterruption: Bool
    ) -> Action {
        switch event {
        case .interruptionBegan:
            return wasPlayingBeforeInterruption ? .markInterrupted : .none
        case let .interruptionEnded(shouldResume):
            guard wasPlayingBeforeInterruption, !userPausedDuringInterruption else { return .none }
            return shouldResume ? .resume : .stayPaused
        case .outputDeviceLost:
            return .pauseLocally
        case .mediaServicesReset:
            return .rebuildSession
        }
    }
}

/// Configures `AVAudioSession` for long-form music playback and translates its
/// notifications into `InterruptionPolicy.Event`s.
@MainActor
final class AudioSessionManager {
    var onEvent: ((InterruptionPolicy.Event) -> Void)?

    private let session = AVAudioSession.sharedInstance()
    private var tokens: [any NSObjectProtocol] = []
    private(set) var isActive = false

    init() {
        observeNotifications()
    }

    /// `.playback` keeps audio running with the silent switch on, in the
    /// background, and on the lock screen (with the `audio` background mode).
    /// `.longFormAudio` routes like Music/Podcasts (AirPlay, CarPlay hand-off).
    func configure() {
        do {
            try session.setCategory(.playback, mode: .default, policy: .longFormAudio)
        } catch {
            Log.audioSession.error("setCategory failed: \(String(describing: error), privacy: .public)")
        }
    }

    func activate() {
        guard !isActive else { return }
        do {
            try session.setActive(true)
            isActive = true
        } catch {
            Log.audioSession.error("Activating audio session failed: \(String(describing: error), privacy: .public)")
        }
    }

    func deactivate() {
        guard isActive else { return }
        do {
            try session.setActive(false, options: .notifyOthersOnDeactivation)
            isActive = false
        } catch {
            Log.audioSession.error("Deactivating audio session failed: \(String(describing: error), privacy: .public)")
        }
    }

    private func observeNotifications() {
        let center = NotificationCenter.default
        tokens.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: session, queue: .main) { [weak self] note in
            let typeValue = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            let optionsValue = note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt
            MainActor.assumeIsolated {
                guard let typeValue, let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }
                switch type {
                case .began:
                    self?.isActive = false
                    self?.onEvent?(.interruptionBegan)
                case .ended:
                    let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue ?? 0)
                    self?.onEvent?(.interruptionEnded(shouldResume: options.contains(.shouldResume)))
                @unknown default:
                    break
                }
            }
        })
        tokens.append(center.addObserver(forName: AVAudioSession.routeChangeNotification, object: session, queue: .main) { [weak self] note in
            let reasonValue = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
            MainActor.assumeIsolated {
                guard let reasonValue, let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else { return }
                if reason == .oldDeviceUnavailable {
                    self?.onEvent?(.outputDeviceLost)
                }
            }
        })
        tokens.append(center.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: session, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.isActive = false
                self.configure()
                self.onEvent?(.mediaServicesReset)
            }
        })
    }
}
