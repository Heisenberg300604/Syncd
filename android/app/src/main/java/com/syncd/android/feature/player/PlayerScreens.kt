package com.syncd.android.feature.player

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Forward10
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.material.icons.outlined.GraphicEq
import androidx.compose.material.icons.outlined.MusicNote
import androidx.compose.material.icons.outlined.Stop
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.syncd.android.core.design.MessageState
import com.syncd.android.core.design.StatusPill
import com.syncd.android.core.design.SyncDColors
import com.syncd.android.core.util.formatClock
import com.syncd.android.di.appViewModel
import com.syncd.android.domain.model.RoomPhase
import com.syncd.android.playback.session.LocalPlayerState
import androidx.lifecycle.ViewModel
import com.syncd.android.di.AppContainer
import kotlinx.coroutines.delay

class PlayerViewModel(c: AppContainer) : ViewModel() {
    val playback = c.playback
    val state = c.playback.state
    val room = c.rooms.state
}

/**
 * Persistent bar above the bottom navigation. Shows the native (Media3) session
 * when one exists — the same session as the notification — otherwise the active
 * room's now-playing, which can only be heard on the room screen (YouTube must be
 * visible to play).
 */
@Composable
fun MiniPlayer(onOpenPlayer: () -> Unit, onOpenRoom: (String) -> Unit) {
    val vm = appViewModel { PlayerViewModel(it) }
    val local by vm.state.collectAsState()
    val room by vm.room.collectAsState()

    when {
        local.hasMedia -> MiniBar(
            title = local.title ?: "Audio file",
            subtitle = if (local.isBuffering) "Buffering…" else "On this device",
            onClick = onOpenPlayer,
            leading = { Artwork(local, Modifier.size(42.dp)) },
            trailing = {
                IconButton(onClick = vm.playback::togglePlayPause) {
                    Icon(
                        if (local.playWhenReady && !local.ended) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = if (local.playWhenReady) "Pause" else "Play",
                    )
                }
            },
        )
        room != null && room?.phase !is RoomPhase.Closed && room?.phase !is RoomPhase.Removed -> {
            val r = room!!
            MiniBar(
                title = r.playback?.title ?: r.restTrackTitle ?: "Nothing playing",
                subtitle = "Room ${r.roomCode} · open the room to listen",
                onClick = { onOpenRoom(r.roomCode) },
                leading = {
                    Box(
                        Modifier.size(42.dp).clip(RoundedCornerShape(10.dp)).background(SyncDColors.AccentLo),
                        contentAlignment = Alignment.Center,
                    ) { Icon(Icons.Outlined.GraphicEq, null, tint = SyncDColors.Accent) }
                },
                trailing = { Text("Open", color = SyncDColors.Accent, style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(end = 12.dp)) },
            )
        }
    }
}

@Composable
private fun MiniBar(
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    leading: @Composable () -> Unit,
    trailing: @Composable () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(SyncDColors.Raised)
            .clickable(role = Role.Button, onClickLabel = "Open player", onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leading()
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        trailing()
    }
}

