import Foundation
import Testing
@testable import SyncD

@MainActor
@Suite("Playback coordinator")
struct PlaybackCoordinatorTests {
    let clock = TestClock()
    let engine = MockAudioEngine()
    let commander = MockCommander()

    private func makeCoordinator(resolver: any PlaybackSourceResolving = StreamResolver()) -> PlaybackCoordinator {
        let coordinator = PlaybackCoordinator(
            engine: engine, audioSession: nil, nowPlaying: nil, remoteCommands: nil,
            clock: clock, resolver: resolver
        )
        coordinator.attachRoom(code: "ABC234", commander: commander)
        return coordinator
    }

    /// Server and device clocks agree; the snapshot arrives instantly.
    private func deliver(_ snapshot: PlaybackSnapshot, to coordinator: PlaybackCoordinator, resync: Bool = false) async {
        coordinator.applyRoomSnapshot(Fixtures.timed(snapshot, receivedAt: snapshot.serverTime), isResync: resync)
        await drainMainActor()
    }

    @Test func joinLoadsSeeksAndPlaysAtExpectedPosition() async {
        let coordinator = makeCoordinator()
        clock.advance(10)
        // Room started 10 s ago at position 20 → should be at 30.
        let snapshot = Fixtures.snapshot(isPlaying: true, position: 20, updatedAt: Fixtures.t0, serverTime: Fixtures.t0.addingTimeInterval(10))
        await deliver(snapshot, to: coordinator, resync: true)

        #expect(engine.loads.count == 1)
        #expect(engine.seeks.last == 30)
        #expect(engine.state == .playing)
        #expect(coordinator.audioAvailability == .native)
        #expect(coordinator.status == .playing)
    }

    @Test func pausedRoomLoadsButDoesNotPlay() async {
        let coordinator = makeCoordinator()
        await deliver(Fixtures.snapshot(isPlaying: false, position: 42), to: coordinator, resync: true)
        #expect(engine.seeks.last == 42)
        #expect(engine.playCount == 0)
        #expect(!coordinator.isPlaying)
    }

    @Test func staleSnapshotDoesNotOverwriteNewerState() async {
        let coordinator = makeCoordinator()
        await deliver(Fixtures.snapshot(videoId: "newTrack001", updatedAt: Fixtures.t0.addingTimeInterval(5), serverTime: Fixtures.t0.addingTimeInterval(5)), to: coordinator)
        await deliver(Fixtures.snapshot(videoId: "oldTrack001", updatedAt: Fixtures.t0, serverTime: Fixtures.t0.addingTimeInterval(6)), to: coordinator)
        #expect(coordinator.item?.id == "newTrack001")
        #expect(engine.loads.map(\.id) == ["newTrack001"])
    }

    @Test func sameTrackUpdateDoesNotReload() async {
        let coordinator = makeCoordinator()
        await deliver(Fixtures.snapshot(isPlaying: true, position: 0), to: coordinator)
        await deliver(Fixtures.snapshot(isPlaying: false, position: 3, updatedAt: Fixtures.t0.addingTimeInterval(3), serverTime: Fixtures.t0.addingTimeInterval(3)), to: coordinator)
        #expect(engine.loads.count == 1)
        #expect(engine.state == .paused)
    }

    @Test func clearedTrackStopsEngine() async {
        let coordinator = makeCoordinator()
        await deliver(Fixtures.snapshot(), to: coordinator)
        await deliver(Fixtures.snapshot(videoId: nil, isPlaying: false, updatedAt: Fixtures.t0.addingTimeInterval(1)), to: coordinator)
        #expect(coordinator.item == nil)
        #expect(engine.state == .idle)
    }

    @Test func youTubeFollowsRoomWithoutEngine() async {
        let coordinator = makeCoordinator(resolver: RoomSourceResolver())
        clock.advance(4)
        await deliver(Fixtures.snapshot(position: 10, serverTime: Fixtures.t0.addingTimeInterval(4)), to: coordinator, resync: true)
        #expect(engine.loads.isEmpty)
        guard case .unavailable = coordinator.audioAvailability else { Issue.record("expected unavailable audio"); return }
        #expect(coordinator.status == .playing)
        #expect(abs(coordinator.position - 14) < 0.001)
        // Participants can't toggle audio they aren't producing.
        #expect(!coordinator.canTogglePlayback)
    }

