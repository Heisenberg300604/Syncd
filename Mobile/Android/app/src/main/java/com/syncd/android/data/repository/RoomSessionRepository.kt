package com.syncd.android.data.repository

import com.syncd.android.core.model.ChatSendPayload
import com.syncd.android.core.model.HostTransferPayload
import com.syncd.android.core.model.LeaveRoomResponse
import com.syncd.android.core.model.PlaybackAck
import com.syncd.android.core.model.PlaybackControlPayload
import com.syncd.android.core.model.PlaybackSetPayload
import com.syncd.android.core.model.PublicUser
import com.syncd.android.core.model.QueueAck
import com.syncd.android.core.model.QueueAdvancePayload
import com.syncd.android.core.model.QueueRemovePayload
import com.syncd.android.core.model.QueueReorderPayload
import com.syncd.android.core.model.QueueTrackPayload
import com.syncd.android.core.model.RoomCodePayload
import com.syncd.android.core.model.RoomDto
import com.syncd.android.core.model.RoomJoinAck
import com.syncd.android.core.model.SimpleAck
import com.syncd.android.core.model.TrackInput
import com.syncd.android.core.network.ApiError
import com.syncd.android.core.network.ApiResult
import com.syncd.android.core.network.SyncDApi
import com.syncd.android.core.network.SyncDJson
import com.syncd.android.core.network.apiCall
import com.syncd.android.core.network.map
import com.syncd.android.core.socket.ConnectionState
import com.syncd.android.core.socket.RealtimeClient
import com.syncd.android.core.socket.RealtimeEvent
import com.syncd.android.core.socket.SocketEvents
import com.syncd.android.core.socket.SocketResult
import com.syncd.android.core.util.CHAT_MAX_LENGTH
import com.syncd.android.data.local.RecentRoom
import com.syncd.android.data.local.RecentRoomsStore
import com.syncd.android.domain.model.ChatEntry
import com.syncd.android.domain.model.ChatStatus
import com.syncd.android.domain.model.RoomPhase
import com.syncd.android.domain.model.RoomReducer
import com.syncd.android.domain.model.RoomState
import com.syncd.android.playback.synchronization.ServerClock
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import java.util.UUID

/** Outcome of a room command, for callers that need more than the shared notice. */
sealed interface CommandResult {
    data object Ok : CommandResult
    data class Rejected(val message: String) : CommandResult
    /** Not connected, or no ack in time. */
    data class Unreachable(val message: String) : CommandResult
}

/**
 * The single active room for the signed-in session (app-scoped, so the room keeps
 * its live state while the user is on another screen and the mini-player can
 * show it).
 *
 * Authority: REST establishes membership; the socket `room:join` ack is the
 * authoritative snapshot (presence + playback + queue + recent chat) and is
 * re-requested after every reconnect — there is no event replay on the server.
 * Every mutation goes to the server and is reflected only once the server
 * answers; nothing here decides permissions (the server enforces host-only).
 *
 * All state transitions run on [stateDispatcher] (single-threaded) so socket
 * events, acks and user commands can never interleave mid-update.
 */
