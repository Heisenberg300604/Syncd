import Foundation

/// The authoritative room playback state, decoded from a snapshot into a
/// form the coordinator can reason about.
struct RoomPlaybackState: Sendable, Equatable {
    let trackId: String?
    let title: String?
    let artworkURL: URL?
    let duration: TimeInterval?
    let isPlaying: Bool
    /// Position in seconds as of `updatedAt`.
    let position: TimeInterval
    /// Server time of the last mutation. `nil` when the room never played.
    let updatedAt: Date?
    /// The protocol has no rate field; rooms always play at 1×.
    let rate: Double

    init(snapshot: PlaybackSnapshot) {
        trackId = snapshot.videoId
        title = snapshot.title
        artworkURL = snapshot.thumbnailUrl.flatMap { $0.isEmpty ? nil : URL(string: $0) }
        duration = snapshot.duration
        isPlaying = snapshot.isPlaying
        position = snapshot.position
        updatedAt = snapshot.updatedAt
        rate = 1
    }

    var hasTrack: Bool { trackId != nil }

    /// `P(t) = P₀ + (T_server − T₀) × rate` while playing, clamped to the track.
    func expectedPosition(atServerTime now: Date) -> TimeInterval {
        var value = position
        if isPlaying, let updatedAt {
            value += max(0, now.timeIntervalSince(updatedAt)) * rate
        }
        value = max(0, value)
        if let duration, duration > 0 { value = min(value, duration) }
        return value
    }

    /// The room's track has run past its end — the host should advance.
    func hasEnded(atServerTime now: Date, grace: TimeInterval = 1) -> Bool {
        guard isPlaying, let duration, duration > 0, let updatedAt else { return false }
        return position + now.timeIntervalSince(updatedAt) * rate >= duration + grace
    }
}

/// Rejects stale and out-of-order snapshots.
///
/// There is no revision number in the protocol, but the server rewrites
/// `updatedAt` on every `set` / `control` / `clear`, so it orders mutations.
struct SnapshotSequencer: Sendable {
    private(set) var lastAppliedUpdatedAt: Date?
    private(set) var hasApplied = false

    enum Decision: Equatable {
        case apply
        case duplicate
        case stale
    }

    /// - Parameter isResync: join/rejoin snapshots. An equal `updatedAt` is
    ///   re-applied so the player re-seeks after a reconnect.
    mutating func evaluate(_ snapshot: PlaybackSnapshot, isResync: Bool) -> Decision {
        guard hasApplied else {
            accept(snapshot)
            return .apply
        }
        switch (lastAppliedUpdatedAt, snapshot.updatedAt) {
        case (nil, nil):
            return isResync ? .apply : .duplicate
        case (nil, .some):
            accept(snapshot)
            return .apply
        case (.some, nil):
            // A room that has been mutated never returns to "never played".
            return .stale
        case let (.some(last), .some(incoming)):
            if incoming > last {
                accept(snapshot)
                return .apply
            }
            if incoming == last { return isResync ? .apply : .duplicate }
            return .stale
        }
    }

    mutating func reset() {
        lastAppliedUpdatedAt = nil
        hasApplied = false
    }

    private mutating func accept(_ snapshot: PlaybackSnapshot) {
        lastAppliedUpdatedAt = snapshot.updatedAt
        hasApplied = true
    }
}
