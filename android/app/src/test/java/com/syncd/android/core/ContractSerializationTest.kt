package com.syncd.android.core

import com.syncd.android.core.model.MeResponse
import com.syncd.android.core.model.PlaybackSnapshot
import com.syncd.android.core.model.QueueAck
import com.syncd.android.core.model.QueueAdvancePayload
import com.syncd.android.core.model.RoomJoinAck
import com.syncd.android.core.model.RoomResponse
import com.syncd.android.core.model.TrackInput
import com.syncd.android.core.network.SyncDJson
import com.syncd.android.core.socket.Backoff
import com.syncd.android.core.util.IsoDuration
import com.syncd.android.core.util.RoomCodes
import com.syncd.android.core.util.Usernames
import com.syncd.android.core.util.formatClock
import com.syncd.android.data.repository.TrackQuery
import com.syncd.android.playback.source.PlaybackSource
import com.syncd.android.playback.source.SourceResolver
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/** Payloads below are shaped exactly like the server's TypeScript types emit them. */
class ContractSerializationTest {

    @Test
    fun `decodes me before onboarding`() {
        val me = SyncDJson.decodeFromString(MeResponse.serializer(), """{"authenticated":true,"user":null,"onboardingComplete":false}""")
        assertNull(me.user)
        assertFalse(me.onboardingComplete)
    }

    @Test
    fun `decodes a fresh room with null playback fields`() {
        val json = """
            {"room":{"id":"c1","roomCode":"ABC234","host":{"id":"u1","username":"ana"},
            "members":[{"user":{"id":"u1","username":"ana"},"joinedAt":"2026-11-14T10:00:00.000Z"}],
            "currentVideoId":null,"currentTitle":null,"currentThumbnailUrl":null,"currentDuration":null,
            "isPlaying":false,"playbackPosition":0,"playbackUpdatedAt":null}}
        """.trimIndent()
        val room = SyncDJson.decodeFromString(RoomResponse.serializer(), json).room
        assertEquals("ABC234", room.roomCode)
        assertEquals(1, room.members.size)
        assertNull(room.currentVideoId)
    }

    @Test
    fun `decodes a full room join ack and ignores unknown fields`() {
        val json = """
            {"ok":true,
             "presence":{"members":[{"userId":"u1","username":"ana","online":true},{"userId":"u2","username":"bo","online":false}],"hostUserId":"u1"},
             "messages":[{"id":"m1","roomId":"c1","userId":"u2","username":"bo","content":"hi","createdAt":"2026-11-14T10:00:01.000Z"}],
             "queue":[{"videoId":"aaaaaaaaaaa","title":"Next","thumbnailUrl":"https://i.ytimg.com/vi/a/mq.jpg","duration":"PT3M5S"}],
             "playback":{"videoId":"dQw4w9WgXcQ","title":"Song","thumbnailUrl":"","duration":212,"isPlaying":true,"position":12.5,
                         "updatedAt":"2026-11-14T10:00:00.000Z","serverTime":"2026-11-14T10:00:05.000Z"},
             "futureField":{"x":1}}
        """.trimIndent()
        val ack = SyncDJson.decodeFromString(RoomJoinAck.serializer(), json)
        assertTrue(ack.ok)
        assertEquals("u1", ack.presence!!.hostUserId)
        assertEquals(12.5, ack.playback!!.position, 0.0)
        assertEquals(1, ack.queue!!.size)
        assertEquals("hi", ack.messages!!.single().content)
    }

    @Test
    fun `decodes join errors`() {
        val ack = SyncDJson.decodeFromString(RoomJoinAck.serializer(), """{"ok":false,"message":"Not a member of this room"}""")
        assertFalse(ack.ok)
        assertEquals("Not a member of this room", ack.message)
    }

    @Test
    fun `decodes queue full ack`() {
        val ack = SyncDJson.decodeFromString(QueueAck.serializer(), """{"ok":false,"message":"Queue is full (max 50 tracks)","code":"QUEUE_FULL"}""")
        assertEquals("QUEUE_FULL", ack.code)
    }

    @Test
    fun `playback snapshot after clear`() {
        val s = SyncDJson.decodeFromString(
            PlaybackSnapshot.serializer(),
            """{"videoId":null,"title":null,"thumbnailUrl":null,"duration":null,"isPlaying":false,"position":0,"updatedAt":"2026-11-14T10:00:00.000Z","serverTime":"2026-11-14T10:00:00.010Z"}""",
        )
        assertNull(s.videoId)
    }

    @Test
    fun `advance without a front item omits the guard instead of sending null`() {
        val json = SyncDJson.encodeToJsonElement(QueueAdvancePayload.serializer(), QueueAdvancePayload("ABC234", null)).jsonObject
        assertFalse("server checks `!== undefined`; null would never match", json.containsKey("expectedFrontVideoId"))
        val withGuard = SyncDJson.encodeToJsonElement(QueueAdvancePayload.serializer(), QueueAdvancePayload("ABC234", "aaaaaaaaaaa")).jsonObject
        assertTrue(withGuard.containsKey("expectedFrontVideoId"))
    }

