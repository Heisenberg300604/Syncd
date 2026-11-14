import Foundation

/// Where audio comes from. Capabilities are explicit so the UI can explain
/// why something can't play in the background instead of failing silently.
enum PlaybackSource: Sendable, Hashable {
    /// A YouTube video. Must only be rendered by YouTube's official embedded
    /// player; SyncD never extracts its audio or feeds it to AVPlayer.
    case youtube(videoId: String)
    /// An authorized HTTPS stream (e.g. a future host-PC stream ticket).
    case remoteStream(URL)
    /// A file the user picked on this device. Never shared with a room.
    case localFile(URL)

    struct Capabilities: Sendable, Equatable {
        /// Can be rendered by `AVPlayerAudioEngine`.
        let nativeEngine: Bool
        /// Can be rendered by the provider's official embedded player
        /// (`YouTubeEmbedEngine`). Foreground only.
        var embeddedPlayer: Bool = false
        /// Keeps playing when the app is backgrounded or the device is locked.
        let backgroundAudio: Bool
        /// Publishes lock-screen / Control Center metadata and controls.
        let systemMediaControls: Bool
    }

    var capabilities: Capabilities {
        switch self {
        case .youtube:
            Capabilities(nativeEngine: false, embeddedPlayer: true, backgroundAudio: false, systemMediaControls: false)
        case .remoteStream, .localFile:
            Capabilities(nativeEngine: true, backgroundAudio: true, systemMediaControls: true)
        }
    }

    var displayName: String {
        switch self {
        case .youtube: "YouTube"
        case .remoteStream: "Stream"
        case .localFile: "On this iPhone"
        }
    }
}

struct PlaybackItem: Sendable, Hashable, Identifiable {
    let id: String
    let title: String
    let subtitle: String?
    let artworkURL: URL?
    /// Known up front (from the room snapshot) or discovered by the engine.
    let duration: TimeInterval?
    let source: PlaybackSource
}

/// The engine's actual state — never the last button pressed.
enum EngineState: Equatable, Sendable {
    case idle
    case loading
    case ready
    case playing
    case paused
    case buffering
    case seeking
    case ended
    case failed(PlaybackError)

    var isActivelyPlaying: Bool { self == .playing || self == .buffering }
}

enum PlaybackError: UserFacingError, Equatable {
    case unsupportedSource(String)
    case sourceUnavailable
    case unplayableFormat
    case network
    case mediaServicesReset
    case unknown(String)

    var title: String {
        switch self {
        case .unsupportedSource: "Can't play here"
        case .sourceUnavailable: "Track unavailable"
        case .unplayableFormat: "Unsupported audio"
        case .network: "Playback interrupted"
        case .mediaServicesReset: "Audio restarted"
        case .unknown: "Playback failed"
        }
    }

    var message: String {
        switch self {
        case let .unsupportedSource(reason): reason
        case .sourceUnavailable: "This track can't be reached right now."
        case .unplayableFormat: "This audio format isn't supported on iPhone."
        case .network: "The connection dropped while streaming."
        case .mediaServicesReset: "iOS restarted its audio system. Tap play to continue."
        case let .unknown(message): message
        }
    }

    var isRetryable: Bool {
        switch self {
        case .unsupportedSource, .unplayableFormat: false
        default: true
        }
    }
}
