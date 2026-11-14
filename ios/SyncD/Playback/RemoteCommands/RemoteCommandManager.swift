import MediaPlayer

/// The coordinator's command surface. Lock screen, Control Center, headphone
/// buttons and in-app controls all call these same methods, so system
/// controls cannot bypass room permissions.
@MainActor
protocol PlaybackCommandHandling: AnyObject {
    func play()
    func pause()
    func togglePlayPause()
    func skipToNext()
    func seek(to position: TimeInterval)
}

/// Registers `MPRemoteCommandCenter` handlers once and toggles their
/// availability as permissions and sources change.
@MainActor
final class RemoteCommandManager {
    weak var handler: (any PlaybackCommandHandling)?

    private let center = MPRemoteCommandCenter.shared()
    private var targets: [(MPRemoteCommand, Any)] = []

    struct Availability: Equatable {
        var playPause: Bool
        var next: Bool
        var seek: Bool

        static let none = Availability(playPause: false, next: false, seek: false)
    }

    func activate() {
        guard targets.isEmpty else { return }
        add(center.playCommand) { $0.play() }
        add(center.pauseCommand) { $0.pause() }
        add(center.togglePlayPauseCommand) { $0.togglePlayPause() }
        add(center.nextTrackCommand) { $0.skipToNext() }
        let seekTarget = center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            let position = event.positionTime
            return MainActor.assumeIsolated {
                guard let handler = self?.handler else { return .noActionableNowPlayingItem }
                handler.seek(to: position)
                return .success
            }
        }
        targets.append((center.changePlaybackPositionCommand, seekTarget))
        // The backend keeps no play history, so "previous" is never offered.
        center.previousTrackCommand.isEnabled = false
        center.skipBackwardCommand.isEnabled = false
        center.skipForwardCommand.isEnabled = false
    }

    func update(_ availability: Availability) {
        center.playCommand.isEnabled = availability.playPause
        center.pauseCommand.isEnabled = availability.playPause
        center.togglePlayPauseCommand.isEnabled = availability.playPause
        center.nextTrackCommand.isEnabled = availability.next
        center.changePlaybackPositionCommand.isEnabled = availability.seek
    }

    func deactivate() {
        for (command, target) in targets {
            command.removeTarget(target)
        }
        targets.removeAll()
        update(.none)
    }

    private func add(_ command: MPRemoteCommand, _ action: @escaping @MainActor (any PlaybackCommandHandling) -> Void) {
        let target = command.addTarget { [weak self] _ in
            MainActor.assumeIsolated {
                guard let handler = self?.handler else { return .noActionableNowPlayingItem }
                action(handler)
                return .success
            }
        }
        targets.append((command, target))
    }
}
