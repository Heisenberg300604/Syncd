import Foundation

// Mirrors server/src/sockets/{presence,queue,host}.types.ts and
// server/src/modules/messages/messages.types.ts

// MARK: Presence

struct PresenceMember: Codable, Sendable, Hashable, Identifiable {
    let userId: String
    let username: String
    let online: Bool

    var id: String { userId }
}

struct PresenceSnapshot: Codable, Sendable, Hashable {
    let members: [PresenceMember]
    /// Authoritative host at the moment of the broadcast.
    let hostUserId: String
}

/// `room:join` ack. `{ ok: false, message }` is decoded into the same type.
struct RoomJoinAck: Decodable, Sendable {
    let ok: Bool
    let message: String?
    let presence: PresenceSnapshot?
    let playback: PlaybackSnapshot?
    let messages: [ChatMessage]?
    let queue: [QueueItem]?
}

// MARK: Queue

typealias QueueItem = TrackInput

struct QueueAddPayload: Encodable, Sendable {
    let roomCode: String
    let track: QueueItem
}

struct QueueRemovePayload: Encodable, Sendable {
    let roomCode: String
    let index: Int
}

struct QueueReorderPayload: Encodable, Sendable {
    let roomCode: String
    let fromIndex: Int
    let toIndex: Int
}

struct QueueAdvancePayload: Encodable, Sendable {
    let roomCode: String
    /// Idempotency guard — the server no-ops when the front no longer matches.
    let expectedFrontVideoId: String?
}

/// `{ ok: true, queue } | { ok: false, message, code?: "QUEUE_FULL" }`
struct QueueAck: Decodable, Sendable {
    let ok: Bool
    let queue: [QueueItem]?
    let message: String?
    let code: String?
}

// MARK: Chat

struct ChatMessage: Codable, Sendable, Hashable, Identifiable {
    let id: String
    let roomId: String
    let userId: String
    let username: String
    let content: String
    let createdAt: Date
}

struct ChatSendPayload: Encodable, Sendable {
    let roomCode: String
    let content: String
}

/// Mirrors server/src/modules/messages/messages.validation.ts.
enum ChatRules {
    static let maxLength = 500
}

/// `{ ok: true } | { ok: false, message }` — also used by `host:transfer`.
struct SimpleAck: Decodable, Sendable {
    let ok: Bool
    let message: String?
}

// MARK: Host

enum HostChangeReason: String, Codable, Sendable {
    case manual, disconnect, left
}

struct HostUpdate: Codable, Sendable, Hashable {
    let hostUserId: String
    let hostUsername: String
    let previousHostUserId: String
    let previousHostUsername: String
    let reason: HostChangeReason
}

struct HostPending: Codable, Sendable, Hashable {
    let pending: Bool
    let hostUserId: String
    let hostUsername: String
    let successorUsername: String?
    let deadline: Date?
}

struct HostTransferPayload: Encodable, Sendable {
    let roomCode: String
    let userId: String
}
