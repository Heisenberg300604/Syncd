package com.syncd.android.playback.session

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import androidx.core.content.ContextCompat
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import com.syncd.android.playback.service.MediaItems
import com.syncd.android.playback.service.PlaybackService
import com.syncd.android.playback.source.PlaybackSource
import com.syncd.android.playback.source.SourceResolver
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Snapshot of the service-owned session for the mini-player, full player and settings. */
data class LocalPlayerState(
    val connected: Boolean = false,
    val hasMedia: Boolean = false,
    val isPlaying: Boolean = false,
    val playWhenReady: Boolean = false,
    val isBuffering: Boolean = false,
    val ended: Boolean = false,
    val title: String? = null,
    val subtitle: String? = null,
    val artworkUri: Uri? = null,
    val artworkData: ByteArray? = null,
    val durationMs: Long? = null,
    val canSeek: Boolean = false,
    val source: PlaybackSource? = null,
    val error: String? = null,
)

/**
 * Lifecycle-safe binding from the UI to [PlaybackService]. [connect] in
 * Activity.onStart, [release] in onStop — releasing the controller does not
 * stop playback; the service keeps running in the foreground while playing.
 * Every surface (mini-player, full player) reads this single connection, and the
 * notification/lock screen talk to the same session, so they can never disagree.
 */
class PlaybackConnection(private val context: Context) {

    private var future: ListenableFuture<MediaController>? = null
    private var controller: MediaController? = null

    private val _state = MutableStateFlow(LocalPlayerState())
    val state: StateFlow<LocalPlayerState> = _state.asStateFlow()

    private val listener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) = publish()
    }

    fun connect() {
        if (future != null) return
        val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        val f = MediaController.Builder(context, token).buildAsync()
        future = f
        f.addListener({
            if (future !== f) return@addListener
            controller = runCatching { f.get() }.getOrNull()?.also {
                it.addListener(listener)
            }
            publish()
        }, ContextCompat.getMainExecutor(context))
    }

    fun release() {
        controller?.removeListener(listener)
        future?.let(MediaController::releaseFuture)
        controller = null
        future = null
        _state.value = _state.value.copy(connected = false)
    }

    /**
     * Starts [source] in the service. Refuses anything that is not eligible for
     * native/background playback (the service re-checks independently).
     */
    fun play(source: PlaybackSource): Result<Unit> {
        if (!SourceResolver.isNativeEligible(source)) {
            return Result.failure(IllegalArgumentException("${source.label} can't play in the background player."))
        }
        val c = controller ?: return Result.failure(IllegalStateException("Player is still starting. Try again."))
        val item = MediaItems.forSource(source) ?: return Result.failure(IllegalArgumentException("Unsupported source"))
        c.setMediaItem(item)
        c.prepare()
        c.play()
        return Result.success(Unit)
    }

    fun togglePlayPause() {
        val c = controller ?: return
        when {
            c.playbackState == Player.STATE_ENDED -> {
                c.seekTo(0)
                c.play()
            }
            c.playWhenReady -> c.pause()
            else -> {
                if (c.playbackState == Player.STATE_IDLE) c.prepare()
                c.play()
            }
        }
    }

    fun pause() {
        controller?.pause()
    }

    fun seekTo(positionMs: Long) {
        val c = controller ?: return
        if (c.isCommandAvailable(Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM)) c.seekTo(positionMs)
    }

    fun seekBy(deltaMs: Long) = seekTo((positionMs() + deltaMs).coerceAtLeast(0))

    fun stop() {
        controller?.run {
            stop()
            clearMediaItems()
        }
    }

    /** Read on demand (polled by the UI while visible) rather than pushed every frame. */
    fun positionMs(): Long = controller?.currentPosition ?: 0L

    private fun publish() {
        val c = controller
        if (c == null) {
            _state.value = LocalPlayerState(connected = false)
            return
        }
        val item = c.currentMediaItem
        val md = c.mediaMetadata
        _state.value = LocalPlayerState(
            connected = true,
            hasMedia = item != null,
            isPlaying = c.isPlaying,
            playWhenReady = c.playWhenReady,
            isBuffering = c.playbackState == Player.STATE_BUFFERING,
            ended = c.playbackState == Player.STATE_ENDED,
            title = md.title?.toString() ?: item?.mediaMetadata?.title?.toString(),
            subtitle = md.artist?.toString() ?: item?.mediaMetadata?.artist?.toString(),
            artworkUri = md.artworkUri,
            artworkData = md.artworkData,
            durationMs = c.duration.takeIf { it > 0 },
            canSeek = c.isCommandAvailable(Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM),
            source = item?.let(MediaItems::sourceOf),
            error = c.playerError?.let(::describe),
        )
    }

    private fun describe(e: PlaybackException): String = when (e.errorCode) {
        PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND,
        PlaybackException.ERROR_CODE_IO_NO_PERMISSION,
        -> "This file is no longer available. Pick it again."
        PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED,
        PlaybackException.ERROR_CODE_DECODER_INIT_FAILED,
        PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED,
        -> "This audio format isn't supported on this device."
        else -> "Playback failed (${e.errorCodeName})."
    }
}
