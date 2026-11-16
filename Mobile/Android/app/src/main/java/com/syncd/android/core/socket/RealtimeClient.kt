package com.syncd.android.core.socket

import com.syncd.android.core.model.ChatMessageDto
import com.syncd.android.core.model.HostPendingPayload
import com.syncd.android.core.model.HostUpdatePayload
import com.syncd.android.core.model.PlaybackSnapshot
import com.syncd.android.core.model.PresenceSnapshot
import com.syncd.android.core.model.QueueItem
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.JsonElement
import kotlin.math.min
import kotlin.random.Random

/** Event names exactly as registered in server/src/sockets/index.ts. */
object SocketEvents {
    // client → server (all acknowledged)
    const val ROOM_JOIN = "room:join"
    const val ROOM_LEAVE = "room:leave"
    const val PLAYBACK_SET = "playback:set"
    const val PLAYBACK_CONTROL = "playback:control"
    const val PLAYBACK_CLEAR = "playback:clear"
    const val QUEUE_ADD = "queue:add"
    const val QUEUE_PREPEND = "queue:prepend"
    const val QUEUE_REMOVE = "queue:remove"
    const val QUEUE_REORDER = "queue:reorder"
    const val QUEUE_ADVANCE = "queue:advance"
    const val QUEUE_CLEAR = "queue:clear"
    const val CHAT_SEND = "chat:send"
    const val HOST_TRANSFER = "host:transfer"

    // server → room broadcasts
    const val PRESENCE_UPDATE = "presence:update"
    const val PLAYBACK_UPDATE = "playback:update"
    const val QUEUE_UPDATE = "queue:update"
    const val CHAT_NEW = "chat:new"
    const val HOST_UPDATE = "host:update"
    const val HOST_PENDING = "host:pending"
}

sealed interface ConnectionState {
    /** Not wanted (signed out, no active room, or app backgrounded long enough). */
    data object Idle : ConnectionState
    data object Connecting : ConnectionState
    data object Connected : ConnectionState
    /** Waiting to retry. [lastError] is the server's handshake message when there was one. */
    data class Reconnecting(val attempt: Int, val retryInMs: Long, val lastError: String?) : ConnectionState
    /** The device has no network; retry happens as soon as it returns. */
    data object Offline : ConnectionState
}

sealed interface RealtimeEvent {
    /** Fired on the initial connect and after every reconnect — the trigger to (re)join. */
    data object Connected : RealtimeEvent
    data class Disconnected(val reason: String) : RealtimeEvent
    data class Presence(val snapshot: PresenceSnapshot) : RealtimeEvent
    data class Playback(val snapshot: PlaybackSnapshot, val receivedAtMs: Long) : RealtimeEvent
    data class Queue(val items: List<QueueItem>) : RealtimeEvent
    data class Chat(val message: ChatMessageDto) : RealtimeEvent
    data class HostUpdate(val payload: HostUpdatePayload) : RealtimeEvent
    data class HostPending(val payload: HostPendingPayload) : RealtimeEvent
}

sealed interface SocketResult<out T> {
    /** [sentAtMs]/[receivedAtMs] are monotonic-clock times, used for round-trip clock sync. */
    data class Ok<T>(val value: T, val sentAtMs: Long, val receivedAtMs: Long) : SocketResult<T>
    data object NotConnected : SocketResult<Nothing>
    /** No ack in time. The server may or may not have applied the request. */
    data object Timeout : SocketResult<Nothing>
    data object Malformed : SocketResult<Nothing>
}

/**
 * The app's single managed Socket.IO connection for the signed-in session.
 * Owns connect / reconnect / token refresh; knows nothing about rooms.
 */
interface RealtimeClient {
    val connectionState: StateFlow<ConnectionState>
    val events: SharedFlow<RealtimeEvent>

    /** Idempotent: ensures a connection is established or being established. */
    fun start()

    /** Intentional disconnect; no reconnect follows. */
    fun stop()

    /**
     * Emits [event] with [payload] and suspends for the server's ack.
     * [decode] receives the ack's first argument as a JSON string (null when the
     * ack carried no arguments, e.g. `room:leave`).
     */
    suspend fun <T> request(
        event: String,
        payload: JsonElement,
        timeoutMs: Long = 10_000,
        decode: (String?) -> T?,
    ): SocketResult<T>
}

/** Exponential backoff with jitter: 1 s, 2 s, 4 s … capped at 30 s, ±20 %. */
class Backoff(
    private val baseMs: Long = 1_000,
    private val maxMs: Long = 30_000,
    private val jitter: Double = 0.2,
    private val random: Random = Random.Default,
) {
    fun delayFor(attempt: Int): Long {
        val exp = baseMs * (1L shl min(attempt.coerceAtLeast(1) - 1, 16))
        val capped = min(exp, maxMs)
        val spread = (capped * jitter).toLong()
        return (capped + if (spread > 0) random.nextLong(-spread, spread + 1) else 0).coerceAtLeast(250)
    }
}
