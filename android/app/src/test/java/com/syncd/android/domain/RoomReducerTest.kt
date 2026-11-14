package com.syncd.android.domain

import com.syncd.android.core.model.ChatMessageDto
import com.syncd.android.core.model.HostPendingPayload
import com.syncd.android.core.model.HostUpdatePayload
import com.syncd.android.core.model.PlaybackSnapshot
import com.syncd.android.core.model.PresenceMember
import com.syncd.android.core.model.PresenceSnapshot
import com.syncd.android.core.model.RoomJoinAck
import com.syncd.android.core.model.TrackInput
import com.syncd.android.domain.model.ChatEntry
import com.syncd.android.domain.model.ChatStatus
import com.syncd.android.domain.model.RoomPhase
import com.syncd.android.domain.model.RoomReducer
import com.syncd.android.testing.iso
import com.syncd.android.testing.roomDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RoomReducerTest {
    private val base = RoomReducer.fromRest(roomDto(members = listOf("u1" to "ana", "u2" to "bo")))

    private fun playback(updatedAt: Long, videoId: String = "dQw4w9WgXcQ", playing: Boolean = true) =
        PlaybackSnapshot(videoId = videoId, isPlaying = playing, position = 1.0, updatedAt = iso(updatedAt), serverTime = iso(updatedAt + 5))

    private fun msg(id: String, at: Long, user: String = "u2", content: String = "hey") =
        ChatMessageDto(id, "r", user, if (user == "u1") "ana" else "bo", content, iso(at))

    @Test
    fun `rest seed has unknown presence and is joining`() {
        assertEquals(RoomPhase.Joining, base.phase)
        assertTrue(base.members.all { it.online == null })
        assertTrue(base.members.first { it.userId == "u1" }.isHost)
    }

    @Test
    fun `join ack is authoritative even over a newer local playback`() {
        val withNewer = RoomReducer.applyPlayback(base, playback(5_000))
        val ack = RoomJoinAck(ok = true, playback = playback(1_000, videoId = "aaaaaaaaaaa"), queue = emptyList(), messages = emptyList())
        val s = RoomReducer.applyJoinAck(withNewer, ack)
        assertEquals(RoomPhase.Live, s.phase)
        assertEquals("aaaaaaaaaaa", s.playback?.videoId)
    }

    @Test
    fun `stale broadcast playback is ignored`() {
        val s = RoomReducer.applyPlayback(RoomReducer.applyPlayback(base, playback(5_000)), playback(4_000, videoId = "zzzzzzzzzzz"))
        assertEquals("dQw4w9WgXcQ", s.playback?.videoId)
    }

    @Test
    fun `presence replaces members and moves the host`() {
        val s = RoomReducer.applyPresence(
            base,
            PresenceSnapshot(listOf(PresenceMember("u1", "ana", false), PresenceMember("u2", "bo", true)), hostUserId = "u2"),
        )
        assertEquals("u2", s.hostUserId)
        assertTrue(s.members.first { it.userId == "u2" }.isHost)
        assertEquals(false, s.members.first { it.userId == "u1" }.online)
    }

    @Test
    fun `chat merge is idempotent and chronological`() {
        var s = RoomReducer.applyChat(base, msg("m2", 2_000), null)
        s = RoomReducer.applyChat(s, msg("m1", 1_000), null)
        s = RoomReducer.applyChat(s, msg("m2", 2_000), null) // duplicate (history + live race)
        assertEquals(listOf("m1", "m2"), s.messages.map { it.key })
    }

    @Test
    fun `own echo replaces the pending entry instead of duplicating`() {
        var s = RoomReducer.addPendingChat(base, ChatEntry("local-1", "u1", "ana", "hello", 0, ChatStatus.Sending))
        s = RoomReducer.applyChat(s, msg("m9", 3_000, user = "u1", content = "hello"), selfUserId = "u1")
        assertEquals(1, s.messages.size)
        assertEquals("m9", s.messages.single().key)
        assertEquals(ChatStatus.Sent, s.messages.single().status)
    }

    @Test
    fun `someone else's identical text does not resolve my pending message`() {
        var s = RoomReducer.addPendingChat(base, ChatEntry("local-1", "u1", "ana", "hello", 0, ChatStatus.Sending))
        s = RoomReducer.applyChat(s, msg("m9", 3_000, user = "u2", content = "hello"), selfUserId = "u1")
        assertEquals(2, s.messages.size)
        assertEquals(ChatStatus.Sending, s.messages.last().status) // pending stays at the bottom
    }

    @Test
    fun `host update clears pending countdown and stores the notice`() {
        var s = RoomReducer.applyHostPending(base, HostPendingPayload(true, "u1", "ana", "bo", iso(9_000)))
        assertEquals("bo", s.hostPending?.successorUsername)
        s = RoomReducer.applyHostUpdate(s, HostUpdatePayload("u2", "bo", "u1", "ana", "disconnect"))
        assertNull(s.hostPending)
        assertEquals("u2", s.hostUserId)
        assertEquals("disconnect", s.hostNotice?.reason)
    }

    @Test
    fun `pending false clears the banner`() {
        val s = RoomReducer.applyHostPending(
            RoomReducer.applyHostPending(base, HostPendingPayload(true, "u1", "ana", "bo", iso(9_000))),
            HostPendingPayload(false, "u1", "ana"),
        )
        assertNull(s.hostPending)
    }

    @Test
    fun `queue snapshot replaces`() {
        val q = listOf(TrackInput("aaaaaaaaaaa", "A", "", "PT1M"))
        assertEquals(q, RoomReducer.applyQueue(base, q).queue)
    }

    @Test
    fun `join errors map to terminal phases`() {
        assertTrue(RoomReducer.phaseForJoinError("Room not found") is RoomPhase.Closed)
        assertTrue(RoomReducer.phaseForJoinError("Not a member of this room") is RoomPhase.Removed)
        assertEquals(RoomPhase.Joining, RoomReducer.phaseForJoinError("Slow down — try again in 3s."))
    }
}
