package com.syncd.android.data.repository

import com.syncd.android.core.model.TrackInput
import com.syncd.android.core.model.YouTubeSearchResult
import com.syncd.android.core.network.ApiResult
import com.syncd.android.core.network.SyncDApi
import com.syncd.android.core.network.apiCall
import com.syncd.android.core.network.map
import java.net.URI

/** What the user typed into search: a playlist link, a single video link/id, or free text. */
sealed interface TrackQuery {
    data class Playlist(val url: String) : TrackQuery
    data class Video(val url: String) : TrackQuery
    data class Search(val text: String) : TrackQuery

    companion object {
        private val hosts = setOf(
            "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
            "youtube-nocookie.com", "www.youtube-nocookie.com", "youtu.be", "www.youtu.be",
        )
        private val videoId = Regex("^[A-Za-z0-9_-]{11}$")

        /** Mirrors the server's isPlaylistUrl / parseYouTubeVideoId routing (music.validation.ts). */
        fun classify(raw: String): TrackQuery {
            val v = raw.trim()
            if (videoId.matches(v)) return Video(v)
            val uri = runCatching { URI(if ("://" in v) v else "https://$v") }.getOrNull()
            val host = uri?.host?.lowercase()
            if (host != null && host in hosts) {
                val hasList = uri.rawQuery?.split('&')?.any { it.startsWith("list=") } == true
                return if (hasList) Playlist(v) else Video(v)
            }
            return Search(v)
        }
    }
}

data class PlaylistImport(val title: String?, val tracks: List<YouTubeSearchResult>)

/** YouTube search/resolve via the backend proxy — the API key never leaves the server. */
class MusicRepository(private val api: SyncDApi) {
    suspend fun search(query: String): ApiResult<List<YouTubeSearchResult>> =
        apiCall { api.searchMusic(query.trim()) }.map { it.results }

    suspend fun resolveVideo(url: String): ApiResult<YouTubeSearchResult> =
        apiCall { api.resolveVideo(url.trim()) }.map { it.result }

    suspend fun resolvePlaylist(url: String): ApiResult<PlaylistImport> =
        apiCall { api.resolvePlaylist(url.trim()) }.map { PlaylistImport(it.playlistTitle, it.results) }
}

/** The exact fields the server's `validateTrackInput` reads. */
fun YouTubeSearchResult.toTrackInput() = TrackInput(
    videoId = videoId,
    title = title,
    thumbnailUrl = thumbnailUrl,
    duration = duration,
)
