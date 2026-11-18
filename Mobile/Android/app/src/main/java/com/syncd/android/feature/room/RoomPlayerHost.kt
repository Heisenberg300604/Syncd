package com.syncd.android.feature.room

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.outlined.GraphicEq
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.options.IFramePlayerOptions
import com.pierfrancescosoffritti.androidyoutubeplayer.core.player.views.YouTubePlayerView
import com.syncd.android.core.design.SyncDColors
import com.syncd.android.di.AppContainer
import com.syncd.android.domain.model.RoomPhase
import com.syncd.android.playback.engine.EngineStatus
import com.syncd.android.playback.engine.YouTubeRoomEngine
import kotlinx.coroutines.flow.map
import kotlin.math.roundToInt

/**
 * Where the room's video is drawn. The room screen reports its player box via
 * [RoomPlayerSlotMarker]; when no room screen is showing, the video floats in a
 * corner so the music keeps playing while the user moves around the app.
 */
@Stable
class RoomPlayerSlot {
    var bounds by mutableStateOf<Rect?>(null)
        internal set
}

/** Placeholder that tells [PersistentRoomPlayer] to draw the video here. */
@Composable
fun RoomPlayerSlotMarker(slot: RoomPlayerSlot, modifier: Modifier = Modifier) {
    Box(modifier.onGloballyPositioned { slot.bounds = it.boundsInRoot() })
    DisposableEffect(slot) { onDispose { slot.bounds = null } }
}

/**
 * The single YouTube player for the active room, alive for the whole signed-in
 * session instead of only while the room screen is open.
 *
 * Compliance with YouTube's terms is unchanged: the video stays visible (in the
 * room's player box, or as a floating mini video elsewhere), and the view still
 * pauses itself when the app goes to the background (ON_STOP).
 *
 * Must be placed in a full-size [BoxScope] above the app's screens.
 */
