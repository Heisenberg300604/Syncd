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
  /** Called when the host's local player reaches the end of a track. */
  onEnded?: () => void;
  /** Called when the host skips to the next track. */
  onSkip?: () => void;
  /** Called when the host navigates back to the previous track. */
  onPrevious?: () => void;
  /** Whether there is a previous track to navigate back to. */
  canPrevious?: boolean;
  /** Whether there are items in the queue to skip to. */
  hasQueue?: boolean;
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
const ECHO_SUPPRESSION_MS = 2000;

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatQualityBadge(rawQuality: string): string {
  switch (rawQuality) {
    case "highres":
    case "hd2160":
      return "4K";
    case "hd1440":
      return "1440p";
    case "hd1080":
      return "1080p";
    case "hd720":
      return "720p";
    case "large":
      return "480p";
    case "medium":
      return "360p";
    case "small":
      return "240p";
    case "tiny":
      return "144p";
    case "auto":
    case "default":
      return "Auto";
    default:
      return rawQuality ? rawQuality.toUpperCase() : "Auto";
  }
}

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
  onEnded,
  onSkip,
  onPrevious,
  canPrevious = false,
  hasQueue = false,
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

  // Looper state
  const [isLooping, setIsLooping] = useState(false);
  const isLoopingRef = useRef(isLooping);
  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  // Keyboard shortcuts info popover
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const shortcutsModalRef = useRef<HTMLDivElement>(null);

  // Volume state (local to each user, persisted in localStorage)
  const [volume, setVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem("syncd_volume");
    if (saved !== null) {
      const parsed = Number(saved);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 100) return parsed;
    }
    return 80;
  });

  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem("syncd_muted") === "true";
  });

  // Playback speed state
  const [playbackRate, setPlaybackRateState] = useState<number>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const speedMenuRef = useRef<HTMLDivElement>(null);

  const playerRef = useRef<{
    seekTo: (pos: number) => void;
    play: () => void;
  } | null>(null);

  const handleLocalStateChange = useCallback(
    (state: PlayerState, at: number) => {
      // "ended" is never an echo of a remote command — always fire it so the
      // queue can advance, unless looping is enabled!
      if (state === "ended") {
        if (isLoopingRef.current) {
          playerRef.current?.seekTo(0);
          playerRef.current?.play();
          if (onControl) {
            onControl("seek", 0);
            onControl("play", 0);
          }
          return;
        }
        onEnded?.();
        return;
      }

      if (!onControl) return;
      if (!playback?.videoId) return;
      if (Date.now() < suppressEmitUntil.current) return;
      if (state === "playing") onControl("play", at);
      else if (state === "paused") onControl("pause", at);
    },
    [onControl, onEnded, playback?.videoId],
  );

  const player = useYouTubePlayer(containerRef, {
    onStateChange: handleLocalStateChange,
  });

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  const {
    ready,
    loadVideo,
    cueVideo,
    play,
    pause,
    stopVideo,
    seekTo,
    getCurrentTime,
    setVolume,
    mute,
    unMute,
    setPlaybackRate,
    playbackQuality,
  } = player;
  const videoId = playback?.videoId ?? null;

  // Apply the room's playback state to the local player.
  useEffect(() => {
    if (!playback || !playback.videoId) {
      if (appliedVideoId.current !== null) {
        appliedVideoId.current = null;
        anchor.current = null;
        suppressEmitUntil.current = Date.now() + ECHO_SUPPRESSION_MS;
        stopVideo();
      }
      return;
    }

    if (!ready) return;

    const target = positionAtSnapshot(playback);
    suppressEmitUntil.current = Date.now() + ECHO_SUPPRESSION_MS;
    anchor.current = { position: target, atMs: Date.now() };

    if (appliedVideoId.current !== playback.videoId) {
      appliedVideoId.current = playback.videoId;
      if (playback.isPlaying) {
        loadVideo(playback.videoId, target);
      } else {
        // cueVideoById loads without auto-playing, avoiding the race where
        // pause() fires before the player has buffered the new video.
        cueVideo(playback.videoId, target);
      }
      return;
    }

    if (Math.abs(getCurrentTime() - target) > DRIFT_TOLERANCE_SECONDS) {
      seekTo(target);
    }

    if (playback.isPlaying) play();
    else pause();
  }, [
    ready,
    playback,
    loadVideo,
    cueVideo,
    play,
    pause,
    stopVideo,
    seekTo,
    getCurrentTime,
  ]);

  // Keep the local player matching the room — both whether it is playing and
  // where the playhead is.
  //
  // A snapshot only arrives when the host acts, so a player that diverged in
  // between would stay diverged until the host's next command: a blocked
  // autoplay, a stalled buffer, a sleeping tab or a pause that arrived before
  // the player was ready would all leave someone out of sync with no way back.
  // Reconciling on a timer means the room's state always wins, eventually.
  useEffect(() => {
    if (!ready || !playback?.videoId) return;

    const interval = setInterval(() => {
      // Mid-load: the apply effect owns this until the new video has landed.
      if (appliedVideoId.current !== playback.videoId) return;

      if (!playback.isPlaying) {
        if (player.state === "playing") {
          suppressEmitUntil.current = Date.now() + ECHO_SUPPRESSION_MS;
          pause();
        }
        return;
      }

      if (player.state === "paused" || player.state === "idle") {
        suppressEmitUntil.current = Date.now() + ECHO_SUPPRESSION_MS;
        play();
        return;
      }

      if (player.state !== "playing") return;

      const current = anchor.current;
      if (!current) return;
      const expected =
        current.position +
        ((Date.now() - current.atMs) / 1000) * playbackRate;
      if (Math.abs(getCurrentTime() - expected) > DRIFT_TOLERANCE_SECONDS) {
        suppressEmitUntil.current = Date.now() + ECHO_SUPPRESSION_MS;
        seekTo(expected);
      }
    }, DRIFT_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [
    ready,
    playback,
    player.state,
    getCurrentTime,
    seekTo,
    play,
    pause,
    playbackRate,
  ]);

  // Synchronize volume and mute state with YouTube player
  useEffect(() => {
    if (!ready) return;
    if (isMuted) {
      mute();
    } else {
      unMute();
      setVolume(volume);
    }
  }, [ready, volume, isMuted, mute, unMute, setVolume]);

  const handleVolumeChange = useCallback(
    (newVol: number) => {
      const clamped = Math.max(0, Math.min(100, newVol));
      setVolumeState(clamped);
      localStorage.setItem("syncd_volume", String(clamped));
      if (clamped === 0) {
        setIsMuted(true);
        localStorage.setItem("syncd_muted", "true");
        mute();
      } else {
        if (isMuted) {
          setIsMuted(false);
          localStorage.setItem("syncd_muted", "false");
          unMute();
        }
        setVolume(clamped);
      }
    },
    [isMuted, mute, unMute, setVolume],
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem("syncd_muted", String(next));
      if (next) {
        mute();
      } else {
        unMute();
        const effectiveVol = volume === 0 ? 50 : volume;
        if (volume === 0) {
          setVolumeState(50);
          localStorage.setItem("syncd_volume", "50");
        }
        setVolume(effectiveVol);
      }
      return next;
    });
  }, [mute, unMute, setVolume, volume]);

  // Synchronize playback speed with YouTube player
  useEffect(() => {
    if (!ready) return;
    setPlaybackRate(playbackRate);
  }, [ready, playbackRate, setPlaybackRate]);

  const handleSpeedChange = useCallback(
    (rate: number) => {
      setPlaybackRateState(rate);
      setPlaybackRate(rate);
      anchor.current = { position: getCurrentTime(), atMs: Date.now() };
    },
    [getCurrentTime, setPlaybackRate],
  );

  // Close speed popover on outside click
  useEffect(() => {
    if (!showSpeedMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        speedMenuRef.current &&
        !speedMenuRef.current.contains(e.target as Node)
      ) {
        setShowSpeedMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSpeedMenu]);

  const duration = player.duration || playback?.duration || 0;
  const displayedTime = scrubbing ?? player.currentTime;
  const isPlaying = player.state === "playing";
  const controlsDisabled = !ready || !videoId || !onControl;

  // The room is playing but this player is not, which in practice means the
  // browser refused to start audio without a gesture. The transport controls
  // belong to the host, so everyone else needs a way back into sync that is
  // not a room command.
  const needsTapToPlay =
    Boolean(videoId) &&
    ready &&
    playback?.isPlaying === true &&
    (player.state === "paused" || player.state === "idle");

  const [actionRipple, setActionRipple] = useState<"play" | "pause" | null>(null);
  const rippleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerActionRipple = useCallback((action: "play" | "pause") => {
    if (rippleTimerRef.current) clearTimeout(rippleTimerRef.current);
    setActionRipple(action);
    rippleTimerRef.current = setTimeout(() => {
      setActionRipple(null);
    }, 650);
  }, []);

  function handleTapToPlay() {
    // Catch-up only: the room already believes this is playing, so this must
    // not be echoed back to it as a new command.
    suppressEmitUntil.current = Date.now() + ECHO_SUPPRESSION_MS;
    play();
    triggerActionRipple("play");
  }

  function handleClear() {
    suppressEmitUntil.current = Date.now() + ECHO_SUPPRESSION_MS;
    appliedVideoId.current = null;
    anchor.current = null;
    stopVideo();
    onClear();
  }

  function handleToggle() {
    if (!onControl) return;
    const at = getCurrentTime();
    // Suppress the onStateChange echo that play()/pause() will trigger below,
    // so only the single explicit onControl() call is emitted to the server.
    suppressEmitUntil.current = Date.now() + ECHO_SUPPRESSION_MS;
    if (isPlaying) {
      pause();
      onControl("pause", at);
      triggerActionRipple("pause");
    } else {
      play();
      onControl("play", at);
      triggerActionRipple("play");
    }
  }

  function handleSurfaceClick() {
    if (needsTapToPlay) {
      handleTapToPlay();
    } else if (!controlsDisabled) {
      handleToggle();
    }
  }

  function commitSeek(value: number) {
    const clamped = Math.max(0, Math.min(duration || 0, value));
    setScrubbing(null);
    seekTo(clamped);
    anchor.current = { position: clamped, atMs: Date.now() };
    suppressEmitUntil.current = Date.now() + ECHO_SUPPRESSION_MS;
    onControl?.("seek", clamped);
  }

  function handleJump(seconds: number) {
    if (controlsDisabled) return;
    commitSeek(displayedTime + seconds);
  }

  // Close shortcuts popover on outside click
  useEffect(() => {
    if (!showShortcutsModal) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        shortcutsModalRef.current &&
        !shortcutsModalRef.current.contains(e.target as Node)
      ) {
        setShowShortcutsModal(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showShortcutsModal]);

  // Keep refs up-to-date for global keyboard shortcuts
  const handleToggleRef = useRef(handleToggle);
  useEffect(() => { handleToggleRef.current = handleToggle; });

  const handleTapToPlayRef = useRef(handleTapToPlay);
  useEffect(() => { handleTapToPlayRef.current = handleTapToPlay; });

  const handleJumpRef = useRef(handleJump);
  useEffect(() => { handleJumpRef.current = handleJump; });

  const handleVolumeChangeRef = useRef(handleVolumeChange);
  useEffect(() => { handleVolumeChangeRef.current = handleVolumeChange; });

  const toggleMuteRef = useRef(toggleMute);
  useEffect(() => { toggleMuteRef.current = toggleMute; });

  const handleSpeedChangeRef = useRef(handleSpeedChange);
  useEffect(() => { handleSpeedChangeRef.current = handleSpeedChange; });

  const onSkipRef = useRef(onSkip);
  useEffect(() => { onSkipRef.current = onSkip; });

  const onPreviousRef = useRef(onPrevious);
  useEffect(() => { onPreviousRef.current = onPrevious; });

  const canPreviousRef = useRef(canPrevious);
  useEffect(() => { canPreviousRef.current = canPrevious; });

  const volumeRef = useRef(volume);
  useEffect(() => { volumeRef.current = volume; });

  const playbackRateRef = useRef(playbackRate);
  useEffect(() => { playbackRateRef.current = playbackRate; });

  const controlsDisabledRef = useRef(controlsDisabled);
  useEffect(() => { controlsDisabledRef.current = controlsDisabled; });

  const needsTapToPlayRef = useRef(needsTapToPlay);
  useEffect(() => { needsTapToPlayRef.current = needsTapToPlay; });

  // Global keyboard shortcuts listener for the room and player controls
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if user is typing in an input, textarea, select, or contentEditable
      if (
        e.target instanceof HTMLElement &&
        (e.target.tagName === "INPUT" ||
          e.target.tagName === "TEXTAREA" ||
          e.target.tagName === "SELECT" ||
          e.target.isContentEditable ||
          Boolean(e.target.closest("input, textarea, select, [contenteditable='true']")))
      ) {
        return;
      }

      // Ignore if modifier keys (Ctrl, Alt, Meta) are held (e.g. Ctrl+R, Ctrl+T)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key.toLowerCase();

      // Play / Pause : Space
      if (e.code === "Space" || key === " ") {
        e.preventDefault();
        if (!controlsDisabledRef.current) {
          handleToggleRef.current();
        } else if (needsTapToPlayRef.current) {
          handleTapToPlayRef.current();
        }
        return;
      }

      // 10sec Backward : Left Arrow
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        if (!controlsDisabledRef.current) {
          handleJumpRef.current(-10);
        }
        return;
      }

      // 10sec Forward : Right Arrow
      if (e.code === "ArrowRight") {
        e.preventDefault();
        if (!controlsDisabledRef.current) {
          handleJumpRef.current(10);
        }
        return;
      }

      // Playback Speed : Q (decrease) - E (increase)
      if (key === "q") {
        e.preventDefault();
        const currentRate = playbackRateRef.current;
        const idx = SPEED_OPTIONS.indexOf(currentRate);
        const nextIdx = idx > 0 ? idx - 1 : 0;
        handleSpeedChangeRef.current(SPEED_OPTIONS[nextIdx]);
        return;
      }

      if (key === "e") {
        e.preventDefault();
        const currentRate = playbackRateRef.current;
        const idx = SPEED_OPTIONS.indexOf(currentRate);
        const nextIdx =
          idx >= 0 && idx < SPEED_OPTIONS.length - 1
            ? idx + 1
            : idx === -1
              ? 2
              : SPEED_OPTIONS.length - 1;
        handleSpeedChangeRef.current(SPEED_OPTIONS[nextIdx]);
        return;
      }

      // Video Skipper : T
      if (key === "t") {
        e.preventDefault();
        if (!controlsDisabledRef.current && onSkipRef.current) {
          onSkipRef.current();
        }
        return;
      }

      // Previous Video : Y
      if (key === "y") {
        e.preventDefault();
        if (
          !controlsDisabledRef.current &&
          canPreviousRef.current &&
          onPreviousRef.current
        ) {
          onPreviousRef.current();
        }
        return;
      }

      // Looper : R
      if (key === "r") {
        e.preventDefault();
        if (!controlsDisabledRef.current) {
          setIsLooping((prev) => !prev);
        }
        return;
      }

      // Volume : A (decrease) - D (increase)
      if (key === "a") {
        e.preventDefault();
        handleVolumeChangeRef.current(volumeRef.current - 5);
        return;
      }

      if (key === "d") {
        e.preventDefault();
        handleVolumeChangeRef.current(volumeRef.current + 5);
        return;
      }

      // Mute : M
      if (key === "m") {
        e.preventDefault();
        toggleMuteRef.current();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const message = syncError ?? player.error;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Now playing
          </h2>
          {isLooping && videoId && (
            <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent ring-1 ring-accent/30 animate-pulse">
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 4h2a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H5m0 0l3-3m-3 3l3 3M8 20H6a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3h13m0 0l-3-3m3 3l-3 3" />
              </svg>
              Loop
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Shortcuts Info Button & Popover */}
          <div className="relative" ref={shortcutsModalRef}>
            <button
              type="button"
              onClick={() => setShowShortcutsModal((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-md border border-line bg-white/5 px-2 py-0.5 text-[11px] font-medium text-ink-muted transition-colors hover:border-accent/40 hover:bg-white/10 hover:text-ink active:scale-95"
              title="Keyboard Shortcuts"
              aria-label="Keyboard shortcuts"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <rect x="2" y="4" width="20" height="16" rx="2.5" />
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" strokeLinecap="round" />
              </svg>
              <span className="hidden sm:inline">Shortcuts</span>
            </button>

            {showShortcutsModal && (
              <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-xl border border-line-strong bg-[#161618] p-4 shadow-2xl">
                <div className="mb-3 flex items-center justify-between border-b border-line pb-2.5">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <rect x="2" y="4" width="20" height="16" rx="2.5" />
                      <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" strokeLinecap="round" />
                    </svg>
                    <span className="text-xs font-bold uppercase tracking-wider text-ink">
                      Keyboard Shortcuts
                    </span>
                  </div>
                  <button
                    onClick={() => setShowShortcutsModal(false)}
                    className="rounded-full p-1 text-ink-muted hover:bg-white/10 hover:text-ink transition-colors"
                    aria-label="Close shortcuts"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
                    <span className="font-medium text-ink">Play / Pause</span>
                    <kbd className="inline-flex min-w-12.5 items-center justify-center rounded-md border border-line-strong bg-white/10 px-2.5 py-0.5 font-mono text-xs font-bold text-accent shadow-sm">
                      Space
                    </kbd>
                  </div>

                  <div className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
                    <span className="font-medium text-ink">10s Forward / Back</span>
                    <span className="flex items-center gap-1.5">
                      <kbd className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-line-strong bg-white/10 font-mono text-xs font-bold text-accent shadow-sm">
                        ←
                      </kbd>
                      <kbd className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-line-strong bg-white/10 font-mono text-xs font-bold text-accent shadow-sm">
                        →
                      </kbd>
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
                    <span className="font-medium text-ink">Playback Speed</span>
                    <span className="flex items-center gap-1.5">
                      <kbd className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-line-strong bg-white/10 font-mono text-xs font-bold text-accent shadow-sm">
                        Q
                      </kbd>
                      <kbd className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-line-strong bg-white/10 font-mono text-xs font-bold text-accent shadow-sm">
                        E
                      </kbd>
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
                    <span className="font-medium text-ink">Skip Video</span>
                    <kbd className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-line-strong bg-white/10 font-mono text-xs font-bold text-accent shadow-sm">
                      T
                    </kbd>
                  </div>

                  <div className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
                    <span className="font-medium text-ink">Previous Video</span>
                    <kbd className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-line-strong bg-white/10 font-mono text-xs font-bold text-accent shadow-sm">
                      Y
                    </kbd>
                  </div>

                  <div className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
                    <span className="font-medium text-ink">Loop Video</span>
                    <kbd className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-line-strong bg-white/10 font-mono text-xs font-bold text-accent shadow-sm">
                      R
                    </kbd>
                  </div>

                  <div className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
                    <span className="font-medium text-ink">Volume Down / Up</span>
                    <span className="flex items-center gap-1.5">
                      <kbd className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-line-strong bg-white/10 font-mono text-xs font-bold text-accent shadow-sm">
                        A
                      </kbd>
                      <kbd className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-line-strong bg-white/10 font-mono text-xs font-bold text-accent shadow-sm">
                        D
                      </kbd>
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
                    <span className="font-medium text-ink">Mute / Unmute</span>
                    <kbd className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-line-strong bg-white/10 font-mono text-xs font-bold text-accent shadow-sm">
                      M
                    </kbd>
                  </div>
                </div>
              </div>
            )}
          </div>

          {videoId && isPlaying && (
            <span className="flex items-center gap-1.5 text-xs text-accent">
              <EqualizerBars className="h-3" />
              Live
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
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

          {/*
            Covers the iframe so a click cannot toggle YouTube's own playback.
            With the control bar disabled the video surface is the last way to
            drive the embed directly, and a member doing that would silently
            fall out of sync with the room.
          */}
          {videoId && (
            <div
              onClick={handleSurfaceClick}
              className={`absolute inset-0 flex items-center justify-center transition-colors ${
                !controlsDisabled || needsTapToPlay
                  ? "cursor-pointer"
                  : ""
              }`}
            >
              {/* Animated Play / Pause Feedback Ripple */}
              {actionRipple && (
                <div className="pointer-events-none animate-ping duration-500 flex h-20 w-20 items-center justify-center rounded-full bg-black/70 text-white shadow-2xl backdrop-blur-md">
                  {actionRipple === "play" ? (
                    <svg className="h-10 w-10 text-accent" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6.5 5.11c0-.94 1.02-1.53 1.83-1.05l11.05 6.39a1.22 1.22 0 0 1 0 2.1l-11.05 6.39c-.81.48-1.83-.11-1.83-1.05V5.11Z" />
                    </svg>
                  ) : (
                    <svg className="h-10 w-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6.75 5.25a1.25 1.25 0 0 1 1.25 1.25v11a1.25 1.25 0 0 1-2.5 0v-11a1.25 1.25 0 0 1 1.25-1.25Zm10.5 0a1.25 1.25 0 0 1 1.25 1.25v11a1.25 1.25 0 0 1-2.5 0v-11a1.25 1.25 0 0 1 1.25-1.25Z" />
                    </svg>
                  )}
                </div>
              )}

              {/* Tap To Play Button (Autoplay Catch-up or when Paused) */}
              {(needsTapToPlay || (!isPlaying && !controlsDisabled)) && !actionRipple && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (needsTapToPlay) {
                      handleTapToPlay();
                    } else {
                      handleToggle();
                    }
                  }}
                  className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink shadow-2xl transition-all hover:bg-accent-hi hover:scale-105 active:scale-95"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6.5 5.11c0-.94 1.02-1.53 1.83-1.05l11.05 6.39a1.22 1.22 0 0 1 0 2.1l-11.05 6.39c-.81.48-1.83-.11-1.83-1.05V5.11Z" />
                  </svg>
                  Tap to play
                </button>
              )}
            </div>
          )}
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
                className="h-12 w-16 shrink-0 rounded-md bg-white/5 object-cover"
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
              onClick={handleClear}
              disabled={!onControl}
              className="shrink-0 text-xs text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        )}

        {videoId && (
          <div className="space-y-3 pt-1">
            {/* Progress / Seek bar row */}
            <div className="flex items-center gap-3">
              <span className="w-12 text-right font-mono text-xs text-ink-muted">
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
                onKeyUp={(e) => {
                  const key = e.key;
                  if (
                    key === "ArrowLeft" ||
                    key === "ArrowRight" ||
                    key === "Home" ||
                    key === "End"
                  ) {
                    commitSeek(Number(e.currentTarget.value));
                  }
                }}
                className="syncd-range flex-1 cursor-pointer"
                aria-label="Seek"
              />

              <span className="w-12 font-mono text-xs text-ink-muted">
                {formatSeconds(duration)}
              </span>
            </div>

            {/* Playback Controls Deck */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-2.5">
              {/* Left: Previous, Rewind 10s, Play/Pause, Forward 10s, Skip Video, Looper, State */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Previous Video (Y) */}
                <button
                  type="button"
                  onClick={onPrevious}
                  disabled={!onPrevious || !canPrevious || controlsDisabled}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-all hover:bg-white/10 hover:text-ink active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                  aria-label="Previous video"
                  title={canPrevious ? "Previous video (Y)" : "No previous video"}
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                  </svg>
                </button>

                {/* 10s Rewind (Left Arrow) */}
                <button
                  type="button"
                  onClick={() => handleJump(-10)}
                  disabled={controlsDisabled}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-all hover:bg-white/10 hover:text-ink active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                  aria-label="Rewind 10 seconds"
                  title="Rewind 10s (←)"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12.5 4.5V1.5L8.5 5.5l4 4V6.5a7 7 0 1 1-6.5 9.6"
                    />
                    <text
                      x="12"
                      y="14.2"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="6.5"
                      fontWeight="700"
                      fill="currentColor"
                      stroke="none"
                      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
                    >
                      10
                    </text>
                  </svg>
                </button>

                {/* Primary Play / Pause button (Space) */}
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={controlsDisabled}
                  className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-ink shadow-md shadow-accent/25 transition-all hover:bg-accent-hi hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  aria-label={isPlaying ? "Pause" : "Play"}
                  title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                >
                  {isPlaying ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6.75 5.25a1.25 1.25 0 0 1 1.25 1.25v11a1.25 1.25 0 0 1-2.5 0v-11a1.25 1.25 0 0 1 1.25-1.25Zm10.5 0a1.25 1.25 0 0 1 1.25 1.25v11a1.25 1.25 0 0 1-2.5 0v-11a1.25 1.25 0 0 1 1.25-1.25Z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6.5 5.11c0-.94 1.02-1.53 1.83-1.05l11.05 6.39a1.22 1.22 0 0 1 0 2.1l-11.05 6.39c-.81.48-1.83-.11-1.83-1.05V5.11Z" />
                    </svg>
                  )}
                </button>

                {/* 10s Forward (Right Arrow) */}
                <button
                  type="button"
                  onClick={() => handleJump(10)}
                  disabled={controlsDisabled}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-all hover:bg-white/10 hover:text-ink active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                  aria-label="Fast-forward 10 seconds"
                  title="Forward 10s (→)"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.5 4.5V1.5l4 4-4 4V6.5a7 7 0 1 0 6.5 9.6"
                    />
                    <text
                      x="12"
                      y="14.2"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="6.5"
                      fontWeight="700"
                      fill="currentColor"
                      stroke="none"
                      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
                    >
                      10
                    </text>
                  </svg>
                </button>

                {/* Video Skipper (Skip to next video: T) */}
                <button
                  type="button"
                  onClick={onSkip}
                  disabled={!onSkip || controlsDisabled}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-all hover:bg-white/10 hover:text-ink active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                  aria-label="Skip to next video"
                  title={hasQueue ? "Skip to next video (T)" : "Skip current video (T)"}
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z" />
                  </svg>
                </button>

                {/* Video Looper (R) */}
                <button
                  type="button"
                  onClick={() => setIsLooping((prev) => !prev)}
                  disabled={controlsDisabled}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-30 ${
                    isLooping
                      ? "bg-accent/15 text-accent ring-1 ring-accent/50 shadow-[0_0_8px_rgba(245,158,11,0.25)]"
                      : "text-ink-muted hover:bg-white/10 hover:text-ink"
                  }`}
                  aria-label={isLooping ? "Disable looping" : "Loop current video"}
                  title={isLooping ? "Looper: ON (R) — click to disable" : "Looper: OFF (R) — click to loop"}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16 4h2a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H5m0 0l3-3m-3 3l3 3M8 20H6a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3h13m0 0l-3-3m3 3l-3 3"
                    />
                  </svg>
                </button>

                {/* State label */}
                <span className="ml-2 hidden text-xs text-ink-faint md:inline">
                  {stateLabels[player.state]}
                </span>
              </div>

              {/* Right: Speed & Volume */}
              <div className="flex items-center gap-2.5 sm:gap-3">
                {/* Speed selector */}
                <div className="relative" ref={speedMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowSpeedMenu((prev) => !prev)}
                    className="flex h-7 items-center gap-1 rounded-md border border-line bg-white/5 px-2 font-mono text-xs font-semibold text-ink-muted transition-colors hover:border-accent/40 hover:bg-white/10 hover:text-ink active:scale-95"
                    aria-label="Playback speed"
                    title="Change playback speed (Q: slower, E: faster)"
                  >
                    <span>{playbackRate === 1 ? "1x" : `${playbackRate}x`}</span>
                  </button>

                  {showSpeedMenu && (
                    <div className="absolute bottom-full right-0 mb-2 w-32 rounded-xl border border-line-strong bg-surface/95 p-1.5 shadow-2xl backdrop-blur-xl z-30">
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                        Playback Speed
                      </div>
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => {
                            handleSpeedChange(rate);
                            setShowSpeedMenu(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-mono transition-colors ${
                            playbackRate === rate
                              ? "bg-accent/15 font-semibold text-accent"
                              : "text-ink-muted hover:bg-white/10 hover:text-ink"
                          }`}
                        >
                          <span>{rate === 1 ? "1.0x Normal" : `${rate}x`}</span>
                          {playbackRate === rate && (
                            <svg className="h-3.5 w-3.5 text-accent" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Video Quality indicator (read-only — YouTube controls this) */}
                <div
                  title={`Stream quality: ${formatQualityBadge(playbackQuality)} (auto-selected by YouTube)`}
                  className="flex h-7 items-center gap-1 rounded-md border border-line bg-white/5 px-2 font-mono text-xs font-semibold text-ink-muted select-none"
                  aria-label={`Current video quality: ${formatQualityBadge(playbackQuality)}`}
                >
                  <span>{formatQualityBadge(playbackQuality)}</span>
                  {(playbackQuality === "hd720" ||
                    playbackQuality === "hd1080" ||
                    playbackQuality === "highres" ||
                    playbackQuality === "hd1440" ||
                    playbackQuality === "hd2160") && (
                    <span className="rounded bg-accent/20 px-1 py-0.5 text-[8px] font-bold text-accent">
                      HD
                    </span>
                  )}
                </div>

                {/* Volume slider & mute button */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-all hover:bg-white/10 hover:text-ink active:scale-95"
                    aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
                    title={isMuted || volume === 0 ? "Unmute (M)" : `Mute (M) · Vol: ${volume}% (A / D)`}
                  >
                    {isMuted || volume === 0 ? (
                      <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L21.75 14.25M21.75 9.75l-4.5 4.5m-5.25-9.75L7.5 8.25H4.5A1.5 1.5 0 003 9.75v4.5a1.5 1.5 0 001.5 1.5h3l4.5 3.75V4.5z" />
                      </svg>
                    ) : volume < 50 ? (
                      <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m-4.036-11.036L7.5 8.25H4.5A1.5 1.5 0 003 9.75v4.5a1.5 1.5 0 001.5 1.5h3l4.5 3.75V4.5z" />
                      </svg>
                    ) : (
                      <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07M11.5 4.5L7.5 8.25H4.5A1.5 1.5 0 003 9.75v4.5a1.5 1.5 0 001.5 1.5h3l4.5 3.75V4.5z" />
                      </svg>
                    )}
                  </button>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="syncd-range h-1 w-16 sm:w-20 cursor-pointer"
                    aria-label="Volume"
                    title="Volume (A: down, D: up)"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {message && <p className="text-sm text-danger">{message}</p>}
      </div>
    </Card>
  );
}
