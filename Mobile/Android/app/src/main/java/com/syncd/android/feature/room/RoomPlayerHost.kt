package com.syncd.android.feature.room

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
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
) {
    val room by c.rooms.state.collectAsState()
    val active = room?.takeIf { it.phase !is RoomPhase.Closed && it.phase !is RoomPhase.Removed }
    val hasRoom = active != null
    val hasTrack = active?.playback?.videoId != null
    val lifecycleOwner = LocalLifecycleOwner.current

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
        .size(176.dp, 99.dp)

    val placement = when {
        // Kept initialised (so the first track starts fast) but invisible.
        !hasTrack -> Modifier.size(1.dp).alpha(0f)
        slot != null -> with(density) {
            Modifier
                .offset { IntOffset((slot.left - origin.x).roundToInt(), (slot.top - origin.y).roundToInt()) }
                .size(slot.width.toDp(), slot.height.toDp())
                .clip(RoundedCornerShape(18.dp))
        }
        else -> mini
            .clip(RoundedCornerShape(14.dp))
            .border(1.dp, SyncDColors.Line, RoundedCornerShape(14.dp))
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
            }
        },
        onRelease = { view ->
            lifecycleOwner.lifecycle.removeObserver(view)
            view.release()
            c.roomEngine.detachPlayer()
        },
    )

    // Floating mode: tap the video to go back to the room.
    if (hasTrack && slot == null && active != null) {
        Box(
            mini
                .clip(RoundedCornerShape(14.dp))
                .clickable { onOpenRoom(active.roomCode) }
                .semantics { contentDescription = "Room video. Open the room" },
        )
    }
}
