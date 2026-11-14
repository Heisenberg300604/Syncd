import Foundation

/// Estimates `offset = serverClock - localClock` from the `serverTime` field the
/// server stamps on every playback snapshot.
///
/// Each observation bounds the true offset θ. If the server stamped `s` while
/// the local clock read somewhere in `[sentAt, receivedAt]`:
///
///     s - receivedAt  ≤  θ  ≤  s - sentAt
///
/// Broadcasts only provide the lower bound (no `sentAt`). Acks provide both.
/// The estimate is the midpoint of the tightest interval seen recently, or the
/// best lower bound when no upper bound is available.
struct ServerClock: Sendable {
    struct Sample: Sendable {
        let lower: TimeInterval
        let upper: TimeInterval?
        let observedAt: Date
    }

    private(set) var samples: [Sample] = []
    let maxSamples: Int
    let maxAge: TimeInterval

    init(maxSamples: Int = 24, maxAge: TimeInterval = 600) {
        self.maxSamples = maxSamples
        self.maxAge = maxAge
    }

    var hasEstimate: Bool { !samples.isEmpty }

    mutating func record(_ timed: TimedPlayback) {
        record(serverTime: timed.snapshot.serverTime, sentAt: timed.sentAt, receivedAt: timed.receivedAt)
    }

    mutating func record(serverTime: Date, sentAt: Date?, receivedAt: Date) {
        let lower = serverTime.timeIntervalSince(receivedAt)
        let upper = sentAt.map { serverTime.timeIntervalSince($0) }
        // A sample whose bounds are inverted means the local clock jumped.
        if let upper, upper < lower { return }
        samples.append(Sample(lower: lower, upper: upper, observedAt: receivedAt))
        samples.removeAll { receivedAt.timeIntervalSince($0.observedAt) > maxAge }
        if samples.count > maxSamples { samples.removeFirst(samples.count - maxSamples) }
    }

    /// Seconds to add to a local time to get server time. Zero until observed.
    var offset: TimeInterval {
        guard !samples.isEmpty else { return 0 }
        let lower = samples.map(\.lower).max() ?? 0
        let uppers = samples.compactMap(\.upper)
        guard let upper = uppers.min() else { return lower }
        // Bounds from different samples can cross when latency varies; fall
        // back to the lower bound, which is never wrong in direction.
        return upper >= lower ? (lower + upper) / 2 : lower
    }

    func serverNow(localNow: Date) -> Date {
        localNow.addingTimeInterval(offset)
    }
}
