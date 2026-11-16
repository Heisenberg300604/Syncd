import Foundation
import Testing
@testable import SyncD

@Suite("Playback position")
struct PlaybackTimelineTests {
    @Test func playingAdvancesByElapsedServerTime() {
        let state = RoomPlaybackState(snapshot: Fixtures.snapshot(isPlaying: true, position: 30))
        #expect(state.expectedPosition(atServerTime: Fixtures.t0.addingTimeInterval(12.5)) == 42.5)
    }

    @Test func pausedDoesNotAdvance() {
        let state = RoomPlaybackState(snapshot: Fixtures.snapshot(isPlaying: false, position: 30))
        #expect(state.expectedPosition(atServerTime: Fixtures.t0.addingTimeInterval(60)) == 30)
    }

    @Test func clampsToDuration() {
        let state = RoomPlaybackState(snapshot: Fixtures.snapshot(duration: 100, position: 90))
        #expect(state.expectedPosition(atServerTime: Fixtures.t0.addingTimeInterval(30)) == 100)
    }

    @Test func neverNegativeWhenServerTimeIsBeforeUpdate() {
        let state = RoomPlaybackState(snapshot: Fixtures.snapshot(position: 5))
        #expect(state.expectedPosition(atServerTime: Fixtures.t0.addingTimeInterval(-10)) == 5)
    }

    @Test func unknownDurationIsNotClamped() {
        let state = RoomPlaybackState(snapshot: Fixtures.snapshot(duration: nil, position: 10))
        #expect(state.expectedPosition(atServerTime: Fixtures.t0.addingTimeInterval(1_000)) == 1_010)
    }

    @Test func endDetectionUsesGrace() {
        let state = RoomPlaybackState(snapshot: Fixtures.snapshot(duration: 100, position: 95))
        #expect(!state.hasEnded(atServerTime: Fixtures.t0.addingTimeInterval(5.5), grace: 1))
        #expect(state.hasEnded(atServerTime: Fixtures.t0.addingTimeInterval(6.5), grace: 1))
    }

    @Test func emptyThumbnailBecomesNilArtwork() {
        let snapshot = PlaybackSnapshot(videoId: "a", title: nil, thumbnailUrl: "", duration: nil, isPlaying: false,
                                        position: 0, updatedAt: nil, serverTime: Fixtures.t0)
        #expect(RoomPlaybackState(snapshot: snapshot).artworkURL == nil)
    }
}

@Suite("Drift policy")
struct DriftPolicyTests {
    let policy = DriftPolicy()

    @Test(arguments: [0.0, 0.1, -0.249])
    func smallDriftIsIgnored(drift: Double) {
        #expect(policy.correction(forDrift: drift) == .none)
    }

    @Test(arguments: [0.25, 0.5, -0.74])
    func moderateDriftIsMonitored(drift: Double) {
        #expect(policy.correction(forDrift: drift) == .monitor)
    }

    @Test func aheadSlowsDownBehindSpeedsUp() {
        guard case let .adjustRate(ahead) = policy.correction(forDrift: 1.0) else { Issue.record("expected rate"); return }
        guard case let .adjustRate(behind) = policy.correction(forDrift: -1.0) else { Issue.record("expected rate"); return }
        #expect(ahead < 1)
        #expect(behind > 1)
        #expect(abs((1 - ahead) - (behind - 1)) < 0.0001)
    }

    @Test func rateAdjustmentIsBounded() {
        guard case let .adjustRate(rate) = policy.correction(forDrift: 1.99) else { Issue.record("expected rate"); return }
        #expect(rate >= 1 - policy.maxRateAdjustment)
    }

    @Test(arguments: [2.01, -3.0, 60.0])
    func largeDriftSeeks(drift: Double) {
        #expect(policy.correction(forDrift: drift) == .seek)
    }

