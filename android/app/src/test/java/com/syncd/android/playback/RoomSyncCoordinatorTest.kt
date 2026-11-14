package com.syncd.android.playback

import com.syncd.android.core.model.PlaybackSnapshot
import com.syncd.android.core.socket.ConnectionState
import com.syncd.android.playback.coordinator.RoomSyncCoordinator
import com.syncd.android.playback.coordinator.SyncStatus
import com.syncd.android.playback.engine.EngineStatus
import com.syncd.android.playback.synchronization.DriftPolicy
import com.syncd.android.playback.synchronization.ServerClock
import com.syncd.android.testing.FakeEngine
import com.syncd.android.testing.iso
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Server time is pinned to virtual test time + [OFFSET]; snapshots are stamped in
 * server time, so expected positions are exact.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class RoomSyncCoordinatorTest {
    private val OFFSET = 1_000_000_000L
    private val playback = MutableStateFlow<PlaybackSnapshot?>(null)
    private val connection = MutableStateFlow<ConnectionState>(ConnectionState.Connected)
    private val ended = mutableListOf<String>()

    private fun TestScope.serverNow() = testScheduler.currentTime + OFFSET

    private fun TestScope.snap(videoId: String? = "dQw4w9WgXcQ", playing: Boolean = true, position: Double = 10.0) = PlaybackSnapshot(
        videoId = videoId,
        isPlaying = playing,
        position = position,
        duration = 300.0,
        updatedAt = iso(serverNow()),
        serverTime = iso(serverNow()),
    )

    private fun TestScope.start(engine: FakeEngine): RoomSyncCoordinator {
        val clock = ServerClock { testScheduler.currentTime }
        clock.observe(serverTimeMs = OFFSET, receivedAtMs = 0, sentAtMs = 0) // exact offset
        val c = RoomSyncCoordinator(
            scope = backgroundScope,
            clock = clock,
            policy = DriftPolicy(),
            monotonicNowMs = { testScheduler.currentTime },
            onTrackEnded = { ended += it },
        )
        c.attach(engine, playback, connection)
        runCurrent()
        return c
    }

    @Test
    fun `new track loads at the room position with autoplay`() = runTest {
        val engine = FakeEngine(nowMs = { testScheduler.currentTime })
        start(engine)
        playback.value = snap(position = 10.0)
        runCurrent()
        assertEquals(listOf("load:dQw4w9WgXcQ:10.0:true"), engine.calls)
    }

    @Test
    fun `room pause pauses and aligns locally`() = runTest {
        val engine = FakeEngine(nowMs = { testScheduler.currentTime })
        start(engine)
        playback.value = snap(position = 10.0)
        runCurrent()
        engine.position = 14.0
        playback.value = snap(playing = false, position = 12.0)
        runCurrent()
        assertTrue(engine.calls.containsAll(listOf("pause", "seek:12.0")))
    }

    @Test
    fun `large drift seeks once, then cooldown prevents a correction loop`() = runTest {
        val engine = FakeEngine(nowMs = { testScheduler.currentTime })
        val c = start(engine)
        playback.value = snap(position = 10.0)
        runCurrent()
        advanceTimeBy(5_000); runCurrent() // past the post-load cooldown
        engine.calls.clear()

        engine.position = 5.0 // ~10 s behind the room
        advanceTimeBy(1_000); runCurrent()
        assertEquals(1, engine.calls.count { it.startsWith("seek:") })
        assertEquals(SyncStatus.Correcting, c.status.value)

        engine.position = 0.0 // the seek "didn't land" — still far off
        advanceTimeBy(1_000); runCurrent()
        assertEquals("no second seek inside the cooldown", 1, engine.calls.count { it.startsWith("seek:") })
    }

    @Test
    fun `small drift is reported as in sync without touching the player`() = runTest {
        val engine = FakeEngine(nowMs = { testScheduler.currentTime })
        val c = start(engine)
        playback.value = snap(position = 10.0)
        runCurrent()
        advanceTimeBy(5_000)
        engine.position = 10.0 + 5.0 + 0.1 // 100 ms ahead
        engine.calls.clear()
        advanceTimeBy(1_000); runCurrent()
        assertTrue(engine.calls.isEmpty())
        assertTrue(c.status.value is SyncStatus.Synced)
    }

    @Test
    fun `local interruption is never auto-resumed, resync rejoins the timeline`() = runTest {
        val engine = FakeEngine(nowMs = { testScheduler.currentTime })
        val c = start(engine)
        playback.value = snap(position = 10.0)
        runCurrent()
        advanceTimeBy(5_000); runCurrent()
        engine.setStatus(EngineStatus.Paused) // e.g. audio focus loss
        engine.calls.clear()
        advanceTimeBy(1_000); runCurrent()
        assertEquals(SyncStatus.PausedLocally, c.status.value)
        assertFalse(engine.calls.contains("play"))

        c.resync()
        assertTrue(engine.calls.any { it.startsWith("seek:") })
        assertTrue(engine.calls.contains("play"))
    }

    @Test
    fun `track end is reported exactly once per video`() = runTest {
        val engine = FakeEngine(nowMs = { testScheduler.currentTime })
        start(engine)
        playback.value = snap()
        runCurrent()
        engine.setStatus(EngineStatus.Ended)
        runCurrent()
        engine.setStatus(EngineStatus.Paused)
        engine.setStatus(EngineStatus.Ended)
        runCurrent()
        assertEquals(listOf("dQw4w9WgXcQ"), ended)
    }

    @Test
    fun `disconnected socket keeps playing but never claims sync`() = runTest {
        val engine = FakeEngine(nowMs = { testScheduler.currentTime })
        val c = start(engine)
        playback.value = snap()
        runCurrent()
        connection.value = ConnectionState.Reconnecting(1, 1_000, null)
        advanceTimeBy(5_000); runCurrent()
        assertEquals(SyncStatus.Offline, c.status.value)
        assertFalse("a transient disconnect must not stop playback", engine.calls.contains("stop"))
    }

    @Test
    fun `clearing the room track stops the player`() = runTest {
        val engine = FakeEngine(nowMs = { testScheduler.currentTime })
        val c = start(engine)
        playback.value = snap()
        runCurrent()
        playback.value = snap(videoId = null, playing = false, position = 0.0)
        runCurrent()
        assertTrue(engine.calls.contains("stop"))
        assertEquals(SyncStatus.NoTrack, c.status.value)
    }

    @Test
    fun `invalid track id is unavailable, not attempted`() = runTest {
        val engine = FakeEngine(nowMs = { testScheduler.currentTime })
        val c = start(engine)
        playback.value = snap(videoId = "bad id!")
        runCurrent()
        assertFalse(engine.calls.any { it.startsWith("load:") })
        assertTrue(c.status.value is SyncStatus.Unavailable)
    }
}
