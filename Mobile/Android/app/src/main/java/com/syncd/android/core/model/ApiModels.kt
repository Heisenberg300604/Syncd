package com.syncd.android.core.model

import kotlinx.serialization.Serializable

/*
 * REST wire models. Each mirrors a TypeScript type in server/src field-for-field;
 * the source file is named on every declaration. Change both sides together.
 */

/** server/src/modules/users/users.types.ts `PublicUser` */
@Serializable
data class PublicUser(
    val id: String,
    val clerkUserId: String,
    val username: String,
)

/** server/src/modules/users/users.types.ts `MeResponse` — `user` is null until onboarding. */
@Serializable
data class MeResponse(
    val authenticated: Boolean,
    val user: PublicUser? = null,
    val onboardingComplete: Boolean,
)

/** Body of `POST /api/users/profile`. */
@Serializable
data class CreateProfileRequest(val username: String)

/** server/src/modules/users/users.types.ts `ProfileResponse` */
@Serializable
data class ProfileResponse(val user: PublicUser)

/** server/src/modules/rooms/rooms.types.ts `RoomUser` (no Clerk id — deliberately narrower). */
@Serializable
data class RoomUser(
    val id: String,
    val username: String,
)

/** server/src/modules/rooms/rooms.types.ts `RoomMemberDTO` */
@Serializable
data class RoomMemberDto(
    val user: RoomUser,
    /** ISO-8601 instant. */
    val joinedAt: String,
)

/** server/src/modules/rooms/rooms.types.ts `RoomDTO` */
@Serializable
data class RoomDto(
    val id: String,
    val roomCode: String,
    val host: RoomUser,
    val members: List<RoomMemberDto>,
    val currentVideoId: String? = null,
    val currentTitle: String? = null,
    val currentThumbnailUrl: String? = null,
    /** Seconds; null for live/unknown. */
    val currentDuration: Double? = null,
    val isPlaying: Boolean = false,
    /** Seconds, as of [playbackUpdatedAt]. */
    val playbackPosition: Double = 0.0,
    val playbackUpdatedAt: String? = null,
)

/** `{ room }` — create (201), join (200) and get (200) all share this envelope. */
@Serializable
data class RoomResponse(val room: RoomDto)

/** `POST /api/rooms/:code/leave` → `{ left: true, roomDeleted }` (rooms.controller.ts). */
@Serializable
data class LeaveRoomResponse(
    val left: Boolean,
    val roomDeleted: Boolean = false,
)

/** server/src/modules/music/music.types.ts `YouTubeSearchResult` */
@Serializable
data class YouTubeSearchResult(
    val videoId: String,
    val title: String,
    val channelTitle: String,
    val thumbnailUrl: String,
    /** ISO-8601 duration ("PT3M45S"); empty when YouTube did not return one. */
    val duration: String,
)

@Serializable
data class SearchResponse(val results: List<YouTubeSearchResult>)

@Serializable
data class VideoResponse(val result: YouTubeSearchResult)

@Serializable
data class PlaylistResponse(
    val results: List<YouTubeSearchResult>,
    val playlistTitle: String? = null,
)

/** Error body produced by errorHandler.ts / requireAuth.ts / rateLimit.ts. */
@Serializable
data class ErrorBody(
    val message: String? = null,
    val authenticated: Boolean? = null,
)
