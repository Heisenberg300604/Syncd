import Foundation
import Testing
@testable import SyncD

/// A scriptable realtime client for exercising `RoomSession`.
@MainActor
final class FakeRealtimeClient: RoomRealtimeClient {
    let events: AsyncStream<RoomEvent>
    private let continuation: AsyncStream<RoomEvent>.Continuation
    var connectionState: RoomConnectionState = .idle
    private(set) var connectCount = 0
    private(set) var disconnectCount = 0
    var advanceExpectations: [String?] = []
    var queueAfterAdvance: [QueueItem] = []

    init() {
        (events, continuation) = AsyncStream.makeStream(of: RoomEvent.self)
    }

    func emit(_ event: RoomEvent) { continuation.yield(event) }

    func connect() { connectCount += 1 }
    func disconnect() { disconnectCount += 1; continuation.finish() }
    func reconnectNow() {}

    func setTrack(_ track: TrackInput) async throws(SocketError) -> TimedPlayback { throw .notConnected }
    func control(_ action: PlaybackAction, position: TimeInterval) async throws(SocketError) -> TimedPlayback { throw .notConnected }
    func clearPlayback() async throws(SocketError) -> TimedPlayback { throw .notConnected }
    func enqueue(_ track: QueueItem, atFront: Bool) async throws(SocketError) -> [QueueItem] { throw .notConnected }
    func removeFromQueue(at index: Int) async throws(SocketError) -> [QueueItem] { throw .rejected("Only the host can change the queue") }
    func moveInQueue(from: Int, to: Int) async throws(SocketError) -> [QueueItem] { throw .notConnected }
    func advanceQueue(expectedFrontVideoId: String?) async throws(SocketError) -> [QueueItem] {
        advanceExpectations.append(expectedFrontVideoId)
        return queueAfterAdvance
    }
    func clearQueue() async throws(SocketError) -> [QueueItem] { [] }
    func sendChat(_ content: String) async throws(SocketError) {}
    func transferHost(to userId: String) async throws(SocketError) {}
}

@MainActor
@Suite("Room session")
struct RoomSessionTests {
    let client = FakeRealtimeClient()
    let engine = MockAudioEngine()

    private func makeSession(userId: String = "u2") -> (RoomSession, PlaybackCoordinator) {
        let room = Room(
            id: "r1", roomCode: "ABC234", host: RoomUser(id: "u1", username: "arjun"),
            members: [RoomMember(user: RoomUser(id: "u1", username: "arjun"), joinedAt: Fixtures.t0),
                      RoomMember(user: RoomUser(id: "u2", username: "sarah"), joinedAt: Fixtures.t0)],
            currentVideoId: nil, currentTitle: nil, currentThumbnailUrl: nil, currentDuration: nil,
            isPlaying: false, playbackPosition: 0, playbackUpdatedAt: nil
        )
        let coordinator = PlaybackCoordinator(engine: engine, audioSession: nil, nowPlaying: nil, remoteCommands: nil,
                                              clock: TestClock(), resolver: RoomSourceResolver())
        let session = RoomSession(room: room, currentUserId: userId, client: client, playback: coordinator)
        return (session, coordinator)
    }

    private func message(_ id: String, at offset: TimeInterval) -> ChatMessage {
        ChatMessage(id: id, roomId: "r1", userId: "u1", username: "arjun", content: id, createdAt: Fixtures.t0.addingTimeInterval(offset))
    }

    @Test func startAttachesPlaybackAndConnectsOnce() {
        let (session, coordinator) = makeSession()
        session.start()
        #expect(client.connectCount == 1)
        #expect(coordinator.session == .room(code: "ABC234"))
    }

    @Test func joinAckSeedsAllState() async {
        let (session, coordinator) = makeSession()
        session.start()
        session.handle(.joined(RoomJoinSnapshot(
            presence: PresenceSnapshot(members: [PresenceMember(userId: "u1", username: "arjun", online: true)], hostUserId: "u1"),
            playback: Fixtures.timed(Fixtures.snapshot(), receivedAt: Fixtures.t0),
            messages: [message("m1", at: 0)],
            queue: [TrackInput(videoId: "abcdefghijk", title: "Next", thumbnailUrl: "", duration: "PT3M")]
        )))
        #expect(session.hasJoined)
        #expect(session.members.count == 1)
        #expect(session.queue.count == 1)
        #expect(session.messages.count == 1)
        #expect(coordinator.item?.id == "dQw4w9WgXcQ")
        #expect(!session.isHost)
    }