    @Test
    fun `track input carries exactly the validated fields`() {
        val json = SyncDJson.encodeToJsonElement(TrackInput.serializer(), TrackInput("dQw4w9WgXcQ", "t", "https://i.ytimg.com/x.jpg", "PT1M")).jsonObject
        assertEquals(setOf("videoId", "title", "thumbnailUrl", "duration"), json.keys)
    }
}

class UtilitiesTest {
    @Test
    fun `iso durations match the server parser`() {
        assertEquals(225.0, IsoDuration.toSeconds("PT3M45S")!!, 0.0)
        assertEquals(3_723.0, IsoDuration.toSeconds("PT1H2M3S")!!, 0.0)
        assertEquals(86_400.0 + 1, IsoDuration.toSeconds("P1DT1S")!!, 0.0)
        assertNull("live streams", IsoDuration.toSeconds("P0D"))
        assertNull(IsoDuration.toSeconds(""))
        assertNull(IsoDuration.toSeconds("3:45"))
    }

    @Test
    fun `clock formatting`() {
        assertEquals("0:00", formatClock(0.0))
        assertEquals("3:07", formatClock(187.9))
        assertEquals("1:02:03", formatClock(3_723.0))
        assertEquals("--:--", formatClock(null))
    }

    @Test
    fun `room code validation mirrors the server`() {
        assertNull(RoomCodes.validate(" abc234 "))
        assertNotNull(RoomCodes.validate("ABC23"))
        assertNotNull(RoomCodes.validate("ABC-34"))
        assertEquals("ABC234", RoomCodes.normalize(" abc234 "))
    }

    @Test
    fun `username validation mirrors the server`() {
        assertNull(Usernames.validate("dj_ana"))
        assertNotNull(Usernames.validate("ab"))
        assertNotNull(Usernames.validate("a".repeat(21)))
        assertNotNull(Usernames.validate("ana!"))
    }

    @Test
    fun `backoff grows, caps and jitters within bounds`() {
        val b = Backoff(random = Random(1))
        val first = b.delayFor(1)
        assertTrue(first in 800..1_200)
        assertTrue(b.delayFor(3) in 3_200..4_800)
        repeat(20) { assertTrue(b.delayFor(50) in 24_000..36_000) }
    }
}

class SourceEligibilityTest {
    @Test
    fun `youtube room tracks are never native or background eligible`() {
        val yt = SourceResolver.forRoomTrack("dQw4w9WgXcQ")!!
        assertFalse(SourceResolver.isNativeEligible(yt))
        assertFalse(yt.capabilities.backgroundPlayback)
        assertFalse(yt.capabilities.systemMediaControls)
        assertTrue(yt.capabilities.sharedWithRoom)
    }

    @Test
    fun `invalid room track ids are unsupported`() {
        assertNull(SourceResolver.forRoomTrack(null))
        assertNull(SourceResolver.forRoomTrack("short"))
        assertNull(SourceResolver.forRoomTrack("https://youtu.be/dQw4w9WgXcQ"))
    }

    @Test
    fun `picked local files are eligible and private`() {
        val local = SourceResolver.forLocalUri("content://media/external/audio/1", "Song")!!
        assertTrue(SourceResolver.isNativeEligible(local))
        assertFalse(local.capabilities.sharedWithRoom)
    }

    @Test
    fun `arbitrary network urls are refused`() {
        assertNull(SourceResolver.forLocalUri("https://example.com/a.mp3", "x"))
        assertNull(SourceResolver.forLocalUri("file:///sdcard/a.mp3", "x"))
    }

    @Test
    fun `youtube is not representable for the native player`() {
        val yt: PlaybackSource = PlaybackSource.YouTube("dQw4w9WgXcQ")
        assertFalse(SourceResolver.isNativeEligible(yt))
    }
}

class TrackQueryTest {
    @Test fun `bare id is a video`() = assertEquals(TrackQuery.Video("dQw4w9WgXcQ"), TrackQuery.classify("dQw4w9WgXcQ"))

    @Test fun `watch link is a video`() =
        assertTrue(TrackQuery.classify("https://www.youtube.com/watch?v=dQw4w9WgXcQ") is TrackQuery.Video)

    @Test fun `short link without scheme is a video`() =
        assertTrue(TrackQuery.classify("youtu.be/dQw4w9WgXcQ") is TrackQuery.Video)

    @Test fun `list param is a playlist`() =
        assertTrue(TrackQuery.classify("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890ab") is TrackQuery.Playlist)

    @Test fun `free text is a search`() = assertEquals(TrackQuery.Search("lofi beats"), TrackQuery.classify(" lofi beats "))

    @Test fun `other hosts are a search`() = assertTrue(TrackQuery.classify("https://vimeo.com/123") is TrackQuery.Search)
}
