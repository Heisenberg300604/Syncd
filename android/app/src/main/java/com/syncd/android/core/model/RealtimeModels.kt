package com.syncd.android.core.model

import kotlinx.serialization.Serializable

/*
 * Socket.IO wire models. Mirrors server/src/sockets/*.types.ts and the playback /
 * messages type files. Event names live in core/socket/SocketEvents.kt.
 */

/**
 * server/src/modules/playback/playback.types.ts `PlaybackSnapshot`.
 *
 * `position` is the playhead in seconds as of `updatedAt`. While playing, the
 * current playhead is `position + (serverNow - updatedAt)`; `serverTime` is the
 * server's clock when the snapshot was serialised and is the only safe basis for
 * estimating `serverNow` (device clocks are not trusted). There is no explicit
 * playback rate — it is implicitly 1.0 — and no revision number.
 */
@Serializable
data class PlaybackSnapshot(
    val videoId: String? = null,
    val title: String? = null,
    val thumbnailUrl: String? = null,
    val duration: Double? = null,
    val isPlaying: Boolean = false,
    val position: Double = 0.0,
    val updatedAt: String? = null,
    val serverTime: String,
)

/** server/src/modules/playback/playback.types.ts `PlaybackTrackInput` (also `QueueItem`). */
@Serializable
data class TrackInput(
    val videoId: String,
    val title: String,
    val thumbnailUrl: String,
    /** ISO-8601 duration string. */
    val duration: String,
)

/** server/src/sockets/queue.types.ts `QueueItem` — identical shape to [TrackInput]. */
typealias QueueItem = TrackInput

/** server/src/sockets/presence.types.ts `PresenceMember` */
@Serializable
data class PresenceMember(
    val userId: String,
    val username: String,
    val online: Boolean,
)

/** server/src/sockets/presence.types.ts `PresenceSnapshot` — carries the live host. */
@Serializable
data class PresenceSnapshot(
    val members: List<PresenceMember>,
    val hostUserId: String,
)

/** server/src/modules/messages/messages.types.ts `ChatMessageDTO` */
@Serializable
data class ChatMessageDto(
    val id: String,
    val roomId: String,
    val userId: String,
    val username: String,
    val content: String,
    val createdAt: String,
)

/** server/src/sockets/host.types.ts `HostUpdatePayload`; reason ∈ manual | disconnect | left. */
@Serializable
data class HostUpdatePayload(
    val hostUserId: String,
    val hostUsername: String,
    val previousHostUserId: String,
    val previousHostUsername: String,
    val reason: String,
)

/** server/src/sockets/host.types.ts `HostPendingPayload` */
@Serializable
data class HostPendingPayload(
    val pending: Boolean,
    val hostUserId: String,
    val hostUsername: String,
    val successorUsername: String? = null,
    /** ISO instant (server clock) the automatic transfer fires at. */
    val deadline: String? = null,
)

/** `room:join` ack — union of `RoomJoinAck` and `RoomJoinErrorAck` (presence.types.ts). */
@Serializable
data class RoomJoinAck(
    val ok: Boolean,
    val message: String? = null,
    val presence: PresenceSnapshot? = null,
    val playback: PlaybackSnapshot? = null,
    val messages: List<ChatMessageDto>? = null,
    val queue: List<QueueItem>? = null,
)

/** `playback:*` ack — `PlaybackAck` (playback.types.ts). */
@Serializable
data class PlaybackAck(
    val ok: Boolean,
    val playback: PlaybackSnapshot? = null,
    val message: String? = null,
)

/** `queue:*` ack — `QueueAck` (queue.types.ts); `code` is "QUEUE_FULL" when capacity is hit. */
@Serializable
data class QueueAck(
    val ok: Boolean,
    val queue: List<QueueItem>? = null,
    val message: String? = null,
    val code: String? = null,
)

/** `chat:send` and `host:transfer` acks: `{ ok, message? }`. */
@Serializable
data class SimpleAck(
    val ok: Boolean,
    val message: String? = null,
)

// ---- Client → server payloads ------------------------------------------------

@Serializable
data class RoomCodePayload(val roomCode: String)

@Serializable
data class PlaybackSetPayload(val roomCode: String, val track: TrackInput)

/** action ∈ play | pause | seek (playback.validation.ts). */
@Serializable
data class PlaybackControlPayload(val roomCode: String, val action: String, val position: Double)

@Serializable
data class QueueTrackPayload(val roomCode: String, val track: TrackInput)

@Serializable
data class QueueRemovePayload(val roomCode: String, val index: Int)

@Serializable
data class QueueReorderPayload(val roomCode: String, val fromIndex: Int, val toIndex: Int)

/** `expectedFrontVideoId` makes duplicate advances idempotent (queue.types.ts). */
@Serializable
data class QueueAdvancePayload(val roomCode: String, val expectedFrontVideoId: String? = null)

@Serializable
data class ChatSendPayload(val roomCode: String, val content: String)

@Serializable
data class HostTransferPayload(val roomCode: String, val userId: String)