    @Test func hostIsTrackedLiveFromPresence() {
        let (session, coordinator) = makeSession(userId: "u2")
        session.start()
        #expect(!session.isHost)
        session.handle(.presence(PresenceSnapshot(members: [], hostUserId: "u2")))
        #expect(session.isHost)
        #expect(coordinator.isHost)
    }

    @Test func hostUpdateClearsPendingAndShowsNotice() {
        let (session, _) = makeSession()
        session.start()
        session.handle(.hostPending(HostPending(pending: true, hostUserId: "u1", hostUsername: "arjun", successorUsername: "sarah", deadline: Fixtures.t0)))
        #expect(session.hostPending != nil)
        session.handle(.hostUpdate(HostUpdate(hostUserId: "u2", hostUsername: "sarah", previousHostUserId: "u1", previousHostUsername: "arjun", reason: .disconnect)))
        #expect(session.hostPending == nil)
        #expect(session.hostNotice?.reason == .disconnect)
        #expect(session.isHost)
    }

    @Test func pendingFalseClearsBanner() {
        let (session, _) = makeSession()
        session.handle(.hostPending(HostPending(pending: true, hostUserId: "u1", hostUsername: "a", successorUsername: nil, deadline: nil)))
        session.handle(.hostPending(HostPending(pending: false, hostUserId: "u1", hostUsername: "a", successorUsername: nil, deadline: nil)))
        #expect(session.hostPending == nil)
    }

    @Test func reconnectHistoryMergesWithoutDroppingLiveMessages() {
        let (session, _) = makeSession()
        session.handle(.chat(message("m2", at: 2)))
        // A reconnect's snapshot that predates m2.
        session.handle(.joined(RoomJoinSnapshot(
            presence: PresenceSnapshot(members: [], hostUserId: "u1"),
            playback: nil, messages: [message("m1", at: 1)], queue: []
        )))
        #expect(session.messages.map(\.id) == ["m1", "m2"])
    }

    @Test func duplicateMessagesAreNotRepeated() {
        let (session, _) = makeSession()
        session.handle(.chat(message("m1", at: 1)))
        session.handle(.chat(message("m1", at: 1)))
        #expect(session.messages.count == 1)
    }

    @Test func messageHistoryIsCapped() {
        let many = (0..<(RoomSession.messageCap + 20)).map { message("m\($0)", at: TimeInterval($0)) }
        let merged = RoomSession.merge([], many)
        #expect(merged.count == RoomSession.messageCap)
        #expect(merged.last?.id == "m\(RoomSession.messageCap + 19)")
    }

    @Test func advanceSendsIdempotencyGuard() async throws {
        let (session, _) = makeSession()
        session.handle(.queue([TrackInput(videoId: "abcdefghijk", title: "Next", thumbnailUrl: "", duration: "PT3M")]))
        try await session.sendAdvanceQueue()
        #expect(client.advanceExpectations == ["abcdefghijk"])
        #expect(session.queue.isEmpty)
    }

    @Test func rejectedQueueMutationPropagates() async {
        let (session, _) = makeSession()
        await #expect(throws: SocketError.rejected("Only the host can change the queue")) {
            try await session.removeFromQueue(at: 0)
        }
    }

    @Test func stopDisconnectsAndDetachesPlayback() {
        let (session, coordinator) = makeSession()
        session.start()
        session.stop()
        #expect(client.disconnectCount == 1)
        #expect(coordinator.session == .none)
    }

    @Test func connectionStateIsMirrored() {
        let (session, _) = makeSession()
        session.handle(.connection(.reconnecting(attempt: 2, reason: nil)))
        #expect(session.connection == .reconnecting(attempt: 2, reason: nil))
    }
}

@MainActor
@Suite("Session store")
struct SessionStoreTests {
    final class FakeAuth: AuthProviding {
        var isLoaded = true
        var hasActiveSession = true
        var clerkUserId: String? = "user_abc"
        var signOutCount = 0
        private var handler: (@MainActor () -> Void)?
        func token(forceRefresh: Bool) async throws -> String? { "t" }
        func signOut() async throws { signOutCount += 1; hasActiveSession = false; clerkUserId = nil }
        func observeChanges(_ handler: @escaping @MainActor () -> Void) { self.handler = handler }
        func fire() { handler?() }
    }

