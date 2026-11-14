package com.syncd.android.playback.source

/**
 * What a source is allowed / able to do. Eligibility is explicit — nothing is
 * assumed to be playable in the background or through Media3.
 */
data class SourceCapabilities(
    /** May be handed to the Media3 ExoPlayer owned by PlaybackService. */
    val nativePlayback: Boolean,
    /** May keep playing with the app backgrounded / screen off. */
    val backgroundPlayback: Boolean,
    /** May publish to the media notification, lock screen and Bluetooth controls. */
    val systemMediaControls: Boolean,
    val seek: Boolean,
    /** Fine-grained speed control for gradual drift correction. */
    val rateCorrection: Boolean,
    /** Audio is the room's shared track (vs. a private, local-only item). */
    val sharedWithRoom: Boolean,
)

sealed interface PlaybackSource {
    val capabilities: SourceCapabilities
    val label: String

    /**
     * A room track. The backend models every room track as a YouTube video id and
     * nothing else (PlaybackSnapshot / QueueItem carry only `videoId`).
     *
     * Provider compliance: YouTube content is rendered only by YouTube's official
     * IFrame player, visible on screen, paused when the app leaves the
     * foreground. No stream extraction, no audio-only mode, no background audio,
     * so it is never eligible for Media3 or system media controls.
     */
    data class YouTube(val videoId: String) : PlaybackSource {
        override val capabilities = SourceCapabilities(
            nativePlayback = false,
            backgroundPlayback = false,
            systemMediaControls = false,
            seek = true,
            // The IFrame API only offers coarse steps (0.75×/1.25×) — far too audible.
            rateCorrection = false,
            sharedWithRoom = true,
        )
        override val label = "YouTube"
    }

    /**
     * An audio file the user picked from their own device via the system picker.
     * Played through Media3 with full background + system-control support. It is
     * private to this device and is never shared with, or synced to, a room.
     */
    data class LocalFile(val uri: String, val displayName: String) : PlaybackSource {
        override val capabilities = SourceCapabilities(
            nativePlayback = true,
            backgroundPlayback = true,
            systemMediaControls = true,
            seek = true,
            rateCorrection = true,
            sharedWithRoom = false,
        )
        override val label = "On this device"
    }

    /*
     * Host-PC streaming is NOT modelled: the backend has no stream contract
     * (no stream URL, ticket endpoint or source-type field). See
     * android/docs/BACKEND_CONTRACT.md §5.1 for the proposed additive extension.
     */
}

object SourceResolver {
    /** server/src/modules/music/music.validation.ts YOUTUBE_VIDEO_ID_REGEX */
    private val youTubeId = Regex("^[A-Za-z0-9_-]{11}$")

    /** Room track → source, or null when the id is not a valid YouTube id (unsupported). */
    fun forRoomTrack(videoId: String?): PlaybackSource.YouTube? =
        videoId?.takeIf { youTubeId.matches(it) }?.let { PlaybackSource.YouTube(it) }

    /**
     * Only `content://` URIs from the system picker are accepted. Remote http(s)
     * URLs are rejected: without a backend-issued, authorised stream contract the
     * app has no business opening arbitrary network audio.
     */
    fun forLocalUri(uri: String, displayName: String): PlaybackSource.LocalFile? =
        if (uri.startsWith("content://")) PlaybackSource.LocalFile(uri, displayName.ifBlank { "Audio file" }) else null

    /** The single gate in front of Media3. */
    fun isNativeEligible(source: PlaybackSource): Boolean =
        source.capabilities.nativePlayback && source.capabilities.backgroundPlayback
}