    @Test func youTubePlaysThroughEmbeddedPlayerWhenAvailable() async {
        let embed = MockAudioEngine()
        embed.supportsRateAdjustment = false
        let coordinator = PlaybackCoordinator(
            engine: engine, embedEngine: embed, audioSession: nil, nowPlaying: nil, remoteCommands: nil,
            clock: clock, resolver: RoomSourceResolver()
        )
        coordinator.attachRoom(code: "ABC234", commander: commander)
        clock.advance(4)
        await deliver(Fixtures.snapshot(isPlaying: true, position: 10, serverTime: Fixtures.t0.addingTimeInterval(4)), to: coordinator, resync: true)

        #expect(coordinator.audioAvailability == .embedded)
        #expect(engine.loads.isEmpty)
        #expect(embed.loads.count == 1)
        #expect(embed.seeks.last == 14)
        #expect(embed.state == .playing)
        #expect(coordinator.status == .playing)
        // A participant can pause the audio on their own device.
        #expect(coordinator.canTogglePlayback)
    }

    private func makeEmbeddedCoordinator(_ embed: MockAudioEngine) -> PlaybackCoordinator {
        embed.supportsRateAdjustment = false
        let coordinator = PlaybackCoordinator(
            engine: engine, embedEngine: embed, audioSession: nil, nowPlaying: nil, remoteCommands: nil,
            clock: clock, resolver: RoomSourceResolver()
        )
        coordinator.attachRoom(code: "ABC234", commander: commander)
        return coordinator
    }

    /// Regression: WebKit's media session made iOS report an interruption of
    /// SyncD's session; the coordinator then refused to play after any pause.
    @Test func embeddedPlayerResumesAfterPauseDespiteSessionInterruption() async {
        let embed = MockAudioEngine()
        let coordinator = makeEmbeddedCoordinator(embed)
        await deliver(Fixtures.snapshot(isPlaying: true, position: 0), to: coordinator, resync: true)
        coordinator.handleAudioSessionEvent(.interruptionBegan)

        await deliver(Fixtures.snapshot(isPlaying: false, position: 5, updatedAt: Fixtures.t0.addingTimeInterval(5), serverTime: Fixtures.t0.addingTimeInterval(5)), to: coordinator)
        #expect(embed.state == .paused)

        await deliver(Fixtures.snapshot(isPlaying: true, position: 5, updatedAt: Fixtures.t0.addingTimeInterval(8), serverTime: Fixtures.t0.addingTimeInterval(8)), to: coordinator)
        #expect(embed.state == .playing)
        #expect(coordinator.status == .playing)
    }

    /// When the player stopped on its own while the room plays, the host's
    /// play button rejoins live instead of pausing everyone.
    @Test func hostToggleRejoinsWhenDeviceStoppedButRoomPlays() async {
        let embed = MockAudioEngine()
        let coordinator = makeEmbeddedCoordinator(embed)
        coordinator.updateRole(isHost: true)
        await deliver(Fixtures.snapshot(isPlaying: true, position: 0), to: coordinator, resync: true)
        embed.state = .paused // e.g. WebKit paused the video

        coordinator.togglePlayPause()
        await drainMainActor()

        #expect(commander.controls.isEmpty)
        #expect(embed.state == .playing)
    }

    /// Regression: releasing the slider snapped the progress back to the old
    /// position until the server round trip finished.
    @Test func hostSeekShowsTargetUntilRoomConfirms() async {
        let embed = MockAudioEngine()
        let coordinator = makeEmbeddedCoordinator(embed)
        coordinator.updateRole(isHost: true)
        await deliver(Fixtures.snapshot(duration: 240, isPlaying: true, position: 65), to: coordinator, resync: true)

        coordinator.seek(to: 120)
        #expect(coordinator.position == 120)
        coordinator.tick() // engine is still at 65 until the room confirms
        #expect(coordinator.position == 120)

        // A failed command falls back to the real position.
        await drainMainActor()
        coordinator.tick()
        #expect(coordinator.commandError != nil)
        #expect(coordinator.position == 65)
    }

    @Test func embeddedPlayerToleratesSubSeekDrift() async {
        let embed = MockAudioEngine()
        let coordinator = makeEmbeddedCoordinator(embed)
        await deliver(Fixtures.snapshot(isPlaying: true, position: 0), to: coordinator, resync: true)
        let seeksBefore = embed.seeks.count

        clock.advance(10)
        embed.currentTime = 8.8 // 1.2 s behind: would loop-seek a streamed player
        for _ in 0..<PlaybackCoordinator.driftCheckEveryTicks { coordinator.tick() }
        await drainMainActor()
        #expect(embed.seeks.count == seeksBefore)
    }

