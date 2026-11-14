package com.syncd.android.playback.engine

import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.PlayerConstants
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.YouTubePlayer
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.listeners.AbstractYouTubePlayerListener
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * [RoomPlaybackEngine] over YouTube's official IFrame Player API (hosted by
 * android-youtube-player). Compliance boundaries:
 *  - the player is always visible while it plays (it lives on the room screen);
 *  - background playback is never enabled — the view pauses itself on ON_STOP;
 *  - no stream extraction or audio-only rendering; ads/branding are untouched.
 *
 * Call only on the main thread (the IFrame bridge requires it).
 */
class YouTubeRoomEngine(private val monotonicNowMs: () -> Long) : RoomPlaybackEngine {

    private val _state = MutableStateFlow(EngineState())
    override val state: StateFlow<EngineState> = _state.asStateFlow()

    /** Coarse IFrame rates only — not usable for inaudible correction. */
    override val supportsRateCorrection: Boolean = false

    private var player: YouTubePlayer? = null
    private var pending: (YouTubePlayer.() -> Unit)? = null
    private var reportedSec = 0.0
    private var reportedAtMs = 0L

    val listener = object : AbstractYouTubePlayerListener() {
        override fun onReady(youTubePlayer: YouTubePlayer) {
            player = youTubePlayer
            pending?.invoke(youTubePlayer)
            pending = null
        }

        override fun onStateChange(youTubePlayer: YouTubePlayer, state: PlayerConstants.PlayerState) {
            val status = when (state) {
                PlayerConstants.PlayerState.PLAYING -> EngineStatus.Playing
                PlayerConstants.PlayerState.PAUSED -> EngineStatus.Paused
                PlayerConstants.PlayerState.BUFFERING -> EngineStatus.Buffering
                PlayerConstants.PlayerState.ENDED -> EngineStatus.Ended
                PlayerConstants.PlayerState.VIDEO_CUED -> EngineStatus.Paused
                PlayerConstants.PlayerState.UNSTARTED -> EngineStatus.Loading
                PlayerConstants.PlayerState.UNKNOWN -> _state.value.status
            }
            reportedAtMs = monotonicNowMs()
            _state.value = _state.value.copy(status = status, error = null)
        }

        override fun onCurrentSecond(youTubePlayer: YouTubePlayer, second: Float) {
            reportedSec = second.toDouble()
            reportedAtMs = monotonicNowMs()
        }

        override fun onVideoDuration(youTubePlayer: YouTubePlayer, duration: Float) {
            _state.value = _state.value.copy(durationSec = duration.toDouble().takeIf { it > 0 })
        }

        override fun onError(youTubePlayer: YouTubePlayer, error: PlayerConstants.PlayerError) {
            _state.value = _state.value.copy(status = EngineStatus.Error, error = describe(error))
        }
    }

    override fun positionSec(): Double {
        if (_state.value.status != EngineStatus.Playing) return reportedSec
        return reportedSec + (monotonicNowMs() - reportedAtMs).coerceAtLeast(0) / 1000.0
    }

    override fun load(videoId: String, startSec: Double, autoplay: Boolean) {
        reportedSec = startSec
        reportedAtMs = monotonicNowMs()
        _state.value = EngineState(status = EngineStatus.Loading, videoId = videoId)
        run {
            if (autoplay) loadVideo(videoId, startSec.toFloat()) else cueVideo(videoId, startSec.toFloat())
        }
    }

    override fun play() = run { play() }

    override fun pause() = run { pause() }

    override fun seekTo(sec: Double) {
        reportedSec = sec
        reportedAtMs = monotonicNowMs()
        run { seekTo(sec.toFloat()) }
    }

    override fun setRate(rate: Float) = Unit // unsupported, see supportsRateCorrection

    override fun stop() {
        run { pause() }
        reportedSec = 0.0
        _state.value = EngineState()
    }

    /** Called when the hosting view is released; the next view gets a fresh player. */
    fun detachPlayer() {
        player = null
        pending = null
        _state.value = EngineState()
    }

    private fun run(command: YouTubePlayer.() -> Unit) {
        val p = player
        if (p != null) p.command() else pending = command
    }

    private fun describe(error: PlayerConstants.PlayerError): String = when (error) {
        PlayerConstants.PlayerError.VIDEO_NOT_PLAYABLE_IN_EMBEDDED_PLAYER ->
            "The owner of this video doesn't allow it to play in other apps."
        PlayerConstants.PlayerError.VIDEO_NOT_FOUND -> "This video is unavailable or private."
        PlayerConstants.PlayerError.HTML_5_PLAYER -> "YouTube couldn't play this video on this device."
        PlayerConstants.PlayerError.INVALID_PARAMETER_IN_REQUEST -> "This video couldn't be loaded."
        PlayerConstants.PlayerError.REQUEST_MISSING_HTTP_REFERER,
        PlayerConstants.PlayerError.UNKNOWN,
        -> "YouTube playback failed."
    }
}
