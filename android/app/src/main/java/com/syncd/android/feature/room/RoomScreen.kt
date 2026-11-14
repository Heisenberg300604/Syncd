package com.syncd.android.feature.room

import android.content.ClipData
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ExitToApp
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.DoNotDisturbOn
import androidx.compose.material.icons.outlined.GraphicEq
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.PersonOff
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.Stop
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.syncd.android.core.design.ConnectionPill
import com.syncd.android.core.design.LoadingState
import com.syncd.android.core.design.MessageState
import com.syncd.android.core.design.StatusPill
import com.syncd.android.core.design.SyncDColors
import com.syncd.android.core.socket.ConnectionState
import com.syncd.android.core.util.formatClock
import com.syncd.android.di.appViewModel
import com.syncd.android.domain.model.RoomPhase
import com.syncd.android.domain.model.RoomState
import com.syncd.android.feature.chat.ChatPanel
import com.syncd.android.feature.queue.QueuePanel
import com.syncd.android.feature.search.SearchSheet
import com.syncd.android.playback.coordinator.SyncStatus
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun RoomScreen(code: String, onBack: () -> Unit) {
    val vm = appViewModel(key = "room-$code") { RoomViewModel(code, it) }
    val open by vm.open.collectAsState()
    val room by vm.room.collectAsState()

    LaunchedEffect(vm) { vm.navigateBack.collect { onBack() } }

    when {
        room?.phase is RoomPhase.Closed -> MessageState(
            title = "Room closed",
            message = (room!!.phase as RoomPhase.Closed).message,
            icon = Icons.Outlined.DoNotDisturbOn,
            primaryAction = "Back to home" to vm::dismissAndExit,
        )
        room?.phase is RoomPhase.Removed -> MessageState(
            title = "You left this room",
            message = (room!!.phase as RoomPhase.Removed).message,
            icon = Icons.Outlined.PersonOff,
            iconTint = SyncDColors.Warning,
            primaryAction = "Join again" to vm::rejoin,
            secondaryAction = "Back to home" to vm::dismissAndExit,
        )
        room != null -> RoomContent(vm, room!!, onBack)
        open is RoomOpenState.Failed -> MessageState(
            title = "Couldn't open room $code",
            message = (open as RoomOpenState.Failed).message,
            primaryAction = "Try again" to vm::load,
            secondaryAction = "Back" to onBack,
        )
        else -> LoadingState("Opening room $code…")
    }
}

private enum class RoomTab(val label: String) { Queue("Queue"), People("People"), Chat("Chat") }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RoomContent(vm: RoomViewModel, room: RoomState, onBack: () -> Unit) {
    val connection by vm.connection.collectAsState()
    val sync by vm.sync.collectAsState()
    val leaving by vm.leaving.collectAsState()
    val dismissedNotice by vm.dismissedNotice.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    val clipboard = LocalClipboard.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val isHost = room.isHost(vm.selfId)

    var tab by rememberSaveable { mutableStateOf(RoomTab.Queue) }
    var menuOpen by remember { mutableStateOf(false) }
    var confirmLeave by remember { mutableStateOf(false) }
    var searchOpen by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(vm) { vm.notices.collect { snackbar.showSnackbar(it) } }

