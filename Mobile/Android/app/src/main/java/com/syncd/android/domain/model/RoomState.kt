package com.syncd.android.domain.model

import com.syncd.android.core.model.ChatMessageDto
import com.syncd.android.core.model.HostPendingPayload
import com.syncd.android.core.model.HostUpdatePayload
import com.syncd.android.core.model.PlaybackSnapshot
import com.syncd.android.core.model.PresenceSnapshot
import com.syncd.android.core.model.QueueItem
import com.syncd.android.core.model.RoomDto
import com.syncd.android.core.model.RoomJoinAck
import com.syncd.android.core.util.parseInstantMillis
import com.syncd.android.playback.synchronization.SnapshotOrdering

sealed interface RoomPhase {
    /** REST room loaded; waiting for the socket `room:join` ack (the authoritative state). */
    data object Joining : RoomPhase
    /** Join ack applied; live updates flowing. */
    data object Live : RoomPhase
    /** The server says we're no longer a member (left on another device, etc.). */
    data class Removed(val message: String) : RoomPhase
    /** The room no longer exists. */
    data class Closed(val message: String) : RoomPhase
}

data class Participant(
    val userId: String,
    val username: String,
    /** Null until live presence arrives — unknown is not the same as offline. */
    val online: Boolean?,
    val isHost: Boolean,
)

sealed interface ChatStatus {
    data object Sent : ChatStatus
    data object Sending : ChatStatus
    /** The server rejected it (ack `ok: false`) — it was NOT stored; safe to retry. */
    data class Failed(val reason: String) : ChatStatus
    /** No ack (timeout/disconnect) — it may or may not have been stored. */
    data object Unconfirmed : ChatStatus
}

data class ChatEntry(
    /** Server id for sent messages; a local UUID for pending ones. */
    val key: String,
    val userId: String,
    val username: String,
    val content: String,
    val createdAtMs: Long,
    val status: ChatStatus,
)

data class RoomState(
    val roomCode: String,
    val phase: RoomPhase = RoomPhase.Joining,
    val members: List<Participant> = emptyList(),
    val hostUserId: String? = null,
    val playback: PlaybackSnapshot? = null,
    /** Display-only fallback from the REST room (no serverTime, so never used for sync). */
    val restTrackTitle: String? = null,
    val queue: List<QueueItem> = emptyList(),
    val messages: List<ChatEntry> = emptyList(),
    val hostPending: HostPendingPayload? = null,
    val hostNotice: HostUpdatePayload? = null,
) {
    fun isHost(userId: String?): Boolean = userId != null && userId == hostUserId
}

/**
 * Pure state transitions for one room. No I/O, no clocks — every input is a
 * server message, which keeps reconnect/duplicate/stale handling testable.
 */
object RoomReducer {
    private const val MAX_MESSAGES = 300

    fun fromRest(room: RoomDto): RoomState = RoomState(
        roomCode = room.roomCode,
        phase = RoomPhase.Joining,
        members = room.members.map {
            Participant(it.user.id, it.user.username, online = null, isHost = it.user.id == room.host.id)
        },
        hostUserId = room.host.id,
        restTrackTitle = room.currentTitle,
    )

    /**
     * The join ack is a fresh read of the whole room and is authoritative: it
     * replaces presence, playback and queue outright (this is the reconnect
     * reconciliation path). Messages merge by id so a live `chat:new` that raced
     * the snapshot is never dropped.
     */
    fun applyJoinAck(state: RoomState, ack: RoomJoinAck): RoomState {
        var s = state.copy(phase = RoomPhase.Live)
        ack.presence?.let { s = applyPresence(s, it) }
        s = s.copy(playback = ack.playback ?: s.playback, queue = ack.queue ?: s.queue)
        ack.messages?.let { history -> s = history.fold(s) { acc, m -> applyChat(acc, m, selfUserId = null) } }
        return s
    }

    fun applyPresence(state: RoomState, snapshot: PresenceSnapshot): RoomState = state.copy(
        hostUserId = snapshot.hostUserId,
        members = snapshot.members.map {
            Participant(it.userId, it.username, it.online, isHost = it.userId == snapshot.hostUserId)
        },
    )

    /** Applies a broadcast/ack snapshot unless it is older than what we have. */
    fun applyPlayback(state: RoomState, snapshot: PlaybackSnapshot): RoomState =
        if (SnapshotOrdering.shouldApply(snapshot, state.playback)) state.copy(playback = snapshot) else state

    fun applyQueue(state: RoomState, queue: List<QueueItem>): RoomState = state.copy(queue = queue)

    fun applyHostUpdate(state: RoomState, payload: HostUpdatePayload): RoomState = state.copy(
        hostUserId = payload.hostUserId,
        members = state.members.map { it.copy(isHost = it.userId == payload.hostUserId) },
        hostNotice = payload,
        hostPending = null,
    )

    fun applyHostPending(state: RoomState, payload: HostPendingPayload): RoomState =
        state.copy(hostPending = payload.takeIf { it.pending })

    /**
     * Merges a server message. If [selfUserId] sent it and a pending local entry
     * with the same content exists, that entry is replaced (the server's echo is
     * the confirmation) — so a send is never shown twice.
     */
    fun applyChat(state: RoomState, message: ChatMessageDto, selfUserId: String?): RoomState {
        if (state.messages.any { it.key == message.id }) return state
        val confirmed = ChatEntry(
            key = message.id,
            userId = message.userId,
            username = message.username,
            content = message.content,
            createdAtMs = parseInstantMillis(message.createdAt) ?: 0L,
            status = ChatStatus.Sent,
        )
        val pendingIndex = state.messages.indexOfFirst {
            it.status != ChatStatus.Sent && it.content == message.content &&
                (selfUserId == null || it.userId == selfUserId) && it.userId == message.userId
        }
        val base = if (pendingIndex >= 0) state.messages.filterIndexed { i, _ -> i != pendingIndex } else state.messages
        // Confirmed messages in server order; pending ones stay at the bottom.
        val sent = (base.filter { it.status == ChatStatus.Sent } + confirmed)
            .sortedWith(compareBy({ it.createdAtMs }, { it.key }))
        val pending = base.filter { it.status != ChatStatus.Sent }
        return state.copy(messages = (sent + pending).takeLast(MAX_MESSAGES))
    }

    fun addPendingChat(state: RoomState, entry: ChatEntry): RoomState =
        state.copy(messages = state.messages + entry)

    fun setChatStatus(state: RoomState, key: String, status: ChatStatus): RoomState =
        state.copy(messages = state.messages.map { if (it.key == key) it.copy(status = status) else it })

    fun removeChat(state: RoomState, key: String): RoomState =
        state.copy(messages = state.messages.filterNot { it.key == key })

    /** Maps the server's join-ack error to a phase (messages from sockets/index.ts handleRoomJoin). */
    fun phaseForJoinError(message: String?): RoomPhase = when (message) {
        "Room not found" -> RoomPhase.Closed("This room has closed.")
        "Not a member of this room" -> RoomPhase.Removed("You're no longer a member of this room.")
        else -> RoomPhase.Joining
    }
}
