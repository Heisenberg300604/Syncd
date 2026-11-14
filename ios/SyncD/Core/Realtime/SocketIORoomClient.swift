import Foundation
import Network
@preconcurrency import SocketIO

/// Socket.IO implementation of `RoomRealtimeClient`.
///
/// Reconnection is owned here rather than by Socket.IO: the server verifies
/// the Clerk token only during the handshake, and Clerk tokens expire after
/// ~60 s, so every attempt must carry a freshly minted token. Socket.IO's
/// built-in reconnect would replay the original (expired) one.
@MainActor
final class SocketIORoomClient: RoomRealtimeClient {
    let events: AsyncStream<RoomEvent>
    private(set) var connectionState: RoomConnectionState = .idle {
        didSet {
            guard connectionState != oldValue else { return }
            continuation.yield(.connection(connectionState))
        }
    }

    private let roomCode: String
    private let socketURL: URL
    private let tokenProvider: AuthTokenProvider
    private let clock: any MonotonicClock
    private let continuation: AsyncStream<RoomEvent>.Continuation

    private var manager: SocketManager?
    private var socket: SocketIOClient?
    private var connectTask: Task<Void, Never>?
    private var attempt = 0
    private var isClosed = false
    /// `.error` and `.disconnect` can both fire for one failure; only the first schedules.
    private var reconnectPending = false
    /// Why the last attempt failed, shown while retrying.
    private var lastFailureReason: String?
    private let pathMonitor = NWPathMonitor()

    static let ackTimeout: Double = 10
    static let maxBackoff: Double = 30

    init(roomCode: String, socketURL: URL, clock: any MonotonicClock, tokenProvider: @escaping AuthTokenProvider) {
        self.roomCode = roomCode
        self.socketURL = socketURL
        self.clock = clock
        self.tokenProvider = tokenProvider
        (events, continuation) = AsyncStream.makeStream(of: RoomEvent.self, bufferingPolicy: .bufferingNewest(256))
        startPathMonitor()
    }

    // MARK: Lifecycle

    func connect() {
        guard !isClosed else { return }
        attempt = 0
        openSocket(after: 0)
    }

    func reconnectNow() {
        // Only short-circuits a pending backoff. NWPathMonitor reports the
        // current path immediately on start, before `connect()` is called.
        guard !isClosed, case .reconnecting = connectionState else { return }
        reconnectPending = false
        openSocket(after: 0)
    }

    func disconnect() {
        guard !isClosed else { return }
        isClosed = true
        pathMonitor.cancel()
        connectTask?.cancel()
        if let socket, socket.status == .connected, let payload = try? JSONCoding.jsonObject(from: RoomCodePayload(roomCode: roomCode)) {
            socket.emit("room:leave", payload)
        }
        tearDownSocket()
        connectionState = .idle
        continuation.finish()
    }

    private func openSocket(after delay: Double) {
        connectTask?.cancel()
        tearDownSocket()
        connectionState = attempt == 0 ? .connecting : .reconnecting(attempt: attempt, reason: lastFailureReason)
        let forceRefresh = attempt > 0

        connectTask = Task { [weak self, tokenProvider] in
            if delay > 0 {
                try? await Task.sleep(for: .seconds(delay))
            }
            guard !Task.isCancelled else { return }
            let token: String?
            do {
                token = try await tokenProvider(forceRefresh)
            } catch {
                token = nil
            }
            guard let self, !Task.isCancelled, !self.isClosed else { return }
            guard let token, !token.isEmpty else {
                Log.socket.error("No auth token for socket handshake")
                self.lastFailureReason = "Your session couldn't be refreshed. Check your connection, or sign out and back in."
                self.scheduleReconnect()
                return
            }
            self.startSocket(token: token)
        }
    }

