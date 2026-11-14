package com.syncd.android.feature.room

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.options.IFramePlayerOptions
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.views.YouTubePlayerView
import com.syncd.android.playback.engine.YouTubeRoomEngine

/**
 * Hosts YouTube's official IFrame player. Kept composed for the whole room
 * screen (even with nothing playing) so the player is initialised before the
 * first track arrives — the same fix the web client applied.
 *
 * The view observes the lifecycle itself and pauses on ON_STOP; background
 * playback is never enabled (it would violate YouTube's terms). [onVisible] /
 * [onHidden] attach and detach the sync coordinator with the same lifecycle.
 */
@Composable
fun YouTubeSurface(
    engine: YouTubeRoomEngine,
    onVisible: () -> Unit,
    onHidden: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val lifecycleOwner = LocalLifecycleOwner.current
    val visible = rememberUpdatedState(onVisible)
    val hidden = rememberUpdatedState(onHidden)

    AndroidView(
        modifier = modifier,
        factory = { context ->
            YouTubePlayerView(context).apply {
                enableAutomaticInitialization = false
                lifecycleOwner.lifecycle.addObserver(this)
                val options = IFramePlayerOptions.Builder(context)
                    .controls(0) // SyncD's controls drive the room; local seeking would desync
                    .rel(0)
                    .ivLoadPolicy(3)
                    .fullscreen(0)
                    .build()
                initialize(engine.listener, /* handleNetworkEvents = */ true, options)
            }
        },
        onRelease = { view ->
            lifecycleOwner.lifecycle.removeObserver(view)
            view.release()
            engine.detachPlayer()
        },
    )

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> visible.value()
                Lifecycle.Event.ON_STOP -> hidden.value()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            hidden.value()
        }
    }
}