@Composable
fun BoxScope.PersistentRoomPlayer(
    c: AppContainer,
    bottomInset: Dp,
    onOpenRoom: (String) -> Unit,
    isHomeScreen: Boolean = false,
) {
    val room by c.rooms.state.collectAsState()
    val active = room?.takeIf { it.phase !is RoomPhase.Closed && it.phase !is RoomPhase.Removed }
    val hasRoom = active != null
    val hasTrack = active?.playback?.videoId != null
    val isPlaying = active?.playback?.isPlaying == true
    val lifecycleOwner = LocalLifecycleOwner.current

    // Drag offset to freely reposition the floating mini player around the screen
    var dragOffsetX by remember { mutableFloatStateOf(0f) }
    var dragOffsetY by remember { mutableFloatStateOf(0f) }

    // Sync runs while a room is active and the app is in the foreground.
    DisposableEffect(lifecycleOwner, hasRoom) {
        fun attach() {
            // One audible source at a time: device playback yields to the room.
            c.playback.pause()
            c.roomSync.attach(c.roomEngine, c.rooms.state.map { it?.playback }, c.rooms.connection)
        }
        if (hasRoom && lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) attach()
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> if (hasRoom) attach()
                Lifecycle.Event.ON_STOP -> c.roomSync.detach()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            c.roomSync.detach()
            // Left the room (or signed out): silence the player.
            c.roomEngine.stop()
        }
    }

    // Slot bounds are in root coordinates; convert to this overlay's space.
    var origin by remember { mutableStateOf(Offset.Zero) }
    Box(Modifier.fillMaxSize().onGloballyPositioned { origin = it.positionInRoot() })

    val density = LocalDensity.current
    val slot = c.roomPlayerSlot.bounds?.takeIf { it.width > 0f && it.height > 0f }
    val mini = Modifier
        .align(Alignment.BottomEnd)
        .padding(end = 12.dp, bottom = bottomInset + 12.dp)
        .offset { IntOffset(dragOffsetX.roundToInt(), dragOffsetY.roundToInt()) }
        .size(176.dp, 99.dp)

    val placement = when {
        // Kept initialised (so the first track starts fast) but invisible when no track.
        !hasTrack -> Modifier.size(1.dp).alpha(0f)
        slot != null -> with(density) {
            Modifier
                .offset { IntOffset((slot.left - origin.x).roundToInt(), (slot.top - origin.y).roundToInt()) }
                .size(slot.width.toDp(), slot.height.toDp())
                .clip(RoundedCornerShape(18.dp))
        }
        // Floating mode: draggable mini player
        else -> mini
            .shadow(12.dp, RoundedCornerShape(14.dp), spotColor = Color.Black.copy(alpha = 0.6f))
            .clip(RoundedCornerShape(14.dp))
            .border(1.dp, SyncDColors.LineStrong, RoundedCornerShape(14.dp))
    }

    AndroidView(
        modifier = placement,
        factory = { context ->
            YouTubePlayerView(context).apply {
                enableAutomaticInitialization = false
                // Pauses on ON_STOP: background playback is never enabled.
                lifecycleOwner.lifecycle.addObserver(this)
                val options = IFramePlayerOptions.Builder(context)
                    .controls(0) // SyncD's controls drive the room; local seeking would desync
                    .rel(0)
                    .ivLoadPolicy(3)
                    .fullscreen(0)
                    .build()
                initialize(c.roomEngine.listener, /* handleNetworkEvents = */ true, options)
                post {
                    (c.roomEngine as? YouTubeRoomEngine)?.setWebView(findWebView(this))
                }
            }
        },
        onRelease = { view ->
            lifecycleOwner.lifecycle.removeObserver(view)
            view.release()
            (c.roomEngine as? YouTubeRoomEngine)?.setWebView(null)
            c.roomEngine.detachPlayer()
        },
    )

    // Hide YouTube recommended overlay when video has ended
    val engineState by c.roomEngine.state.collectAsState()
    if (hasTrack && slot != null && engineState.status == EngineStatus.Ended) {
        Box(
            modifier = with(density) {
                Modifier
                    .offset { IntOffset((slot.left - origin.x).roundToInt(), (slot.top - origin.y).roundToInt()) }
                    .size(slot.width.toDp(), slot.height.toDp())
                    .clip(RoundedCornerShape(18.dp))
                    .background(SyncDColors.Surface)
                    .border(1.dp, SyncDColors.Line, RoundedCornerShape(18.dp))
            },
            contentAlignment = Alignment.Center,
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.padding(16.dp),
            ) {
                Icon(
                    Icons.Outlined.GraphicEq,
                    contentDescription = null,
                    tint = SyncDColors.Accent,
                    modifier = Modifier.size(34.dp),
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = active?.playback?.title ?: "Track ended",
                    style = MaterialTheme.typography.titleSmall,
                    color = SyncDColors.Ink,
                    maxLines = 1,
                )
                Text(
                    text = "Up next in queue…",
                    style = MaterialTheme.typography.bodySmall,
                    color = SyncDColors.InkMuted,
                )
            }
        }
    }

    // Floating mode: drag to move anywhere on the screen, tap to open the room
    if (hasTrack && slot == null) {
        val currentActive = active ?: return
        var totalDrag by remember { mutableFloatStateOf(0f) }

        Box(
            mini
                .clip(RoundedCornerShape(14.dp))
                .pointerInput(currentActive.roomCode) {
                    detectDragGestures(
                        onDragStart = { totalDrag = 0f },
                        onDragEnd = {
                            if (totalDrag < 15f) {
                                onOpenRoom(currentActive.roomCode)
                            }
                        },
                        onDrag = { change, dragAmount ->
                            change.consume()
                            totalDrag += kotlin.math.abs(dragAmount.x) + kotlin.math.abs(dragAmount.y)
                            dragOffsetX += dragAmount.x
                            dragOffsetY += dragAmount.y
                        }
                    )
                }
                .semantics { contentDescription = "Room video. Drag to move, tap to open room" },
        )
    }
}

private fun findWebView(view: android.view.View): android.webkit.WebView? {
    if (view is android.webkit.WebView) return view
    if (view is android.view.ViewGroup) {
        for (i in 0 until view.childCount) {
            val child = findWebView(view.getChildAt(i))
            if (child != null) return child
        }
    }
    return null
}
