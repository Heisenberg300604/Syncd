export const SEARCH_QUERY_MIN_LENGTH = 1;
export const SEARCH_QUERY_MAX_LENGTH = 200;
export const SEARCH_MAX_RESULTS = 20;

export type SearchQueryValidation =
  | { ok: true; value: string }
  | { ok: false; message: string };

export function validateSearchQuery(raw: unknown): SearchQueryValidation {
  if (typeof raw !== "string") {
    return { ok: false, message: "Search query is required" };
  }

  const value = raw.trim();

  if (value.length < SEARCH_QUERY_MIN_LENGTH) {
    return { ok: false, message: "Search query is required" };
  }

  if (value.length > SEARCH_QUERY_MAX_LENGTH) {
    return {
      ok: false,
      message: `Search query must be at most ${SEARCH_QUERY_MAX_LENGTH} characters`,
    };
  }

  return { ok: true, value };
}
export const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTNAMES = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const YOUTUBE_SHORT_HOSTNAMES = new Set(["youtu.be", "www.youtu.be"]);

/** Path prefixes that carry the video id as the next path segment. */
const PATH_PREFIXES = ["embed", "shorts", "live", "v"];

export type VideoIdValidation =
  | { ok: true; value: string }
  | { ok: false; message: string };

/**
 * Accepts a YouTube watch/short/embed/shorts/live URL or a bare 11-character
 * video id and returns the video id.
 */
export function parseYouTubeVideoId(raw: unknown): VideoIdValidation {
  if (typeof raw !== "string") {
    return { ok: false, message: "A YouTube link is required" };
  }

  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, message: "A YouTube link is required" };
  }

  if (YOUTUBE_VIDEO_ID_REGEX.test(value)) {
    return { ok: true, value };
  }

  let url: URL;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    return { ok: false, message: "That does not look like a YouTube link" };
  }

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  let candidate: string | undefined;

  if (YOUTUBE_SHORT_HOSTNAMES.has(host)) {
    candidate = segments[0];
  } else if (YOUTUBE_HOSTNAMES.has(host)) {
    const queryId = url.searchParams.get("v");
    if (queryId) {
      candidate = queryId;
    } else if (segments[0] && PATH_PREFIXES.includes(segments[0])) {
      candidate = segments[1];
    }
  } else {
    return { ok: false, message: "Only YouTube links are supported" };
  }

  if (!candidate || !YOUTUBE_VIDEO_ID_REGEX.test(candidate)) {
    return {
      ok: false,
      message: "Could not find a video id in that link",
    };
  }

  return { ok: true, value: candidate };
}

export const YOUTUBE_PLAYLIST_ID_REGEX = /^[A-Za-z0-9_-]{2,100}$/;

export type PlaylistIdValidation =
  | { ok: true; value: string }
  | { ok: false; message: string };

/**
 * Returns true if a URL contains a `list=` parameter on a YouTube hostname.
 */
export function isPlaylistUrl(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const value = raw.trim();
  if (!value) return false;

  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    const host = url.hostname.toLowerCase();
    if (!YOUTUBE_HOSTNAMES.has(host) && !YOUTUBE_SHORT_HOSTNAMES.has(host)) {
      return false;
    }
    return url.searchParams.has("list");
  } catch {
    return false;
  }
}

/**
 * Accepts a YouTube playlist URL (e.g. /playlist?list=PLxxx, /watch?v=...&list=PLxxx, youtu.be/...&list=PLxxx)
 * or a bare playlist id, and returns the playlist id.
 */
export function parseYouTubePlaylistId(raw: unknown): PlaylistIdValidation {
  if (typeof raw !== "string") {
    return { ok: false, message: "A YouTube playlist link is required" };
  }

  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, message: "A YouTube playlist link is required" };
  }

  if (/^(PL|UU|LL|FL|RD|OLAK)[A-Za-z0-9_-]{10,}$/.test(value)) {
    return { ok: true, value };
  }

  let url: URL;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    return { ok: false, message: "That does not look like a YouTube link" };
  }

  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTNAMES.has(host) && !YOUTUBE_SHORT_HOSTNAMES.has(host)) {
    return { ok: false, message: "Only YouTube links are supported" };
  }

  const candidate = url.searchParams.get("list");
  if (!candidate || !YOUTUBE_PLAYLIST_ID_REGEX.test(candidate)) {
    return {
      ok: false,
      message: "Could not find a playlist id in that link",
    };
  }

  return { ok: true, value: candidate };
}

const ISO_8601_DURATION_REGEX =
  /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/**
 * Converts a YouTube `contentDetails.duration` value ("PT3M45S") to seconds.
 * Returns null for live streams ("P0D") and anything unparseable.
 */
export function parseIso8601DurationToSeconds(raw: string): number | null {
  const match = ISO_8601_DURATION_REGEX.exec(raw.trim());
  if (!match) return null;

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);

  const total = days * 86400 + hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

/**
 * Hosts YouTube serves thumbnail images from. Everything reaching the room's
 * `thumbnailUrl` originates here, either from `music.service` or from the same
 * payload echoed back by the client.
 */
const THUMBNAIL_HOST_SUFFIXES = ["ytimg.com", "ggpht.com", "youtube.com"];

/**
 * Thumbnail URLs arrive inside client-supplied socket payloads and are rendered
 * as an `<img src>` in every room member's browser. Left unchecked, whoever
 * holds the host role could point the whole room at an arbitrary URL and
 * collect their IP addresses and user agents. Anything that is not an https
 * YouTube image URL is dropped — the UI already copes with a missing thumbnail.
 */
export function sanitizeThumbnailUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";

  const value = raw.trim();
  if (value.length === 0 || value.length > 500) return "";

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "";
  }

  if (url.protocol !== "https:") return "";

  const host = url.hostname.toLowerCase();
  const allowed = THUMBNAIL_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );

  return allowed ? url.toString() : "";
}
