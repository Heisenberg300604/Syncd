package com.syncd.android.feature.room

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.syncd.android.SyncDApplication
import com.syncd.android.core.design.MusicNoteHouseIcon
import com.syncd.android.core.design.SecondaryButton
import com.syncd.android.core.design.SyncDColors
import com.syncd.android.domain.model.RoomPhase

/**
 * The Room tab screen. Shows the active room session if one is currently open,
 * or the empty state explaining how to join/create a room, matching iOS `ActiveRoomTab`.
 */
@Composable
fun ActiveRoomTabScreen(
    onGoHome: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val app = context.applicationContext as SyncDApplication
    val room by app.container.rooms.state.collectAsState()
    val activeRoom = room?.takeIf { it.phase !is RoomPhase.Closed && it.phase !is RoomPhase.Removed }

    Box(modifier = modifier.fillMaxSize().background(SyncDColors.Canvas)) {
        if (activeRoom != null) {
            RoomScreen(code = activeRoom.roomCode, onBack = onGoHome)
        } else {
            EmptyRoomTab(onGoHome = onGoHome)
        }
    }
}

@Composable
fun EmptyRoomTab(
    onGoHome: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .statusBarsPadding(),
    ) {
        Text(
            text = "Room",
            style = MaterialTheme.typography.displaySmall.copy(
                fontWeight = FontWeight.Bold,
                fontSize = 34.sp,
            ),
            color = SyncDColors.Ink,
            modifier = Modifier
                .padding(horizontal = 20.dp, vertical = 12.dp)
                .semantics { heading() },
        )

        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 32.dp, vertical = 24.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.widthIn(max = 340.dp),
            ) {
                MusicNoteHouseIcon(
                    modifier = Modifier.size(54.dp),
                    tint = SyncDColors.Accent,
                )
                Spacer(Modifier.height(18.dp))
                Text(
                    text = "You're not in a room",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = SyncDColors.Ink,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "Create a room or join one with a 6-character code to start listening together.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = SyncDColors.InkMuted,
                    textAlign = TextAlign.Center,
                    lineHeight = 22.sp,
                )
                Spacer(Modifier.height(24.dp))
                SecondaryButton(
                    text = "Go to Home",
                    onClick = onGoHome,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        }
    }
}
