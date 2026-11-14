import Foundation
import Observation

/// Live state for the one room this device is in. Consumes realtime events,
/// keeps presence / queue / chat / host state, and forwards playback
/// snapshots to the `PlaybackCoordinator`. Lives in `RoomsController`, not in
/// a view, so navigating away never drops the subscription.
@MainActor
@Observable
final class RoomSession: RoomPlaybackCommanding {
    let roomCode: String
    let currentUserId: String

    private(set) var room: Room
    private(set) var members: [PresenceMember]
    private(set) var hostUserId: String
    private(set) var queue: [QueueItem] = []
    private(set) var messages: [ChatMessage] = []
    private(set) var connection: RoomConnectionState = .idle
    private(set) var hostPending: HostPending?
    private(set) var hostNotice: HostUpdate?
    /// `true` after the first `room:join` ack. Before that, presence and
    /// queue are seed values from REST.
    private(set) var hasJoined = false

    var isHost: Bool { hostUserId == currentUserId }

    var hostUsername: String {
        members.first { $0.userId == hostUserId }?.username ?? room.host.username
    }

    var onlineCount: Int { members.filter(\.online).count }

    @ObservationIgnored private let client: any RoomRealtimeClient
    @ObservationIgnored private let playback: PlaybackCoordinator
    @ObservationIgnored private var eventsTask: Task<Void, Never>?

    static let messageCap = 500

    init(room: Room, currentUserId: String, client: any RoomRealtimeClient, playback: PlaybackCoordinator) {
        self.room = room
        self.roomCode = room.roomCode
        self.currentUserId = currentUserId
        self.client = client
        self.playback = playback
        self.hostUserId = room.host.id
        // Until presence arrives, show REST membership with unknown online state.
        self.members = room.members.map { PresenceMember(userId: $0.user.id, username: $0.user.username, online: false) }
    }

    func start() {
        playback.attachRoom(code: roomCode, commander: self)
        playback.updateRole(isHost: isHost)
        let events = client.events
        eventsTask = Task { [weak self] in
            for await event in events {
                self?.handle(event)
            }
        }
        client.connect()
    }

    /// Unsubscribes and stops room playback. Does not remove membership.
    func stop() {
        eventsTask?.cancel()
        eventsTask = nil
        client.disconnect()
        playback.detachRoom()
    }

    func reconnectIfNeeded() {
        client.reconnectNow()
        playback.handleBecameActive()
    }

    func dismissHostNotice() {
        hostNotice = nil
    }

    // MARK: Events

    func handle(_ event: RoomEvent) {
        switch event {
        case let .joined(snapshot):
            hasJoined = true
            applyPresence(snapshot.presence)
            queue = snapshot.queue
            messages = Self.merge(messages, snapshot.messages)
            if let playbackSnapshot = snapshot.playback {
                playback.applyRoomSnapshot(playbackSnapshot, isResync: true)
            }
        case let .presence(presence):
            applyPresence(presence)
        case let .playback(timed):
            playback.applyRoomSnapshot(timed, isResync: false)
        case let .queue(items):
            queue = items
        case let .chat(message):
            messages = Self.merge(messages, [message])
        case let .hostUpdate(update):
            hostUserId = update.hostUserId
            hostNotice = update
            hostPending = nil
            playback.updateRole(isHost: isHost)
        case let .hostPending(pending):
            hostPending = pending.pending ? pending : nil
        case let .connection(state):
            connection = state
        }
    }

    private func applyPresence(_ presence: PresenceSnapshot) {
        members = presence.members
        hostUserId = presence.hostUserId
        playback.updateRole(isHost: isHost)
    }

    /// Merges by id instead of replacing, so a reconnect's history snapshot
    /// can't drop a message that already arrived live (same rule as web).
    static func merge(_ existing: [ChatMessage], _ incoming: [ChatMessage]) -> [ChatMessage] {
        guard !incoming.isEmpty else { return existing }
        var byId = Dictionary(existing.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        for message in incoming { byId[message.id] = message }
        let sorted = byId.values.sorted { ($0.createdAt, $0.id) < ($1.createdAt, $1.id) }
        return Array(sorted.suffix(messageCap))
    }

    // MARK: Intents — the server enforces host-only rules; errors surface to the caller.

    func playNow(_ track: TrackInput) async throws(SocketError) {
        let timed = try await client.setTrack(track)
        playback.applyRoomSnapshot(timed, isResync: false)
    }

    func enqueue(_ track: TrackInput, atFront: Bool = false) async throws(SocketError) {
        queue = try await client.enqueue(track, atFront: atFront)
    }

    func removeFromQueue(at index: Int) async throws(SocketError) {
        queue = try await client.removeFromQueue(at: index)
    }

    func moveInQueue(from: Int, to: Int) async throws(SocketError) {
        queue = try await client.moveInQueue(from: from, to: to)
    }

    func clearQueue() async throws(SocketError) {
        queue = try await client.clearQueue()
    }

    func stopPlayback() async throws(SocketError) {
        let timed = try await client.clearPlayback()
        playback.applyRoomSnapshot(timed, isResync: false)
    }

    func sendChat(_ content: String) async throws(SocketError) {
        try await client.sendChat(content)
    }

    func transferHost(to userId: String) async throws(SocketError) {
        try await client.transferHost(to: userId)
    }

    // MARK: RoomPlaybackCommanding

    func sendPlaybackControl(_ action: PlaybackAction, position: TimeInterval) async throws(SocketError) -> TimedPlayback {
        try await client.control(action, position: position)
    }

    func sendAdvanceQueue() async throws(SocketError) {
        queue = try await client.advanceQueue(expectedFrontVideoId: queue.first?.videoId)
    }
}
