package com.syncd.android.feature.room

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.syncd.android.core.design.Avatar
import com.syncd.android.core.design.StatusPill
import com.syncd.android.core.design.SyncDColors
import com.syncd.android.domain.model.Participant

/** Members from live presence (refreshed on every join/leave/disconnect), host first. */
@Composable
fun ParticipantsPanel(
    members: List<Participant>,
    selfId: String?,
    isHost: Boolean,
    onMakeHost: (String) -> Unit,
) {
    var confirmFor by remember { mutableStateOf<Participant?>(null) }
    val ordered = members.sortedWith(compareByDescending<Participant> { it.isHost }.thenByDescending { it.online == true })

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 8.dp)) {
        items(ordered, key = { it.userId }) { m ->
            val presence = when (m.online) {
                true -> "online"
                false -> "offline"
                null -> "presence unknown"
            }
            Row(
                Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(horizontal = 16.dp)
                    .semantics(mergeDescendants = true) {
                        contentDescription = "${m.username}${if (m.isHost) ", host" else ""}${if (m.userId == selfId) ", you" else ""}, $presence"
                    },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Avatar(m.username, online = m.online)
                Spacer(Modifier.width(12.dp))
                Text(
                    m.username + if (m.userId == selfId) " (you)" else "",
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.weight(1f),
                    color = if (m.online == false) SyncDColors.InkMuted else SyncDColors.Ink,
                )
                if (m.isHost) StatusPill("Host", SyncDColors.Accent, showDot = false)
                // The server accepts any member as a target; offering only online members
                // matches the web client and avoids handing control to someone who's away.
                if (isHost && !m.isHost && m.online == true) {
                    TextButton(onClick = { confirmFor = m }) { Text("Make host") }
                }
            }
        }
    }

    confirmFor?.let { target ->
        AlertDialog(
            onDismissRequest = { confirmFor = null },
            title = { Text("Make ${target.username} the host?") },
            text = { Text("They'll control playback and the queue. You can't undo this yourself.") },
            confirmButton = {
                TextButton(onClick = {
                    onMakeHost(target.userId)
                    confirmFor = null
                }) { Text("Make host") }
            },
            dismissButton = { TextButton(onClick = { confirmFor = null }) { Text("Cancel") } },
            containerColor = SyncDColors.Raised,
        )
    }
}
