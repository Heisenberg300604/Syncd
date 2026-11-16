package com.syncd.android.core.socket

import com.syncd.android.core.model.ChatSendPayload
import com.syncd.android.core.model.RoomCodePayload
import com.syncd.android.core.model.RoomJoinAck
import com.syncd.android.core.model.SimpleAck
import com.syncd.android.core.network.NetworkFactory
import com.syncd.android.core.network.SyncDJson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.filterIsInstance
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.util.Collections

/**
 * Opt-in: exercises the real Socket.IO Java client over OkHttp 5 against a real
 * Socket.IO v4 server (android/tools/socketio-contract-mock.mjs). Skipped unless
 * SYNCD_SIO_URL is set, e.g.
 *
 *   node android/tools/socketio-contract-mock.mjs 5055 &
 *   SYNCD_SIO_URL=http://127.0.0.1:5055 ./gradlew :app:testDebugUnitTest --tests '*SocketIoIntegrationTest*'
 */
class SocketIoIntegrationTest {
    private val url: String? = System.getenv("SYNCD_SIO_URL")

    @Test
    fun `handshake rejection, token refresh per attempt, acks, broadcasts and reconnect`() = runBlocking {
        assumeTrue("SYNCD_SIO_URL not set", url != null)
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        val issued = Collections.synchronizedList(mutableListOf<String>())
        val states = Collections.synchronizedList(mutableListOf<ConnectionState>())
        var n = 0
        val client = SocketIoRealtimeClient(
            scope = scope,
            socketUrl = url!!,
            okHttp = NetworkFactory.baseClient(),
            tokens = { _ ->
                n += 1
                // First token is rejected like a token with an unaccepted azp.
                (if (n == 1) "bad-$n" else "good-$n").also { issued += it }
            },
            networkAvailable = MutableStateFlow(true),
            monotonicNowMs = System::nanoTime.let { f -> { f() / 1_000_000 } },
            backoff = Backoff(baseMs = 200, maxMs = 400, jitter = 0.0),
        )
        scope.launch { client.connectionState.collect { states += it } }

        try {
            client.start()
            withTimeout(15_000) { client.connectionState.first { it is ConnectionState.Connected } }

            val rejected = states.filterIsInstance<ConnectionState.Reconnecting>().first()
            assertTrue("server message surfaced: ${rejected.lastError}", rejected.lastError!!.contains("azp"))
            assertEquals(listOf("bad-1", "good-2"), issued.toList())

            // room:join ack decodes into the real contract model
            val join = client.request(SocketEvents.ROOM_JOIN, SyncDJson.encodeToJsonElement(RoomCodePayload.serializer(), RoomCodePayload("ABC234"))) {
                it?.let { raw -> SyncDJson.decodeFromString(RoomJoinAck.serializer(), raw) }
            }
            assertTrue(join is SocketResult.Ok && join.value.ok && join.value.presence!!.hostUserId == "u1")

            // chat:new broadcast arrives and chat:send is acked
            val chatEvent = scope.launch(start = CoroutineStart.UNDISPATCHED) {
                withTimeout(5_000) { client.events.filterIsInstance<RealtimeEvent.Chat>().first { it.message.content == "hello there" } }
            }
            val sent = client.request(SocketEvents.CHAT_SEND, SyncDJson.encodeToJsonElement(ChatSendPayload.serializer(), ChatSendPayload("ABC234", "hello there"))) {
                it?.let { raw -> SyncDJson.decodeFromString(SimpleAck.serializer(), raw) }
            }
            assertTrue(sent is SocketResult.Ok && sent.value.ok)
            chatEvent.join()

            // An ack with no arguments (room:leave) still resolves
            val leave = client.request(SocketEvents.ROOM_LEAVE, SyncDJson.encodeToJsonElement(RoomCodePayload.serializer(), RoomCodePayload("ABC234"))) { Unit }
            assertTrue(leave is SocketResult.Ok)

            // Server drops us → we reconnect with a *fresh* token
            val dropped = scope.launch(start = CoroutineStart.UNDISPATCHED) {
                withTimeout(5_000) { client.events.filterIsInstance<RealtimeEvent.Disconnected>().first() }
            }
            client.request("test:kick", JsonObject(emptyMap()), timeoutMs = 300) { Unit }
            dropped.join()
            withTimeout(10_000) { client.connectionState.first { it is ConnectionState.Connected } }
            val who = client.request("whoami", JsonObject(emptyMap())) { raw ->
                raw?.let { SyncDJson.parseToJsonElement(it) as JsonObject }
            }
            val token = ((who as SocketResult.Ok).value["token"])!!.jsonPrimitive.content
            assertEquals("good-3", token)
        } finally {
            client.stop()
            scope.cancel()
        }
    }
}
