package com.syncd.android.playback.service

import android.app.PendingIntent
import android.content.Intent
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.syncd.android.MainActivity
import com.syncd.android.R
import com.syncd.android.playback.source.SourceResolver

/**
 * Owns the app's one and only ExoPlayer and its MediaSession for the lifetime of
 * the service. Screens never construct players; they connect a MediaController
 * (playback/session/PlaybackConnection). Media3 handles the foreground-service
 * promotion and media notification while playing, which also publishes the
 * lock-screen / Bluetooth / headset controls.
 *
 * Audio focus, ducking and interruptions are handled by ExoPlayer
 * (`handleAudioFocus = true`); headset unplug / Bluetooth disconnect pause via
 * `setHandleAudioBecomingNoisy(true)`. The wake lock is held only while playing
 * (WAKE_MODE_LOCAL — eligible sources are local files, so no Wi-Fi lock).
 */
@OptIn(UnstableApi::class)
class PlaybackService : MediaSessionService() {

    private var session: MediaSession? = null

    override fun onCreate() {
        super.onCreate()

        val exo = ExoPlayer.Builder(this)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                /* handleAudioFocus = */ true,
            )
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_LOCAL)
            .build()

        val player = CapabilityGatedPlayer(exo)
        exo.addListener(object : Player.Listener {
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                player.capabilities = mediaItem?.let(MediaItems::sourceOf)?.capabilities
            }
        })

        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        session = MediaSession.Builder(this, player)
            .setSessionActivity(openApp)
            .setCallback(EligibilityCallback())
            .build()

        setMediaNotificationProvider(
            DefaultMediaNotificationProvider.Builder(this).build().apply {
                setSmallIcon(R.drawable.ic_notification)
            },
        )
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

    /** Swiping the app away stops the service unless something is actually playing. */
    override fun onTaskRemoved(rootIntent: Intent?) {
        val player = session?.player
        if (player == null || !player.playWhenReady || player.mediaItemCount == 0 ||
            player.playbackState == Player.STATE_ENDED
        ) {
            stopSelf()
        }
    }

    override fun onDestroy() {
        session?.run {
            player.release()
            release()
        }
        session = null
        super.onDestroy()
    }

    /**
     * Defence in depth: every item a controller tries to add is re-resolved here,
     * and anything not eligible for native/background playback is refused — so a
     * YouTube id can never reach ExoPlayer, whichever controller sends it.
     * Items from controllers arrive without `localConfiguration`; the URI is
     * rebuilt from `requestMetadata.mediaUri`.
     */
    private inner class EligibilityCallback : MediaSession.Callback {
        override fun onAddMediaItems(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: MutableList<MediaItem>,
        ): ListenableFuture<MutableList<MediaItem>> {
            val accepted = mediaItems.mapNotNull { item ->
                val source = MediaItems.sourceOf(item) ?: return@mapNotNull null
                if (!SourceResolver.isNativeEligible(source)) return@mapNotNull null
                MediaItems.forSource(source, item.mediaMetadata)
            }.toMutableList()
            return if (accepted.isEmpty()) {
                Futures.immediateFailedFuture(UnsupportedOperationException("Source not eligible for native playback"))
            } else {
                Futures.immediateFuture(accepted)
            }
        }
    }
}
