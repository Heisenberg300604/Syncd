import Foundation

// Mirrors server/src/modules/rooms/rooms.types.ts

struct RoomUser: Codable, Sendable, Hashable, Identifiable {
    let id: String
    let username: String
}

struct RoomMember: Codable, Sendable, Hashable {
    let user: RoomUser
    let joinedAt: Date
}

/// `RoomDTO` on the server. Its playback fields are only a seed value: the
/// socket `room:join` ack and `playback:update` broadcasts are authoritative.
struct Room: Codable, Sendable, Hashable, Identifiable {
    let id: String
    let roomCode: String
    let host: RoomUser
    let members: [RoomMember]
    let currentVideoId: String?
    let currentTitle: String?
    let currentThumbnailUrl: String?
    let currentDuration: Double?
    let isPlaying: Bool
    let playbackPosition: Double
    let playbackUpdatedAt: Date?
}

struct RoomEnvelope: Decodable, Sendable {
    let room: Room
}

struct LeaveRoomResponse: Decodable, Sendable {
    let left: Bool
}

/// Mirrors server/src/modules/rooms/rooms.validation.ts.
enum RoomCode {
    static let length = 6
    /// Unambiguous alphabet: no O/0/I/1/L.
    static let alphabet = Set("ABCDEFGHJKMNPQRSTUVWXYZ23456789")

    /// Upper-cases and trims, the same normalisation the server applies.
    static func normalize(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    }

    /// The server accepts any `[A-Z0-9]{6}` and answers 404 for unknown codes,
    /// so the client only checks shape.
    static func validationMessage(for raw: String) -> String? {
        let value = normalize(raw)
        if value.isEmpty { return "Room code is required" }
        if value.count != length { return "Room code must be \(length) characters" }
        let valid = value.unicodeScalars.allSatisfy { scalar in
            scalar.isASCII && CharacterSet.alphanumerics.contains(scalar)
        }
        if !valid { return "Room code can only contain letters and numbers" }
        return nil
    }
}
