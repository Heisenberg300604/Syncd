import Foundation
import Testing
@testable import SyncD

/// Payloads below are shaped exactly like the server's responses
/// (`server/src/**/*.types.ts`), including `toISOString()` millisecond dates.
@Suite("Backend decoding")
struct DecodingTests {
    @Test func decodesMe() throws {
        let json = #"{"authenticated":true,"user":{"id":"u1","clerkUserId":"user_abc","username":"arjun"},"onboardingComplete":true}"#
        let me = try JSONCoding.makeDecoder().decode(MeResponse.self, from: Data(json.utf8))
        #expect(me.user?.username == "arjun")
        #expect(me.onboardingComplete)
    }

    @Test func decodesMeBeforeOnboarding() throws {
        let json = #"{"authenticated":true,"user":null,"onboardingComplete":false}"#
        let me = try JSONCoding.makeDecoder().decode(MeResponse.self, from: Data(json.utf8))
        #expect(me.user == nil)
    }

    @Test func decodesRoomEnvelope() throws {
        let json = """
        {"room":{"id":"r1","roomCode":"ABC234","host":{"id":"u1","username":"arjun"},
        "members":[{"user":{"id":"u1","username":"arjun"},"joinedAt":"2026-11-14T10:00:00.123Z"}],
        "currentVideoId":null,"currentTitle":null,"currentThumbnailUrl":null,"currentDuration":null,
        "isPlaying":false,"playbackPosition":0,"playbackUpdatedAt":null}}
        """
        let room = try JSONCoding.makeDecoder().decode(RoomEnvelope.self, from: Data(json.utf8)).room
        #expect(room.roomCode == "ABC234")
        #expect(room.members.first?.joinedAt == JSONCoding.parseDate("2026-11-14T10:00:00.123Z"))
    }

    @Test func decodesPlaybackSnapshotFromSocketObject() throws {
        let object: [String: Any] = [
            "videoId": "dQw4w9WgXcQ", "title": "Song", "thumbnailUrl": "https://i.ytimg.com/vi/x/hq.jpg",
            "duration": 212.0, "isPlaying": true, "position": 12.5,
            "updatedAt": "2026-11-14T10:00:00.000Z", "serverTime": "2026-11-14T10:00:02.500Z",
        ]
        let snapshot = try JSONCoding.decode(PlaybackSnapshot.self, fromJSONObject: object)
        #expect(snapshot.position == 12.5)
        #expect(snapshot.serverTime.timeIntervalSince(snapshot.updatedAt!) == 2.5)
    }

    @Test func decodesJoinAckWithAllSections() throws {
        let object: [String: Any] = [
            "ok": true,
            "presence": ["members": [["userId": "u1", "username": "arjun", "online": true]], "hostUserId": "u1"],
            "playback": ["videoId": NSNull(), "title": NSNull(), "thumbnailUrl": NSNull(), "duration": NSNull(),
                         "isPlaying": false, "position": 0, "updatedAt": NSNull(), "serverTime": "2026-11-14T10:00:00.000Z"],
            "messages": [["id": "m1", "roomId": "r1", "userId": "u1", "username": "arjun", "content": "hi", "createdAt": "2026-11-14T09:59:00.000Z"]],
            "queue": [["videoId": "abcdefghijk", "title": "Next", "thumbnailUrl": "", "duration": "PT3M5S"]],
        ]
        let ack = try JSONCoding.decode(RoomJoinAck.self, fromJSONObject: object)
        #expect(ack.ok)
        #expect(ack.presence?.hostUserId == "u1")
        #expect(ack.playback?.videoId == nil)
        #expect(ack.messages?.count == 1)
        #expect(ack.queue?.first?.duration == "PT3M5S")
    }

    @Test func decodesJoinRejection() throws {
        let ack = try JSONCoding.decode(RoomJoinAck.self, fromJSONObject: ["ok": false, "message": "Not a member of this room"])
        #expect(!ack.ok)
        #expect(ack.message == "Not a member of this room")
    }

    @Test func decodesQueueFullAck() throws {
        let ack = try JSONCoding.decode(QueueAck.self, fromJSONObject: ["ok": false, "message": "Queue is full (max 50 tracks)", "code": "QUEUE_FULL"])
        #expect(ack.code == "QUEUE_FULL")
    }

    @Test func decodesHostPending() throws {
        let pending = try JSONCoding.decode(HostPending.self, fromJSONObject: [
            "pending": true, "hostUserId": "u1", "hostUsername": "arjun", "successorUsername": "sarah", "deadline": "2026-11-14T10:00:30.000Z",
        ])
        #expect(pending.successorUsername == "sarah")
    }

    @Test func encodesSocketPayloadsWithServerFieldNames() throws {
        let object = try JSONCoding.jsonObject(from: PlaybackControlPayload(roomCode: "ABC234", action: .seek, position: 42))
        #expect(object["roomCode"] as? String == "ABC234")
        #expect(object["action"] as? String == "seek")
        #expect(object["position"] as? Double == 42)
    }