    @Test func seeksWhenRateAdjustmentUnsupported() {
        #expect(policy.correction(forDrift: 1.0, supportsRateAdjustment: false) == .monitor)
        #expect(policy.correction(forDrift: 2.5, supportsRateAdjustment: false) == .seek)
    }

    @Test func nonFiniteDriftSeeks() {
        #expect(policy.correction(forDrift: .nan) == .seek)
    }
}

@Suite("Stale snapshot rejection")
struct SnapshotSequencerTests {
    @Test func firstSnapshotApplies() {
        var sequencer = SnapshotSequencer()
        #expect(sequencer.evaluate(Fixtures.snapshot(), isResync: false) == .apply)
    }

    @Test func olderSnapshotIsStale() {
        var sequencer = SnapshotSequencer()
        _ = sequencer.evaluate(Fixtures.snapshot(updatedAt: Fixtures.t0.addingTimeInterval(10)), isResync: false)
        #expect(sequencer.evaluate(Fixtures.snapshot(updatedAt: Fixtures.t0), isResync: false) == .stale)
    }

    @Test func newerSnapshotApplies() {
        var sequencer = SnapshotSequencer()
        _ = sequencer.evaluate(Fixtures.snapshot(updatedAt: Fixtures.t0), isResync: false)
        #expect(sequencer.evaluate(Fixtures.snapshot(updatedAt: Fixtures.t0.addingTimeInterval(1)), isResync: false) == .apply)
    }

    /// The host's ack and the room broadcast carry the same mutation.
    @Test func ackAndBroadcastOfSameMutationIsDuplicate() {
        var sequencer = SnapshotSequencer()
        _ = sequencer.evaluate(Fixtures.snapshot(updatedAt: Fixtures.t0), isResync: false)
        #expect(sequencer.evaluate(Fixtures.snapshot(updatedAt: Fixtures.t0), isResync: false) == .duplicate)
    }

    @Test func rejoinReappliesEqualSnapshot() {
        var sequencer = SnapshotSequencer()
        _ = sequencer.evaluate(Fixtures.snapshot(updatedAt: Fixtures.t0), isResync: false)
        #expect(sequencer.evaluate(Fixtures.snapshot(updatedAt: Fixtures.t0), isResync: true) == .apply)
    }

    @Test func rejoinCannotRewindToOlderState() {
        var sequencer = SnapshotSequencer()
        _ = sequencer.evaluate(Fixtures.snapshot(updatedAt: Fixtures.t0.addingTimeInterval(5)), isResync: false)
        #expect(sequencer.evaluate(Fixtures.snapshot(updatedAt: Fixtures.t0), isResync: true) == .stale)
    }

    @Test func mutatedRoomNeverReturnsToNeverPlayed() {
        var sequencer = SnapshotSequencer()
        _ = sequencer.evaluate(Fixtures.snapshot(updatedAt: Fixtures.t0), isResync: false)
        #expect(sequencer.evaluate(Fixtures.snapshot(videoId: nil, updatedAt: nil), isResync: false) == .stale)
    }

    @Test func resetForgetsHistory() {
        var sequencer = SnapshotSequencer()
        _ = sequencer.evaluate(Fixtures.snapshot(updatedAt: Fixtures.t0.addingTimeInterval(5)), isResync: false)
        sequencer.reset()
        #expect(sequencer.evaluate(Fixtures.snapshot(updatedAt: Fixtures.t0), isResync: false) == .apply)
    }
}

@Suite("Server clock")
struct ServerClockTests {
    @Test func zeroOffsetWithoutSamples() {
        #expect(ServerClock().offset == 0)
    }

    @Test func broadcastGivesLowerBound() {
        var clock = ServerClock()
        // Server is 5 s ahead; message took 0.2 s to arrive.
        let local = Fixtures.t0
        clock.record(serverTime: local.addingTimeInterval(5), sentAt: nil, receivedAt: local.addingTimeInterval(0.2))
        #expect(abs(clock.offset - 4.8) < 0.0001)
    }

