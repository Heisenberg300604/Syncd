package com.syncd.android.testing

import com.syncd.android.core.model.CreateProfileRequest
import com.syncd.android.core.model.LeaveRoomResponse
import com.syncd.android.core.model.MeResponse
import com.syncd.android.core.model.PlaylistResponse
import com.syncd.android.core.model.ProfileResponse
import com.syncd.android.core.model.RoomDto
import com.syncd.android.core.model.RoomMemberDto
import com.syncd.android.core.model.RoomResponse
import com.syncd.android.core.model.RoomUser
import com.syncd.android.core.model.SearchResponse
import com.syncd.android.core.model.VideoResponse
import com.syncd.android.core.network.SyncDApi
import com.syncd.android.core.socket.ConnectionState
import com.syncd.android.core.socket.RealtimeClient
import com.syncd.android.core.socket.RealtimeEvent
import com.syncd.android.core.socket.SocketResult
import com.syncd.android.playback.engine.EngineState
import com.syncd.android.playback.engine.EngineStatus
import com.syncd.android.playback.engine.RoomPlaybackEngine
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.JsonElement
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import retrofit2.HttpException
import retrofit2.Response
import java.time.Instant

fun iso(ms: Long): String = Instant.ofEpochMilli(ms).toString()

fun httpError(status: Int, message: String) = HttpException(
    Response.error<Any>(status, """{"message":"$message"}""".toResponseBody("application/json".toMediaType())),
)

fun roomDto(code: String = "ABC234", hostId: String = "u1", members: List<Pair<String, String>> = listOf("u1" to "ana")) = RoomDto(
    id = "room-$code",
    roomCode = code,
    host = RoomUser(hostId, members.first { it.first == hostId }.second),
    members = members.map { RoomMemberDto(RoomUser(it.first, it.second), "2026-11-14T10:00:00.000Z") },
)

/** Scriptable [RealtimeClient]: records every emit and answers with [responder]. */
class FakeRealtimeClient : RealtimeClient {
    sealed interface Reply {
        data class Ack(val raw: String?) : Reply
        data object Timeout : Reply
        data object NotConnected : Reply
    }

    override val connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Idle)
    override val events = MutableSharedFlow<RealtimeEvent>(extraBufferCapacity = 64)

    var starts = 0
    var stops = 0
    val sent = mutableListOf<Pair<String, JsonElement>>()
    var responder: suspend (event: String, payload: JsonElement) -> Reply = { _, _ -> Reply.Ack(null) }

    override fun start() {
        starts++
    }

    override fun stop() {
        stops++
        connectionState.value = ConnectionState.Idle
    }

    override suspend fun <T> request(event: String, payload: JsonElement, timeoutMs: Long, decode: (String?) -> T?): SocketResult<T> {
        sent += event to payload
        return when (val r = responder(event, payload)) {
            is Reply.Ack -> decode(r.raw)?.let { SocketResult.Ok(it, sentAtMs = 0, receivedAtMs = 0) } ?: SocketResult.Malformed
            Reply.Timeout -> SocketResult.Timeout
            Reply.NotConnected -> SocketResult.NotConnected
        }
    }

    suspend fun connect() {
        connectionState.value = ConnectionState.Connected
        events.emit(RealtimeEvent.Connected)
    }

    suspend fun disconnect() {
        connectionState.value = ConnectionState.Reconnecting(1, 1_000, null)
        events.emit(RealtimeEvent.Disconnected("transport close"))
    }

    fun sentEvents() = sent.map { it.first }
}

/** [SyncDApi] whose room endpoints are programmable; others fail loudly if touched. */
class FakeApi : SyncDApi {
    var joinRoomResult: () -> RoomResponse = { RoomResponse(roomDto()) }
    var getRoomResult: () -> RoomResponse = { RoomResponse(roomDto()) }
    var leaveResult: () -> LeaveRoomResponse = { LeaveRoomResponse(left = true) }
    var leaveCalls = 0

    override suspend fun me(): MeResponse = error("unused")
    override suspend fun createProfile(body: CreateProfileRequest): ProfileResponse = error("unused")
    override suspend fun createRoom(): RoomResponse = RoomResponse(roomDto())
    override suspend fun joinRoom(roomCode: String): RoomResponse = joinRoomResult()
    override suspend fun getRoom(roomCode: String): RoomResponse = getRoomResult()
    override suspend fun leaveRoom(roomCode: String): LeaveRoomResponse {
        leaveCalls++
        return leaveResult()
    }
    override suspend fun searchMusic(query: String): SearchResponse = error("unused")
    override suspend fun resolveVideo(url: String): VideoResponse = error("unused")
    override suspend fun resolvePlaylist(url: String): PlaylistResponse = error("unused")
}

/**
 * Deterministic [RoomPlaybackEngine] that records commands. While Playing, the
 * playhead advances with [nowMs] like a real player; setting [position] re-anchors it.
 */
class FakeEngine(
    override val supportsRateCorrection: Boolean = false,
    private val nowMs: () -> Long = { 0L },
) : RoomPlaybackEngine {
    private val _state = MutableStateFlow(EngineState())
    override val state: StateFlow<EngineState> = _state

    private var anchorPos = 0.0
    private var anchorAt = 0L
    val calls = mutableListOf<String>()

    var position: Double
        get() = positionSec()
        set(v) {
            anchorPos = v
            anchorAt = nowMs()
        }

    override fun positionSec() =
        if (_state.value.status == EngineStatus.Playing) anchorPos + (nowMs() - anchorAt) / 1000.0 else anchorPos

    private fun transition(next: EngineState) {
        position = positionSec()
        _state.value = next
    }

    override fun load(videoId: String, startSec: Double, autoplay: Boolean) {
        calls += "load:$videoId:${"%.1f".format(startSec)}:$autoplay"
        _state.value = EngineState(if (autoplay) EngineStatus.Playing else EngineStatus.Paused, videoId)
        position = startSec
    }

    override fun play() {
        calls += "play"
        transition(_state.value.copy(status = EngineStatus.Playing))
    }

    override fun pause() {
        calls += "pause"
        transition(_state.value.copy(status = EngineStatus.Paused))
    }

    override fun seekTo(sec: Double) {
        calls += "seek:${"%.1f".format(sec)}"
        position = sec
    }

    override fun setRate(rate: Float) {
        calls += "rate:$rate"
    }

    override fun stop() {
        calls += "stop"
        transition(EngineState())
        position = 0.0
    }

    fun setStatus(status: EngineStatus) = transition(_state.value.copy(status = status))
}