    @Test func largeDriftTriggersAuthoritativeSeek() async {
        let coordinator = makeCoordinator()
        await deliver(Fixtures.snapshot(isPlaying: true, position: 0), to: coordinator)
        let seeksBefore = engine.seeks.count

        clock.advance(10)
        engine.currentTime = 4 // 6 s behind the room
        for _ in 0..<PlaybackCoordinator.driftCheckEveryTicks { coordinator.tick() }
        await drainMainActor()

        #expect(engine.seeks.count == seeksBefore + 1)
        #expect(abs((engine.seeks.last ?? 0) - 10) < 0.001)
    }

    @Test func moderateDriftAdjustsRateThenRestores() async {
        let coordinator = makeCoordinator()
        await deliver(Fixtures.snapshot(isPlaying: true, position: 0), to: coordinator)

        clock.advance(10)
        engine.currentTime = 11.2 // 1.2 s ahead
        for _ in 0..<PlaybackCoordinator.driftCheckEveryTicks { coordinator.tick() }
        #expect(engine.rate < 1)

        engine.currentTime = 10.1 // back within tolerance
        for _ in 0..<PlaybackCoordinator.driftCheckEveryTicks { coordinator.tick() }
        #expect(engine.rate == 1)
    }

    @Test func driftIsNotCorrectedRightAfterASeek() async {
        let coordinator = makeCoordinator()
        await deliver(Fixtures.snapshot(isPlaying: true, position: 0), to: coordinator)
        let seeksBefore = engine.seeks.count
        clock.advance(1) // within the 3 s cooldown
        engine.currentTime = 50
        for _ in 0..<PlaybackCoordinator.driftCheckEveryTicks { coordinator.tick() }
        await drainMainActor()
        #expect(engine.seeks.count == seeksBefore)
    }

    @Test func participantPauseIsLocalAndNeverSent() async {
        let coordinator = makeCoordinator()
        coordinator.updateRole(isHost: false)
        await deliver(Fixtures.snapshot(isPlaying: true), to: coordinator)

        coordinator.pause()
        #expect(coordinator.isLocallyPaused)
        #expect(engine.state == .paused)
        #expect(commander.controls.isEmpty)
    }

    @Test func participantResumeRejoinsLivePosition() async {
        let coordinator = makeCoordinator()
        coordinator.updateRole(isHost: false)
        await deliver(Fixtures.snapshot(isPlaying: true, position: 0), to: coordinator)
        coordinator.pause()
        clock.advance(30)
        coordinator.play()
        await drainMainActor()
        #expect(!coordinator.isLocallyPaused)
        #expect(abs((engine.seeks.last ?? 0) - 30) < 0.001)
        #expect(engine.state == .playing)
    }

    @Test func participantCannotSeekOrSkip() async {
        let coordinator = makeCoordinator()
        coordinator.updateRole(isHost: false)
        await deliver(Fixtures.snapshot(), to: coordinator)
        coordinator.seek(to: 50)
        coordinator.skipToNext()
        await drainMainActor()
        #expect(commander.controls.isEmpty)
        #expect(commander.advanceCount == 0)
        #expect(coordinator.commandError != nil)
    }

    @Test func hostPauseIsSentToRoomAndAppliesAck() async {
        let coordinator = makeCoordinator()
        coordinator.updateRole(isHost: true)
        await deliver(Fixtures.snapshot(isPlaying: true, position: 0), to: coordinator)
        clock.advance(5)
        engine.currentTime = 5
        let ack = Fixtures.snapshot(isPlaying: false, position: 5, updatedAt: Fixtures.t0.addingTimeInterval(5), serverTime: Fixtures.t0.addingTimeInterval(5))
        commander.controlResult = .success(Fixtures.timed(ack, sentAt: clock.now(), receivedAt: clock.now()))

        coordinator.pause()
        await drainMainActor()

        #expect(commander.controls.first?.0 == .pause)
        #expect(commander.controls.first?.1 == 5)
        #expect(!coordinator.isRoomPlaying)
        #expect(engine.state == .paused)
    }

    @Test func rejectedHostCommandSurfacesError() async {
        let coordinator = makeCoordinator()
        coordinator.updateRole(isHost: true)
        await deliver(Fixtures.snapshot(), to: coordinator)
        commander.controlResult = .failure(.rejected("Only the host can control playback"))
        coordinator.pause()
        await drainMainActor()
        #expect(coordinator.commandError?.message == "Only the host can control playback")
        #expect(coordinator.isRoomPlaying)
    }