class RoomSessionRepository(
    private val scope: CoroutineScope,
    private val stateDispatcher: CoroutineDispatcher,
    private val api: SyncDApi,
    private val realtime: RealtimeClient,
    private val clock: ServerClock,
    private val recents: RecentRoomsStore?,
    private val selfUser: () -> PublicUser?,
    private val wallClockMs: () -> Long = System::currentTimeMillis,
) {
    private val _state = MutableStateFlow<RoomState?>(null)
    val state: StateFlow<RoomState?> = _state.asStateFlow()

    val connection: StateFlow<ConnectionState> = realtime.connectionState

    private val _notices = MutableSharedFlow<String>(extraBufferCapacity = 16)
    /** Transient, user-facing errors (rejected commands, timeouts). */
    val notices: SharedFlow<String> = _notices.asSharedFlow()

    /** The room the socket is confirmed joined to. Broadcasts carry no room code, so this gates them. */
    private var joinedRoomCode: String? = null
    /** Set while a `room:join` is in flight; events arriving meanwhile are buffered. */
    private var joiningRoomCode: String? = null
    private val joinBuffer = mutableListOf<RealtimeEvent>()
    private var backgroundStop: Job? = null

    init {
        scope.launch(stateDispatcher) { realtime.events.collect(::onEvent) }
    }

    // ---- Room lifecycle (REST) ---------------------------------------------------

    suspend fun create(): ApiResult<String> = apiCall { api.createRoom() }.map { enter(it.room); it.room.roomCode }

    suspend fun join(roomCode: String): ApiResult<String> =
        apiCall { api.joinRoom(roomCode) }.map { enter(it.room); it.room.roomCode }

    /** Opens a room the user should already belong to (recent rooms, returning to the room screen). */
    suspend fun open(roomCode: String): ApiResult<String> {
        val current = _state.value
        if (current != null && current.roomCode == roomCode &&
            current.phase !is RoomPhase.Removed && current.phase !is RoomPhase.Closed
        ) {
            realtime.start()
            return ApiResult.Success(roomCode)
        }
        return when (val r = apiCall { api.getRoom(roomCode) }) {
            is ApiResult.Success -> {
                enter(r.value.room)
                ApiResult.Success(roomCode)
            }
            is ApiResult.Failure -> r
        }
    }

    private suspend fun enter(room: RoomDto) = withContext(stateDispatcher) {
        val previous = _state.value
        if (previous != null && previous.roomCode != room.roomCode) leaveSocketRoom(previous.roomCode)
        joinedRoomCode = null
        joiningRoomCode = null
        joinBuffer.clear()
        _state.value = RoomReducer.fromRest(room)
        recents?.record(RecentRoom(room.roomCode, room.host.username, wallClockMs(), room.currentTitle))
        realtime.start()
        if (realtime.connectionState.value is ConnectionState.Connected) scope.launch(stateDispatcher) { joinActive() }
    }

    /**
     * `POST /rooms/:code/leave`. Local state is cleared only after the server
     * confirms, so a failure never leaves a false "left" state.
     */
    suspend fun leave(): ApiResult<LeaveRoomResponse> {
        val code = _state.value?.roomCode ?: return ApiResult.Success(LeaveRoomResponse(left = true))
        val result = apiCall { api.leaveRoom(code) }
        if (result is ApiResult.Success) {
            withContext(stateDispatcher) {
                leaveSocketRoom(code)
                clearLocal()
            }
            recents?.remove(code)
        }
        return result
    }

    /** Forget a Removed/Closed room locally (nothing to tell the server). */
    suspend fun dismiss() = withContext(stateDispatcher) {
        _state.value?.let { if (it.phase is RoomPhase.Closed) recents?.remove(it.roomCode) }
        clearLocal()
    }

    /** Sign-out: drop everything and close the socket. */
    suspend fun reset() = withContext(stateDispatcher) {
        clearLocal()
        clock.reset()
    }

    private fun clearLocal() {
        _state.value = null
        joinedRoomCode = null
        joiningRoomCode = null
        joinBuffer.clear()
        realtime.stop()
    }

    private suspend fun leaveSocketRoom(code: String) {
        if (realtime.connectionState.value is ConnectionState.Connected) {
            realtime.request(SocketEvents.ROOM_LEAVE, encode(RoomCodePayload.serializer(), RoomCodePayload(code)), 3_000) { Unit }
        }
    }

    /**
     * Keeps the socket while the app is briefly backgrounded (switching apps to
     * share the room code must not trigger a host hand-over countdown), and
     * disconnects after [BACKGROUND_DISCONNECT_MS] to save battery. Returning to
     * the foreground reconnects and re-reconciles through `room:join`.
     */
    fun onAppForegroundChanged(foreground: Boolean) {
        scope.launch(stateDispatcher) {
            backgroundStop?.cancel()
            if (_state.value == null) return@launch
            if (foreground) {
                realtime.start()
            } else {
                backgroundStop = scope.launch(stateDispatcher) {
                    delay(BACKGROUND_DISCONNECT_MS)
                    realtime.stop()
                }
            }
        }
    }

    // ---- Socket events -----------------------------------------------------------

    private suspend fun onEvent(event: RealtimeEvent) {
        when (event) {
            RealtimeEvent.Connected -> scope.launch(stateDispatcher) { joinActive() }
            is RealtimeEvent.Disconnected -> {
                joinedRoomCode = null
                joiningRoomCode = null
                joinBuffer.clear()
            }
            else -> {
                val code = _state.value?.roomCode ?: return
                when {
                    joinedRoomCode == code -> applyBroadcast(event)
                    joiningRoomCode == code -> joinBuffer += event
                }
            }
        }
    }

    private fun applyBroadcast(event: RealtimeEvent) {
        when (event) {
            is RealtimeEvent.Presence -> update { RoomReducer.applyPresence(it, event.snapshot) }
            is RealtimeEvent.Playback -> {
                clock.observe(event.snapshot.serverTime, event.receivedAtMs)
                update { RoomReducer.applyPlayback(it, event.snapshot) }
            }
            is RealtimeEvent.Queue -> update { RoomReducer.applyQueue(it, event.items) }
            is RealtimeEvent.Chat -> update { RoomReducer.applyChat(it, event.message, selfUser()?.id) }
            is RealtimeEvent.HostUpdate -> update { RoomReducer.applyHostUpdate(it, event.payload) }
            is RealtimeEvent.HostPending -> update { RoomReducer.applyHostPending(it, event.payload) }
            RealtimeEvent.Connected, is RealtimeEvent.Disconnected -> Unit
        }
    }

    /** Must run on [stateDispatcher]. */
    private suspend fun joinActive() {
        val code = _state.value?.roomCode ?: return
        val phase = _state.value?.phase
        if (phase is RoomPhase.Removed || phase is RoomPhase.Closed) return
        if (joiningRoomCode == code) return
        joiningRoomCode = code
        joinBuffer.clear()

        val result = realtime.request(SocketEvents.ROOM_JOIN, encode(RoomCodePayload.serializer(), RoomCodePayload(code))) { raw ->
            raw?.let { SyncDJson.decodeFromString(RoomJoinAck.serializer(), it) }
        }
        if (joiningRoomCode != code) return // superseded (room switched or disconnected)
        joiningRoomCode = null
        if (_state.value?.roomCode != code) return

        when (result) {
            is SocketResult.Ok -> {
                val ack = result.value
                if (ack.ok) {
                    ack.playback?.let { clock.observe(it.serverTime, result.receivedAtMs, result.sentAtMs) }
                    joinedRoomCode = code
                    update { RoomReducer.applyJoinAck(it, ack) }
                    // Replay what raced the ack. Presence/queue are skipped: the ack's
                    // copies were read at or after those broadcasts and a fresh presence
                    // broadcast follows every join.
                    joinBuffer.forEach { e ->
                        if (e is RealtimeEvent.Playback || e is RealtimeEvent.Chat ||
                            e is RealtimeEvent.HostUpdate || e is RealtimeEvent.HostPending
                        ) {
                            applyBroadcast(e)
                        }
                    }
                } else {
                    val terminal = RoomReducer.phaseForJoinError(ack.message)
                    if (terminal is RoomPhase.Joining) {
                        notify(ack.message ?: "Couldn't join the room.")
                    } else {
                        update { it.copy(phase = terminal) }
                        realtime.stop()
                    }
                }
                joinBuffer.clear()
            }
            SocketResult.NotConnected -> Unit // the next Connected event re-joins
            SocketResult.Timeout, SocketResult.Malformed -> {
                joinBuffer.clear()
                notify("The room didn't respond. Retrying…")
                scope.launch(stateDispatcher) {
                    delay(2_000)
                    if (realtime.connectionState.value is ConnectionState.Connected) joinActive()
                }
            }
        }
    }

    // ---- Playback & queue commands (host-only on the server) ---------------------

    suspend fun setTrack(track: TrackInput): CommandResult = playbackCommand(
        SocketEvents.PLAYBACK_SET,
        encode(PlaybackSetPayload.serializer(), PlaybackSetPayload(code() ?: return noRoom(), track)),
    )

    /** [action] ∈ play | pause | seek. */
    suspend fun control(action: String, positionSec: Double): CommandResult = playbackCommand(
        SocketEvents.PLAYBACK_CONTROL,
        encode(
            PlaybackControlPayload.serializer(),
            PlaybackControlPayload(code() ?: return noRoom(), action, positionSec.coerceAtLeast(0.0)),
        ),
    )

    suspend fun clearPlayback(): CommandResult = playbackCommand(
        SocketEvents.PLAYBACK_CLEAR,
        encode(RoomCodePayload.serializer(), RoomCodePayload(code() ?: return noRoom())),
    )

    suspend fun queueAdd(track: TrackInput): CommandResult = queueCommand(
        SocketEvents.QUEUE_ADD,
        encode(QueueTrackPayload.serializer(), QueueTrackPayload(code() ?: return noRoom(), track)),
    )

    suspend fun queuePrepend(track: TrackInput): CommandResult = queueCommand(
        SocketEvents.QUEUE_PREPEND,
        encode(QueueTrackPayload.serializer(), QueueTrackPayload(code() ?: return noRoom(), track)),
    )

    suspend fun queueRemove(index: Int): CommandResult = queueCommand(
        SocketEvents.QUEUE_REMOVE,
        encode(QueueRemovePayload.serializer(), QueueRemovePayload(code() ?: return noRoom(), index)),
    )

    suspend fun queueReorder(fromIndex: Int, toIndex: Int): CommandResult = queueCommand(
        SocketEvents.QUEUE_REORDER,
        encode(QueueReorderPayload.serializer(), QueueReorderPayload(code() ?: return noRoom(), fromIndex, toIndex)),
    )

    /**
     * Skip / auto-advance. Always sends the idempotency guard so duplicate
     * advances (double tap, two host devices) cannot dequeue twice.
     */
    suspend fun queueAdvance(): CommandResult {
        val state = _state.value ?: return noRoom()
        return queueCommand(
            SocketEvents.QUEUE_ADVANCE,
            encode(
                QueueAdvancePayload.serializer(),
                QueueAdvancePayload(state.roomCode, expectedFrontVideoId = state.queue.firstOrNull()?.videoId),
            ),
        )
    }

    suspend fun queueClear(): CommandResult = queueCommand(
        SocketEvents.QUEUE_CLEAR,
        encode(RoomCodePayload.serializer(), RoomCodePayload(code() ?: return noRoom())),
    )

    suspend fun transferHost(userId: String): CommandResult {
        val payload = encode(HostTransferPayload.serializer(), HostTransferPayload(code() ?: return noRoom(), userId))
        return simpleCommand(SocketEvents.HOST_TRANSFER, payload)
    }

    // ---- Chat ----------------------------------------------------------------------

    /**
     * Sends a chat message. Shown immediately as "sending"; it becomes "sent" only
     * when the server's own `chat:new` broadcast arrives (it is broadcast before
     * the ack). The backend has no client-supplied message id, so a send whose ack
     * never arrived is marked [ChatStatus.Unconfirmed] rather than auto-retried —
     * retrying it could post a duplicate.
     */
    fun sendChat(content: String) {
        val text = content.trim()
        if (text.isEmpty() || text.length > CHAT_MAX_LENGTH) return
        val self = selfUser() ?: return
        val key = "local-" + UUID.randomUUID()
        scope.launch(stateDispatcher) {
            update {
                RoomReducer.addPendingChat(
                    it,
                    ChatEntry(key, self.id, self.username, text, wallClockMs(), ChatStatus.Sending),
                )
            }
            deliverChat(key, text)
        }
    }

    /** Resend a message. Only offered for [ChatStatus.Failed] (definitely not stored) or after explicit confirmation. */
    fun retryChat(key: String) {
        scope.launch(stateDispatcher) {
            val entry = _state.value?.messages?.firstOrNull { it.key == key } ?: return@launch
            update { RoomReducer.setChatStatus(it, key, ChatStatus.Sending) }
            deliverChat(key, entry.content)
        }
    }

    fun discardChat(key: String) {
        scope.launch(stateDispatcher) { update { RoomReducer.removeChat(it, key) } }
    }

    private suspend fun deliverChat(key: String, text: String) {
        val code = code() ?: return
        val result = realtime.request(SocketEvents.CHAT_SEND, encode(ChatSendPayload.serializer(), ChatSendPayload(code, text))) { raw ->
            raw?.let { SyncDJson.decodeFromString(SimpleAck.serializer(), it) }
        }
        val status: ChatStatus? = when (result) {
            is SocketResult.Ok -> if (result.value.ok) null else ChatStatus.Failed(result.value.message ?: "Couldn't send.")
            SocketResult.NotConnected -> ChatStatus.Failed("Not connected to the room.")
            SocketResult.Timeout, SocketResult.Malformed -> ChatStatus.Unconfirmed
        }
        // On ok:true the chat:new echo has already replaced the pending entry.
        if (status != null) update { s ->
            if (s.messages.any { it.key == key }) RoomReducer.setChatStatus(s, key, status) else s
        }
    }

    // ---- Plumbing ------------------------------------------------------------------

    private fun code(): String? = _state.value?.roomCode

    private fun noRoom() = CommandResult.Unreachable("You're not in a room.")

    private inline fun update(transform: (RoomState) -> RoomState) {
        _state.value?.let { _state.value = transform(it) }
    }

    private fun notify(message: String) {
        _notices.tryEmit(message)
    }

    private suspend fun playbackCommand(event: String, payload: kotlinx.serialization.json.JsonElement): CommandResult {
        val result = realtime.request(event, payload) { raw -> raw?.let { SyncDJson.decodeFromString(PlaybackAck.serializer(), it) } }
        return withContext(stateDispatcher) {
            when (result) {
                is SocketResult.Ok -> {
                    val ack = result.value
                    if (ack.ok) {
                        ack.playback?.let { snap ->
                            clock.observe(snap.serverTime, result.receivedAtMs, result.sentAtMs)
                            update { RoomReducer.applyPlayback(it, snap) }
                        }
                        CommandResult.Ok
                    } else {
                        rejected(ack.message ?: "Playback update failed.")
                    }
                }
                else -> unreachable(result)
            }
        }
    }

    private suspend fun queueCommand(event: String, payload: kotlinx.serialization.json.JsonElement): CommandResult {
        val result = realtime.request(event, payload) { raw -> raw?.let { SyncDJson.decodeFromString(QueueAck.serializer(), it) } }
        return withContext(stateDispatcher) {
            when (result) {
                is SocketResult.Ok -> {
                    val ack = result.value
                    if (ack.ok) {
                        ack.queue?.let { q -> update { RoomReducer.applyQueue(it, q) } }
                        CommandResult.Ok
                    } else {
                        rejected(ack.message ?: "Queue update failed.")
                    }
                }
                else -> unreachable(result)
            }
        }
    }

    private suspend fun simpleCommand(event: String, payload: kotlinx.serialization.json.JsonElement): CommandResult {
        val result = realtime.request(event, payload) { raw -> raw?.let { SyncDJson.decodeFromString(SimpleAck.serializer(), it) } }
        return when (result) {
            is SocketResult.Ok -> if (result.value.ok) CommandResult.Ok else rejected(result.value.message ?: "Request failed.")
            else -> unreachable(result)
        }
    }

    private fun rejected(message: String): CommandResult {
        notify(message)
        return CommandResult.Rejected(message)
    }

    private fun unreachable(result: SocketResult<*>): CommandResult {
        val message = when (result) {
            SocketResult.NotConnected -> "Not connected to the room yet."
            SocketResult.Timeout -> "The room didn't respond. Check the current state before trying again."
            else -> "Unexpected response from the room."
        }
        notify(message)
        return CommandResult.Unreachable(message)
    }

    private fun <T> encode(serializer: KSerializer<T>, value: T) = SyncDJson.encodeToJsonElement(serializer, value)

    companion object {
        const val BACKGROUND_DISCONNECT_MS = 60_000L

        /** User-facing copy for REST failures when opening a room. */
        fun describeOpenFailure(error: ApiError): String = when {
            error is ApiError.Http && error.status == 404 -> "That room doesn't exist (or has closed)."
            error is ApiError.Http && error.status == 403 -> "You're not a member of that room. Join it with its code."
            else -> error.message
        }
    }
}
