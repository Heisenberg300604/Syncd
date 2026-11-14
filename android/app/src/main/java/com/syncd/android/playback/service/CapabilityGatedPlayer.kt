package com.syncd.android.playback.service

import android.net.Uri
import android.os.Bundle
import androidx.annotation.OptIn
import androidx.media3.common.ForwardingSimpleBasePlayer
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import com.syncd.android.playback.source.PlaybackSource
import com.syncd.android.playback.source.SourceCapabilities
import com.syncd.android.playback.source.SourceResolver

/**
 * Publishes only the commands the current source supports. Media3 derives the
 * notification / lock-screen / Bluetooth buttons from the available commands, so
 * an unsupported action is never offered rather than offered and ignored.
 */
@OptIn(UnstableApi::class)
class CapabilityGatedPlayer(player: Player) : ForwardingSimpleBasePlayer(player) {

    var capabilities: SourceCapabilities? = null
        set(value) {
            field = value
            invalidateState()
        }

    override fun getState(): State {
        val state = super.getState()
        val caps = capabilities ?: return state
        val commands = state.availableCommands.buildUpon().apply {
            if (!caps.seek) {
                removeAll(
                    Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM,
                    Player.COMMAND_SEEK_BACK,
                    Player.COMMAND_SEEK_FORWARD,
                    Player.COMMAND_SEEK_TO_DEFAULT_POSITION,
                )
            }
            if (!caps.rateCorrection) remove(Player.COMMAND_SET_SPEED_AND_PITCH)
            // Single-item sessions: no playlist navigation to advertise.
            removeAll(
                Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
                Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
            )
        }.build()
        return state.buildUpon().setAvailableCommands(commands).build()
    }
}

/** MediaItem <-> [PlaybackSource] mapping shared by the service and the controller side. */
object MediaItems {
    private const val EXTRA_SOURCE_KIND = "com.syncd.android.SOURCE_KIND"
    private const val EXTRA_DISPLAY_NAME = "com.syncd.android.DISPLAY_NAME"
    private const val KIND_LOCAL_FILE = "local_file"

    fun forSource(source: PlaybackSource, metadata: MediaMetadata? = null): MediaItem? = when (source) {
        is PlaybackSource.LocalFile -> {
            val extras = Bundle().apply {
                putString(EXTRA_SOURCE_KIND, KIND_LOCAL_FILE)
                putString(EXTRA_DISPLAY_NAME, source.displayName)
            }
            val uri = Uri.parse(source.uri)
            MediaItem.Builder()
                .setMediaId(source.uri)
                .setUri(uri)
                .setRequestMetadata(
                    MediaItem.RequestMetadata.Builder().setMediaUri(uri).setExtras(extras).build(),
                )
                .setMediaMetadata(
                    (metadata?.buildUpon() ?: MediaMetadata.Builder())
                        .setTitle(metadata?.title ?: source.displayName)
                        .setArtist(metadata?.artist ?: source.label)
                        .setExtras(extras)
                        .build(),
                )
                .build()
        }
        // Never representable as a MediaItem: see PlaybackSource.YouTube.
        is PlaybackSource.YouTube -> null
    }

    fun sourceOf(item: MediaItem): PlaybackSource? {
        val extras = item.requestMetadata.extras ?: item.mediaMetadata.extras ?: return null
        return when (extras.getString(EXTRA_SOURCE_KIND)) {
            KIND_LOCAL_FILE -> {
                val uri = item.requestMetadata.mediaUri ?: item.localConfiguration?.uri ?: return null
                SourceResolver.forLocalUri(uri.toString(), extras.getString(EXTRA_DISPLAY_NAME).orEmpty())
            }
            else -> null
        }
    }
}
