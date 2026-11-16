package com.syncd.android.core.config

import com.syncd.android.BuildConfig

/**
 * Public client configuration. Same derivation as client/src/config/env.ts:
 * the API base includes `/api`; the Socket.IO origin is the base with `/api` removed.
 */
data class AppConfig(
    val apiBaseUrl: String,
    val clerkPublishableKey: String,
    val allowCleartext: Boolean,
) {
    /** Retrofit requires a trailing slash on the base URL. */
    val retrofitBaseUrl: String get() = apiBaseUrl.trimEnd('/') + "/"

    val socketUrl: String get() = apiBaseUrl.trimEnd('/').removeSuffix("/api")

    /** Problems that make the app unusable; surfaced on a setup screen instead of crashing. */
    fun problems(): List<String> = buildList {
        if (clerkPublishableKey.isBlank() || clerkPublishableKey.contains("replace_me")) {
            add("syncd.clerkPublishableKey is not set (see android/syncd.local.properties.example).")
        }
        if (!apiBaseUrl.startsWith("https://") && !(allowCleartext && apiBaseUrl.startsWith("http://"))) {
            add("syncd.apiBaseUrl must be an https:// URL in release builds.")
        }
    }

    companion object {
        fun fromBuildConfig() = AppConfig(
            apiBaseUrl = BuildConfig.API_BASE_URL,
            clerkPublishableKey = BuildConfig.CLERK_PUBLISHABLE_KEY,
            allowCleartext = BuildConfig.ALLOW_CLEARTEXT,
        )
    }
}
