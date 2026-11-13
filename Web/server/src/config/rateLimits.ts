import type { RateLimitRule } from "../middleware/rateLimit.js";

/**
 * Abuse ceilings, not usage quotas.
 *
 * Every value is well above what the UI can produce through normal use — the
 * point is to bound scripted abuse (YouTube quota burning, room-code guessing,
 * chat flooding), not to make the app feel throttled.
 */
export const REST_RATE_LIMITS = {
  /** `/me` — fetched once per session, plus retries and dev double-renders. */
  me: { limit: 60, windowMs: 60_000 },
  /** Profile creation is once-per-account; also a username-existence oracle. */
  createProfile: { limit: 10, windowMs: 10 * 60_000 },
  createRoom: { limit: 15, windowMs: 5 * 60_000 },
  /** The room-code guessing boundary: 30 tries per 5 min against 31^6 codes. */
  joinRoom: { limit: 30, windowMs: 5 * 60_000 },
  getRoom: { limit: 60, windowMs: 5 * 60_000 },
  leaveRoom: { limit: 60, windowMs: 5 * 60_000 },
  /** A YouTube search costs 100 quota units of a 10,000/day project budget. */
  musicSearch: { limit: 30, windowMs: 60_000 },
  /** Resolving a link costs 1 unit, so it can be looser than search. */
  musicVideo: { limit: 60, windowMs: 60_000 },
  /** Resolving a playlist costs 2 units and fetches up to 50 videos. */
  musicPlaylist: { limit: 15, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export const SOCKET_RATE_LIMITS = {
  /** Reconnect storms re-join; the client backs off, so this is generous. */
  roomJoin: { limit: 20, windowMs: 60_000 },
  /** Fast human typing is roughly one message per second. */
  chatSend: { limit: 15, windowMs: 10_000 },
  /** Play/pause/seek are discrete user actions plus player state echoes. */
  playback: { limit: 40, windowMs: 10_000 },
  /** Accommodates bulk-enqueuing up to 50 tracks when importing a playlist. */
  queue: { limit: 100, windowMs: 10_000 },
  hostTransfer: { limit: 10, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;
