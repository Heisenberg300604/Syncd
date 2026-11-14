import Foundation

enum RoomConnectionState: Equatable, Sendable {
    case idle
    case connecting
    /// Socket connected *and* `room:join` acknowledged.
    case connected
    /// `reason` is the last handshake failure, in user-facing words, when known.
    case reconnecting(attempt: Int, reason: String?)
    /// Not recoverable by retrying (room deleted, membership revoked).
    case failed(String)

    var isConnected: Bool { self == .connected }

    var failureReason: String? {
        switch self {
        case let .reconnecting(_, reason): reason
        case let .failed(message): message
        default: nil
        }
    }
}

/// A playback snapshot plus the local times bracketing it, for clock estimation.
/// `sentAt` is set only for snapshots that came back on an ack.
struct TimedPlayback: Sendable, Equatable {
    let snapshot: PlaybackSnapshot
    let sentAt: Date?
    let receivedAt: Date
}

struct RoomJoinSnapshot: Sendable {
    let presence: PresenceSnapshot
    let playback: TimedPlayback?
    let messages: [ChatMessage]
    let queue: [QueueItem]
}

enum RoomEvent: Sendable {
    /// Fired on the first join and again after every reconnect.
    case joined(RoomJoinSnapshot)
    case presence(PresenceSnapshot)
    case playback(TimedPlayback)
    case queue([QueueItem])
    case chat(ChatMessage)
    case hostUpdate(HostUpdate)
    case hostPending(HostPending)
    case connection(RoomConnectionState)
}

/// One authenticated realtime session for one room, mirroring the server's
/// one-room-per-socket model. Create a new instance per room.
@MainActor
protocol RoomRealtimeClient: AnyObject {
    /// Single-consumer stream; finishes after `disconnect()`.
    var events: AsyncStream<RoomEvent> { get }
    var connectionState: RoomConnectionState { get }

    func connect()
    /// Emits `room:leave` (best effort) and closes the socket.
    func disconnect()
    /// Skip any pending backoff, e.g. on app foreground or network return.
    func reconnectNow()

    func setTrack(_ track: TrackInput) async throws(SocketError) -> TimedPlayback
    func control(_ action: PlaybackAction, position: TimeInterval) async throws(SocketError) -> TimedPlayback
    func clearPlayback() async throws(SocketError) -> TimedPlayback

    func enqueue(_ track: QueueItem, atFront: Bool) async throws(SocketError) -> [QueueItem]
    func removeFromQueue(at index: Int) async throws(SocketError) -> [QueueItem]
    func moveInQueue(from: Int, to: Int) async throws(SocketError) -> [QueueItem]
    func advanceQueue(expectedFrontVideoId: String?) async throws(SocketError) -> [QueueItem]
    func clearQueue() async throws(SocketError) -> [QueueItem]

    func sendChat(_ content: String) async throws(SocketError)
    func transferHost(to userId: String) async throws(SocketError)
}