    Scaffold(
        containerColor = SyncDColors.Canvas,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SyncDColors.Canvas),
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back (stay in room)") }
                },
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            room.roomCode,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 3.sp,
                            style = MaterialTheme.typography.titleLarge,
                            modifier = Modifier.semantics { contentDescription = "Room code ${room.roomCode.toList().joinToString(" ")}" },
                        )
                        IconButton(onClick = {
                            scope.launch {
                                clipboard.setClipEntry(ClipEntry(ClipData.newPlainText("SyncD room code", room.roomCode)))
                                snackbar.showSnackbar("Room code copied")
                            }
                        }) { Icon(Icons.Outlined.ContentCopy, contentDescription = "Copy room code", modifier = Modifier.size(20.dp)) }
                    }
                },
                actions = {
                    ConnectionPill(connection)
                    Box {
                        IconButton(onClick = { menuOpen = true }) { Icon(Icons.Outlined.MoreVert, contentDescription = "Room options") }
                        DropdownMenu(menuOpen, onDismissRequest = { menuOpen = false }) {
                            DropdownMenuItem(
                                text = { Text("Share code") },
                                leadingIcon = { Icon(Icons.Outlined.Share, null) },
                                onClick = {
                                    menuOpen = false
                                    val send = Intent(Intent.ACTION_SEND)
                                        .setType("text/plain")
                                        .putExtra(Intent.EXTRA_TEXT, "Join my SyncD room: ${room.roomCode}")
                                    context.startActivity(Intent.createChooser(send, "Share room code"))
                                },
                            )
                            DropdownMenuItem(
                                text = { Text("Leave room", color = SyncDColors.Danger) },
                                leadingIcon = { Icon(Icons.AutoMirrored.Outlined.ExitToApp, null, tint = SyncDColors.Danger) },
                                onClick = {
                                    menuOpen = false
                                    confirmLeave = true
                                },
                            )
                        }
                    }
                },
            )
        },
        floatingActionButton = {
            if (isHost && tab != RoomTab.Chat) {
                ExtendedFloatingActionButton(
                    onClick = { searchOpen = true },
                    icon = { Icon(Icons.Outlined.Search, null) },
                    text = { Text("Add music") },
                    containerColor = SyncDColors.Accent,
                    contentColor = SyncDColors.AccentInk,
                )
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).imePadding()) {
            ConnectionBanner(connection, room)
            HostBanners(vm, room, dismissedNotice)

            PlayerCard(vm, room, sync, isHost)

            PrimaryTabRow(selectedTabIndex = tab.ordinal, containerColor = SyncDColors.Canvas, contentColor = SyncDColors.Ink) {
                RoomTab.entries.forEach { t ->
                    val label = when (t) {
                        RoomTab.Queue -> "Queue · ${room.queue.size}"
                        RoomTab.People -> "People · ${room.members.count { it.online == true }}/${room.members.size}"
                        RoomTab.Chat -> "Chat"
                    }
                    Tab(selected = tab == t, onClick = { tab = t }, text = { Text(label, maxLines = 1) })
                }
            }
            Box(Modifier.weight(1f).fillMaxWidth()) {
                when (tab) {
                    RoomTab.Queue -> QueuePanel(
                        queue = room.queue,
                        isHost = isHost,
                        onRemove = vm::removeFromQueue,
                        onMove = vm::moveInQueue,
                        onClear = vm::clearQueue,
                        onAdd = { searchOpen = true },
                    )
                    RoomTab.People -> ParticipantsPanel(
                        members = room.members,
                        selfId = vm.selfId,
                        isHost = isHost,
                        onMakeHost = vm::transferHost,
                    )
                    RoomTab.Chat -> ChatPanel(
                        messages = room.messages,
                        selfId = vm.selfId,
                        connected = connection is ConnectionState.Connected && room.phase is RoomPhase.Live,
                        onSend = vm::sendChat,
                        onRetry = vm::retryChat,
                        onDiscard = vm::discardChat,
                        modifier = Modifier.navigationBarsPadding(),
                    )
                }
            }
        }
    }

    if (searchOpen && isHost) {
        SearchSheet(
            somethingPlaying = room.playback?.videoId != null,
            onDismiss = { searchOpen = false },
        )
    }

    if (confirmLeave) {
        AlertDialog(
            onDismissRequest = { confirmLeave = false },
            title = { Text("Leave room ${room.roomCode}?") },
            text = {
                Text(
                    if (isHost) "You're the host. Hosting passes to the longest-standing member; if you're the last one here the room closes."
                    else "You can join again later with the code.",
                )
            },
            confirmButton = {
                TextButton(enabled = !leaving, onClick = {
                    confirmLeave = false
                    vm.leave()
                }) { Text("Leave", color = SyncDColors.Danger) }
            },
            dismissButton = { TextButton(onClick = { confirmLeave = false }) { Text("Cancel") } },
            containerColor = SyncDColors.Raised,
        )
    }
}