    @Test func ackBoundsOffsetToMidpoint() {
        var clock = ServerClock()
        let sent = Fixtures.t0
        // RTT 0.4 s, server stamped at the midpoint, server 5 s ahead.
        clock.record(serverTime: sent.addingTimeInterval(5.2), sentAt: sent, receivedAt: sent.addingTimeInterval(0.4))
        #expect(abs(clock.offset - 5.0) < 0.0001)
    }

    @Test func tightestBoundsWin() {
        var clock = ServerClock()
        let base = Fixtures.t0
        // Slow sample: wide interval [4.0, 6.0]
        clock.record(serverTime: base.addingTimeInterval(6), sentAt: base, receivedAt: base.addingTimeInterval(2))
        // Fast sample: narrow interval [4.95, 5.05]
        let later = base.addingTimeInterval(10)
        clock.record(serverTime: later.addingTimeInterval(5.05), sentAt: later, receivedAt: later.addingTimeInterval(0.1))
        #expect(abs(clock.offset - 5.0) < 0.0001)
    }

    @Test func invertedBoundsAreIgnored() {
        var clock = ServerClock()
        let base = Fixtures.t0
        clock.record(serverTime: base, sentAt: base.addingTimeInterval(1), receivedAt: base)
        #expect(!clock.hasEstimate)
    }

    @Test func oldSamplesExpire() {
        var clock = ServerClock(maxSamples: 10, maxAge: 60)
        let base = Fixtures.t0
        clock.record(serverTime: base.addingTimeInterval(100), sentAt: nil, receivedAt: base)
        clock.record(serverTime: base.addingTimeInterval(125), sentAt: nil, receivedAt: base.addingTimeInterval(120))
        #expect(clock.samples.count == 1)
        #expect(abs(clock.offset - 5) < 0.0001)
    }
}

@Suite("Interruption policy")
struct InterruptionPolicyTests {
    @Test func beganWhilePlayingMarksInterrupted() {
        #expect(InterruptionPolicy.action(for: .interruptionBegan, wasPlayingBeforeInterruption: true, userPausedDuringInterruption: false) == .markInterrupted)
    }

    @Test func beganWhilePausedDoesNothing() {
        #expect(InterruptionPolicy.action(for: .interruptionBegan, wasPlayingBeforeInterruption: false, userPausedDuringInterruption: false) == .none)
    }

    @Test func endedWithShouldResumeResumes() {
        #expect(InterruptionPolicy.action(for: .interruptionEnded(shouldResume: true), wasPlayingBeforeInterruption: true, userPausedDuringInterruption: false) == .resume)
    }

    @Test func endedWithoutShouldResumeStaysPaused() {
        #expect(InterruptionPolicy.action(for: .interruptionEnded(shouldResume: false), wasPlayingBeforeInterruption: true, userPausedDuringInterruption: false) == .stayPaused)
    }

    /// An intentional pause during a call must win over the system's hint.
    @Test func intentionalPauseWinsOverShouldResume() {
        #expect(InterruptionPolicy.action(for: .interruptionEnded(shouldResume: true), wasPlayingBeforeInterruption: true, userPausedDuringInterruption: true) == .none)
    }

    @Test func neverResumesWhatWasNotPlaying() {
        #expect(InterruptionPolicy.action(for: .interruptionEnded(shouldResume: true), wasPlayingBeforeInterruption: false, userPausedDuringInterruption: false) == .none)
    }

    @Test func headphoneLossPausesLocally() {
        #expect(InterruptionPolicy.action(for: .outputDeviceLost, wasPlayingBeforeInterruption: true, userPausedDuringInterruption: false) == .pauseLocally)
    }

    @Test func mediaServicesResetRebuilds() {
        #expect(InterruptionPolicy.action(for: .mediaServicesReset, wasPlayingBeforeInterruption: false, userPausedDuringInterruption: false) == .rebuildSession)
    }
}
