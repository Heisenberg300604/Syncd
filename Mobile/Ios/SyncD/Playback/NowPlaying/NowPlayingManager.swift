import MediaPlayer
import UIKit

/// Publishes metadata to the lock screen, Control Center, CarPlay and
/// connected accessories via `MPNowPlayingInfoCenter`. Only used for sources
/// whose capabilities include `systemMediaControls`.
@MainActor
final class NowPlayingManager {
    private let center = MPNowPlayingInfoCenter.default()
    private let session: URLSession
    private var artworkTask: Task<Void, Never>?
    private var artworkURL: URL?
    private var artwork: MPMediaItemArtwork?

    init(session: URLSession = .shared) {
        self.session = session
    }

    func update(item: PlaybackItem, elapsed: TimeInterval, duration: TimeInterval?, isPlaying: Bool, rate: Double) {
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: item.title,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: max(0, elapsed),
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? rate : 0,
            MPNowPlayingInfoPropertyDefaultPlaybackRate: 1.0,
            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
        ]
        if let subtitle = item.subtitle { info[MPMediaItemPropertyArtist] = subtitle }
        if let duration, duration > 0 { info[MPMediaItemPropertyPlaybackDuration] = duration }

        if item.artworkURL != artworkURL {
            artworkURL = item.artworkURL
            artwork = nil
            loadArtwork(item.artworkURL)
        }
        if let artwork { info[MPMediaItemPropertyArtwork] = artwork }

        center.nowPlayingInfo = info
        center.playbackState = isPlaying ? .playing : .paused
    }

    func clear() {
        artworkTask?.cancel()
        artworkURL = nil
        artwork = nil
        center.nowPlayingInfo = nil
        center.playbackState = .stopped
    }

    /// MediaPlayer calls the request handler on a background queue, so the
    /// closure must not be formed inside a `@MainActor` method.
    nonisolated private static func makeArtwork(_ image: UIImage) -> MPMediaItemArtwork {
        MPMediaItemArtwork(boundsSize: image.size) { _ in image }
    }

    private func loadArtwork(_ url: URL?) {
        artworkTask?.cancel()
        guard let url else { return }
        artworkTask = Task { [weak self, session] in
            guard
                let (data, _) = try? await session.data(from: url),
                let image = UIImage(data: data),
                !Task.isCancelled,
                let self,
                self.artworkURL == url
            else { return }
            let artwork = Self.makeArtwork(image)
            self.artwork = artwork
            if var info = self.center.nowPlayingInfo {
                info[MPMediaItemPropertyArtwork] = artwork
                self.center.nowPlayingInfo = info
            }
        }
    }
}