    private func startSocket(token: String) {
        reconnectPending = false
        let manager = SocketManager(socketURL: socketURL, config: [
            .log(false),
            .compress,
            .forceWebsockets(true), // matches the web client's transports: ["websocket"]
            .reconnects(false),
            .version(.three),       // Socket.IO v3/v4 protocol
        ])
        let socket = manager.defaultSocket
        self.manager = manager
        self.socket = socket
        registerHandlers(on: socket)
        socket.connect(withPayload: ["token": token], timeoutAfter: 15) { [weak self] in
            MainActor.assumeIsolated {
                Log.socket.error("Socket connect timed out")
                self?.scheduleReconnect()
            }
        }
    }

    private func tearDownSocket() {
        socket?.removeAllHandlers()
        socket?.disconnect()
        manager?.disconnect()
        socket = nil
        manager = nil
    }

    private func scheduleReconnect() {
        guard !isClosed, !reconnectPending else { return }
        if case .failed = connectionState { return }
        reconnectPending = true
        attempt += 1
        let base = min(Self.maxBackoff, pow(2, Double(min(attempt - 1, 5))))
        let delay = base * Double.random(in: 0.8...1.2)
        Log.socket.info("Reconnecting in \(delay, format: .fixed(precision: 1), privacy: .public)s (attempt \(self.attempt, privacy: .public))")
        openSocket(after: delay)
    }

    private func startPathMonitor() {
        pathMonitor.pathUpdateHandler = Self.makePathHandler { [weak self] in
            Task { @MainActor [weak self] in self?.reconnectNow() }
        }
        pathMonitor.start(queue: DispatchQueue(label: "syncd.socket.path"))
    }

    /// Runs on the monitor's queue, so it must not be main-actor isolated.
    nonisolated private static func makePathHandler(onSatisfied: @escaping @Sendable () -> Void) -> @Sendable (NWPath) -> Void {
        { path in
            if path.status == .satisfied { onSatisfied() }
        }
    }

    // MARK: Incoming events

    private func registerHandlers(on socket: SocketIOClient) {
        socket.on(clientEvent: .connect) { [weak self] _, _ in
            MainActor.assumeIsolated { self?.joinRoom() }
        }
        socket.on(clientEvent: .disconnect) { [weak self] _, _ in
            MainActor.assumeIsolated {
                guard let self, !self.isClosed else { return }
                Log.socket.info("Socket disconnected")
                self.scheduleReconnect()
            }
        }
        socket.on(clientEvent: .error) { [weak self] data, _ in
            // Handshake rejections arrive here (e.g. "User profile not found",
            // expired token). Never log the payload — it can echo the token.
            let description = Self.errorMessage(from: data)
            MainActor.assumeIsolated {
                guard let self, !self.isClosed, !self.connectionState.isConnected else { return }
                Log.socket.error("Socket error during connect: \(description, privacy: .private)")
                self.lastFailureReason = Self.describeConnectError(description)
                self.scheduleReconnect()
            }
        }

        on(socket, "presence:update", PresenceSnapshot.self) { .presence($0) }
        on(socket, "queue:update", [QueueItem].self) { .queue($0) }
        on(socket, "chat:new", ChatMessage.self) { .chat($0) }
        on(socket, "host:update", HostUpdate.self) { .hostUpdate($0) }
        on(socket, "host:pending", HostPending.self) { .hostPending($0) }
        socket.on("playback:update") { [weak self] data, _ in
            let decoded = Self.decodeFirst(PlaybackSnapshot.self, from: data, event: "playback:update")
            MainActor.assumeIsolated {
                guard let self, let snapshot = decoded else { return }
                self.continuation.yield(.playback(TimedPlayback(snapshot: snapshot, sentAt: nil, receivedAt: self.clock.now())))
            }
        }
    }

    /// Registers a decode-validate-yield handler. Malformed payloads are dropped
    /// and logged, never forwarded.
    private func on<T: Decodable & Sendable>(
        _ socket: SocketIOClient,
        _ event: String,
        _ type: T.Type,
        _ makeEvent: @escaping @Sendable (T) -> RoomEvent
    ) {
        socket.on(event) { [weak self] data, _ in
            let decoded = Self.decodeFirst(type, from: data, event: event)
            MainActor.assumeIsolated {
                guard let self, let value = decoded else { return }
                self.continuation.yield(makeEvent(value))
            }
        }
    }

