import { useCallback, useEffect, useRef, useState } from "react";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import { formatSeconds } from "../utils/duration";
import type { PlaybackAction, PlaybackSnapshot } from "../services/types";
import type { PlayerState } from "../hooks/useYouTubePlayer";

interface YouTubePlayerProps {
  playback: PlaybackSnapshot | null;
  /** Null while the room socket is not connected. */
  onControl: ((action: PlaybackAction, position: number) => void) | null;
  onClear: () => void;
  syncError: string | null;
}

const stateLabels: Record<PlayerState, string> = {
  initialising: "Starting player...",
  idle: "Ready",
  buffering: "Buffering...",
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
    <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
      <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
        Now Playing
      </h2>

      <div className="space-y-4">
        {/*
          The container is always mounted. Rendering it only when a video is
          selected leaves the ref null when the player effect runs, and the
          IFrame player is then never constructed.
        */}
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
          <div
            ref={containerRef}
            className={`absolute inset-0 ${videoId ? "" : "invisible"}`}
          />
          {!videoId && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
              <svg
                className="h-12 w-12 text-zinc-700 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
                />
              </svg>
              <p className="text-sm text-zinc-500">
                Search for a song or paste a YouTube link to start watching
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
                className="h-16 w-24 rounded-lg object-cover flex-shrink-0 bg-zinc-800"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-white truncate">
                {playback?.title || "Untitled"}
              </h3>
              <p className="text-sm text-zinc-400">
                Playing for everyone in the room
              </p>
            </div>
            <button
              onClick={onClear}
              disabled={!onControl}
              className="text-xs text-zinc-400 hover:text-white transition-colors flex-shrink-0 disabled:opacity-50"
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
                className="h-10 w-10 rounded-full bg-violet-500 text-white flex items-center justify-center hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ) : (
                  <svg className="h-5 w-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>

              <span className="text-xs text-zinc-500 font-mono w-12 text-right">
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
                className="flex-1 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-violet-500 disabled:cursor-not-allowed"
                aria-label="Seek"
              />

              <span className="text-xs text-zinc-500 font-mono w-12">
                {formatSeconds(duration)}
              </span>
            </div>

            <p className="text-xs text-zinc-500">{stateLabels[player.state]}</p>
          </div>
        )}

        {message && <p className="text-sm text-red-400">{message}</p>}
      </div>
    </div>
  );
}