@Composable
private fun Artwork(state: LocalPlayerState, modifier: Modifier) {
    val bitmap = remember(state.artworkData) {
        state.artworkData?.let { runCatching { BitmapFactory.decodeByteArray(it, 0, it.size)?.asImageBitmap() }.getOrNull() }
    }
    Box(
        modifier.clip(RoundedCornerShape(12.dp)).background(SyncDColors.Overlay).border(1.dp, SyncDColors.Line, RoundedCornerShape(12.dp)),
        contentAlignment = Alignment.Center,
    ) {
        if (bitmap != null) {
            Image(bitmap, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        } else {
            Icon(Icons.Outlined.MusicNote, null, tint = SyncDColors.Accent, modifier = Modifier.fillMaxSize(0.4f))
        }
    }
}

/** Full-screen controls for the native (Media3) session. */
@Composable
fun FullPlayerScreen(onBack: () -> Unit) {
    val vm = appViewModel { PlayerViewModel(it) }
    val state by vm.state.collectAsState()

    var position by remember { mutableLongStateOf(0L) }
    var dragging by remember { mutableStateOf(false) }
    var dragValue by remember { mutableFloatStateOf(0f) }

    // Poll position only while this screen is visible.
    LaunchedEffect(state.hasMedia) {
        while (state.hasMedia) {
            if (!dragging) position = vm.playback.positionMs()
            delay(500)
        }
    }

    Column(Modifier.fillMaxSize().statusBarsPadding().padding(20.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
            Text("Now playing", style = MaterialTheme.typography.titleMedium)
        }

        if (!state.hasMedia) {
            MessageState(
                title = "Nothing playing",
                message = "Choose an audio file on the Home screen to start device playback.",
                icon = Icons.Outlined.MusicNote,
                iconTint = SyncDColors.Accent,
            )
            return@Column
        }

        Spacer(Modifier.height(16.dp))
        Artwork(state, Modifier.fillMaxWidth().aspectRatio(1f))
        Spacer(Modifier.height(24.dp))
        Text(state.title ?: "Audio file", style = MaterialTheme.typography.headlineSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Text(state.subtitle ?: "", style = MaterialTheme.typography.bodyMedium, color = SyncDColors.InkMuted, maxLines = 1)
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatusPill("Not shared with any room", SyncDColors.Cool, showDot = false)
            if (state.source?.capabilities?.backgroundPlayback == true) StatusPill("Plays in background", SyncDColors.Online)
        }

        state.error?.let {
            Spacer(Modifier.height(12.dp))
            Text(it, color = SyncDColors.Danger, style = MaterialTheme.typography.bodyMedium)
        }

        Spacer(Modifier.height(20.dp))
        val duration = state.durationMs
        Slider(
            value = if (dragging) dragValue else position.toFloat(),
            onValueChange = {
                dragging = true
                dragValue = it
            },
            onValueChangeFinished = {
                vm.playback.seekTo(dragValue.toLong())
                position = dragValue.toLong()
                dragging = false
            },
            valueRange = 0f..((duration ?: 1L).toFloat().coerceAtLeast(1f)),
            enabled = state.canSeek && duration != null,
            colors = SliderDefaults.colors(thumbColor = SyncDColors.Accent, activeTrackColor = SyncDColors.Accent),
            modifier = Modifier.semantics { contentDescription = "Seek" },
        )
        Row {
            Text(formatClock(position / 1000.0), style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.weight(1f))
            Text(formatClock(duration?.div(1000.0)), style = MaterialTheme.typography.bodySmall)
        }

        Spacer(Modifier.height(16.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { vm.playback.seekBy(-10_000) }, enabled = state.canSeek, modifier = Modifier.size(56.dp)) {
                Icon(Icons.Filled.Replay10, contentDescription = "Back 10 seconds", modifier = Modifier.size(32.dp))
            }
            FilledIconButton(
                onClick = vm.playback::togglePlayPause,
                modifier = Modifier.size(76.dp).semantics {
                    stateDescription = if (state.isPlaying) "Playing" else if (state.isBuffering) "Buffering" else "Paused"
                },
                shape = CircleShape,
                colors = IconButtonDefaults.filledIconButtonColors(containerColor = SyncDColors.Accent, contentColor = SyncDColors.AccentInk),
            ) {
                if (state.isBuffering) {
                    CircularProgressIndicator(Modifier.size(28.dp), color = SyncDColors.AccentInk, strokeWidth = 3.dp)
                } else {
                    Icon(
                        if (state.playWhenReady && !state.ended) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = if (state.playWhenReady) "Pause" else "Play",
                        modifier = Modifier.size(38.dp),
                    )
                }
            }
            IconButton(onClick = { vm.playback.seekBy(10_000) }, enabled = state.canSeek, modifier = Modifier.size(56.dp)) {
                Icon(Icons.Filled.Forward10, contentDescription = "Forward 10 seconds", modifier = Modifier.size(32.dp))
            }
        }
        Spacer(Modifier.height(16.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            IconButton(onClick = {
                vm.playback.stop()
                onBack()
            }) { Icon(Icons.Outlined.Stop, contentDescription = "Stop and close") }
        }
        Spacer(Modifier.weight(1f))
        Text(
            "Keeps playing with the screen off. Use the notification, lock screen or your headset to control it.",
            style = MaterialTheme.typography.bodySmall,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
