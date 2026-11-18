package com.syncd.android.feature.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.GraphicEq
import androidx.compose.material.icons.outlined.History
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.syncd.android.core.design.Avatar
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
}

@Composable
fun HomeScreen(
    onOpenRoom: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val vm = appViewModel { HomeViewModel(it) }
    val state by vm.state.collectAsState()
    val recent by vm.recent.collectAsState()
    val active by vm.activeRoom.collectAsState()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(vm) { vm.navigate.collect(onOpenRoom) }
    LaunchedEffect(vm) { vm.messages.collect { snackbar.showSnackbar(it) } }

    Box(modifier = modifier.fillMaxSize()) {
        LazyColumn(
            Modifier.fillMaxSize().statusBarsPadding(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // iOS-matching greeting header
            item {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(vertical = 4.dp),
                ) {
                    Avatar(
                        name = vm.username ?: "?",
                        size = 46.dp,
                        useGradient = true,
                    )
                    Spacer(Modifier.width(14.dp))
                    Column {
                        Text(
                            text = "Welcome back",
                            style = MaterialTheme.typography.bodySmall,
                            color = SyncDColors.InkMuted,
                        )
                        Text(
                            text = vm.username ?: "User",
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                            color = SyncDColors.Ink,
                            modifier = Modifier.semantics { heading() },
                        )
                    }
                }
            }

            // Active Room card
            active?.let { room ->
                item {
                    SyncDCard(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(role = Role.Button) { onOpenRoom(room.roomCode) },
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                Modifier
                                    .size(46.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(SyncDColors.AccentLo),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(Icons.Outlined.GraphicEq, contentDescription = null, tint = SyncDColors.Accent)
                            }
                            Spacer(Modifier.width(14.dp))
                            Column(Modifier.weight(1f)) {
                                Text(
                                    "Listening in ${room.roomCode}",
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                                    color = SyncDColors.Accent,
                                )
                                Spacer(Modifier.height(2.dp))
                                val title = room.playback?.title ?: room.restTrackTitle ?: "Room active"
                                Text(
                                    title,
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                                    maxLines = 1,
                                    color = SyncDColors.Ink,
                                )
                            }
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowForward,
                                contentDescription = "Return to room ${room.roomCode}",
                                tint = SyncDColors.InkFaint,
                            )
                        }
                    }
                }
            }

            // Start Listening section
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    SectionHeader("Start listening")

                    PrimaryButton(
                        text = "Create a room",
                        onClick = vm::create,
                        modifier = Modifier.fillMaxWidth(),
                        loading = state.creating,
                        icon = Icons.Outlined.Add,
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        OutlinedTextField(
                            value = state.joinCode,
                            onValueChange = vm::onCodeChange,
                            placeholder = { Text("Room code", color = SyncDColors.InkFaint) },
                            singleLine = true,
                            isError = state.joinError != null,
                            supportingText = state.joinError?.let { { Text(it) } },
                            textStyle = MaterialTheme.typography.titleMedium.copy(
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.SemiBold,
                                letterSpacing = 2.sp,
                            ),
                            keyboardOptions = KeyboardOptions(
                                capitalization = KeyboardCapitalization.Characters,
                                imeAction = ImeAction.Go,
                            ),
                            keyboardActions = KeyboardActions(onGo = { vm.join() }),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = SyncDColors.Raised,
                                unfocusedContainerColor = SyncDColors.Raised,
                                focusedBorderColor = SyncDColors.Accent,
                                unfocusedBorderColor = SyncDColors.LineStrong,
                                focusedTextColor = SyncDColors.Ink,
                                unfocusedTextColor = SyncDColors.Ink,
                            ),
                            shape = MaterialTheme.shapes.medium,
                            modifier = Modifier
                                .weight(1f)
                                .heightIn(min = 52.dp),
                        )

                        SecondaryButton(
                            text = if (state.joining) "Joining…" else "Join",
                            onClick = vm::join,
                            enabled = !state.joining && state.joinCode.length == RoomCodes.LENGTH,
                            modifier = Modifier.height(52.dp),
                        )
                    }
                }
            }

            // Recent rooms section
            item {
                SectionHeader("Recent rooms")
            }

            if (recent.isEmpty()) {
                item {
                    SyncDCard(
                        modifier = Modifier.fillMaxWidth(),
                        padding = PaddingValues(16.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.History, null, tint = SyncDColors.Accent.copy(alpha = 0.8f))
                            Spacer(Modifier.width(14.dp))
                            Column {
                                Text(
                                    "No recent rooms",
                                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                                    color = SyncDColors.Ink,
                                )
                                Spacer(Modifier.height(2.dp))
                                Text(
                                    "Rooms you join on this device will show up here. Share a 6-character code with friends to listen together.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = SyncDColors.InkMuted,
                                )
                            }
                        }
                    }
                }
            } else {
                item {
                    SyncDCard(
                        modifier = Modifier.fillMaxWidth(),
                        padding = PaddingValues(0.dp),
                    ) {
                        recent.forEachIndexed { index, room ->
                            RecentRoomRow(
                                room = room,
                                opening = state.openingCode == room.roomCode,
                                onOpen = { vm.open(room.roomCode) },
                            )
                            if (index < recent.lastIndex) {
                                HorizontalDivider(
                                    color = SyncDColors.Line,
                                    thickness = 1.dp,
                                    modifier = Modifier.padding(horizontal = 16.dp),
                                )
                            }
                        }
                    }
                }
            }
        }

        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(16.dp))
    }
}

@Composable
private fun RecentRoomRow(
    room: RecentRoom,
    opening: Boolean,
    onOpen: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .clickable(enabled = !opening, role = Role.Button, onClick = onOpen)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(name = room.hostUsername, size = 38.dp, useGradient = true)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                room.roomCode,
                style = MaterialTheme.typography.titleSmall.copy(
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.5.sp,
                ),
                color = SyncDColors.Ink,
            )
            Text(
                "Hosted by ${room.hostUsername} · ${DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date(room.lastOpenedAtMs))}",
                style = MaterialTheme.typography.bodySmall,
                color = SyncDColors.InkMuted,
                maxLines = 1,
            )
        }
        Text(
            if (opening) "Opening…" else "Open",
            color = SyncDColors.Accent,
            style = MaterialTheme.typography.labelLarge,
        )
    }
}
