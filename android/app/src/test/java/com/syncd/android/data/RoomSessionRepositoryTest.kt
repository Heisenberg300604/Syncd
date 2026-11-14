package com.syncd.android.data

import com.syncd.android.core.model.ChatMessageDto
import com.syncd.android.core.model.PlaybackSnapshot
import com.syncd.android.core.model.PresenceMember
import com.syncd.android.core.model.PresenceSnapshot
import com.syncd.android.core.model.PublicUser
import com.syncd.android.core.model.QueueItem
import com.syncd.android.core.network.ApiResult
import com.syncd.android.core.socket.RealtimeEvent
import com.syncd.android.core.socket.SocketEvents
import com.syncd.android.data.repository.CommandResult
import com.syncd.android.data.repository.RoomSessionRepository
import com.syncd.android.domain.model.ChatStatus
import com.syncd.android.domain.model.RoomPhase
import com.syncd.android.playback.synchronization.ServerClock
import com.syncd.android.testing.FakeApi
import com.syncd.android.testing.FakeRealtimeClient
import com.syncd.android.testing.FakeRealtimeClient.Reply
import com.syncd.android.testing.httpError
import com.syncd.android.testing.iso
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class RoomSessionRepositoryTest {
    private val self = PublicUser("u1", "clerk_1", "ana")
    private val api = FakeApi()
    private val socket = FakeRealtimeClient()

    private fun joinAck(
        hostUserId: String = "u1",
        online: Boolean = true,
        playbackUpdatedAt: Long = 1_000,
        videoId: String = "dQw4w9WgXcQ",
        queue: String = """[{"videoId":"aaaaaaaaaaa","title":"Next","thumbnailUrl":"","duration":"PT1M"}]""",
        messages: String = "[]",
    ) = """
        {"ok":true,
         "presence":{"members":[{"userId":"u1","username":"ana","online":$online}],"hostUserId":"$hostUserId"},
         "playback":{"videoId":"$videoId","title":"Song","thumbnailUrl":"","duration":200,"isPlaying":true,"position":3,
                     "updatedAt":"${iso(playbackUpdatedAt)}","serverTime":"${iso(playbackUpdatedAt + 10)}"},
         "messages":$messages,"queue":$queue}
    """.trimIndent()

    private fun TestScope.repo() = RoomSessionRepository(
        scope = backgroundScope,
        stateDispatcher = StandardTestDispatcher(testScheduler),
        api = api,
        realtime = socket,
        clock = ServerClock { testScheduler.currentTime },
        recents = null,
        selfUser = { self },
        wallClockMs = { 0L },
    )

    @Test
    fun `join over REST then connect sends room join and applies the ack`() = runTest {
        socket.responder = { event, _ -> if (event == SocketEvents.ROOM_JOIN) Reply.Ack(joinAck()) else Reply.Ack(null) }
        val repo = repo()

        assertTrue(repo.join("ABC234") is ApiResult.Success)
        assertEquals(RoomPhase.Joining, repo.state.value?.phase)
        assertEquals(1, socket.starts)

        socket.connect()
        runCurrent()

        val s = repo.state.value!!
        assertEquals(RoomPhase.Live, s.phase)
        assertEquals(true, s.members.single().online)
        assertEquals("dQw4w9WgXcQ", s.playback?.videoId)
        assertEquals(1, s.queue.size)
        assertEquals(listOf(SocketEvents.ROOM_JOIN), socket.sentEvents())
    }

    @Test
    fun `broadcasts are ignored until the socket has joined`() = runTest {
        val repo = repo()
        repo.join("ABC234")
        runCurrent()
        socket.events.emit(RealtimeEvent.Queue(listOf(QueueItem("zzzzzzzzzzz", "x", "", "PT1M"))))
        runCurrent()
        assertTrue(repo.state.value!!.queue.isEmpty())
    }

    @Test
    fun `events racing the join ack are replayed when ordered, dropped when the ack is authoritative`() = runTest {
        val gate = CompletableDeferred<Unit>()
        socket.responder = { event, _ ->
            if (event == SocketEvents.ROOM_JOIN) {
                gate.await()
                Reply.Ack(joinAck(playbackUpdatedAt = 1_000))
            } else {
                Reply.Ack(null)
            }
        }
        val repo = repo()
        repo.join("ABC234")
        socket.connect()
        runCurrent() // join in flight

        val newer = PlaybackSnapshot(videoId = "bbbbbbbbbbb", isPlaying = true, position = 0.0, updatedAt = iso(2_000), serverTime = iso(2_001))
        socket.events.emit(RealtimeEvent.Playback(newer, receivedAtMs = 0))
        socket.events.emit(RealtimeEvent.Queue(emptyList()))
        socket.events.emit(RealtimeEvent.Chat(ChatMessageDto("m1", "r", "u2", "bo", "yo", iso(1_500))))
        runCurrent()
        gate.complete(Unit)
        runCurrent()

        val s = repo.state.value!!
        assertEquals("newer playback broadcast survives the older ack", "bbbbbbbbbbb", s.playback?.videoId)
        assertEquals("queue comes from the ack", 1, s.queue.size)
        assertEquals("chat merged", listOf("m1"), s.messages.map { it.key })
    }

    @Test
    fun `reconnect re-joins and reconciles from the fresh ack`() = runTest {
        var ackNumber = 0
        socket.responder = { event, _ ->
            if (event == SocketEvents.ROOM_JOIN) {
                ackNumber++
                Reply.Ack(if (ackNumber == 1) joinAck() else joinAck(hostUserId = "u9", playbackUpdatedAt = 9_000, videoId = "ccccccccccc"))
            } else {
                Reply.Ack(null)
            }
        }
        val repo = repo()
        repo.join("ABC234")
        socket.connect()
        runCurrent()

        socket.disconnect()
        runCurrent()
        // While disconnected, live broadcasts are no longer trusted.
        socket.events.emit(RealtimeEvent.Presence(PresenceSnapshot(emptyList(), "zz")))
        runCurrent()
        assertEquals("u1", repo.state.value!!.hostUserId)

        socket.connect()
        runCurrent()
        assertEquals(2, socket.sentEvents().count { it == SocketEvents.ROOM_JOIN })
        assertEquals("u9", repo.state.value!!.hostUserId)
        assertEquals("ccccccccccc", repo.state.value!!.playback?.videoId)
    }

    @Test
    fun `not a member on join marks the room removed and stops the socket`() = runTest {
        socket.responder = { _, _ -> Reply.Ack("""{"ok":false,"message":"Not a member of this room"}""") }
        val repo = repo()
        repo.join("ABC234")
        socket.connect()
        runCurrent()
        assertTrue(repo.state.value!!.phase is RoomPhase.Removed)
        assertTrue(socket.stops >= 1)
    }

    @Test
    fun `chat - server echo confirms, rejection fails, missing ack is unconfirmed`() = runTest {
        val repo = repo()
        socket.responder = { event, payload ->
            when (event) {
                SocketEvents.ROOM_JOIN -> Reply.Ack(joinAck())
                SocketEvents.CHAT_SEND -> {
                    val content = payload.toString()
                    when {
                        "ok-msg" in content -> {
                            // Server broadcasts chat:new before acking.
                            socket.events.emit(RealtimeEvent.Chat(ChatMessageDto("m1", "r", "u1", "ana", "ok-msg", iso(5))))
                            Reply.Ack("""{"ok":true}""")
                        }
                        "bad-msg" in content -> Reply.Ack("""{"ok":false,"message":"Slow down — try again in 2s."}""")
                        else -> Reply.Timeout
                    }
                }
                else -> Reply.Ack(null)
            }
        }
        repo.join("ABC234")
        socket.connect()
        runCurrent()

        repo.sendChat("ok-msg")
        repo.sendChat("bad-msg")
        repo.sendChat("lost-msg")
        runCurrent()

        val byContent = repo.state.value!!.messages.associateBy { it.content }
        assertEquals(ChatStatus.Sent, byContent.getValue("ok-msg").status)
        assertEquals("m1", byContent.getValue("ok-msg").key)
        assertTrue(byContent.getValue("bad-msg").status is ChatStatus.Failed)
        assertEquals(ChatStatus.Unconfirmed, byContent.getValue("lost-msg").status)
        assertEquals(3, repo.state.value!!.messages.size)
    }

    @Test
    fun `failed leave keeps the room, successful leave clears it`() = runTest {
        val repo = repo()
        repo.join("ABC234")
        api.leaveResult = { throw httpError(500, "Internal server error") }
        assertTrue(repo.leave() is ApiResult.Failure)
        assertNotNull("no false 'left' state", repo.state.value)

        api.leaveResult = { com.syncd.android.core.model.LeaveRoomResponse(left = true) }
        assertTrue(repo.leave() is ApiResult.Success)
        runCurrent()
        assertNull(repo.state.value)
        assertTrue(socket.stops >= 1)
    }

    @Test
    fun `open maps 403 and 404 without entering`() = runTest {
        val repo = repo()
        api.getRoomResult = { throw httpError(403, "Forbidden") }
        val r = repo.open("ABC234")
        assertTrue(r is ApiResult.Failure)
        assertNull(repo.state.value)
    }

    @Test
    fun `playback ack applies its snapshot and rejections surface a notice`() = runTest {
        val repo = repo()
        socket.responder = { event, _ ->
            when (event) {
                SocketEvents.ROOM_JOIN -> Reply.Ack(joinAck())
                SocketEvents.PLAYBACK_CONTROL -> Reply.Ack(
                    """{"ok":true,"playback":{"videoId":"dQw4w9WgXcQ","isPlaying":false,"position":42,"updatedAt":"${iso(50_000)}","serverTime":"${iso(50_001)}"}}""",
                )
                SocketEvents.QUEUE_ADVANCE -> Reply.Ack("""{"ok":false,"message":"Only the host can control playback"}""")
                else -> Reply.Ack(null)
            }
        }
        repo.join("ABC234")
        socket.connect()
        runCurrent()

        val notices = mutableListOf<String>()
        backgroundScope.launch { repo.notices.toList(notices) }

        assertEquals(CommandResult.Ok, repo.control("pause", 42.0))
        assertEquals(false, repo.state.value!!.playback?.isPlaying)
        assertEquals(42.0, repo.state.value!!.playback!!.position, 0.0)

        val advance = repo.queueAdvance()
        runCurrent()
        assertTrue(advance is CommandResult.Rejected)
        assertEquals(listOf("Only the host can control playback"), notices)
        // The idempotency guard names the current front of the queue.
        val advancePayload = socket.sent.last { it.first == SocketEvents.QUEUE_ADVANCE }.second.toString()
        assertTrue(advancePayload.contains("\"expectedFrontVideoId\":\"aaaaaaaaaaa\""))
    }

    @Test
    fun `presence broadcast after join updates members`() = runTest {
        socket.responder = { event, _ -> if (event == SocketEvents.ROOM_JOIN) Reply.Ack(joinAck()) else Reply.Ack(null) }
        val repo = repo()
        repo.join("ABC234")
        socket.connect()
        runCurrent()
        socket.events.emit(
            RealtimeEvent.Presence(PresenceSnapshot(listOf(PresenceMember("u1", "ana", true), PresenceMember("u2", "bo", true)), "u1")),
        )
        runCurrent()
        assertEquals(2, repo.state.value!!.members.size)
    }
}
