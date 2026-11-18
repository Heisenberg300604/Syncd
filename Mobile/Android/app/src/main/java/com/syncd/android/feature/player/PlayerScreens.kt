package com.syncd.android.feature.player

import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Forward10
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.material.icons.outlined.AudioFile
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.GraphicEq
import androidx.compose.material.icons.outlined.MusicNote
import androidx.compose.material.icons.outlined.Refresh
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.syncd.android.core.design.PrimaryButton
import com.syncd.android.core.design.SecondaryButton
import com.syncd.android.core.design.SectionHeader
import com.syncd.android.core.design.StatusPill
import com.syncd.android.core.design.SyncDCard
import com.syncd.android.core.design.SyncDColors
import com.syncd.android.core.util.formatClock
import com.syncd.android.data.local.LocalAudioScanner
import com.syncd.android.data.local.LocalTrack
import com.syncd.android.di.AppContainer
import com.syncd.android.di.appViewModel
import com.syncd.android.domain.model.RoomPhase
import com.syncd.android.playback.session.LocalPlayerState
import com.syncd.android.playback.source.SourceResolver
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class PlayerViewModel(c: AppContainer) : ViewModel() {
    val playback = c.playback
    val state = c.playback.state
    val room = c.rooms.state
    val autoScanEnabled = c.userPrefs.autoScanEnabled

    private val _tracks = MutableStateFlow<List<LocalTrack>>(emptyList())
    val tracks = _tracks.asStateFlow()

    private val _isScanning = MutableStateFlow(false)
    val isScanning = _isScanning.asStateFlow()

    fun scan(context: Context) {
        viewModelScope.launch {
            _isScanning.value = true
            val found = LocalAudioScanner.scanTracks(context)
            _tracks.value = found
            _isScanning.value = false
        }
    }

    fun playTrack(track: LocalTrack): Boolean {
        val source = SourceResolver.forLocalUri(track.contentUri, track.title) ?: return false
        val result = playback.play(source)
        return result.isSuccess
    }

    fun playLocalFile(context: Context, uri: Uri): Boolean {
        runCatching {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val name = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { if (it.moveToFirst()) it.getString(0) else null }
            ?.substringBeforeLast('.')
            .orEmpty()
        val source = SourceResolver.forLocalUri(uri.toString(), name) ?: return false
        val result = playback.play(source)
        return result.isSuccess
    }
}

/**
 * Persistent bar above the bottom navigation. Shows the native (Media3) session
 * when one exists. Active room banner is only displayed when [showRoomBanner] is true (Home).
 */
@Composable
fun MiniPlayer(
    onOpenPlayer: () -> Unit,
    modifier: Modifier = Modifier,
    onOpenRoom: ((String) -> Unit)? = null,
    showRoomBanner: Boolean = false,
) {
    val vm = appViewModel { PlayerViewModel(it) }
    val local by vm.state.collectAsState()

    if (local.hasMedia) {
        MiniBar(
            title = local.title ?: "Audio file",
            subtitle = if (local.isBuffering) "Buffering…" else "On this device",
            onClick = onOpenPlayer,
            modifier = modifier,
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
    }
}

@Composable
private fun MiniBar(
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    leading: @Composable () -> Unit,
    trailing: @Composable () -> Unit,
) {
    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SyncDColors.Raised)
            .border(1.dp, SyncDColors.LineStrong, RoundedCornerShape(16.dp))
            .clickable(role = Role.Button, onClickLabel = "Open player", onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 10.dp),
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

/**
 * Full Player screen displaying the local audio library with direct tap-to-play,
 * plus one-handed bottom thumb-zone playback controls.
 */
@Composable
fun FullPlayerScreen(
    onBack: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val vm = appViewModel { PlayerViewModel(it) }
    val state by vm.state.collectAsState()
    val tracks by vm.tracks.collectAsState()
    val isScanning by vm.isScanning.collectAsState()
    val autoScan by vm.autoScanEnabled.collectAsState(initial = true)
    val context = LocalContext.current

    LaunchedEffect(autoScan) {
        if (autoScan) {
            vm.scan(context)
        }
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            vm.playLocalFile(context, uri)
        }
    }

    var position by remember { mutableLongStateOf(0L) }

    LaunchedEffect(state.hasMedia) {
        while (state.hasMedia) {
            position = vm.playback.positionMs()
            delay(500)
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .statusBarsPadding(),
    ) {
        // Top Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                }
                Spacer(Modifier.width(8.dp))
            }
            Text(
                "Player",
                style = MaterialTheme.typography.displaySmall.copy(
                    fontWeight = FontWeight.Bold,
                    fontSize = 32.sp,
                ),
                color = SyncDColors.Ink,
                modifier = Modifier
                    .weight(1f)
                    .semantics { heading() },
            )
            IconButton(onClick = { vm.scan(context) }) {
                if (isScanning) {
                    CircularProgressIndicator(Modifier.size(20.dp), color = SyncDColors.Accent, strokeWidth = 2.dp)
                } else {
                    Icon(
                        Icons.Outlined.Refresh,
                        contentDescription = "Rescan library",
                        tint = SyncDColors.InkMuted,
                        modifier = Modifier.size(22.dp),
                    )
                }
            }
            IconButton(onClick = { picker.launch(arrayOf("audio/*")) }) {
                Icon(
                    Icons.Outlined.FolderOpen,
                    contentDescription = "Pick file",
                    tint = SyncDColors.Accent,
                    modifier = Modifier.size(24.dp),
                )
            }
        }

        // Main content: Scrollable local track list
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
        ) {
            if (tracks.isEmpty() && !isScanning) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 24.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                        modifier = Modifier.widthIn(max = 340.dp),
                    ) {
                        Box(
                            Modifier
                                .size(72.dp)
                                .clip(RoundedCornerShape(22.dp))
                                .background(SyncDColors.AccentLo)
                                .border(1.dp, SyncDColors.Accent.copy(alpha = 0.3f), RoundedCornerShape(22.dp)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Outlined.AudioFile, contentDescription = null, tint = SyncDColors.Accent, modifier = Modifier.size(34.dp))
                        }
                        Spacer(Modifier.height(18.dp))
                        Text(
                            "No local tracks found",
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                            color = SyncDColors.Ink,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "SyncD can scan audio on your phone or you can select an audio file directly.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = SyncDColors.InkMuted,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(20.dp))
                        PrimaryButton(
                            text = "Scan device audio",
                            onClick = { vm.scan(context) },
                            icon = Icons.Outlined.Refresh,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(10.dp))
                        SecondaryButton(
                            text = "Choose audio file",
                            onClick = { picker.launch(arrayOf("audio/*")) },
                            icon = Icons.Outlined.FolderOpen,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 20.dp, vertical = 6.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item {
                        SectionHeader(
                            text = "Local Tracks",
                            trailing = {
                                Text(
                                    "${tracks.size} tracks",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = SyncDColors.InkFaint,
                                )
                            },
                        )
                        Spacer(Modifier.height(4.dp))
                    }

                    items(tracks, key = { it.id }) { track ->
                        val isPlayingThis = state.title == track.title
                        TrackRow(
                            track = track,
                            isPlaying = isPlayingThis,
                            onClick = { vm.playTrack(track) },
                        )
                    }
                }
            }
        }

        // Bottom Slim Playback Pill (Spotify-style)
        if (state.hasMedia) {
            val duration = state.durationMs ?: 0L
            val progress = if (duration > 0) (position.toFloat() / duration.toFloat()).coerceIn(0f, 1f) else 0f

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 6.dp)
                    .shadow(
                        elevation = 12.dp,
                        shape = RoundedCornerShape(16.dp),
                        spotColor = Color.Black.copy(alpha = 0.5f),
                        ambientColor = Color.Black.copy(alpha = 0.3f),
                    )
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0xF21C1815))
                    .border(1.dp, Color(0x38FFFFFF), RoundedCornerShape(16.dp)),
            ) {
                Column(Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Artwork(state, Modifier.size(42.dp))
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                state.title ?: "Audio file",
                                style = MaterialTheme.typography.titleSmall.copy(
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 13.5.sp,
                                ),
                                color = SyncDColors.Ink,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Spacer(Modifier.height(2.dp))
                            Text(
                                "${formatClock(position / 1000.0)} / ${formatClock(if (duration > 0) duration / 1000.0 else null)} · On this device",
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.5.sp),
                                color = SyncDColors.InkMuted,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }

                        IconButton(
                            onClick = { vm.playback.seekBy(-10_000) },
                            enabled = state.canSeek,
                            modifier = Modifier.size(34.dp),
                        ) {
                            Icon(
                                Icons.Filled.Replay10,
                                contentDescription = "Back 10s",
                                tint = SyncDColors.InkMuted,
                                modifier = Modifier.size(20.dp),
                            )
                        }

                        FilledIconButton(
                            onClick = vm.playback::togglePlayPause,
                            modifier = Modifier.size(38.dp),
                            shape = CircleShape,
                            colors = IconButtonDefaults.filledIconButtonColors(
                                containerColor = SyncDColors.Accent,
                                contentColor = SyncDColors.AccentInk,
                            ),
                        ) {
                            if (state.isBuffering) {
                                CircularProgressIndicator(Modifier.size(18.dp), color = SyncDColors.AccentInk, strokeWidth = 2.dp)
                            } else {
                                Icon(
                                    if (state.playWhenReady && !state.ended) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                                    contentDescription = if (state.playWhenReady) "Pause" else "Play",
                                    modifier = Modifier.size(22.dp),
                                )
                            }
                        }

                        IconButton(
                            onClick = { vm.playback.seekBy(10_000) },
                            enabled = state.canSeek,
                            modifier = Modifier.size(34.dp),
                        ) {
                            Icon(
                                Icons.Filled.Forward10,
                                contentDescription = "Forward 10s",
                                tint = SyncDColors.InkMuted,
                                modifier = Modifier.size(20.dp),
                            )
                        }

                        IconButton(
                            onClick = { vm.playback.stop() },
                            modifier = Modifier.size(30.dp),
                        ) {
                            Icon(
                                Icons.Outlined.Close,
                                contentDescription = "Stop playback",
                                tint = SyncDColors.InkFaint,
                                modifier = Modifier.size(17.dp),
                            )
                        }
                    }

                    // Spotify signature: ultra-slim interactive seek progress bar
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(3.dp)
                            .background(Color(0x26FFFFFF))
                            .pointerInput(duration) {
                                detectTapGestures { offset ->
                                    if (duration > 0) {
                                        val fraction = (offset.x / size.width).coerceIn(0f, 1f)
                                        val target = (fraction * duration).toLong()
                                        vm.playback.seekTo(target)
                                        position = target
                                    }
                                }
                            },
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(fraction = progress)
                                .fillMaxHeight()
                                .background(SyncDColors.Accent),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TrackRow(
    track: LocalTrack,
    isPlaying: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(if (isPlaying) SyncDColors.AccentLo else SyncDColors.Raised)
            .border(
                1.dp,
                if (isPlaying) SyncDColors.Accent.copy(alpha = 0.5f) else SyncDColors.Line,
                RoundedCornerShape(14.dp),
            )
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(if (isPlaying) SyncDColors.Accent else SyncDColors.Overlay),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                if (isPlaying) Icons.Outlined.GraphicEq else Icons.Outlined.MusicNote,
                contentDescription = null,
                tint = if (isPlaying) SyncDColors.AccentInk else SyncDColors.Accent,
                modifier = Modifier.size(20.dp),
            )
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                track.title,
                style = MaterialTheme.typography.titleSmall.copy(
                    fontWeight = if (isPlaying) FontWeight.Bold else FontWeight.SemiBold,
                ),
                color = if (isPlaying) SyncDColors.Accent else SyncDColors.Ink,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                "${track.artist} · ${formatClock(track.durationMs / 1000.0)}",
                style = MaterialTheme.typography.bodySmall,
                color = SyncDColors.InkMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
