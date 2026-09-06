import { useCallback, useEffect, useRef, useState } from "react";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import { formatSeconds } from "../utils/duration";
import type { PlaybackAction, PlaybackSnapshot } from "../services/types";
import type { PlayerState } from "../hooks/useYouTubePlayer";
import { Card } from "./ui/Card";
import { EqualizerBars } from "./ui/EqualizerBars";

interface YouTubePlayerProps {
  playback: PlaybackSnapshot | null;
  /** Null while the room socket is not connected. */
  onControl: ((action: PlaybackAction, position: number) => void) | null;
  onClear: () => void;
  syncError: string | null;
}

const stateLabels: Record<PlayerState, string> = {
  initialising: "Starting player…",
  idle: "Ready",
  buffering: "Buffering…",
  playing: "Playing",
  paused: "Paused",
  ended: "Ended",
  error: "Error",
};

/** How far the local playhead may drift from the room before we correct it. */
const DRIFT_TOLERANCE_SECONDS = 2;
const DRIFT_CHECK_INTERVAL_MS = 5000;
/** Ignore our own state changes for this long after applying a remote one. */
const ECHO_SUPPRESSION_MS = 1000;

/**
 * Derives the playhead at the instant the snapshot was produced.
 *
 * Both timestamps come from the server, so the difference is free of client
 * clock skew.
 */
function positionAtSnapshot(playback: PlaybackSnapshot): number {
  if (!playback.isPlaying || !playback.updatedAt) return playback.position;
  const elapsedMs =
    Date.parse(playback.serverTime) - Date.parse(playback.updatedAt);
  if (!Number.isFinite(elapsedMs)) return playback.position;
  return playback.position + Math.max(0, elapsedMs / 1000);
}

export function YouTubePlayer({
  playback,
  onControl,
  onClear,
  syncError,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Set whenever we act on a remote snapshot, so the resulting player events
  // are not echoed back to the room as if the local user had caused them.
  const suppressEmitUntil = useRef(0);
  // Where the room's playhead was, and when we observed it locally.
  const anchor = useRef<{ position: number; atMs: number } | null>(null);
  const appliedVideoId = useRef<string | null>(null);
  const [scrubbing, setScrubbing] = useState<number | null>(null);

  const handleLocalStateChange = useCallback(
    (state: PlayerState, at: number) => {
      if (!onControl) return;
      if (Date.now() < suppressEmitUntil.current) return;
      if (state === "playing") onControl("play", at);
      else if (state === "paused") onControl("pause", at);
    },
    [onControl],
  );

  const player = useYouTubePlayer(containerRef, {
    onStateChange: handleLocalStateChange,
  });

  const { ready, loadVideo, play, pause, seekTo, getCurrentTime } = player;
  const videoId = playback?.videoId ?? null;

  // Apply the room's playback state to the local player.
  useEffect(() => {
    if (!ready) return;

    if (!playback || !playback.videoId) {
      appliedVideoId.current = null;
      anchor.current = null;
      return;
    }

    const target = positionAtSnapshot(playback);
    suppressEmitUntil.current = Date.now() + ECHO_SUPPRESSION_MS;
    anchor.current = { position: target, atMs: Date.now() };

    if (appliedVideoId.current !== playback.videoId) {
      appliedVideoId.current = playback.videoId;
      loadVideo(playback.videoId, target);
      if (!playback.isPlaying) pause();
      return;
    }

    if (Math.abs(getCurrentTime() - target) > DRIFT_TOLERANCE_SECONDS) {
      seekTo(target);
    }

    if (playback.isPlaying) play();
    else pause();
  }, [ready, playback, loadVideo, play, pause, seekTo, getCurrentTime]);

  // Nudge the local playhead back in line if it drifts away from the room.
  useEffect(() => {
    if (!ready || !playback?.isPlaying || player.state !== "playing") return;

    const interval = setInterval(() => {
      const current = anchor.current;
      if (!current) return;
      const expected = current.position + (Date.now() - current.atMs) / 1000;
      if (Math.abs(getCurrentTime() - expected) > DRIFT_TOLERANCE_SECONDS) {
        suppressEmitUntil.current = Date.now() + ECHO_SUPPRESSION_MS;
        seekTo(expected);
      }
    }, DRIFT_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [ready, playback?.isPlaying, player.state, getCurrentTime, seekTo]);

  const duration = player.duration || playback?.duration || 0;
  const displayedTime = scrubbing ?? player.currentTime;
  const isPlaying = player.state === "playing";
  const controlsDisabled = !ready || !videoId || !onControl;

  function handleToggle() {
    if (!onControl) return;
    const at = getCurrentTime();
    if (isPlaying) {
      pause();
      onControl("pause", at);
    } else {
      play();
      onControl("play", at);
    }
  }

  function commitSeek(value: number) {
    setScrubbing(null);
    seekTo(value);
    anchor.current = { position: value, atMs: Date.now() };
    suppressEmitUntil.current = Date.now() + ECHO_SUPPRESSION_MS;
    onControl?.("seek", value);
  }

  const message = syncError ?? player.error;

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Now playing
        </h2>
        {videoId && isPlaying && (
          <span className="flex items-center gap-1.5 text-xs text-accent">
            <EqualizerBars className="h-3" />
            Live
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/*
          The container is always mounted. Rendering it only when a video is
          selected leaves the ref null when the player effect runs, and the
          IFrame player is then never constructed.
        */}
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          <div
            ref={containerRef}
            className={`absolute inset-0 ${videoId ? "" : "invisible"}`}
          />
          {!videoId && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <svg
                className="mb-3 h-11 w-11 text-ink-faint"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 18V5l12-3v13M9 18c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3zm12-3c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z"
                />
              </svg>
              <p className="text-sm text-ink-muted">
                Search for a song or paste a YouTube link to start listening
                together.
              </p>
            </div>
          )}
        </div>

        {videoId && (
          <div className="flex items-start gap-4">
            {playback?.thumbnailUrl && (
              <img
                src={playback.thumbnailUrl}
                alt=""
                className="h-16 w-24 shrink-0 rounded-md bg-white/5 object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-ink">
                {playback?.title || "Untitled"}
              </h3>
              <p className="text-sm text-ink-muted">
                Playing for everyone in the room
              </p>
            </div>
            <button
              onClick={onClear}
              disabled={!onControl}
              className="shrink-0 text-xs text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        )}

        {videoId && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggle}
                disabled={controlsDisabled}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-colors hover:bg-accent-hi disabled:opacity-50 disabled:pointer-events-none"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                ) : (
                  <svg className="ml-0.5 h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>

              <span className="w-12 text-right font-mono text-xs text-ink-faint">
                {formatSeconds(displayedTime)}
              </span>

              <input
                type="range"
                min={0}
                max={duration || 0}
                step={1}
                value={Math.min(displayedTime, duration || 0)}
                disabled={controlsDisabled || duration === 0}
                onChange={(e) => setScrubbing(Number(e.target.value))}
                onMouseUp={(e) => commitSeek(Number(e.currentTarget.value))}
                onTouchEnd={(e) => commitSeek(Number(e.currentTarget.value))}
                onKeyUp={(e) => commitSeek(Number(e.currentTarget.value))}
                className="syncd-range flex-1"
                aria-label="Seek"
              />

              <span className="w-12 font-mono text-xs text-ink-faint">
                {formatSeconds(duration)}
              </span>
            </div>

            <p className="text-xs text-ink-faint">{stateLabels[player.state]}</p>
          </div>
        )}

        {message && <p className="text-sm text-danger">{message}</p>}
      </div>
    </Card>
  );
}
