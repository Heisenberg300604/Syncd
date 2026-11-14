package com.syncd.android.feature.search

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil3.compose.AsyncImage
import com.syncd.android.core.design.PrimaryButton
import com.syncd.android.core.design.SyncDColors
import com.syncd.android.core.model.YouTubeSearchResult
import com.syncd.android.core.network.ApiResult
import com.syncd.android.core.util.IsoDuration
import com.syncd.android.core.util.formatClock
import com.syncd.android.data.repository.CommandResult
import com.syncd.android.data.repository.MusicRepository
import com.syncd.android.data.repository.PlaylistImport
import com.syncd.android.data.repository.RoomSessionRepository
import com.syncd.android.data.repository.TrackQuery
import com.syncd.android.data.repository.toTrackInput
import com.syncd.android.di.appViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SearchUiState(
    val query: String = "",
    val loading: Boolean = false,
    val results: List<YouTubeSearchResult> = emptyList(),
    val playlist: PlaylistImport? = null,
    val error: String? = null,
    val searched: Boolean = false,
    val busyVideoId: String? = null,
    val queuedIds: Set<String> = emptySet(),
    val importProgress: Pair<Int, Int>? = null,
)

class SearchViewModel(private val music: MusicRepository, private val rooms: RoomSessionRepository) : ViewModel() {
    private val _state = MutableStateFlow(SearchUiState())
    val state = _state.asStateFlow()
    private val _close = Channel<Unit>(Channel.BUFFERED)
    val close = _close.receiveAsFlow()

    fun onQueryChange(q: String) = _state.update { it.copy(query = q.take(200), error = null) }

    fun submit() {
        val q = _state.value.query.trim()
        if (q.isEmpty() || _state.value.loading) return
        _state.update { it.copy(loading = true, error = null, playlist = null, results = emptyList()) }
        viewModelScope.launch {
            when (val kind = TrackQuery.classify(q)) {
                is TrackQuery.Playlist -> when (val r = music.resolvePlaylist(kind.url)) {
                    is ApiResult.Success -> _state.update { it.copy(playlist = r.value, results = r.value.tracks) }
                    is ApiResult.Failure -> _state.update { it.copy(error = r.error.message) }
                }
                is TrackQuery.Video -> when (val r = music.resolveVideo(kind.url)) {
                    is ApiResult.Success -> _state.update { it.copy(results = listOf(r.value)) }
                    is ApiResult.Failure -> _state.update { it.copy(error = r.error.message) }
                }
                is TrackQuery.Search -> when (val r = music.search(kind.text)) {
                    is ApiResult.Success -> _state.update { it.copy(results = r.value) }
                    is ApiResult.Failure -> _state.update { it.copy(error = r.error.message) }
                }
            }
            _state.update { it.copy(loading = false, searched = true) }
        }
    }

    fun playNow(track: YouTubeSearchResult) = act(track) {
        if (rooms.setTrack(track.toTrackInput()) == CommandResult.Ok) _close.send(Unit)
    }

    fun queue(track: YouTubeSearchResult) = act(track) {
        if (rooms.queueAdd(track.toTrackInput()) == CommandResult.Ok) markQueued(track)
    }

    fun playNext(track: YouTubeSearchResult) = act(track) {
        if (rooms.queuePrepend(track.toTrackInput()) == CommandResult.Ok) markQueued(track)
    }

    /** Adds the playlist in order, one acknowledged `queue:add` at a time; stops at the first rejection (e.g. queue full). */
    fun importPlaylist() {
        val tracks = _state.value.playlist?.tracks ?: return
        viewModelScope.launch {
            for ((i, t) in tracks.withIndex()) {
                _state.update { it.copy(importProgress = i to tracks.size) }
                if (rooms.queueAdd(t.toTrackInput()) != CommandResult.Ok) break
                markQueued(t)
            }
            _state.update { it.copy(importProgress = null) }
        }
    }

