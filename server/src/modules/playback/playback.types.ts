export interface PlaybackTrackInput {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  /** ISO 8601 duration as returned by the YouTube Data API, e.g. "PT3M45S". */
  duration: string;
}

/**
 * The room's shared playback state.
 *
 * `position` is the playhead in seconds as of `updatedAt`. Clients that are
 * playing must add `serverTime - updatedAt` to it — comparing against their own
 * clock would drift by whatever their clock skew is.
 */
export interface PlaybackSnapshot {
  videoId: string | null;
  title: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  isPlaying: boolean;
  position: number;
  updatedAt: string | null;
  serverTime: string;
}

export type PlaybackAction = "play" | "pause" | "seek";

export interface PlaybackSetPayload {
  roomCode: string;
  track: PlaybackTrackInput;
}

export interface PlaybackControlPayload {
  roomCode: string;
  action: PlaybackAction;
  position: number;
}

export interface PlaybackClearPayload {
  roomCode: string;
}

export type PlaybackAck =
  | { ok: true; playback: PlaybackSnapshot }
  | { ok: false; message: string };
