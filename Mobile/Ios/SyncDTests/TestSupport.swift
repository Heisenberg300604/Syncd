import Foundation
@testable import SyncD

/// A controllable clock for synchronisation tests.
final class TestClock: MonotonicClock, @unchecked Sendable {
    private let lock = NSLock()
    private var current: Date

    init(_ start: Date = Date(timeIntervalSince1970: 1_800_000_000)) {
        current = start
    }

    func now() -> Date {
        lock.withLock { current }
    }

    func advance(_ seconds: TimeInterval) {
        lock.withLock { current = current.addingTimeInterval(seconds) }
    }
}

enum Fixtures {
    static let t0 = Date(timeIntervalSince1970: 1_800_000_000)

    static func snapshot(
        videoId: String? = "dQw4w9WgXcQ",
        title: String? = "Track",
        duration: Double? = 200,
        isPlaying: Bool = true,
        position: Double = 0,
        updatedAt: Date? = t0,
        serverTime: Date = t0
    ) -> PlaybackSnapshot {
        PlaybackSnapshot(
            videoId: videoId,
            title: title,
            thumbnailUrl: "https://i.ytimg.com/vi/x/hqdefault.jpg",
            duration: duration,
            isPlaying: isPlaying,
            position: position,
            updatedAt: updatedAt,
            serverTime: serverTime
        )
    }

    static func timed(_ snapshot: PlaybackSnapshot, sentAt: Date? = nil, receivedAt: Date) -> TimedPlayback {
        TimedPlayback(snapshot: snapshot, sentAt: sentAt, receivedAt: receivedAt)
    }
}

/// Records calls and lets tests drive engine state transitions.
@MainActor
final class MockAudioEngine: AudioEngine {
    var state: EngineState = .idle {
        didSet { if state != oldValue { onStateChange?(state) } }
    }
    var currentItem: PlaybackItem?
    var currentTime: TimeInterval = 0
    var duration: TimeInterval?
    var rate: Double = 1
    var supportsRateAdjustment = true
    var onStateChange: ((EngineState) -> Void)?

    var loadError: PlaybackError?
    private(set) var loads: [PlaybackItem] = []
    private(set) var seeks: [TimeInterval] = []
    private(set) var playCount = 0
    private(set) var pauseCount = 0
    private(set) var rates: [Double] = []

    func load(_ item: PlaybackItem) async throws(PlaybackError) {
        loads.append(item)
        if let loadError {
            state = .failed(loadError)
            throw loadError
        }
        currentItem = item
        duration = item.duration
        currentTime = 0
        state = .ready
    }

    func play() {
        playCount += 1
        state = .playing
    }

    func pause() {
        pauseCount += 1
        state = .paused
    }

    func seek(to position: TimeInterval) async -> Bool {
        seeks.append(position)
        currentTime = position
        return true
    }

    func setRate(_ rate: Double) {
        if rate != self.rate { rates.append(rate) }
        self.rate = rate
    }

    func setVolume(_ volume: Float) {}

    func stop() {
        currentItem = nil
        currentTime = 0
        state = .idle
    }
}

/// Resolves every room track to a native stream, standing in for the future
/// host-stream contract so the engine sync path can be exercised.
struct StreamResolver: PlaybackSourceResolving {
    func source(for snapshot: PlaybackSnapshot) -> PlaybackSource? {
        snapshot.videoId.map { .remoteStream(URL(string: "https://stream.example/\($0)")!) }
    }
}

@MainActor
final class MockCommander: RoomPlaybackCommanding {
    var controls: [(PlaybackAction, TimeInterval)] = []
    var advanceCount = 0
    var controlResult: Result<TimedPlayback, SocketError>?

    func sendPlaybackControl(_ action: PlaybackAction, position: TimeInterval) async throws(SocketError) -> TimedPlayback {
        controls.append((action, position))
        guard let controlResult else { throw .notConnected }
        return try controlResult.get()
    }

    func sendAdvanceQueue() async throws(SocketError) {
        advanceCount += 1
    }
}

/// Lets queued main-actor tasks run.
@MainActor
func drainMainActor(iterations: Int = 100) async {
    for _ in 0..<iterations { await Task.yield() }
}

/// Waits for a condition driven by unstructured tasks, failing after `timeout`
/// instead of assuming a fixed number of scheduler turns is enough.
@MainActor
func waitUntil(timeout: Duration = .seconds(2), _ condition: @MainActor () -> Bool) async {
    let deadline = ContinuousClock.now + timeout
    while !condition(), ContinuousClock.now < deadline {
        try? await Task.sleep(for: .milliseconds(5))
    }
}

struct StubTransport: HTTPTransport {
    let handler: @Sendable (URLRequest) throws -> (Data, URLResponse)

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        try handler(request)
    }

    static func json(_ status: Int, _ body: String, headers: [String: String] = [:]) -> StubTransport {
        StubTransport { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: headers)!
            return (Data(body.utf8), response)
        }
    }
}