    struct FakeAPI: SyncDAPIProtocol {
        var meResult: Result<MeResponse, APIError>
        func me() async throws(APIError) -> MeResponse { try meResult.get() }
        func createProfile(username: String) async throws(APIError) -> PublicUser { PublicUser(id: "u1", clerkUserId: "user_abc", username: username) }
        func createRoom() async throws(APIError) -> Room { throw .invalidResponse }
        func joinRoom(code: String) async throws(APIError) -> Room { throw .invalidResponse }
        func room(code: String) async throws(APIError) -> Room { throw .invalidResponse }
        func leaveRoom(code: String) async throws(APIError) {}
        func searchTracks(query: String) async throws(APIError) -> [TrackSearchResult] { [] }
        func resolveTrack(link: String) async throws(APIError) -> TrackSearchResult { throw .invalidResponse }
        func resolvePlaylist(link: String) async throws(APIError) -> PlaylistResolveResponse { throw .invalidResponse }
    }

    static let user = PublicUser(id: "u1", clerkUserId: "user_abc", username: "arjun")

    @Test func signedOutWithoutSession() {
        let auth = FakeAuth()
        auth.hasActiveSession = false
        let store = SessionStore(auth: auth, api: FakeAPI(meResult: .failure(.offline)))
        store.start()
        #expect(store.state == .signedOut)
    }

    @Test func launchingUntilAuthLoads() {
        let auth = FakeAuth()
        auth.isLoaded = false
        let store = SessionStore(auth: auth, api: FakeAPI(meResult: .failure(.offline)))
        store.start()
        #expect(store.state == .launching)
    }

    @Test func readyWhenOnboarded() async {
        let store = SessionStore(auth: FakeAuth(), api: FakeAPI(meResult: .success(MeResponse(authenticated: true, user: Self.user, onboardingComplete: true))))
        store.start()
        await waitUntil { store.state != .loadingProfile }
        #expect(store.state == .ready(Self.user))
    }

    @Test func onboardingOnlyOnSuccessfulIncompleteResponse() async {
        let store = SessionStore(auth: FakeAuth(), api: FakeAPI(meResult: .success(MeResponse(authenticated: true, user: nil, onboardingComplete: false))))
        store.start()
        await waitUntil { store.state != .loadingProfile }
        #expect(store.state == .onboarding)
    }

    /// Mirrors the web fix: a failed /me must not route to onboarding.
    @Test func failedProfileLoadShowsRetryableError() async {
        let store = SessionStore(auth: FakeAuth(), api: FakeAPI(meResult: .failure(.server(status: 500))))
        store.start()
        await waitUntil { store.state != .loadingProfile }
        #expect(store.state == .failed)
        #expect(store.error?.isRetryable == true)
    }

    @Test func profileIsNotRefetchedForSameAccount() async {
        let auth = FakeAuth()
        let store = SessionStore(auth: auth, api: FakeAPI(meResult: .success(MeResponse(authenticated: true, user: Self.user, onboardingComplete: true))))
        store.start()
        await waitUntil { store.state != .loadingProfile }
        auth.fire()
        #expect(store.state == .ready(Self.user))
    }

    @Test func completingOnboardingSeedsUser() async throws {
        let store = SessionStore(auth: FakeAuth(), api: FakeAPI(meResult: .success(MeResponse(authenticated: true, user: nil, onboardingComplete: false))))
        store.start()
        await waitUntil { store.state != .loadingProfile }
        try await store.completeOnboarding(username: " arjun ")
        #expect(store.currentUser?.username == "arjun")
    }

    @Test func signOutTearsDownOnce() async {
        let auth = FakeAuth()
        let store = SessionStore(auth: auth, api: FakeAPI(meResult: .success(MeResponse(authenticated: true, user: Self.user, onboardingComplete: true))))
        var teardowns = 0
        store.onSignedOut = { teardowns += 1 }
        store.start()
        await waitUntil { store.state != .loadingProfile }
        await store.signOut()
        auth.fire()
        await drainMainActor()
        #expect(store.state == .signedOut)
        #expect(auth.signOutCount == 1)
        #expect(teardowns == 1)
    }
}
