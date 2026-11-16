package com.syncd.android.playback.coordinator

import com.syncd.android.core.model.PlaybackSnapshot
import com.syncd.android.core.socket.ConnectionState
import com.syncd.android.playback.engine.EngineState
import com.syncd.android.playback.engine.EngineStatus
import com.syncd.android.playback.engine.RoomPlaybackEngine
import com.syncd.android.playback.source.SourceResolver
import com.syncd.android.playback.synchronization.DriftDecision
import com.syncd.android.playback.synchronization.DriftPolicy
import com.syncd.android.playback.synchronization.PlaybackTimeline
import com.syncd.android.playback.synchronization.ServerClock
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.abs

/** What the UI may honestly claim about local playback vs. the room. */
sealed interface SyncStatus {
    data object NoTrack : SyncStatus
    data object Loading : SyncStatus
    data object Buffering : SyncStatus
    data class Synced(val driftMs: Long) : SyncStatus
    data object Correcting : SyncStatus
    /** The room is playing but the local player was paused (interruption, tap). Never auto-resumed. */
    data object PausedLocally : SyncStatus
    /** The track finished locally; waiting for the host to advance. */
    data object WaitingForNext : SyncStatus
    data class Unavailable(val message: String) : SyncStatus
    /** Socket down: still playing from the last known state, not claiming sync. */
    data object Offline : SyncStatus
}

/**
 * Reconciles a local [RoomPlaybackEngine] with the server-authoritative room
 * playback snapshot. One-directional by construction: it reads room state and
 * drives the engine, and never emits anything to the server — so applying a
 * remote snapshot can never echo back as a new command. The only upward signal
 * is [onTrackEnded], which the caller turns into `queue:advance` when (and only
 * when) the local user is the host.
 */
