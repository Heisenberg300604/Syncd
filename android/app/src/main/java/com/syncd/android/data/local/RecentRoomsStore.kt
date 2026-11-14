package com.syncd.android.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.syncd.android.core.network.SyncDJson
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer

/**
 * A room this device has opened. A local convenience only — NOT authoritative:
 * membership is re-checked by the server whenever a room is opened. The backend
 * has no "my rooms" endpoint (docs/BACKEND_CONTRACT.md §5.3).
 */
@Serializable
data class RecentRoom(
    val roomCode: String,
    val hostUsername: String,
    val lastOpenedAtMs: Long,
    val lastTrackTitle: String? = null,
)

private val Context.recentRoomsDataStore: DataStore<Preferences> by preferencesDataStore(name = "recent_rooms")

/**
 * DataStore rather than Room: it is a bounded list of ≤ [MAX] small records read
 * as a whole, which does not warrant a database, schema migrations and KSP.
 * Cleared on sign-out so the next account on the device does not see it.
 */
class RecentRoomsStore(private val context: Context) {
    private val key = stringPreferencesKey("rooms_v1")
    private val serializer = ListSerializer(RecentRoom.serializer())

    val rooms: Flow<List<RecentRoom>> = context.recentRoomsDataStore.data.map { prefs ->
        prefs[key]?.let { runCatching { SyncDJson.decodeFromString(serializer, it) }.getOrNull() }.orEmpty()
    }

    suspend fun record(room: RecentRoom) {
        context.recentRoomsDataStore.edit { prefs ->
            val current = prefs[key]?.let { runCatching { SyncDJson.decodeFromString(serializer, it) }.getOrNull() }.orEmpty()
            val updated = (listOf(room) + current.filterNot { it.roomCode == room.roomCode })
                .sortedByDescending { it.lastOpenedAtMs }
                .take(MAX)
            prefs[key] = SyncDJson.encodeToString(serializer, updated)
        }
    }

    suspend fun remove(roomCode: String) {
        context.recentRoomsDataStore.edit { prefs ->
            val current = prefs[key]?.let { runCatching { SyncDJson.decodeFromString(serializer, it) }.getOrNull() }.orEmpty()
            prefs[key] = SyncDJson.encodeToString(serializer, current.filterNot { it.roomCode == roomCode })
        }
    }

    suspend fun clear() {
        context.recentRoomsDataStore.edit { it.remove(key) }
    }

    private companion object {
        const val MAX = 10
    }
}
