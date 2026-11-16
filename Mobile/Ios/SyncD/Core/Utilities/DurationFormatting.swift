import Foundation

/// Mirrors `parseIso8601DurationToSeconds` in `server/src/modules/music/music.validation.ts`
/// and `formatSeconds` in `client/src/utils/duration.ts`, so iOS, web and the server
/// agree on every duration they display or persist.
enum DurationFormatting {
    /// Converts a YouTube ISO 8601 duration ("PT3M45S") to seconds.
    /// Returns `nil` for live streams ("P0D") and unparseable values, like the server.
    static func seconds(fromISO8601 raw: String) -> TimeInterval? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        // Built per call: `Regex` isn't Sendable, so it can't be a shared static.
        let isoPattern = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
        guard let match = trimmed.wholeMatch(of: isoPattern) else { return nil }

        let days = match.1.flatMap { Double($0) } ?? 0
        let hours = match.2.flatMap { Double($0) } ?? 0
        let minutes = match.3.flatMap { Double($0) } ?? 0
        let seconds = match.4.flatMap { Double($0) } ?? 0

        let total = days * 86_400 + hours * 3_600 + minutes * 60 + seconds
        return total > 0 ? total : nil
    }

    /// `m:ss` or `h:mm:ss`. Negative or non-finite input renders as `0:00`.
    static func clock(_ seconds: TimeInterval) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "0:00" }
        let total = Int(seconds.rounded(.down))
        let hours = total / 3_600
        let minutes = (total % 3_600) / 60
        let secs = total % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        }
        return String(format: "%d:%02d", minutes, secs)
    }

    /// Formats an ISO 8601 duration for display; empty for live/unknown.
    static func clock(fromISO8601 raw: String) -> String {
        seconds(fromISO8601: raw).map(clock) ?? ""
    }
}
