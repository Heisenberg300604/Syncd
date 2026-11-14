package com.syncd.android.feature.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import com.syncd.android.BuildConfig
import com.syncd.android.core.design.Avatar
import com.syncd.android.core.design.ConnectionPill
import com.syncd.android.core.design.SecondaryButton
import com.syncd.android.core.design.SectionHeader
import com.syncd.android.core.design.SyncDCard
import com.syncd.android.core.design.SyncDColors
import com.syncd.android.core.socket.ConnectionState
import com.syncd.android.di.AppContainer
import com.syncd.android.di.appViewModel

class ProfileViewModel(c: AppContainer) : ViewModel() {
    val user = c.users.currentUser
    val connection = c.realtime.connectionState
    val room = c.rooms.state
    val apiHost: String = runCatching { java.net.URI(c.config.apiBaseUrl).host }.getOrNull() ?: "?"
}

@Composable
fun ProfileScreen(onSignOut: () -> Unit) {
    val vm = appViewModel { ProfileViewModel(it) }
    val connection by vm.connection.collectAsState()
    val room by vm.room.collectAsState()
    var confirmSignOut by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxSize().statusBarsPadding().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(vm.user?.username ?: "?", size = 56.dp)
            Spacer(Modifier.width(16.dp))
            Column {
                Text(vm.user?.username ?: "", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.semantics { heading() })
                Text("Signed in with Clerk", style = MaterialTheme.typography.bodySmall)
            }
        }

        SectionHeader("Connection")
        SyncDCard(Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Real-time", style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                ConnectionPill(connection)
            }
            Spacer(Modifier.height(6.dp))
            Text(
                when (val c = connection) {
                    ConnectionState.Connected -> "Connected to ${room?.roomCode?.let { "room $it" } ?: "SyncD"}."
                    is ConnectionState.Reconnecting ->
                        "Retrying (attempt ${c.attempt})." + (c.lastError?.let { " Server said: $it" } ?: "")
                    ConnectionState.Offline -> "No network. Will reconnect automatically."
                    ConnectionState.Connecting -> "Connecting…"
                    ConnectionState.Idle -> "Connects when you open a room."
                },
                style = MaterialTheme.typography.bodySmall,
            )
            Spacer(Modifier.height(6.dp))
            Text("Server: ${vm.apiHost}", style = MaterialTheme.typography.bodySmall)
        }

        SectionHeader("Playback")
        SyncDCard(Modifier.fillMaxWidth()) {
            Text("Room tracks (YouTube)", style = MaterialTheme.typography.titleSmall)
            Text(
                "Play in YouTube's official player on the room screen while the app is open. " +
                    "YouTube doesn't allow background or audio-only playback, so they pause when you leave the app.",
                style = MaterialTheme.typography.bodySmall,
            )
            Spacer(Modifier.height(12.dp))
            Text("Files on this device", style = MaterialTheme.typography.titleSmall)
            Text(
                "Play in the background with notification, lock-screen and headset controls. Not shared with rooms.",
                style = MaterialTheme.typography.bodySmall,
            )
        }

        SectionHeader("About")
        SyncDCard(Modifier.fillMaxWidth()) {
            Text("SyncD for Android ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})", style = MaterialTheme.typography.bodyMedium)
        }

        SecondaryButton(
            "Sign out",
            { confirmSignOut = true },
            Modifier.fillMaxWidth(),
            icon = Icons.AutoMirrored.Outlined.Logout,
            contentColor = SyncDColors.Danger,
        )
    }

    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text("Sign out?") },
            text = { Text("You'll stay a member of your rooms, but playback on this device stops.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmSignOut = false
                    onSignOut()
                }) { Text("Sign out", color = SyncDColors.Danger) }
            },
            dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text("Cancel") } },
            containerColor = SyncDColors.Raised,
        )
    }
}
