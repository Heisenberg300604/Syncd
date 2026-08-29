/** Formats a number of seconds as `m:ss` or `h:mm:ss`. */
export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

const ISO_8601_DURATION_REGEX =
  /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/**
 * Converts the YouTube Data API's ISO 8601 duration ("PT3M45S") to `m:ss`.
 * Returns an empty string for live streams and unparseable values.
 */
export function formatIsoDuration(raw: string): string {
  const match = ISO_8601_DURATION_REGEX.exec(raw.trim());
  if (!match) return "";

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);

  const total = days * 86400 + hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? formatSeconds(total) : "";
}