    /// Socket.IO v4 delivers a handshake rejection (`next(new Error(msg))` on
    /// the server) as `{ message: msg }`; transport failures arrive as strings
    /// or errors. Reads every shape so the real reason reaches the UI.
    nonisolated static func errorMessage(from data: [Any]) -> String {
        guard let first = data.first else { return "No details from the server" }
        if let text = first as? String { return text }
        if let object = first as? [String: Any] {
            if let message = object["message"] as? String { return message }
            if let nested = object["data"] as? [String: Any], let message = nested["message"] as? String { return message }
        }
        if let error = first as? any Error { return error.localizedDescription }
        return String(describing: first)
    }

    /// Turns the server's handshake rejection (see `io.use` in
    /// server/src/sockets/index.ts) into something a person can act on.
    nonisolated static func describeConnectError(_ raw: String) -> String {
        let lower = raw.lowercased()
        if lower.contains("authorized party") || lower.contains("azp") || lower.contains("unauthorized party") {
            return "The server rejected this app's sign-in token. Its socket check only accepts tokens from the web app's address, so the server needs to allow native-app tokens."
        }
        if lower.contains("profile not found") {
            return "Your SyncD profile wasn't found on this server. Finish onboarding, then try again."
        }
        if lower.contains("expired") || lower.contains("missing auth token") || lower.contains("invalid token") {
            return "Your session token was rejected. Retrying with a fresh one…"
        }
        if lower.contains("timeout") || lower.contains("websocket") || lower.contains("could not connect") || lower.contains("refused") {
            return "Can't reach the room server. Check that it's running and reachable from this device."
        }
        return "The server refused the connection: \(raw)"
    }

    nonisolated private static func decodeFirst<T: Decodable>(_ type: T.Type, from data: [Any], event: String) -> T? {
        guard let first = data.first else { return nil }
        do {
            return try JSONCoding.decode(type, fromJSONObject: first)
        } catch {
            Log.socket.error("Dropped malformed \(event, privacy: .public): \(String(describing: error), privacy: .private)")
            return nil
        }
    }

    private func joinRoom() {
        Task { [weak self] in
            guard let self else { return }
            do {
                let (ack, sentAt, receivedAt) = try await self.emit(
                    "room:join", RoomCodePayload(roomCode: self.roomCode), ack: RoomJoinAck.self, requireJoined: false
                )
                guard ack.ok, let presence = ack.presence else {
                    let message = ack.message ?? "Could not join the room"
                    Log.socket.error("room:join rejected: \(message, privacy: .public)")
                    self.connectionState = .failed(message)
                    self.tearDownSocket()
                    return
                }
                self.attempt = 0
                self.lastFailureReason = nil
                self.connectionState = .connected
                self.continuation.yield(.joined(RoomJoinSnapshot(
                    presence: presence,
                    playback: ack.playback.map { TimedPlayback(snapshot: $0, sentAt: sentAt, receivedAt: receivedAt) },
                    messages: ack.messages ?? [],
                    queue: ack.queue ?? []
                )))
            } catch {
                Log.socket.error("room:join failed: \(PresentableError(error).title, privacy: .public)")
                self.scheduleReconnect()
            }
        }
    }

    // MARK: Outgoing commands

    func setTrack(_ track: TrackInput) async throws(SocketError) -> TimedPlayback {
        try await playbackCommand("playback:set", PlaybackSetPayload(roomCode: roomCode, track: track))
    }

    func control(_ action: PlaybackAction, position: TimeInterval) async throws(SocketError) -> TimedPlayback {
        try await playbackCommand("playback:control", PlaybackControlPayload(
            roomCode: roomCode, action: action, position: max(0, position.isFinite ? position : 0)
        ))
    }

    func clearPlayback() async throws(SocketError) -> TimedPlayback {
        try await playbackCommand("playback:clear", RoomCodePayload(roomCode: roomCode))
    }

    func enqueue(_ track: QueueItem, atFront: Bool) async throws(SocketError) -> [QueueItem] {
        try await queueCommand(atFront ? "queue:prepend" : "queue:add", QueueAddPayload(roomCode: roomCode, track: track))
    }