    @Test func hostAdvancesWhenEngineEndsOnlyOnce() async {
        let coordinator = makeCoordinator()
        coordinator.updateRole(isHost: true)
        await deliver(Fixtures.snapshot(), to: coordinator)
        engine.state = .ended
        engine.state = .playing
        engine.state = .ended
        await drainMainActor()
        #expect(commander.advanceCount == 1)
    }

    @Test func hostAdvancesFromTimelineWhenNoLocalPlayer() async {
        let coordinator = makeCoordinator(resolver: RoomSourceResolver())
        coordinator.updateRole(isHost: true)
        await deliver(Fixtures.snapshot(duration: 100, position: 99), to: coordinator)
        clock.advance(5)
        coordinator.tick()
        await drainMainActor()
        #expect(commander.advanceCount == 1)
    }

    @Test func participantNeverAdvances() async {
        let coordinator = makeCoordinator()
        coordinator.updateRole(isHost: false)
        await deliver(Fixtures.snapshot(duration: 100, position: 99), to: coordinator)
        engine.state = .ended
        clock.advance(5)
        coordinator.tick()
        await drainMainActor()
        #expect(commander.advanceCount == 0)
    }

    @Test func headphoneLossPausesLocallyWithoutPausingRoom() async {
        let coordinator = makeCoordinator()
        coordinator.updateRole(isHost: true)
        await deliver(Fixtures.snapshot(isPlaying: true), to: coordinator)
        coordinator.handleAudioSessionEvent(.outputDeviceLost)
        #expect(engine.state == .paused)
        #expect(coordinator.isLocallyPaused)
        #expect(coordinator.isRoomPlaying)
        #expect(commander.controls.isEmpty)
    }

    @Test func interruptionResumeResyncsToRoom() async {
        let coordinator = makeCoordinator()
        coordinator.updateRole(isHost: false)
        await deliver(Fixtures.snapshot(isPlaying: true, position: 0), to: coordinator)
        coordinator.handleAudioSessionEvent(.interruptionBegan)
        engine.pause() // iOS pauses us
        clock.advance(40) // a phone call
        coordinator.handleAudioSessionEvent(.interruptionEnded(shouldResume: true))
        await drainMainActor()
        #expect(abs((engine.seeks.last ?? 0) - 40) < 0.001)
        #expect(engine.state == .playing)
    }

    @Test func interruptionWithoutResumeHintStaysPaused() async {
        let coordinator = makeCoordinator()
        coordinator.updateRole(isHost: false)
        await deliver(Fixtures.snapshot(isPlaying: true), to: coordinator)
        coordinator.handleAudioSessionEvent(.interruptionBegan)
        engine.pause()
        coordinator.handleAudioSessionEvent(.interruptionEnded(shouldResume: false))
        await drainMainActor()
        #expect(coordinator.isLocallyPaused)
        #expect(engine.state == .paused)
    }

    @Test func loadFailureIsReported() async {
        engine.loadError = .sourceUnavailable
        let coordinator = makeCoordinator()
        await deliver(Fixtures.snapshot(), to: coordinator)
        #expect(coordinator.status == .failed(.sourceUnavailable))
    }

    @Test func detachStopsEverything() async {
        let coordinator = makeCoordinator()
        await deliver(Fixtures.snapshot(), to: coordinator)
        coordinator.detachRoom()
        #expect(coordinator.session == .none)
        #expect(coordinator.item == nil)
        #expect(engine.state == .idle)
    }

    @Test func snapshotsIgnoredWithoutRoomSession() async {
        let coordinator = PlaybackCoordinator(engine: engine, audioSession: nil, nowPlaying: nil, remoteCommands: nil, clock: clock, resolver: StreamResolver())
        coordinator.applyRoomSnapshot(Fixtures.timed(Fixtures.snapshot(), receivedAt: clock.now()), isResync: true)
        await drainMainActor()
        #expect(coordinator.item == nil)
        #expect(engine.loads.isEmpty)
    }

    @Test func usesServerClockOffsetNotDeviceClock() async {
        let coordinator = makeCoordinator()
        // Device clock is 100 s behind the server.
        let serverNow = clock.now().addingTimeInterval(100)
        let snapshot = Fixtures.snapshot(isPlaying: true, position: 0, updatedAt: serverNow.addingTimeInterval(-8), serverTime: serverNow)
        coordinator.applyRoomSnapshot(Fixtures.timed(snapshot, sentAt: clock.now(), receivedAt: clock.now()), isResync: true)
        await drainMainActor()
        #expect(abs((engine.seeks.last ?? 0) - 8) < 0.001)
    }
}
