import Foundation

// Mirrors server/src/modules/music/music.types.ts

struct TrackSearchResult: Codable, Sendable, Hashable, Identifiable {
    let videoId: String
    let title: String
    let channelTitle: String
    let thumbnailUrl: String
    /// ISO 8601, e.g. "PT3M45S".
    let duration: String

    var id: String { videoId }

    var trackInput: TrackInput {
        TrackInput(videoId: videoId, title: title, thumbnailUrl: thumbnailUrl, duration: duration)
    }
}

struct TrackSearchResponse: Decodable, Sendable {
    let results: [TrackSearchResult]
}

struct TrackResolveResponse: Decodable, Sendable {
    let result: TrackSearchResult
}

struct PlaylistResolveResponse: Decodable, Sendable {
    let results: [TrackSearchResult]
    let playlistTitle: String?
}
