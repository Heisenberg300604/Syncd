package com.syncd.android.feature.home

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AudioFile
import androidx.compose.material.icons.outlined.History
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
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
import com.syncd.android.core.network.ApiError
import com.syncd.android.core.network.ApiResult
import com.syncd.android.core.util.RoomCodes
import com.syncd.android.data.local.RecentRoom
import com.syncd.android.data.repository.RoomSessionRepository
import com.syncd.android.di.AppContainer
import com.syncd.android.di.appViewModel
import com.syncd.android.domain.model.RoomState
import com.syncd.android.playback.source.SourceResolver
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

data class HomeUiState(
    val joinCode: String = "",
    val joinError: String? = null,
    val creating: Boolean = false,
    val joining: Boolean = false,
    val openingCode: String? = null,
)

class HomeViewModel(private val c: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow(HomeUiState())
    val state = _state.asStateFlow()

    val recent: StateFlow<List<RecentRoom>> =
        c.recentRooms.rooms.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val activeRoom: StateFlow<RoomState?> = c.rooms.state
    val username: String? get() = c.users.currentUser?.username

    private val _navigate = Channel<String>(Channel.BUFFERED)
    val navigate = _navigate.receiveAsFlow()
    private val _messages = Channel<String>(Channel.BUFFERED)
    val messages = _messages.receiveAsFlow()

    fun onCodeChange(raw: String) {
        val filtered = raw.uppercase().filter { it.isLetterOrDigit() }.take(RoomCodes.LENGTH)
        _state.update { it.copy(joinCode = filtered, joinError = null) }
    }

    fun create() {
        if (_state.value.creating) return
        _state.update { it.copy(creating = true) }
        viewModelScope.launch {
            when (val r = c.rooms.create()) {
                is ApiResult.Success -> _navigate.send(r.value)
                is ApiResult.Failure -> _messages.send(r.error.message)
            }
            _state.update { it.copy(creating = false) }
        }
    }

    fun join() {
        val code = RoomCodes.normalize(_state.value.joinCode)
        RoomCodes.validate(code)?.let { err ->
            _state.update { it.copy(joinError = err) }
            return
        }
        _state.update { it.copy(joining = true, joinError = null) }
        viewModelScope.launch {
            when (val r = c.rooms.join(code)) {
                is ApiResult.Success -> {
                    _state.update { it.copy(joinCode = "") }
                    _navigate.send(r.value)
                }
                is ApiResult.Failure -> _state.update {
                    it.copy(
                        joinError = when (val e = r.error) {
                            is ApiError.Http -> if (e.status == 404) "No room with that code." else e.message
                            else -> e.message
                        },
                    )
                }
            }
            _state.update { it.copy(joining = false) }
        }
    }

    fun open(code: String) {
        _state.update { it.copy(openingCode = code) }
        viewModelScope.launch {
            when (val r = c.rooms.open(code)) {
                is ApiResult.Success -> _navigate.send(code)
                is ApiResult.Failure -> {
                    _messages.send(RoomSessionRepository.describeOpenFailure(r.error))
                    if (r.error is ApiError.Http && r.error.status == 404) c.recentRooms.remove(code)
                }
            }
            _state.update { it.copy(openingCode = null) }
        }
    }

    /** Local, device-only playback through the Media3 service. Never shared with a room. */
    fun playLocalFile(context: Context, uri: Uri): Boolean {
        runCatching {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val name = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { if (it.moveToFirst()) it.getString(0) else null }
            ?.substringBeforeLast('.')
            .orEmpty()
        val source = SourceResolver.forLocalUri(uri.toString(), name)
        if (source == null) {
            _messages.trySend("That file can't be played.")
            return false
        }
        val result = c.playback.play(source)
        result.exceptionOrNull()?.let { _messages.trySend(it.message ?: "Couldn't start playback.") }
        return result.isSuccess
    }
}

@Composable
fun HomeScreen(onOpenRoom: (String) -> Unit, onOpenPlayer: () -> Unit) {
    val vm = appViewModel { HomeViewModel(it) }
    val state by vm.state.collectAsState()
    val recent by vm.recent.collectAsState()
    val active by vm.activeRoom.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    val context = LocalContext.current

    LaunchedEffect(vm) { vm.navigate.collect(onOpenRoom) }
    LaunchedEffect(vm) { vm.messages.collect { snackbar.showSnackbar(it) } }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null && vm.playLocalFile(context, uri)) onOpenPlayer()
    }

    androidx.compose.foundation.layout.Box(Modifier.fillMaxSize()) {
        LazyColumn(
            Modifier.fillMaxSize().statusBarsPadding(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Column {
                    Text(
                        "Hey${vm.username?.let { ", $it" } ?: ""}",
                        style = MaterialTheme.typography.headlineMedium,
                        modifier = Modifier.semantics { heading() },
                    )
                    Spacer(Modifier.height(4.dp))
                    Text("Listen together, in sync.", style = MaterialTheme.typography.bodyMedium, color = SyncDColors.InkMuted)
                }
            }

            active?.let { room ->
                item {
                    SyncDCard(Modifier.fillMaxWidth().clickable(role = Role.Button) { onOpenRoom(room.roomCode) }) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                StatusPill("In a room", SyncDColors.Online)
                                Spacer(Modifier.height(8.dp))
                                Text("Room ${room.roomCode}", style = MaterialTheme.typography.titleMedium)
                                val title = room.playback?.title ?: room.restTrackTitle
                                Text(
                                    title ?: "Nothing playing",
                                    style = MaterialTheme.typography.bodySmall,
                                    maxLines = 1,
                                )
                            }
                            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = "Return to room ${room.roomCode}")
                        }
                    }
                }
            }

            item {
                SyncDCard(Modifier.fillMaxWidth()) {
                    Text("Start a room", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "You'll be the host and get a code to share.",
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Spacer(Modifier.height(14.dp))
                    PrimaryButton("Create room", vm::create, Modifier.fillMaxWidth(), loading = state.creating, icon = Icons.Outlined.Add)
                }
            }

            item {
                SyncDCard(Modifier.fillMaxWidth()) {
                    Text("Join with a code", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = state.joinCode,
                        onValueChange = vm::onCodeChange,
                        placeholder = { Text("ABC234") },
                        isError = state.joinError != null,
                        supportingText = state.joinError?.let { { Text(it) } },
                        singleLine = true,
                        textStyle = MaterialTheme.typography.titleLarge.copy(fontFamily = FontFamily.Monospace, letterSpacing = 4.sp),
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, imeAction = ImeAction.Go),
                        keyboardActions = KeyboardActions(onGo = { vm.join() }),
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = SyncDColors.Accent),
                    )
                    Spacer(Modifier.height(8.dp))
                    SecondaryButton(
                        if (state.joining) "Joining…" else "Join room",
                        vm::join,
                        Modifier.fillMaxWidth(),
                        enabled = !state.joining && state.joinCode.length == RoomCodes.LENGTH,
                    )
                }
            }

            item { SectionHeader("Recent rooms") }
            if (recent.isEmpty()) {
                item {
                    Row(Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.History, null, tint = SyncDColors.InkFaint)
                        Spacer(Modifier.width(12.dp))
                        Text(
                            "Rooms you open on this device show up here. SyncD doesn't list public rooms yet — ask a friend for a code.",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            } else {
                items(recent, key = { it.roomCode }) { room ->
                    RecentRoomRow(room, opening = state.openingCode == room.roomCode) { vm.open(room.roomCode) }
                }
            }

            item { SectionHeader("On this device") }
            item {
                SyncDCard(Modifier.fillMaxWidth()) {
                    Text("Play an audio file", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Plays a file from your phone with background playback, lock-screen and Bluetooth controls. " +
                            "It's private to this device and isn't shared with any room.",
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Spacer(Modifier.height(12.dp))
                    SecondaryButton("Choose audio file", { picker.launch(arrayOf("audio/*")) }, Modifier.fillMaxWidth(), icon = Icons.Outlined.AudioFile)
                }
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(16.dp))
    }
}

@Composable
private fun RecentRoomRow(room: RecentRoom, opening: Boolean, onOpen: () -> Unit) {
    SyncDCard(
        Modifier.fillMaxWidth().heightIn(min = 56.dp).clickable(enabled = !opening, role = Role.Button, onClick = onOpen),
        padding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(room.roomCode, style = MaterialTheme.typography.titleMedium.copy(fontFamily = FontFamily.Monospace, letterSpacing = 2.sp))
                Text(
                    "Host ${room.hostUsername} · opened ${DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date(room.lastOpenedAtMs))}",
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                )
            }
            Text(if (opening) "Opening…" else "Open", color = SyncDColors.Accent, style = MaterialTheme.typography.labelLarge)
            Spacer(Modifier.size(4.dp))
        }
    }
}