    private fun markQueued(t: YouTubeSearchResult) = _state.update { it.copy(queuedIds = it.queuedIds + t.videoId) }

    private fun act(track: YouTubeSearchResult, block: suspend () -> Unit) {
        if (_state.value.busyVideoId != null) return
        _state.update { it.copy(busyVideoId = track.videoId) }
        viewModelScope.launch {
            block()
            _state.update { it.copy(busyVideoId = null) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchSheet(somethingPlaying: Boolean, onDismiss: () -> Unit) {
    val vm = appViewModel(key = "search") { SearchViewModel(it.music, it.rooms) }
    val state by vm.state.collectAsState()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(vm) { vm.close.collect { onDismiss() } }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = SyncDColors.Surface) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(0.92f).imePadding().padding(horizontal = 16.dp)) {
            Text("Add music", style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = state.query,
                onValueChange = vm::onQueryChange,
                placeholder = { Text("Search YouTube or paste a link") },
                leadingIcon = { Icon(Icons.Outlined.Search, null) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { vm.submit() }),
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = SyncDColors.Accent),
            )
            Spacer(Modifier.height(12.dp))

            when {
                state.loading -> Row(Modifier.fillMaxWidth().padding(24.dp), horizontalArrangement = Arrangement.Center) {
                    CircularProgressIndicator(color = SyncDColors.Accent)
                }
                state.error != null -> Text(state.error!!, color = SyncDColors.Danger, style = MaterialTheme.typography.bodyMedium)
                state.searched && state.results.isEmpty() -> Text("No results.", style = MaterialTheme.typography.bodyMedium)
            }

            state.playlist?.let { pl ->
                Column(Modifier.padding(bottom = 8.dp)) {
                    Text(pl.title ?: "Playlist", style = MaterialTheme.typography.titleMedium)
                    Text("${pl.tracks.size} playable videos", style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.height(8.dp))
                    val progress = state.importProgress
                    PrimaryButton(
                        if (progress != null) "Adding ${progress.first + 1} of ${progress.second}…" else "Add all to queue",
                        vm::importPlaylist,
                        Modifier.fillMaxWidth(),
                        loading = progress != null,
                    )
                }
            }

            LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
                items(state.results, key = { it.videoId }) { r ->
                    ResultRow(
                        r,
                        busy = state.busyVideoId == r.videoId,
                        queued = r.videoId in state.queuedIds,
                        somethingPlaying = somethingPlaying,
                        onPlay = { vm.playNow(r) },
                        onQueue = { vm.queue(r) },
                        onPlayNext = { vm.playNext(r) },
                    )
                }
            }
        }
    }
}

@Composable
private fun ResultRow(
    r: YouTubeSearchResult,
    busy: Boolean,
    queued: Boolean,
    somethingPlaying: Boolean,
    onPlay: () -> Unit,
    onQueue: () -> Unit,
    onPlayNext: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AsyncImage(
                model = r.thumbnailUrl.takeIf { it.isNotBlank() },
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(width = 96.dp, height = 54.dp).clip(RoundedCornerShape(8.dp)).background(SyncDColors.Overlay),
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(r.title, style = MaterialTheme.typography.bodyMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(
                    "${r.channelTitle} · ${formatClock(IsoDuration.toSeconds(r.duration))}",
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                )
            }
        }
        Row(Modifier.fillMaxWidth().heightIn(min = 48.dp), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
            if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = SyncDColors.Accent)
            if (queued) Text("Queued ✓", style = MaterialTheme.typography.labelLarge, color = SyncDColors.Online, modifier = Modifier.padding(end = 8.dp))
            TextButton(onClick = onPlay, enabled = !busy) { Text("Play now") }
            if (somethingPlaying) {
                TextButton(onClick = onPlayNext, enabled = !busy) { Text("Play next") }
                TextButton(onClick = onQueue, enabled = !busy) { Text("Queue") }
            }
        }
    }
}