    @Test func rejectsMalformedPayload() {
        #expect(throws: (any Error).self) {
            try JSONCoding.decode(PlaybackSnapshot.self, fromJSONObject: ["videoId": 3])
        }
    }
}

@Suite("API client")
struct APIClientTests {
    let base = URL(string: "http://localhost:5000/api")!

    private func client(_ transport: StubTransport, token: String? = "token") -> APIClient {
        APIClient(baseURL: base, transport: transport) { _ in token }
    }

    @Test func sendsBearerTokenToCorrectPath() async throws {
        let transport = StubTransport { request in
            #expect(request.url?.absoluteString == "http://localhost:5000/api/rooms/ABC234/join")
            #expect(request.httpMethod == "POST")
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer token")
            let body = #"{"room":{"id":"r1","roomCode":"ABC234","host":{"id":"u1","username":"a"},"members":[],"currentVideoId":null,"currentTitle":null,"currentThumbnailUrl":null,"currentDuration":null,"isPlaying":false,"playbackPosition":0,"playbackUpdatedAt":null}}"#
            return (Data(body.utf8), HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        }
        let room = try await SyncDAPI(client: client(transport)).joinRoom(code: " abc234 ")
        #expect(room.roomCode == "ABC234")
    }

    @Test func encodesSearchQuery() async throws {
        let transport = StubTransport { request in
            #expect(request.url?.query()?.contains("q=lo%20fi") == true || request.url?.query()?.contains("q=lo+fi") == true)
            return (Data(#"{"results":[]}"#.utf8), HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        }
        let results = try await SyncDAPI(client: client(transport)).searchTracks(query: "lo fi")
        #expect(results.isEmpty)
    }

    @Test func missingTokenIsNotSignedIn() async {
        let api = SyncDAPI(client: client(.json(200, "{}"), token: nil))
        await #expect(throws: APIError.notSignedIn) { try await api.me() }
    }

    @Test func retriesOnceWithFreshTokenAfter401() async throws {
        let calls = Counter()
        let transport = StubTransport { request in
            let attempt = calls.increment()
            let status = attempt == 1 ? 401 : 200
            let body = attempt == 1 ? #"{"authenticated":false,"message":"Unauthorized"}"# : #"{"authenticated":true,"user":null,"onboardingComplete":false}"#
            return (Data(body.utf8), HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!)
        }
        let forced = Counter()
        let api = SyncDAPI(client: APIClient(baseURL: base, transport: transport) { force in
            if force { forced.increment() }
            return "token"
        })
        let me = try await api.me()
        #expect(!me.onboardingComplete)
        #expect(calls.value == 2)
        #expect(forced.value == 1)
    }

    @Test(arguments: [
        (400, APIError.validation("Bad")),
        (403, APIError.forbidden("Bad")),
        (404, APIError.notFound("Bad")),
        (409, APIError.conflict("Bad")),
        (500, APIError.server(status: 500)),
        (503, APIError.server(status: 503)),
    ])
    func mapsStatusCodes(status: Int, expected: APIError) async {
        let api = SyncDAPI(client: client(.json(status, #"{"message":"Bad"}"#)))
        await #expect(throws: expected) { try await api.me() }
    }

    @Test func mapsRateLimitWithRetryAfter() async {
        let api = SyncDAPI(client: client(.json(429, #"{"message":"Too many"}"#, headers: ["Retry-After": "12"])))
        await #expect(throws: APIError.rateLimited(retryAfter: 12)) { try await api.me() }
    }

    @Test func mapsOffline() async {
        let transport = StubTransport { _ in throw URLError(.notConnectedToInternet) }
        await #expect(throws: APIError.offline) { try await SyncDAPI(client: client(transport)).me() }
    }

    /// A stopped server must say so, with the host it tried, not a generic error.
    @Test func mapsRefusedConnectionToUnreachableServer() async {
        let transport = StubTransport { _ in throw URLError(.cannotConnectToHost) }
        let api = SyncDAPI(client: client(transport))
        await #expect(throws: APIError.serverUnreachable("localhost:5000")) { try await api.me() }
        #expect(APIError.serverUnreachable("localhost:5000").message.contains("localhost:5000"))
    }

    @Test func mapsTimeout() async {
        let transport = StubTransport { _ in throw URLError(.timedOut) }
        await #expect(throws: APIError.timeout) { try await SyncDAPI(client: client(transport)).me() }
    }

    @Test func mapsUndecodableBody() async {
        let api = SyncDAPI(client: client(.json(200, #"{"unexpected":true}"#)))
        await #expect(throws: APIError.decoding("MeResponse")) { try await api.me() }
    }

    @Test func retryabilityMatchesErrorKind() {
        #expect(APIError.offline.isRetryable)
        #expect(APIError.server(status: 500).isRetryable)
        #expect(!APIError.conflict("taken").isRetryable)
        #expect(!APIError.forbidden("no").isRetryable)
    }
}

final class Counter: @unchecked Sendable {
    private let lock = NSLock()
    private var count = 0
    var value: Int { lock.withLock { count } }
    @discardableResult func increment() -> Int { lock.withLock { count += 1; return count } }
}

@Suite("Socket handshake errors")
struct SocketHandshakeErrorTests {
    @Test func explainsAuthorizedPartyRejection() {
        let raw = #"Invalid JWT Authorized party claim (azp) undefined. Expected "http://localhost:5173"."#
        #expect(SocketIORoomClient.describeConnectError(raw).contains("native-app tokens"))
    }

    /// The real shape Socket.IO v4 delivers for `next(new Error(msg))`.
    @Test func readsMessageFromConnectErrorObject() {
        let payload: [Any] = [["message": #"Invalid JWT Authorized party claim (azp) undefined. Expected "http://localhost:5173"."#]]
        let message = SocketIORoomClient.errorMessage(from: payload)
        #expect(message.contains("Authorized party"))
        #expect(SocketIORoomClient.describeConnectError(message).contains("native-app tokens"))
    }

    @Test func readsPlainStringAndNestedErrors() {
        #expect(SocketIORoomClient.errorMessage(from: ["Tried emitting when not connected"]) == "Tried emitting when not connected")
        #expect(SocketIORoomClient.errorMessage(from: [["data": ["message": "inner"]]]) == "inner")
        #expect(SocketIORoomClient.errorMessage(from: []) == "No details from the server")
    }

    @Test func explainsMissingProfile() {
        #expect(SocketIORoomClient.describeConnectError("User profile not found").contains("onboarding"))
    }

    @Test func passesThroughUnknownReasons() {
        #expect(SocketIORoomClient.describeConnectError("Something odd").hasSuffix("Something odd"))
    }

    @Test func reasonSurfacesWhileReconnecting() {
        #expect(RoomConnectionState.reconnecting(attempt: 3, reason: "x").failureReason == "x")
        #expect(RoomConnectionState.connected.failureReason == nil)
    }
}

@Suite("Configuration")
struct ConfigurationTests {
    @Test func derivesSocketURLLikeWeb() throws {
        let config = try AppConfiguration(environment: .development, apiBaseURL: "http://localhost:5000/api", clerkPublishableKey: "pk_test_x")
        #expect(config.socketURL.absoluteString == "http://localhost:5000")
        #expect(AppConfiguration.socketURL(fromAPIBase: URL(string: "https://syncd-api.onrender.com/api/")!).absoluteString == "https://syncd-api.onrender.com")
    }

    @Test func rejectsSecretKey() {
        #expect(throws: ConfigurationError.secretKeyInClient) {
            try AppConfiguration(environment: .development, apiBaseURL: "http://localhost:5000/api", clerkPublishableKey: "sk_test_x")
        }
    }

    @Test func rejectsPlaceholderKey() {
        #expect(throws: ConfigurationError.missing("SYNCD_CLERK_PUBLISHABLE_KEY")) {
            try AppConfiguration(environment: .development, apiBaseURL: "http://localhost:5000/api", clerkPublishableKey: "pk_test_replace_me")
        }
    }

    @Test func productionRequiresHTTPS() {
        #expect(throws: ConfigurationError.insecureURL("http://api.example.com/api")) {
            try AppConfiguration(environment: .production, apiBaseURL: "http://api.example.com/api", clerkPublishableKey: "pk_live_x")
        }
    }

    @Test func rejectsMissingURL() {
        #expect(throws: ConfigurationError.missing("SYNCD_API_BASE_URL")) {
            try AppConfiguration(environment: .development, apiBaseURL: " ", clerkPublishableKey: "pk_test_x")
        }
    }
}

@Suite("Validation mirrors server rules")
struct ValidationTests {
    @Test(arguments: [("PT3M45S", 225.0), ("PT1H2M3S", 3723.0), ("P1DT1S", 86401.0), ("PT0.5S", 0.5)])
    func parsesISODurations(raw: String, seconds: Double) {
        #expect(DurationFormatting.seconds(fromISO8601: raw) == seconds)
    }

    @Test(arguments: ["P0D", "garbage", "", "PT"])
    func liveOrInvalidDurationsAreNil(raw: String) {
        #expect(DurationFormatting.seconds(fromISO8601: raw) == nil)
    }

    @Test func formatsClock() {
        #expect(DurationFormatting.clock(225) == "3:45")
        #expect(DurationFormatting.clock(3723) == "1:02:03")
        #expect(DurationFormatting.clock(-1) == "0:00")
    }

    @Test func roomCodeRules() {
        #expect(RoomCode.validationMessage(for: "abc234") == nil)
        #expect(RoomCode.validationMessage(for: "ABC23") != nil)
        #expect(RoomCode.validationMessage(for: "ABC-23") != nil)
        #expect(RoomCode.normalize("  abc234 ") == "ABC234")
    }

    @Test func usernameRules() {
        #expect(UsernameRules.validationMessage(for: "arjun_22") == nil)
        #expect(UsernameRules.validationMessage(for: "ab") != nil)
        #expect(UsernameRules.validationMessage(for: "has space") != nil)
        #expect(UsernameRules.validationMessage(for: "émile") != nil)
        #expect(UsernameRules.validationMessage(for: String(repeating: "a", count: 21)) != nil)
    }
}
