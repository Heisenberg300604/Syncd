import {
  YOUTUBE_VIDEO_ID_REGEX,
  sanitizeThumbnailUrl,
} from "../music/music.validation.js";
import type {
  PlaybackAction,
  PlaybackTrackInput,
} from "./playback.types.js";

const TITLE_MAX_LENGTH = 300;
const DURATION_MAX_LENGTH = 20;
const PLAYBACK_ACTIONS: PlaybackAction[] = ["play", "pause", "seek"];

export type TrackValidation =
  | { ok: true; value: PlaybackTrackInput }
  | { ok: false; message: string };

function asBoundedString(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.slice(0, max) : "";
}

/**
 * The socket payload is client-supplied, so nothing here is trusted. The video
 * id is enforced strictly, the thumbnail is checked against YouTube's image
 * hosts (it becomes an `<img src>` in every member's browser), and the
 * remaining display fields are clamped.
 *
 * Shared by `playback:set` and `queue:add` — a queued track is promoted to the
 * room's current track verbatim, so both entry points have to validate to the
 * same standard.
 */
export function validateTrackInput(raw: unknown): TrackValidation {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, message: "Track is required" };
  }

  const track = raw as Record<string, unknown>;
  const videoId = typeof track["videoId"] === "string" ? track["videoId"] : "";

  if (!YOUTUBE_VIDEO_ID_REGEX.test(videoId)) {
    return { ok: false, message: "Invalid video id" };
  }

  return {
    ok: true,
    value: {
      videoId,
      title: asBoundedString(track["title"], TITLE_MAX_LENGTH),
      thumbnailUrl: sanitizeThumbnailUrl(track["thumbnailUrl"]),
      duration: asBoundedString(track["duration"], DURATION_MAX_LENGTH),
    },
  };
}

export function isPlaybackAction(raw: unknown): raw is PlaybackAction {
  return (
    typeof raw === "string" &&
    (PLAYBACK_ACTIONS as string[]).includes(raw)
  );
}

export type SeekValidation =
  | { ok: true; value: number }
  | { ok: false; message: string };

/**
 * Validates and optionally clamps a seek position.
 *
 * - Rejects non-finite values (NaN, Infinity, non-numbers).
 * - Rejects negative positions.
 * - Clamps to `durationSeconds` when it is known and > 0 (positions slightly
 *   over the duration are common near the track end — clamp rather than reject).
 * - When `durationSeconds` is null (live stream or unknown), any finite
 *   non-negative value is accepted as-is.
 */
export function validateSeekPosition(
  raw: unknown,
  durationSeconds: number | null,
): SeekValidation {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return { ok: false, message: "Invalid seek position" };
  }

  if (raw < 0) {
    return { ok: false, message: "Seek position cannot be negative" };
  }

  if (durationSeconds !== null && durationSeconds > 0) {
    return { ok: true, value: Math.min(raw, durationSeconds) };
  }

  return { ok: true, value: raw };
}
