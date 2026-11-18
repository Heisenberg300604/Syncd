package com.syncd.android.feature.profile

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ExitToApp
import androidx.compose.material.icons.outlined.ClosedCaption
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.GraphicEq
import androidx.compose.material.icons.outlined.MusicNote
import androidx.compose.material.icons.outlined.WifiTethering
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.syncd.android.core.design.Avatar
import com.syncd.android.core.design.SyncDCard
import com.syncd.android.core.design.SyncDColors
import com.syncd.android.data.local.LocalAudioScanner
import com.syncd.android.di.AppContainer
import com.syncd.android.di.appViewModel
import com.syncd.android.domain.model.RoomPhase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class ProfileViewModel(private val c: AppContainer) : ViewModel() {
    val user = c.users.currentUser

    val recentCount = c.recentRooms.rooms
        .map { it.size }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    val activeRoom = c.rooms.state

    val autoScanEnabled = c.userPrefs.autoScanEnabled
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), true)

    val captionsByDefault = c.userPrefs.captionsByDefault
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    private val _localTrackCount = MutableStateFlow(0)
    val localTrackCount = _localTrackCount.asStateFlow()

    fun loadTrackCount(context: Context) {
        viewModelScope.launch {
            val tracks = LocalAudioScanner.scanTracks(context)
            _localTrackCount.value = tracks.size
        }
    }

    fun setAutoScan(enabled: Boolean) {
        viewModelScope.launch { c.userPrefs.setAutoScanEnabled(enabled) }
    }

    fun setCaptionsDefault(enabled: Boolean) {
        viewModelScope.launch { c.userPrefs.setCaptionsByDefault(enabled) }
    }
}

