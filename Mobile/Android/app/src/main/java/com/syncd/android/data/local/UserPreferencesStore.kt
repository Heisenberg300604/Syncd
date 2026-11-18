package com.syncd.android.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.userPrefsDataStore: DataStore<Preferences> by preferencesDataStore(name = "user_preferences")

/**
 * Stores local app preferences (permission onboarding, audio scan preferences).
 */
class UserPreferencesStore(private val context: Context) {
    private val keyPermissionOnboarded = booleanPreferencesKey("permission_onboarded_v1")
    private val keyAutoScanAudio = booleanPreferencesKey("auto_scan_audio")
    private val keyCaptionsDefault = booleanPreferencesKey("captions_by_default")

    val hasSeenPermissionScreen: Flow<Boolean> = context.userPrefsDataStore.data.map { prefs ->
        prefs[keyPermissionOnboarded] ?: false
    }

    val autoScanEnabled: Flow<Boolean> = context.userPrefsDataStore.data.map { prefs ->
        prefs[keyAutoScanAudio] ?: true
    }

    val captionsByDefault: Flow<Boolean> = context.userPrefsDataStore.data.map { prefs ->
        prefs[keyCaptionsDefault] ?: false
    }

    suspend fun setPermissionOnboarded(seen: Boolean = true) {
        context.userPrefsDataStore.edit { prefs ->
            prefs[keyPermissionOnboarded] = seen
        }
    }

    suspend fun setAutoScanEnabled(enabled: Boolean) {
        context.userPrefsDataStore.edit { prefs ->
            prefs[keyAutoScanAudio] = enabled
        }
    }

    suspend fun setCaptionsByDefault(enabled: Boolean) {
        context.userPrefsDataStore.edit { prefs ->
            prefs[keyCaptionsDefault] = enabled
        }
    }
}
