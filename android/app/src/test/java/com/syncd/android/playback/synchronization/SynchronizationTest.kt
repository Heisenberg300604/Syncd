package com.syncd.android.playback.synchronization

import com.syncd.android.core.model.PlaybackSnapshot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

private fun iso(ms: Long) = Instant.ofEpochMilli(ms).toString()

private fun snap(
    position: Double = 0.0,
    isPlaying: Boolean = true,
    updatedAt: Long? = 1_000_000L,
    serverTime: Long = 1_000_000L,
    duration: Double? = 300.0,
    videoId: String? = "dQw4w9WgXcQ",
) = PlaybackSnapshot(
    videoId = videoId,
    title = "t",
    thumbnailUrl = null,
    duration = duration,
    isPlaying = isPlaying,
    position = position,
    updatedAt = updatedAt?.let(::iso),
    serverTime = iso(serverTime),
)

class ServerClockTest {
    private var now = 0L
    private val clock = ServerClock { now }

    @Test
    fun `no samples means unknown`() {
        assertNull(clock.offsetMs())
        assertNull(clock.serverNowMs())
    }

    @Test
    fun `broadcast-only uses lower bound`() {
        // Server stamped 10_000; we received at local 500 → offset ≥ 9_500.
        clock.observe(serverTimeMs = 10_000, receivedAtMs = 500)
        assertEquals(9_500L, clock.offsetMs())
        now = 1_500
        assertEquals(11_000L, clock.serverNowMs())
    }

    @Test
    fun `round trip brackets the offset and takes the midpoint`() {
        // Sent at 100, server stamped 10_150, received at 300 → offset ∈ [9_850, 10_050].
        clock.observe(serverTimeMs = 10_150, receivedAtMs = 300, sentAtMs = 100)
        assertEquals(9_950L, clock.offsetMs())
    }

    @Test
    fun `tighter samples narrow the bounds`() {
        clock.observe(serverTimeMs = 10_150, receivedAtMs = 300, sentAtMs = 100) // [9_850, 10_050]
        clock.observe(serverTimeMs = 10_520, receivedAtMs = 540, sentAtMs = 500) // [9_980, 10_020]
        assertEquals(10_000L, clock.offsetMs())
    }

    @Test
    fun `inconsistent history resets to the newest sample`() {
        clock.observe(serverTimeMs = 10_150, receivedAtMs = 300, sentAtMs = 100) // upper 10_050
        // Server clock stepped forward by a minute: lower bound now exceeds the old upper bound.
        clock.observe(serverTimeMs = 70_400, receivedAtMs = 400, sentAtMs = 350) // [70_000, 70_050]
        assertEquals(70_025L, clock.offsetMs())
    }

    @Test
    fun `reset forgets everything`() {
        clock.observe(10_000, 500)
        clock.reset()
        assertNull(clock.offsetMs())
    }
}

class PlaybackTimelineTest {
    @Test
    fun `paused returns stored position`() {
        assertEquals(42.0, PlaybackTimeline.expectedPositionSec(snap(position = 42.0, isPlaying = false), 9_999_999), 1e-9)
    }

    @Test
    fun `playing advances by server elapsed time at rate one`() {
        val s = snap(position = 10.0, updatedAt = 1_000_000)
        assertEquals(17.5, PlaybackTimeline.expectedPositionSec(s, serverNowMs = 1_007_500), 1e-9)
    }

    @Test
    fun `clamps to duration`() {
        val s = snap(position = 290.0, updatedAt = 1_000_000, duration = 300.0)
        assertEquals(300.0, PlaybackTimeline.expectedPositionSec(s, 1_060_000), 1e-9)
    }

    @Test
    fun `unknown duration does not clamp`() {
        val s = snap(position = 290.0, updatedAt = 1_000_000, duration = null)
        assertEquals(350.0, PlaybackTimeline.expectedPositionSec(s, 1_060_000), 1e-9)
    }

    @Test
    fun `server now earlier than updatedAt never rewinds`() {
        val s = snap(position = 10.0, updatedAt = 1_000_000)
        assertEquals(10.0, PlaybackTimeline.expectedPositionSec(s, 999_000), 1e-9)
    }

    @Test
    fun `falls back to snapshot serverTime without a clock estimate`() {
        val s = snap(position = 10.0, updatedAt = 1_000_000, serverTime = 1_002_000)
        assertEquals(12.0, PlaybackTimeline.expectedPositionSec(s, null), 1e-9)
    }
}

class DriftPolicyTest {
    private val policy = DriftPolicy()

    private fun decide(driftMs: Long, rate: Boolean = false, buffering: Boolean = false, sinceSeek: Long = 60_000) =
        policy.decide(100.0 + driftMs / 1000.0, 100.0, rate, buffering, sinceSeek)

    @Test fun `under 250ms no correction`() = assertEquals(DriftDecision.None, decide(240))

    @Test fun `250 to 750ms observe`() {
        assertEquals(DriftDecision.Observe, decide(250))
        assertEquals(DriftDecision.Observe, decide(-700))
    }

    @Test fun `750ms to 2s gradual when supported`() {
        assertEquals(DriftDecision.AdjustRate(0.95f), decide(1_000, rate = true)) // ahead → slow down
        assertEquals(DriftDecision.AdjustRate(1.05f), decide(-1_000, rate = true)) // behind → speed up
    }

    @Test fun `750ms to 2s only observes when rate control is unsupported`() =
        assertEquals(DriftDecision.Observe, decide(1_500, rate = false))

    @Test fun `2s and over seeks to expected`() = assertEquals(DriftDecision.Seek(100.0), decide(2_000))

    @Test fun `seek is suppressed during cooldown to avoid loops`() =
        assertEquals(DriftDecision.Observe, decide(5_000, sinceSeek = 1_000))

    @Test fun `never corrects while buffering`() = assertEquals(DriftDecision.None, decide(10_000, buffering = true))
}

class SnapshotOrderingTest {
    @Test fun `anything beats nothing`() = assertTrue(SnapshotOrdering.shouldApply(snap(), null))

    @Test fun `older updatedAt is stale`() =
        assertFalse(SnapshotOrdering.shouldApply(snap(updatedAt = 1_000), snap(updatedAt = 2_000)))

    @Test fun `newer updatedAt applies`() =
        assertTrue(SnapshotOrdering.shouldApply(snap(updatedAt = 3_000), snap(updatedAt = 2_000)))

    @Test fun `same mutation twice (ack plus broadcast) is accepted idempotently`() =
        assertTrue(SnapshotOrdering.shouldApply(snap(updatedAt = 2_000, serverTime = 2_050), snap(updatedAt = 2_000, serverTime = 2_010)))

    @Test fun `never-played cannot supersede a real mutation`() =
        assertFalse(SnapshotOrdering.shouldApply(snap(updatedAt = null), snap(updatedAt = 2_000)))
}
