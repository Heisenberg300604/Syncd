package com.syncd.android.feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.syncd.android.core.design.SyncDColors
import com.syncd.android.core.util.CHAT_MAX_LENGTH
import com.syncd.android.domain.model.ChatEntry
import com.syncd.android.domain.model.ChatStatus
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

@Composable
fun ChatPanel(
    messages: List<ChatEntry>,
    selfId: String?,
    connected: Boolean,
    onSend: (String) -> Unit,
    onRetry: (String) -> Unit,
    onDiscard: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var draft by rememberSaveable { mutableStateOf("") }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val nearBottom by remember {
        derivedStateOf {
            val last = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            last >= listState.layoutInfo.totalItemsCount - 2
        }
    }
    var unseen by remember { mutableStateOf(false) }

    // Auto-scroll only when the reader is already at the bottom (or it's our own message).
    LaunchedEffect(messages.size) {
        if (messages.isEmpty()) return@LaunchedEffect
        val mine = messages.last().userId == selfId
        if (nearBottom || mine) {
            listState.animateScrollToItem(messages.lastIndex)
            unseen = false
        } else {
            unseen = true
        }
    }

    Column(modifier.fillMaxSize()) {
        Box(Modifier.weight(1f)) {
            if (messages.isEmpty()) {
                Column(
                    Modifier.fillMaxSize().padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(Icons.Outlined.ChatBubbleOutline, null, tint = SyncDColors.InkFaint)
                    Spacer(Modifier.size(8.dp))
                    Text("No messages yet. Say hi!", style = MaterialTheme.typography.bodySmall)
                }
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize().semantics { liveRegion = LiveRegionMode.Polite },
                    contentPadding = PaddingValues(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    items(messages, key = { it.key }) { m ->
                        MessageBubble(m, mine = m.userId == selfId, onRetry = onRetry, onDiscard = onDiscard)
                    }
                }
            }
            if (unseen && !nearBottom) {
                SmallFloatingActionButton(
                    onClick = {
                        scope.launch { listState.animateScrollToItem(messages.lastIndex) }
                        unseen = false
                    },
                    modifier = Modifier.align(Alignment.BottomCenter).padding(8.dp),
                    containerColor = SyncDColors.Overlay,
                ) { Text("↓ New messages", modifier = Modifier.padding(horizontal = 12.dp)) }
            }
        }

        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            val send = {
                val text = draft.trim()
                if (text.isNotEmpty() && connected) {
                    onSend(text)
                    draft = ""
                }
            }
            OutlinedTextField(
                value = draft,
                onValueChange = { draft = it.take(CHAT_MAX_LENGTH) },
                placeholder = { Text(if (connected) "Message the room" else "Reconnecting…") },
                supportingText = if (draft.length > CHAT_MAX_LENGTH - 50) {
                    { Text("${draft.length}/$CHAT_MAX_LENGTH") }
                } else null,
                maxLines = 4,
                enabled = connected,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { send() }),
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(22.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = SyncDColors.Accent),
            )
            Spacer(Modifier.size(8.dp))
            FilledIconButton(
                onClick = send,
                enabled = connected && draft.isNotBlank(),
                modifier = Modifier.size(52.dp),
                colors = IconButtonDefaults.filledIconButtonColors(containerColor = SyncDColors.Accent, contentColor = SyncDColors.AccentInk),
            ) { Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send message") }
        }
    }
}

@Composable
private fun MessageBubble(m: ChatEntry, mine: Boolean, onRetry: (String) -> Unit, onDiscard: (String) -> Unit) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
        if (!mine) Text(m.username, style = MaterialTheme.typography.labelMedium, color = SyncDColors.InkMuted)
        Box(
            Modifier.widthIn(max = 300.dp).clip(RoundedCornerShape(16.dp))
                .background(if (mine) SyncDColors.AccentLo else SyncDColors.Raised)
                .padding(horizontal = 12.dp, vertical = 8.dp),
        ) { Text(m.content, style = MaterialTheme.typography.bodyMedium) }
        when (val s = m.status) {
            ChatStatus.Sent -> Text(
                DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(m.createdAtMs)),
                style = MaterialTheme.typography.bodySmall,
                color = SyncDColors.InkFaint,
            )
            ChatStatus.Sending -> Text("Sending…", style = MaterialTheme.typography.bodySmall)
            is ChatStatus.Failed -> Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Not sent: ${s.reason}", style = MaterialTheme.typography.bodySmall, color = SyncDColors.Danger)
                TextButton(onClick = { onRetry(m.key) }) { Text("Retry") }
                TextButton(onClick = { onDiscard(m.key) }) { Text("Discard") }
            }
            ChatStatus.Unconfirmed -> Row(verticalAlignment = Alignment.CenterVertically) {
                Text("May not have sent", style = MaterialTheme.typography.bodySmall, color = SyncDColors.Warning)
                // Resending could duplicate it if the first attempt did arrive — the user decides.
                TextButton(onClick = { onRetry(m.key) }) { Text("Send again") }
                TextButton(onClick = { onDiscard(m.key) }) { Text("Discard") }
            }
        }
    }
}
