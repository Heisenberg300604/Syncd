package com.syncd.android.core.network

import com.syncd.android.core.model.CreateProfileRequest
import com.syncd.android.core.model.LeaveRoomResponse
import com.syncd.android.core.model.MeResponse
import com.syncd.android.core.model.PlaylistResponse
import com.syncd.android.core.model.ProfileResponse
import com.syncd.android.core.model.RoomResponse
import com.syncd.android.core.model.SearchResponse
import com.syncd.android.core.model.VideoResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Every route the backend exposes (server/src/routes/index.ts and module routers),
 * relative to the `/api` base. All require `Authorization: Bearer <Clerk JWT>`,
 * which [AuthInterceptor] attaches. Nothing here is invented: a route that does
 * not exist on the server does not exist here.
 */
interface SyncDApi {
    @GET("me")
    suspend fun me(): MeResponse

    @POST("users/profile")
    suspend fun createProfile(@Body body: CreateProfileRequest): ProfileResponse

    @POST("rooms")
    suspend fun createRoom(): RoomResponse

    @POST("rooms/{roomCode}/join")
    suspend fun joinRoom(@Path("roomCode") roomCode: String): RoomResponse

    @GET("rooms/{roomCode}")
    suspend fun getRoom(@Path("roomCode") roomCode: String): RoomResponse

    @POST("rooms/{roomCode}/leave")
    suspend fun leaveRoom(@Path("roomCode") roomCode: String): LeaveRoomResponse

    @GET("music/search")
    suspend fun searchMusic(@Query("q") query: String): SearchResponse

    @GET("music/video")
    suspend fun resolveVideo(@Query("url") url: String): VideoResponse

    @GET("music/playlist")
    suspend fun resolvePlaylist(@Query("url") url: String): PlaylistResponse
}
