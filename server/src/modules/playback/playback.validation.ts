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
