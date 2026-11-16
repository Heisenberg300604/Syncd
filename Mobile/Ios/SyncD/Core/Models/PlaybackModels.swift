import Foundation

// Mirrors server/src/modules/playback/playback.types.ts

/// The room's shared playback state.
///
/// `position` is the playhead in seconds as of `updatedAt`. While playing,
/// clients add `serverNow - updatedAt` — never `deviceNow - updatedAt`.
struct PlaybackSnapshot: Codable, Sendable, Hashable {
    let videoId: String?
    let title: String?
    let thumbnailUrl: String?
    let duration: Double?
    let isPlaying: Bool
    let position: Double
    let updatedAt: Date?
    let serverTime: Date
}

/// `PlaybackTrackInput` / `QueueItem` share this shape on the server.
struct TrackInput: Codable, Sendable, Hashable {
    let videoId: String
    let title: String
    let thumbnailUrl: String
    /// ISO 8601 duration as returned by the YouTube Data API, e.g. "PT3M45S".
    let duration: String
}

enum PlaybackAction: String, Codable, Sendable {
    case play, pause, seek
}

// MARK: Socket payloads (client → server)

struct RoomCodePayload: Encodable, Sendable {
    let roomCode: String
}

struct PlaybackSetPayload: Encodable, Sendable {
    let roomCode: String
    let track: TrackInput
}

struct PlaybackControlPayload: Encodable, Sendable {
    let roomCode: String
    let action: PlaybackAction
    let position: Double
}

/// `{ ok: true, playback } | { ok: false, message }`
struct PlaybackAck: Decodable, Sendable {
    let ok: Bool
    let playback: PlaybackSnapshot?
    let message: String?
}
