package com.syncd.android.core.socket

import com.syncd.android.core.auth.TokenProvider
import com.syncd.android.core.model.ChatMessageDto
import com.syncd.android.core.model.HostPendingPayload
import com.syncd.android.core.model.HostUpdatePayload
import com.syncd.android.core.model.PlaybackSnapshot
import com.syncd.android.core.model.PresenceSnapshot
import com.syncd.android.core.model.QueueItem
import com.syncd.android.core.network.SyncDJson
import io.socket.client.Ack
import io.socket.client.IO
import io.socket.client.Socket
import io.socket.engineio.client.transports.WebSocket
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonElement
import okhttp3.OkHttpClient
import org.json.JSONArray
import org.json.JSONObject
import java.net.URI

/**
 * Socket.IO v4 client (`io.socket:socket.io-client` 2.x) configured to match the
 * web client: websocket transport only, `auth: { token }` handshake.
 *
 * Socket.IO's built-in reconnection is disabled. It would resend the handshake
 * `auth` captured at construction, and the server verifies the Clerk token only
 * at connect time; Clerk session tokens live ~60 s, so an automatic reconnect a
 * minute later would be rejected. Instead every attempt builds a fresh socket
 * with a freshly fetched token, under our own backoff.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class SocketIoRealtimeClient(
    private val scope: CoroutineScope,
    private val socketUrl: String,
    private val okHttp: OkHttpClient,
    private val tokens: TokenProvider,
    networkAvailable: StateFlow<Boolean>,
    private val monotonicNowMs: () -> Long,
    private val backoff: Backoff = Backoff(),
) : RealtimeClient {

    /** All connection-state mutations run here, one at a time. */
    private val serial = Dispatchers.Default.limitedParallelism(1)

    private val _state = MutableStateFlow<ConnectionState>(ConnectionState.Idle)
    override val connectionState: StateFlow<ConnectionState> = _state.asStateFlow()

    private val _events = MutableSharedFlow<RealtimeEvent>(extraBufferCapacity = 256)
    override val events: SharedFlow<RealtimeEvent> = _events.asSharedFlow()

    private var desired = false
    @Volatile private var socket: Socket? = null
    /** Bumped for every socket; callbacks from a superseded socket are ignored. Read off-thread. */
    @Volatile private var generation = 0
    private var attempt = 0
    private var retryJob: Job? = null
    private var online = networkAvailable.value

    init {
        scope.launch(serial) {
            networkAvailable.collect { available ->
                online = available
                if (!desired) return@collect
                if (available && socket?.connected() != true) {
                    // Network is back: skip the remaining backoff.
                    retryJob?.cancel()
                    connectNow()
                } else if (!available && socket?.connected() != true) {
                    _state.value = ConnectionState.Offline
                }
            }
        }
    }

    override fun start() {
        scope.launch(serial) {
            desired = true
            val current = _state.value
            if (current is ConnectionState.Connected || current is ConnectionState.Connecting) return@launch
            if (current is ConnectionState.Reconnecting) return@launch // a retry is already scheduled
            attempt = 0
            connectNow()
        }
    }

    override fun stop() {
        scope.launch(serial) {
            desired = false
            retryJob?.cancel()
            teardownSocket()
            attempt = 0
            _state.value = ConnectionState.Idle
        }
    }

    /** Must run on [serial]. */
    private suspend fun connectNow() {
        if (!desired) return
        if (!online) {
            _state.value = ConnectionState.Offline
            return
        }
        teardownSocket()
        _state.value = ConnectionState.Connecting

        val token = tokens.token(forceRefresh = false)
        if (!desired) return
        if (token == null) {
            scheduleRetry("Not signed in")
            return
        }

        val gen = ++generation
        val options = IO.Options().apply {
            transports = arrayOf(WebSocket.NAME)
            reconnection = false
            forceNew = true
            timeout = 10_000
            auth = mapOf("token" to token)
            callFactory = okHttp
            webSocketFactory = okHttp
        }
        val s = IO.socket(URI.create(socketUrl), options)
        socket = s
        registerHandlers(s, gen)
        s.connect()
    }

    private fun registerHandlers(s: Socket, gen: Int) {
        s.on(Socket.EVENT_CONNECT) {
            scope.launch(serial) {
                if (gen != generation) return@launch
                attempt = 0
                _state.value = ConnectionState.Connected
                _events.tryEmit(RealtimeEvent.Connected)
            }
        }
        s.on(Socket.EVENT_CONNECT_ERROR) { args ->
            val message = errorMessage(args.firstOrNull())
            scope.launch(serial) {
                if (gen != generation) return@launch
                scheduleRetry(message)
            }
        }
        s.on(Socket.EVENT_DISCONNECT) { args ->
            val reason = args.firstOrNull()?.toString() ?: "unknown"
            scope.launch(serial) {
                if (gen != generation) return@launch
                _events.tryEmit(RealtimeEvent.Disconnected(reason))
                if (desired) scheduleRetry(null)
            }
        }

        // Broadcasts are emitted straight from the socket's event thread so their
        // order is preserved exactly as the server sent them.
        s.onDecoded(gen, SocketEvents.PRESENCE_UPDATE, PresenceSnapshot.serializer()) {
            RealtimeEvent.Presence(it)
        }
        s.onDecoded(gen, SocketEvents.PLAYBACK_UPDATE, PlaybackSnapshot.serializer()) {
            RealtimeEvent.Playback(it, monotonicNowMs())
        }
        s.onDecoded(gen, SocketEvents.QUEUE_UPDATE, ListSerializer(QueueItem.serializer())) {
            RealtimeEvent.Queue(it)
        }
        s.onDecoded(gen, SocketEvents.CHAT_NEW, ChatMessageDto.serializer()) { RealtimeEvent.Chat(it) }
        s.onDecoded(gen, SocketEvents.HOST_UPDATE, HostUpdatePayload.serializer()) {
            RealtimeEvent.HostUpdate(it)
        }
        s.onDecoded(gen, SocketEvents.HOST_PENDING, HostPendingPayload.serializer()) {
            RealtimeEvent.HostPending(it)
        }
    }

    private fun <T> Socket.onDecoded(
        gen: Int,
        event: String,
        serializer: KSerializer<T>,
        wrap: (T) -> RealtimeEvent,
    ) {
        on(event) { args ->
            if (gen != generation) return@on
            val raw = args.firstOrNull()?.let(::jsonString) ?: return@on
            // A malformed broadcast is dropped, never allowed to crash the event thread.
            val decoded = runCatching { SyncDJson.decodeFromString(serializer, raw) }.getOrNull() ?: return@on
            _events.tryEmit(wrap(decoded))
        }
    }

    /** Must run on [serial]. */
    private fun scheduleRetry(lastError: String?) {
        teardownSocket()
        if (!desired) return
        if (!online) {
            _state.value = ConnectionState.Offline
            return
        }
        attempt += 1
        val wait = backoff.delayFor(attempt)
        _state.value = ConnectionState.Reconnecting(attempt, wait, lastError)
        retryJob?.cancel()
        retryJob = scope.launch(serial) {
            delay(wait)
            connectNow()
        }
    }

    private fun teardownSocket() {
        socket?.let {
            it.off()
            it.disconnect()
        }
        socket = null
        generation++
    }

    override suspend fun <T> request(
        event: String,
        payload: JsonElement,
        timeoutMs: Long,
        decode: (String?) -> T?,
    ): SocketResult<T> {
        val s = socket?.takeIf { it.connected() } ?: return SocketResult.NotConnected
        val reply = CompletableDeferred<Pair<String?, Long>>()
        val sentAt = monotonicNowMs()
        s.emit(event, arrayOf<Any>(JSONObject(payload.toString())), Ack { args ->
            reply.complete(args.firstOrNull()?.let(::jsonString) to monotonicNowMs())
        })
        val (raw, receivedAt) = withTimeoutOrNull(timeoutMs) { reply.await() } ?: return SocketResult.Timeout
        val value = runCatching { decode(raw) }.getOrNull() ?: return SocketResult.Malformed
        return SocketResult.Ok(value, sentAt, receivedAt)
    }

    private fun jsonString(arg: Any): String? = when (arg) {
        is JSONObject, is JSONArray -> arg.toString()
        is String -> JSONObject.quote(arg)
        else -> null
    }

    /** The server rejects a handshake with `next(new Error(message))` → `{ message }`. */
    private fun errorMessage(arg: Any?): String? = when (arg) {
        is JSONObject -> arg.optString("message").takeIf { it.isNotBlank() }
        is Exception -> arg.message
        else -> arg?.toString()
    }
}
