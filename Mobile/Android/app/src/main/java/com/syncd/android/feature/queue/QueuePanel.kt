package com.syncd.android.feature.queue

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.KeyboardArrowDown
import androidx.compose.material.icons.outlined.KeyboardArrowUp
import androidx.compose.material.icons.automirrored.outlined.QueueMusic
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.syncd.android.core.design.SectionHeader
import com.syncd.android.core.design.SyncDColors
import com.syncd.android.core.model.QueueItem
import com.syncd.android.core.util.IsoDuration
import com.syncd.android.core.util.QUEUE_CAPACITY
import com.syncd.android.core.util.formatClock

/**
 * The canonical queue (server snapshot). Host-only controls; for everyone else it
 * is read-only. Reordering uses buttons plus TalkBack custom actions rather than
 * drag, which is also the web client's fallback.
 */
@Composable
fun QueuePanel(
    queue: List<QueueItem>,
    isHost: Boolean,
    onRemove: (Int) -> Unit,
    onMove: (from: Int, to: Int) -> Unit,
    onClear: () -> Unit,
    onAdd: () -> Unit,
) {
    if (queue.isEmpty()) {
        Column(
            Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(Icons.AutoMirrored.Outlined.QueueMusic, null, tint = SyncDColors.InkFaint, modifier = Modifier.size(32.dp))
            Spacer(Modifier.size(8.dp))
            Text("The queue is empty", style = MaterialTheme.typography.titleSmall)
            Text(
                if (isHost) "Add songs and they'll play in order." else "The host hasn't queued anything yet.",
                style = MaterialTheme.typography.bodySmall,
            )
            if (isHost) TextButton(onClick = onAdd) { Text("Add music") }
        }
        return
    }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 96.dp)) {
        item {
            SectionHeader(
                "Up next · ${queue.size}/$QUEUE_CAPACITY",
                Modifier.padding(start = 16.dp, end = 4.dp, top = 8.dp),
            ) {
                if (isHost) TextButton(onClick = onClear) { Text("Clear all", color = SyncDColors.Danger) }
            }
        }
        itemsIndexed(queue, key = { index, item -> "$index-${item.videoId}" }) { index, item ->
            val actions = if (isHost) buildList {
                if (index > 0) add(CustomAccessibilityAction("Move up") { onMove(index, index - 1); true })
                if (index < queue.lastIndex) add(CustomAccessibilityAction("Move down") { onMove(index, index + 1); true })
                add(CustomAccessibilityAction("Remove from queue") { onRemove(index); true })
            } else emptyList()

            Row(
                Modifier.fillMaxWidth().heightIn(min = 64.dp).padding(horizontal = 16.dp, vertical = 6.dp)
                    .semantics(mergeDescendants = true) {
                        contentDescription = "${index + 1}. ${item.title}"
                        customActions = actions
                    },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "${index + 1}",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (index == 0) SyncDColors.Accent else SyncDColors.InkFaint,
                    modifier = Modifier.width(22.dp),
                )
                AsyncImage(
                    model = item.thumbnailUrl.takeIf { it.isNotBlank() },
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(width = 64.dp, height = 36.dp).clip(RoundedCornerShape(6.dp)).background(SyncDColors.Overlay),
                )
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(item.title.ifBlank { "Untitled" }, style = MaterialTheme.typography.bodyMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(
                        (if (index == 0) "Up next · " else "") + formatClock(IsoDuration.toSeconds(item.duration)),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                if (isHost) {
                    IconButton(onClick = { onMove(index, index - 1) }, enabled = index > 0) {
                        Icon(Icons.Outlined.KeyboardArrowUp, contentDescription = null)
                    }
                    IconButton(onClick = { onMove(index, index + 1) }, enabled = index < queue.lastIndex) {
                        Icon(Icons.Outlined.KeyboardArrowDown, contentDescription = null)
                    }
                    IconButton(onClick = { onRemove(index) }) {
                        Icon(Icons.Outlined.Close, contentDescription = null)
                    }
                }
            }
        }
    }
}