class RoomSyncCoordinator(
    private val scope: CoroutineScope,
    private val clock: ServerClock,
    private val policy: DriftPolicy,
    private val monotonicNowMs: () -> Long,
    private val onTrackEnded: (videoId: String) -> Unit,
    private val tickMs: Long = 1_000,
    /** After a load/apply, a paused engine is assumed to still be starting (autoplay may be deferred). */
    private val startGraceMs: Long = 3_000,
) {
    private val _status = MutableStateFlow<SyncStatus>(SyncStatus.NoTrack)
    val status: StateFlow<SyncStatus> = _status.asStateFlow()

    private var engine: RoomPlaybackEngine? = null
    private var job: Job? = null
    private var snapshot: PlaybackSnapshot? = null
    private var connection: ConnectionState = ConnectionState.Idle
    private var lastSeekAtMs = Long.MIN_VALUE / 2
    private var lastApplyAtMs = Long.MIN_VALUE / 2
    private var endedHandledFor: String? = null
    private var rateAdjusted = false

    fun attach(
        engine: RoomPlaybackEngine,
        playback: Flow<PlaybackSnapshot?>,
        connectionState: Flow<ConnectionState>,
    ) {
        detach()
        this.engine = engine
        job = scope.launch {
            launch { connectionState.collect { connection = it } }
            launch { playback.distinctUntilChanged().collect { apply(it) } }
            launch { engine.state.collect(::onEngineState) }
            launch {
                while (isActive) {
                    delay(tickMs)
                    tick()
                }
            }
        }
    }

    fun detach() {
        job?.cancel()
        job = null
        engine = null
        snapshot = null
        endedHandledFor = null
        _status.value = SyncStatus.NoTrack
    }

    /** User asked to rejoin the room's timeline (after an interruption paused us). */
    fun resync() {
        val e = engine ?: return
        val s = snapshot ?: return
        if (s.videoId == null) return
        if (e.state.value.videoId != s.videoId || e.state.value.status == EngineStatus.Error) {
            load(e, s)
            return
        }
        if (s.isPlaying) {
            seek(e, expected(s))
            e.play()
        } else {
            seek(e, s.position)
        }
        lastApplyAtMs = monotonicNowMs()
    }

    private fun expected(s: PlaybackSnapshot) = PlaybackTimeline.expectedPositionSec(s, clock.serverNowMs())

    private fun apply(s: PlaybackSnapshot?) {
        snapshot = s
        val e = engine ?: return
        val videoId = s?.videoId
        if (s == null || videoId == null) {
            if (e.state.value.status != EngineStatus.Idle) e.stop()
            _status.value = SyncStatus.NoTrack
            return
        }
        if (SourceResolver.forRoomTrack(videoId) == null) {
            e.stop()
            _status.value = SyncStatus.Unavailable("This track can't be played on Android.")
            return
        }
        val es = e.state.value
        if (es.videoId != videoId || es.status == EngineStatus.Idle) {
            load(e, s)
            return
        }
        if (s.isPlaying) {
            val target = expected(s)
            if (abs(e.positionSec() - target) > ALIGN_TOLERANCE_SEC) seek(e, target)
            if (es.status != EngineStatus.Playing && es.status != EngineStatus.Buffering) e.play()
        } else {
            e.pause()
            if (abs(e.positionSec() - s.position) > ALIGN_TOLERANCE_SEC) seek(e, s.position)
        }
        resetRate(e)
        lastApplyAtMs = monotonicNowMs()
    }

    private fun load(e: RoomPlaybackEngine, s: PlaybackSnapshot) {
        val videoId = s.videoId ?: return
        endedHandledFor = null
        resetRate(e)
        e.load(videoId, if (s.isPlaying) expected(s) else s.position, autoplay = s.isPlaying)
        lastSeekAtMs = monotonicNowMs()
        lastApplyAtMs = lastSeekAtMs
        _status.value = SyncStatus.Loading
    }

    private fun onEngineState(es: EngineState) {
        val s = snapshot ?: return
        if (es.status == EngineStatus.Ended && es.videoId != null && es.videoId == s.videoId &&
            endedHandledFor != es.videoId
        ) {
            endedHandledFor = es.videoId
            onTrackEnded(es.videoId)
        }
    }

    private fun tick() {
        val e = engine ?: return
        val s = snapshot ?: return
        if (s.videoId == null) return
        val es = e.state.value
        val now = monotonicNowMs()

        val local: SyncStatus = when (es.status) {
            EngineStatus.Error -> SyncStatus.Unavailable(es.error ?: "Playback failed.")
            EngineStatus.Idle -> {
                load(e, s)
                SyncStatus.Loading
            }
            EngineStatus.Loading -> SyncStatus.Loading
            EngineStatus.Buffering -> SyncStatus.Buffering
            EngineStatus.Ended -> SyncStatus.WaitingForNext
            EngineStatus.Paused -> when {
                !s.isPlaying -> SyncStatus.Synced(0)
                now - lastApplyAtMs < startGraceMs -> {
                    e.play()
                    SyncStatus.Loading
                }
                else -> SyncStatus.PausedLocally
            }
            EngineStatus.Playing -> if (!s.isPlaying) {
                e.pause() // the room is authoritative
                SyncStatus.Correcting
            } else {
                correctDrift(e, s, now)
            }
        }
        _status.value = if (connection !is ConnectionState.Connected && local !is SyncStatus.Unavailable) {
            SyncStatus.Offline
        } else {
            local
        }
    }

    private fun correctDrift(e: RoomPlaybackEngine, s: PlaybackSnapshot, now: Long): SyncStatus {
        val target = expected(s)
        val local = e.positionSec()
        return when (val d = policy.decide(local, target, e.supportsRateCorrection, buffering = false, now - lastSeekAtMs)) {
            DriftDecision.None, DriftDecision.Observe -> {
                if (d == DriftDecision.None) resetRate(e)
                SyncStatus.Synced(((local - target) * 1000).toLong())
            }
            is DriftDecision.AdjustRate -> {
                e.setRate(d.rate)
                rateAdjusted = true
                SyncStatus.Correcting
            }
            is DriftDecision.Seek -> {
                resetRate(e)
                seek(e, d.targetSec)
                SyncStatus.Correcting
            }
        }
    }

    private fun seek(e: RoomPlaybackEngine, sec: Double) {
        e.seekTo(sec)
        lastSeekAtMs = monotonicNowMs()
    }

    private fun resetRate(e: RoomPlaybackEngine) {
        if (rateAdjusted) {
            e.setRate(1f)
            rateAdjusted = false
        }
    }

    private companion object {
        /** On an explicit room change, re-align when off by more than this. */
        const val ALIGN_TOLERANCE_SEC = 0.25
    }
}