@Composable
private fun ConnectionBanner(connection: ConnectionState, room: RoomState) {
    val text = when {
        connection is ConnectionState.Offline -> "You're offline. Showing the last known room state."
        connection is ConnectionState.Reconnecting ->
            "Reconnecting… room state may be out of date." + (connection.lastError?.let { " ($it)" } ?: "")
        room.phase is RoomPhase.Joining && connection is ConnectionState.Connected -> "Syncing with the room…"
        else -> null
    } ?: return
    Text(
        text,
        style = MaterialTheme.typography.bodySmall,
        color = SyncDColors.Warning,
        modifier = Modifier.fillMaxWidth().background(SyncDColors.Warning.copy(alpha = 0.08f)).padding(horizontal = 16.dp, vertical = 8.dp),
    )
}

@Composable
private fun HostBanners(vm: RoomViewModel, room: RoomState, dismissed: com.syncd.android.core.model.HostUpdatePayload?) {
    room.hostPending?.let { pending ->
        var remaining by remember(pending) { mutableStateOf(vm.secondsUntil(pending.deadline)) }
        LaunchedEffect(pending) {
            while (true) {
                remaining = vm.secondsUntil(pending.deadline)
                delay(1_000)
            }
        }
        Text(
            buildString {
                append("${pending.hostUsername} (host) disconnected.")
                pending.successorUsername?.let { append(" Hosting passes to $it") }
                remaining?.let { append(" in ${it}s") }
                append(" unless they return.")
            },
            style = MaterialTheme.typography.bodySmall,
            color = SyncDColors.Warning,
            modifier = Modifier.fillMaxWidth().background(SyncDColors.Warning.copy(alpha = 0.08f)).padding(horizontal = 16.dp, vertical = 8.dp),
        )
    }
    room.hostNotice?.takeIf { it != dismissed }?.let { notice ->
        val you = notice.hostUserId == vm.selfId
        val why = when (notice.reason) {
            "disconnect" -> "${notice.previousHostUsername} lost connection"
            "left" -> "${notice.previousHostUsername} left"
            else -> "${notice.previousHostUsername} handed over"
        }
        Row(
            Modifier.fillMaxWidth().background(SyncDColors.AccentLo).padding(start = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                if (you) "You're the host now — $why." else "${notice.hostUsername} is the host now — $why.",
                style = MaterialTheme.typography.bodySmall,
                color = SyncDColors.Accent,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = { vm.dismissHostNotice(notice) }) { Text("OK") }
        }
    }
}