@Composable
fun ProfileScreen(
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val vm = appViewModel { ProfileViewModel(it) }
    val context = LocalContext.current
    var confirmSignOut by remember { mutableStateOf(false) }

    val recentRoomsCount by vm.recentCount.collectAsState()
    val localTracksCount by vm.localTrackCount.collectAsState()
    val autoScan by vm.autoScanEnabled.collectAsState()
    val captionsByDefault by vm.captionsByDefault.collectAsState()
    val activeRoom by vm.activeRoom.collectAsState()

    LaunchedEffect(Unit) {
        vm.loadTrackCount(context)
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .statusBarsPadding(),
    ) {
        Text(
            text = "Profile",
            style = MaterialTheme.typography.displaySmall.copy(
                fontWeight = FontWeight.Bold,
                fontSize = 34.sp,
            ),
            color = SyncDColors.Ink,
            modifier = Modifier
                .padding(horizontal = 20.dp, vertical = 12.dp)
                .semantics { heading() },
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // ── Section 1: User Identity Card ──
            SyncDCard(
                modifier = Modifier.fillMaxWidth(),
                padding = PaddingValues(16.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box {
                        Avatar(
                            name = vm.user?.username ?: "User",
                            size = 60.dp,
                            useGradient = true,
                        )
                        Box(
                            modifier = Modifier
                                .size(14.dp)
                                .clip(CircleShape)
                                .background(SyncDColors.Online)
                                .border(2.dp, SyncDColors.Raised, CircleShape)
                                .align(Alignment.BottomEnd),
                        )
                    }
                    Spacer(Modifier.width(16.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            text = vm.user?.username ?: "User",
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                            color = SyncDColors.Ink,
                        )
                        Spacer(Modifier.height(4.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(SyncDColors.AccentLo)
                                    .padding(horizontal = 8.dp, vertical = 2.dp),
                            ) {
                                Text(
                                    text = "SyncD Member",
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                                    color = SyncDColors.Accent,
                                )
                            }
                            Spacer(Modifier.width(8.dp))
                            Text(
                                text = "Active",
                                style = MaterialTheme.typography.bodySmall,
                                color = SyncDColors.InkMuted,
                            )
                        }
                    }
                }
            }

            // ── Active Room Indicator (if currently listening) ──
            activeRoom?.takeIf { it.phase !is RoomPhase.Closed && it.phase !is RoomPhase.Removed }?.let { room ->
                SyncDCard(
                    modifier = Modifier.fillMaxWidth(),
                    padding = PaddingValues(14.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(SyncDColors.AccentLo),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Outlined.GraphicEq, contentDescription = null, tint = SyncDColors.Accent, modifier = Modifier.size(18.dp))
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                text = "Listening in ${room.roomCode}",
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                                color = SyncDColors.Accent,
                            )
                            val title = room.playback?.title ?: "Room active"
                            Text(
                                text = title,
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                                color = SyncDColors.Ink,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }

            // ── Section 2: Music Stats ──
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                StatCard(
                    icon = Icons.Outlined.WifiTethering,
                    value = recentRoomsCount.toString(),
                    label = "Rooms joined",
                    modifier = Modifier.weight(1f),
                )
                StatCard(
                    icon = Icons.Outlined.MusicNote,
                    value = localTracksCount.toString(),
                    label = "Tracks on device",
                    modifier = Modifier.weight(1f),
                )
            }

            // ── Section 3: Audio & App Preferences ──
            Column(modifier = Modifier.padding(top = 4.dp)) {
                Text(
                    text = "PREFERENCES",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 0.8.sp,
                    ),
                    color = SyncDColors.InkFaint,
                    modifier = Modifier.padding(start = 4.dp, bottom = 8.dp),
                )
                SyncDCard(
                    modifier = Modifier.fillMaxWidth(),
                    padding = PaddingValues(0.dp),
                ) {
                    PreferenceToggleRow(
                        icon = Icons.Outlined.FolderOpen,
                        title = "Auto-scan library",
                        subtitle = "Scan device audio automatically on launch",
                        checked = autoScan,
                        onCheckedChange = vm::setAutoScan,
                    )
                    HorizontalDivider(color = SyncDColors.Line, thickness = 1.dp, modifier = Modifier.padding(horizontal = 16.dp))
                    PreferenceToggleRow(
                        icon = Icons.Outlined.ClosedCaption,
                        title = "Captions by default",
                        subtitle = "Keep video captions enabled when video plays",
                        checked = captionsByDefault,
                        onCheckedChange = vm::setCaptionsDefault,
                    )
                }
            }

            // ── Section 4: Account Actions ──
            Spacer(Modifier.height(4.dp))
            SyncDCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(role = Role.Button, onClick = { confirmSignOut = true }),
                padding = PaddingValues(vertical = 14.dp, horizontal = 16.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.AutoMirrored.Outlined.ExitToApp,
                        contentDescription = null,
                        tint = SyncDColors.Danger,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = "Sign out",
                        color = SyncDColors.Danger,
                        style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
                    )
                }
            }

            // ── Section 5: App Branding Tag ──
            Box(Modifier.fillMaxWidth().padding(top = 8.dp), contentAlignment = Alignment.Center) {
                Text(
                    text = "SyncD · Listen together",
                    style = MaterialTheme.typography.bodySmall,
                    color = SyncDColors.InkFaint,
                )
            }
            Spacer(Modifier.height(24.dp))
        }
    }

    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text("Sign out of SyncD?") },
            text = { Text("You'll stop listening to any room on this device.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmSignOut = false
                    onSignOut()
                }) {
                    Text("Sign out", color = SyncDColors.Danger, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmSignOut = false }) {
                    Text("Cancel", color = SyncDColors.Ink)
                }
            },
            containerColor = SyncDColors.Raised,
        )
    }
}

@Composable
private fun StatCard(
    icon: ImageVector,
    value: String,
    label: String,
    modifier: Modifier = Modifier,
) {
    SyncDCard(
        modifier = modifier,
        padding = PaddingValues(16.dp),
    ) {
        Column {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(SyncDColors.AccentLo),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = SyncDColors.Accent, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.height(12.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                color = SyncDColors.Ink,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                color = SyncDColors.InkMuted,
            )
        }
    }
}

@Composable
private fun PreferenceToggleRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!checked) }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(SyncDColors.Overlay),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = SyncDColors.Accent, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                color = SyncDColors.Ink,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = SyncDColors.InkMuted,
            )
        }
        Spacer(Modifier.width(8.dp))
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = SyncDColors.AccentInk,
                checkedTrackColor = SyncDColors.Accent,
                uncheckedThumbColor = SyncDColors.InkMuted,
                uncheckedTrackColor = SyncDColors.Overlay,
                uncheckedBorderColor = SyncDColors.LineStrong,
            ),
        )
    }
}
