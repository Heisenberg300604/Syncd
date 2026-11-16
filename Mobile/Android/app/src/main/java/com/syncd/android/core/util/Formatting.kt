package com.syncd.android.core.util

import java.time.Instant
import java.time.format.DateTimeParseException
import kotlin.math.max

/**
 * Port of server/src/modules/music/music.validation.ts `parseIso8601DurationToSeconds`.
 * Returns null for live streams ("P0D") and anything unparseable — same contract.
 */
object IsoDuration {
    private val regex = Regex("""^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$""")

    fun toSeconds(raw: String?): Double? {
        if (raw.isNullOrBlank()) return null
        val m = regex.matchEntire(raw.trim()) ?: return null
        val (d, h, min, s) = m.destructured
        val total = (d.toLongOrNull() ?: 0) * 86400.0 +
            (h.toLongOrNull() ?: 0) * 3600.0 +
            (min.toLongOrNull() ?: 0) * 60.0 +
            (s.toDoubleOrNull() ?: 0.0)
        return if (total > 0) total else null
    }
}

/** "3:07", "1:02:03". Negative/NaN inputs render as 0:00. */
fun formatClock(seconds: Double?): String {
    if (seconds == null || seconds.isNaN() || seconds.isInfinite()) return "--:--"
    val total = max(0L, seconds.toLong())
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

/** Parses the server's `Date.toISOString()` output to epoch millis. */
fun parseInstantMillis(iso: String?): Long? {
    if (iso.isNullOrBlank()) return null
    return try {
        Instant.parse(iso).toEpochMilli()
    } catch (_: DateTimeParseException) {
        null
    }
}

/**
 * Client-side mirror of server/src/modules/rooms/rooms.validation.ts. UX only —
 * the server re-validates and normalises every code.
 */
object RoomCodes {
    const val LENGTH = 6
    private val allowed = Regex("^[A-Z0-9]+$")

    fun normalize(raw: String): String = raw.trim().uppercase()

    /** Returns an error message, or null when the code is well-formed. */
    fun validate(raw: String): String? {
        val v = normalize(raw)
        return when {
            v.isEmpty() -> "Enter a room code"
            v.length != LENGTH -> "Room codes are $LENGTH characters"
            !allowed.matches(v) -> "Room codes only contain letters and numbers"
            else -> null
        }
    }
}

/** Mirror of server/src/modules/users/users.validation.ts (UX only). */
object Usernames {
    private val allowed = Regex("^[a-zA-Z0-9_]+$")

    fun validate(raw: String): String? {
        val v = raw.trim()
        return when {
            v.isEmpty() -> "Username is required"
            v.length < 3 -> "Username must be at least 3 characters"
            v.length > 20 -> "Username must be at most 20 characters"
            !allowed.matches(v) -> "Use letters, numbers and underscores only"
            else -> null
        }
    }
}

/** Mirror of messages.validation.ts MESSAGE_MAX_LENGTH. */
const val CHAT_MAX_LENGTH = 500

/** Mirror of queueStore capacity. */
const val QUEUE_CAPACITY = 50
