package com.syncd.android.feature.room

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.syncd.android.core.model.HostUpdatePayload
import com.syncd.android.core.model.PlaybackSnapshot
import com.syncd.android.core.network.ApiResult
import com.syncd.android.core.util.parseInstantMillis
import com.syncd.android.data.repository.RoomSessionRepository
import com.syncd.android.di.AppContainer
import com.syncd.android.domain.model.RoomState
import com.syncd.android.playback.coordinator.RoomSyncCoordinator
import com.syncd.android.playback.coordinator.SyncStatus
import com.syncd.android.playback.engine.EngineStatus
import com.syncd.android.playback.engine.YouTubeRoomEngine
import com.syncd.android.playback.synchronization.PlaybackTimeline
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed interface RoomOpenState {
    data object Loading : RoomOpenState
    data object Ready : RoomOpenState
    data class Failed(val message: String) : RoomOpenState
}

/**
 * Screen-scoped controller for one room. The room's live state lives in the
 * app-scoped [RoomSessionRepository]; this ViewModel owns only what must die
 * with the screen: the visible YouTube engine and its sync coordinator.
 *
 * Host-only actions are offered to the host in the UI as a convenience; the
 * server rejects them for anyone else and the rejection is surfaced as a notice.
 */
class RoomViewModel(private val code: String, private val c: AppContainer) : ViewModel() {

    private val _open = MutableStateFlow<RoomOpenState>(RoomOpenState.Loading)
    val open: StateFlow<RoomOpenState> = _open.asStateFlow()

    val room: StateFlow<RoomState?> = c.rooms.state
        .map { it?.takeIf { s -> s.roomCode == code } }
        .stateIn(viewModelScope, SharingStarted.Eagerly, c.rooms.state.value?.takeIf { it.roomCode == code })

    val connection = c.rooms.connection
    val selfId: String? = c.users.currentUser?.id

    private val localNotices = Channel<String>(Channel.BUFFERED)
    val notices = merge(c.rooms.notices, localNotices.receiveAsFlow())

    private val _navigateBack = Channel<Unit>(Channel.BUFFERED)
    val navigateBack = _navigateBack.receiveAsFlow()

    private val _dismissedNotice = MutableStateFlow<HostUpdatePayload?>(null)
    val dismissedNotice = _dismissedNotice.asStateFlow()

    private val _leaving = MutableStateFlow(false)
    val leaving = _leaving.asStateFlow()

    val engine = YouTubeRoomEngine(c.monotonicNowMs)
    private val coordinator = RoomSyncCoordinator(
        scope = viewModelScope,
        clock = c.serverClock,
        policy = c.driftPolicy,
        monotonicNowMs = c.monotonicNowMs,
        onTrackEnded = {
            // Only the host advances the shared queue (the server enforces this too).
            if (isHost) viewModelScope.launch { c.rooms.queueAdvance() }
        },
    )
    val sync = coordinator.status

    val isHost: Boolean get() = room.value?.isHost(selfId) == true

    init {
        load()
    }

    fun load() {
        _open.value = RoomOpenState.Loading
        viewModelScope.launch {
            _open.value = when (val r = c.rooms.open(code)) {
                is ApiResult.Success -> RoomOpenState.Ready
                is ApiResult.Failure -> RoomOpenState.Failed(RoomSessionRepository.describeOpenFailure(r.error))
            }
        }
    }

    // ---- Visible player lifecycle ---------------------------------------------------

    /** The YouTube view is on screen and the app is in the foreground. */
    fun onPlayerVisible() {
        // One audible source at a time: device playback yields to the room.
        c.playback.pause()
        coordinator.attach(engine, room.map { it?.playback }, connection)
    }

    fun onPlayerHidden() = coordinator.detach()

    fun resync() = coordinator.resync()

    // ---- Timeline ---------------------------------------------------------------------

    fun roomPositionSec(): Double =
        room.value?.playback?.let { PlaybackTimeline.expectedPositionSec(it, c.serverClock.serverNowMs()) } ?: 0.0

    /** Seconds left on a pending host hand-over, measured on the server clock. */
    fun secondsUntil(deadlineIso: String?): Long? {
        val deadline = parseInstantMillis(deadlineIso) ?: return null
        val now = c.serverClock.serverNowMs() ?: return null
        return ((deadline - now) / 1000).coerceAtLeast(0)
    }

    private fun localOrRoomPosition(p: PlaybackSnapshot): Double {
        val es = engine.state.value
        val engineHasTrack = es.videoId == p.videoId &&
            (es.status == EngineStatus.Playing || es.status == EngineStatus.Paused)
        return if (engineHasTrack) engine.positionSec() else roomPositionSec()
    }

    // ---- Host controls ----------------------------------------------------------------

    fun togglePlay() {
        val p = room.value?.playback ?: return
        if (p.videoId == null) return
        // The room is playing but this device stopped (interruption, local pause):
        // rejoin live instead of pausing the room for everyone.
        if (p.isPlaying && coordinator.status.value == SyncStatus.PausedLocally) {
            coordinator.resync()
            return
        }
        val position = localOrRoomPosition(p)
        viewModelScope.launch { c.rooms.control(if (p.isPlaying) "pause" else "play", position) }
    }

    fun seekTo(sec: Double) {
        viewModelScope.launch { c.rooms.control("seek", sec) }
    }

    fun skip() {
        viewModelScope.launch { c.rooms.queueAdvance() }
    }

    fun stopPlayback() {
        viewModelScope.launch { c.rooms.clearPlayback() }
    }

    fun removeFromQueue(index: Int) {
        viewModelScope.launch { c.rooms.queueRemove(index) }
    }

    fun moveInQueue(from: Int, to: Int) {
        viewModelScope.launch { c.rooms.queueReorder(from, to) }
    }

    fun clearQueue() {
        viewModelScope.launch { c.rooms.queueClear() }
    }

    fun transferHost(userId: String) {
        viewModelScope.launch { c.rooms.transferHost(userId) }
    }

    fun dismissHostNotice(notice: HostUpdatePayload) {
        _dismissedNotice.value = notice
    }

    // ---- Chat -------------------------------------------------------------------------

    fun sendChat(text: String) = c.rooms.sendChat(text)
    fun retryChat(key: String) = c.rooms.retryChat(key)
    fun discardChat(key: String) = c.rooms.discardChat(key)

    // ---- Membership -------------------------------------------------------------------

    fun leave() {
        if (_leaving.value) return
        _leaving.value = true
        viewModelScope.launch {
            when (val r = c.rooms.leave()) {
                is ApiResult.Success -> {
                    if (r.value.roomDeleted) localNotices.send("You were the last one here — the room has closed.")
                    _navigateBack.send(Unit)
                }
                is ApiResult.Failure -> localNotices.send("Couldn't leave: ${r.error.message}")
            }
            _leaving.value = false
        }
    }

    /** After being removed (e.g. left on another device): join again with the code. */
    fun rejoin() {
        viewModelScope.launch {
            when (val r = c.rooms.join(code)) {
                is ApiResult.Success -> _open.value = RoomOpenState.Ready
                is ApiResult.Failure -> localNotices.send(RoomSessionRepository.describeOpenFailure(r.error))
            }
        }
    }

    fun dismissAndExit() {
        viewModelScope.launch {
            c.rooms.dismiss()
            _navigateBack.send(Unit)
        }
    }

    override fun onCleared() {
        coordinator.detach()
    }
}