    func removeFromQueue(at index: Int) async throws(SocketError) -> [QueueItem] {
        try await queueCommand("queue:remove", QueueRemovePayload(roomCode: roomCode, index: index))
    }

    func moveInQueue(from: Int, to: Int) async throws(SocketError) -> [QueueItem] {
        try await queueCommand("queue:reorder", QueueReorderPayload(roomCode: roomCode, fromIndex: from, toIndex: to))
    }

    func advanceQueue(expectedFrontVideoId: String?) async throws(SocketError) -> [QueueItem] {
        try await queueCommand("queue:advance", QueueAdvancePayload(roomCode: roomCode, expectedFrontVideoId: expectedFrontVideoId))
    }

    func clearQueue() async throws(SocketError) -> [QueueItem] {
        try await queueCommand("queue:clear", RoomCodePayload(roomCode: roomCode))
    }

    func sendChat(_ content: String) async throws(SocketError) {
        let (ack, _, _) = try await emit("chat:send", ChatSendPayload(roomCode: roomCode, content: content), ack: SimpleAck.self)
        guard ack.ok else { throw .rejected(ack.message ?? "Could not send message") }
    }

    func transferHost(to userId: String) async throws(SocketError) {
        let (ack, _, _) = try await emit("host:transfer", HostTransferPayload(roomCode: roomCode, userId: userId), ack: SimpleAck.self)
        guard ack.ok else { throw .rejected(ack.message ?? "Could not transfer host") }
    }

    private func playbackCommand<P: Encodable>(_ event: String, _ payload: P) async throws(SocketError) -> TimedPlayback {
        let (ack, sentAt, receivedAt) = try await emit(event, payload, ack: PlaybackAck.self)
        guard ack.ok, let snapshot = ack.playback else { throw .rejected(ack.message ?? "Playback update failed") }
        return TimedPlayback(snapshot: snapshot, sentAt: sentAt, receivedAt: receivedAt)
    }

    private func queueCommand<P: Encodable>(_ event: String, _ payload: P) async throws(SocketError) -> [QueueItem] {
        let (ack, _, _) = try await emit(event, payload, ack: QueueAck.self)
        guard ack.ok, let queue = ack.queue else {
            let message = ack.message ?? "Queue update failed"
            throw ack.code == "QUEUE_FULL" ? .queueFull(message) : .rejected(message)
        }
        return queue
    }

    /// Emits with an ack and a timeout. The ack payload is converted to `Data`
    /// inside the Socket.IO callback so nothing non-Sendable crosses isolation.
    private func emit<P: Encodable, A: Decodable>(
        _ event: String,
        _ payload: P,
        ack: A.Type,
        requireJoined: Bool = true
    ) async throws(SocketError) -> (A, sentAt: Date, receivedAt: Date) {
        guard let socket, socket.status == .connected, !requireJoined || connectionState.isConnected else {
            throw .notConnected
        }
        guard let object = try? JSONCoding.jsonObject(from: payload) else {
            throw .malformedPayload(event: event)
        }

        let sentAt = clock.now()
        let result: Result<Data, SocketError> = await withCheckedContinuation { continuation in
            socket.emitWithAck(event, object).timingOut(after: Self.ackTimeout) { items in
                if let status = items.first as? String, status == SocketAckStatus.noAck.rawValue {
                    continuation.resume(returning: .failure(.ackTimeout(event: event)))
                    return
                }
                guard let first = items.first, let data = try? JSONSerialization.data(withJSONObject: first) else {
                    continuation.resume(returning: .failure(.malformedPayload(event: event)))
                    return
                }
                continuation.resume(returning: .success(data))
            }
        }
        let receivedAt = clock.now()

        switch result {
        case let .failure(error):
            throw error
        case let .success(data):
            do {
                return (try JSONCoding.makeDecoder().decode(A.self, from: data), sentAt, receivedAt)
            } catch {
                Log.socket.error("Malformed ack for \(event, privacy: .public)")
                throw .malformedPayload(event: event)
            }
        }
    }
}
