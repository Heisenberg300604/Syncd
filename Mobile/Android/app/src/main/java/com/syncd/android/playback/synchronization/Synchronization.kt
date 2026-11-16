package com.syncd.android.playback.synchronization

import com.syncd.android.core.model.PlaybackSnapshot
import com.syncd.android.core.util.parseInstantMillis
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Estimates the server's wall clock from the `serverTime` stamps the backend puts
 * on every [PlaybackSnapshot]. The device's wall clock is never trusted (users
 * have skewed clocks); time is measured on a monotonic clock and offset.
 *
 * Every sample bounds the offset (server epoch − local monotonic):
 *  - Any message: the server stamped S before we received it at R, so
 *    serverNow(R) ≥ S  ⇒  offset ≥ S − R          (lower bound)
 *  - An ack to a request sent at T0: S was stamped after T0, so
 *    offset ≤ S − T0                               (upper bound)
 * The estimate is the midpoint of the tightest bounds, or the lower bound when
 * only broadcasts have been seen (biased late by one-way latency, typically
 * well under the 250 ms "no correction" band).
 */
class ServerClock(private val monotonicNowMs: () -> Long) {
    private var lower: Long? = null
    private var upper: Long? = null

    @Synchronized
    fun observe(serverTimeMs: Long, receivedAtMs: Long, sentAtMs: Long? = null) {
        val lb = serverTimeMs - receivedAtMs
        val ub = sentAtMs?.let { serverTimeMs - it }
        val newLower = max(lower ?: lb, lb)
        val newUpper = when {
            ub == null -> upper
            upper == null -> ub
            else -> min(upper!!, ub)
        }
        if (newUpper != null && newLower > newUpper) {
            // Inconsistent history (clock step on the server, long drift): restart from this sample.
            lower = lb
            upper = ub
        } else {
            lower = newLower
            upper = newUpper
        }
    }

    /** Convenience for ISO timestamps; ignores unparseable input. */
    fun observe(serverTimeIso: String, receivedAtMs: Long, sentAtMs: Long? = null) {
        parseInstantMillis(serverTimeIso)?.let { observe(it, receivedAtMs, sentAtMs) }
    }

    @Synchronized
    fun offsetMs(): Long? {
        val lb = lower ?: return null
        val ub = upper ?: return lb
        return (lb + ub) / 2
    }

    fun serverNowMs(): Long? = offsetMs()?.let { monotonicNowMs() + it }

    /** Converts a server-clock instant to local monotonic time (e.g. a host-transfer deadline). */
    fun toLocalMonotonic(serverEpochMs: Long): Long? = offsetMs()?.let { serverEpochMs - it }

    @Synchronized
    fun reset() {
        lower = null
        upper = null
    }
}

/**
 * The backend's playback model: P(T) = P₀ + (T − T₀) × rate, with P₀ =
 * `position`, T₀ = `updatedAt`, T = server now and rate = 1.0 (the server has no
 * rate field; it never plays at any other speed). Paused ⇒ P₀.
 */
object PlaybackTimeline {
    const val PLAYBACK_RATE = 1.0

    fun expectedPositionSec(snapshot: PlaybackSnapshot, serverNowMs: Long?): Double {
        if (!snapshot.isPlaying) return snapshot.position.coerceAtLeast(0.0)
        val t0 = parseInstantMillis(snapshot.updatedAt) ?: return snapshot.position
        val now = serverNowMs ?: parseInstantMillis(snapshot.serverTime) ?: return snapshot.position
        val elapsedSec = max(0L, now - t0) / 1000.0
        val p = snapshot.position + elapsedSec * PLAYBACK_RATE
        val d = snapshot.duration
        return if (d != null && d > 0) min(p, d) else p
    }
}

sealed interface DriftDecision {
    /** In sync (or not safe to judge); play at normal speed. */
    data object None : DriftDecision
    /** Noticeable but small — recheck before acting, to avoid audible corrections. */
    data object Observe : DriftDecision
    /** Nudge speed to converge without a jump. Only for engines with fine-grained rate control. */
    data class AdjustRate(val rate: Float) : DriftDecision
    /** Authoritative seek. */
    data class Seek(val targetSec: Double) : DriftDecision
}

/**
 * Drift thresholds from the Android PRD §5.10 — starting values, to be tuned on
 * devices. [cooldownMs] stops seek loops when a source is slow to settle after a
 * seek (YouTube rebuffers and lands slightly off), which would otherwise produce
 * an audible correction every check.
 */
class DriftPolicy(
    private val ignoreBelowMs: Long = 250,
    private val observeBelowMs: Long = 750,
    private val seekAtOrAboveMs: Long = 2_000,
    private val cooldownMs: Long = 4_000,
    private val rateNudge: Float = 0.05f,
) {
    /**
     * @param localSec where the local engine is.
     * @param expectedSec where the room says it should be (see [PlaybackTimeline]).
     * @param buffering never correct while buffering — the position is not settled.
     */
    fun decide(
        localSec: Double,
        expectedSec: Double,
        supportsRateCorrection: Boolean,
        buffering: Boolean,
        msSinceLastSeek: Long,
    ): DriftDecision {
        if (buffering) return DriftDecision.None
        val driftMs = ((localSec - expectedSec) * 1000).toLong()
        val magnitude = abs(driftMs)
        return when {
            magnitude < ignoreBelowMs -> DriftDecision.None
            magnitude < observeBelowMs -> DriftDecision.Observe
            magnitude < seekAtOrAboveMs ->
                if (supportsRateCorrection) {
                    // Ahead ⇒ slow down; behind ⇒ speed up.
                    DriftDecision.AdjustRate(if (driftMs > 0) 1f - rateNudge else 1f + rateNudge)
                } else {
                    DriftDecision.Observe
                }
            msSinceLastSeek < cooldownMs -> DriftDecision.Observe
            else -> DriftDecision.Seek(expectedSec)
        }
    }
}

/**
 * Stale/out-of-order rejection. The server has no revision number; `updatedAt` is
 * rewritten on every set / control / clear, so it orders mutations. An equal
 * `updatedAt` is the same mutation delivered twice (ack + broadcast) and is
 * accepted idempotently.
 */
object SnapshotOrdering {
    fun shouldApply(incoming: PlaybackSnapshot, current: PlaybackSnapshot?): Boolean {
        if (current == null) return true
        val inc = parseInstantMillis(incoming.updatedAt)
        val cur = parseInstantMillis(current.updatedAt)
        return when {
            inc == null && cur == null ->
                (parseInstantMillis(incoming.serverTime) ?: 0) >= (parseInstantMillis(current.serverTime) ?: 0)
            inc == null -> false // "never played" cannot supersede a real mutation
            cur == null -> true
            else -> inc >= cur
        }
    }
}