@Composable
private fun PlayerCard(vm: RoomViewModel, room: RoomState, sync: SyncStatus, isHost: Boolean) {
    val playback = room.playback
    val hasTrack = playback?.videoId != null

    Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Box(
            Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(18.dp))
                .background(SyncDColors.Surface).border(1.dp, SyncDColors.Line, RoundedCornerShape(18.dp)),
        ) {
            YouTubeSurface(vm.engine, vm::onPlayerVisible, vm::onPlayerHidden, Modifier.fillMaxSize())
            if (!hasTrack) {
                Column(
                    Modifier.fillMaxSize().background(SyncDColors.Surface).padding(16.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(Icons.Outlined.GraphicEq, null, tint = SyncDColors.InkFaint, modifier = Modifier.size(36.dp))
                    Spacer(Modifier.height(8.dp))
                    Text(
                        if (room.phase is RoomPhase.Joining) "Connecting to the room…"
                        else if (isHost) "Nothing playing. Tap “Add music” to start."
                        else "Nothing playing yet. The host picks the music.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = SyncDColors.InkMuted,
                    )
                }
            }
        }

        Spacer(Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(
                    playback?.title?.takeIf { hasTrack } ?: room.restTrackTitle?.takeIf { room.phase is RoomPhase.Joining } ?: "—",
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    if (hasTrack) "YouTube · plays while SyncD is open" else " ",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            if (hasTrack) SyncPill(sync, onResync = vm::resync)
        }

        if (hasTrack) {
            var position by remember { mutableDoubleStateOf(vm.roomPositionSec()) }
            var dragging by remember { mutableStateOf(false) }
            var dragValue by remember { mutableFloatStateOf(0f) }
            LaunchedEffect(playback) {
                while (true) {
                    if (!dragging) position = vm.roomPositionSec()
                    delay(500)
                }
            }
            val duration = playback.duration
            Slider(
                value = if (dragging) dragValue else position.toFloat(),
                onValueChange = {
                    dragging = true
                    dragValue = it
                },
                onValueChangeFinished = {
                    vm.seekTo(dragValue.toDouble())
                    dragging = false
                },
                valueRange = 0f..((duration ?: 1.0).toFloat().coerceAtLeast(1f)),
                enabled = isHost && duration != null,
                colors = SliderDefaults.colors(
                    thumbColor = SyncDColors.Accent,
                    activeTrackColor = SyncDColors.Accent,
                    disabledThumbColor = SyncDColors.InkMuted,
                    disabledActiveTrackColor = SyncDColors.InkMuted,
                ),
                modifier = Modifier.semantics { contentDescription = if (isHost) "Seek the room" else "Room progress" },
            )
            Row {
                Text(formatClock(position), style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.weight(1f))
                Text(formatClock(duration), style = MaterialTheme.typography.bodySmall)
            }
        }

        if (isHost && hasTrack) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = vm::stopPlayback, modifier = Modifier.size(52.dp)) {
                    Icon(Icons.Outlined.Stop, contentDescription = "Stop playback and clear the queue")
                }
                Spacer(Modifier.width(16.dp))
                FilledIconButton(
                    onClick = vm::togglePlay,
                    modifier = Modifier.size(60.dp).semantics { stateDescription = if (playback.isPlaying) "Playing" else "Paused" },
                    colors = IconButtonDefaults.filledIconButtonColors(containerColor = SyncDColors.Accent, contentColor = SyncDColors.AccentInk),
                ) {
                    Icon(
                        if (playback.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = if (playback.isPlaying) "Pause for everyone" else "Play for everyone",
                        modifier = Modifier.size(32.dp),
                    )
                }
                Spacer(Modifier.width(16.dp))
                IconButton(onClick = vm::skip, modifier = Modifier.size(52.dp)) {
                    Icon(Icons.Filled.SkipNext, contentDescription = "Skip to next in queue")
                }
            }
        } else if (hasTrack) {
            Text(
                "Only the host controls playback.",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

@Composable
private fun SyncPill(sync: SyncStatus, onResync: () -> Unit) {
    when (sync) {
        is SyncStatus.Synced -> StatusPill("In sync", SyncDColors.Online)
        SyncStatus.Correcting -> StatusPill("Syncing", SyncDColors.Cool)
        SyncStatus.Loading -> StatusPill("Loading", SyncDColors.Cool)
        SyncStatus.Buffering -> StatusPill("Buffering", SyncDColors.Warning)
        SyncStatus.WaitingForNext -> StatusPill("Up next soon", SyncDColors.InkMuted)
        SyncStatus.Offline -> StatusPill("Not synced", SyncDColors.Warning)
        SyncStatus.NoTrack -> Unit
        SyncStatus.PausedLocally -> TextButton(onClick = onResync) { Text("Paused here · Resync", color = SyncDColors.Accent) }
        is SyncStatus.Unavailable -> Column(horizontalAlignment = Alignment.End) {
            StatusPill("Unavailable", SyncDColors.Danger)
            Text(sync.message, style = MaterialTheme.typography.bodySmall, color = SyncDColors.Danger, maxLines = 2)
        }
    }
}
