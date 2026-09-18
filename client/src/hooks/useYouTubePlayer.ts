import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoadingPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (apiLoadingPromise) return apiLoadingPromise;

  apiLoadingPromise = new Promise<void>((resolve, reject) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }

    const existingCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      existingCallback?.();
      resolve();
    };

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => {
      // Let the next mount retry instead of caching a dead promise.
      apiLoadingPromise = null;
      reject(new Error("Could not load the YouTube player script"));
    };
    document.head.appendChild(tag);
  });

  return apiLoadingPromise;
}

export type PlayerState =
  | "initialising"
  | "idle"
  | "buffering"
  | "playing"
  | "paused"
  | "ended"
  | "error";

/** YouTube IFrame API `onError` codes, translated into something actionable. */
function describeError(code: number): string {
  switch (code) {
    case 2:
      return "That video ID is not valid.";
    case 5:
      return "This video cannot be played in the HTML5 player.";
    case 100:
      return "That video was removed or is private.";
    case 101:
    case 150:
      return "The owner of this video does not allow it to be played on other sites. Try a different upload.";
    default:
      return `The YouTube player reported error ${code}.`;
  }
}

function readCurrentTime(ref: React.RefObject<YT.Player | null>): number {
  try {
    return ref.current?.getCurrentTime() ?? 0;
  } catch {
    return 0;
  }
}

export interface YouTubePlayerHandle {
  state: PlayerState;
  /** True once the IFrame player exists and accepts commands. */
  ready: boolean;
  error: string | null;
  currentTime: number;
  duration: number;
  /** Load and auto-play a video from the given start position. */
  loadVideo: (videoId: string, startSeconds?: number) => void;
  /** Load a video in a paused/cued state without auto-playing. */
  cueVideo: (videoId: string, startSeconds?: number) => void;
  play: () => void;
  pause: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setPlaybackRate: (rate: number) => void;
  getPlaybackRate: () => number;
  setPlaybackQuality: (quality: string) => void;
  getPlaybackQuality: () => string;
  /**
   * The quality level YouTube has actually chosen for the current stream.
   * Read-only — YouTube controls this based on network and player size.
   * Updated in real time via the `onPlaybackQualityChange` IFrame API event.
   */
  playbackQuality: string;
  availableQualityLevels: string[];
}

export interface YouTubePlayerOptions {
  /** Fired for user-driven transitions so callers can broadcast them. */
  onStateChange?: (state: PlayerState, currentTime: number) => void;
}

/**
 * Owns a single YouTube IFrame player mounted into `containerRef`.
 *
 * The container element must be present in the DOM for the whole lifetime of
 * the component using this hook. Rendering it conditionally leaves the ref
 * null when the effect runs and the player is never constructed.
 */
export function useYouTubePlayer(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: YouTubePlayerOptions = {},
): YouTubePlayerHandle {
  const playerRef = useRef<YT.Player | null>(null);
  const [state, setState] = useState<PlayerState>("initialising");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackQuality, setPlaybackQualityState] = useState<string>("auto");
  const [availableQualityLevels, setAvailableQualityLevels] = useState<string[]>([]);
  const pendingVideo = useRef<{
    videoId: string;
    startSeconds: number;
    paused: boolean;
  } | null>(null);

  const onStateChangeRef = useRef(options.onStateChange);
  useEffect(() => {
    onStateChangeRef.current = options.onStateChange;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      setError(
        "Player container is missing. This is a bug — the container must always be rendered.",
      );
      setState("error");
      return;
    }

    let disposed = false;

    // The API replaces the element it is given with an iframe, so hand it a
    // throwaway child rather than the React-owned container.
    const mountPoint = document.createElement("div");
    container.appendChild(mountPoint);

    loadYouTubeAPI()
      .then(() => {
        if (disposed || !window.YT?.Player) return;

        playerRef.current = new window.YT.Player(mountPoint, {
          height: "100%",
          width: "100%",
          playerVars: {
            autoplay: 0,
            // SyncD owns playback: the room decides what plays, where the
            // playhead is, and who may move it. YouTube's own control bar is a
            // second, ungoverned input surface — anyone could drive their own
            // player with it, silently diverging from the room — so it is off,
            // along with the keyboard shortcuts and clickable annotations that
            // do the same thing. Play, pause and seek all come from this app's
            // controls instead.
            controls: 0,
            disablekb: 1,
            iv_load_policy: 3,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (disposed) return;
              setReady(true);
              setError(null);
              setState("idle");

              try {
                const q = playerRef.current?.getPlaybackQuality();
                if (q) setPlaybackQualityState(q);
                const levels = playerRef.current?.getAvailableQualityLevels();
                if (levels && levels.length > 0) setAvailableQualityLevels(levels);
              } catch {
                // Ignore
              }

              const pending = pendingVideo.current;
              if (pending) {
                pendingVideo.current = null;
                if (pending.paused) {
                  playerRef.current?.cueVideoById(
                    pending.videoId,
                    pending.startSeconds,
                  );
                } else {
                  playerRef.current?.loadVideoById(
                    pending.videoId,
                    pending.startSeconds,
                  );
                }
              }
            },
            onPlaybackQualityChange: (e: YT.OnPlaybackQualityChangeEvent) => {
              if (disposed) return;
              if (e?.data) setPlaybackQualityState(e.data);
              try {
                const levels = playerRef.current?.getAvailableQualityLevels();
                if (levels && levels.length > 0) setAvailableQualityLevels(levels);
              } catch {
                // Ignore
              }
            },
            onStateChange: (e: YT.OnStateChangeEvent) => {
              if (disposed) return;

              let next: PlayerState | null = null;
              switch (e.data) {
                case YT.PlayerState.PLAYING:
                  next = "playing";
                  try {
                    const q = playerRef.current?.getPlaybackQuality();
                    if (q) setPlaybackQualityState(q);
                    const levels = playerRef.current?.getAvailableQualityLevels();
                    if (levels && levels.length > 0) setAvailableQualityLevels(levels);
                  } catch {
                    // Ignore
                  }
                  break;
                case YT.PlayerState.PAUSED:
                  next = "paused";
                  break;
                case YT.PlayerState.ENDED:
                  next = "ended";
                  break;
                case YT.PlayerState.BUFFERING:
                  next = "buffering";
                  break;
                case YT.PlayerState.CUED:
                  next = "idle";
                  break;
                default:
                  break;
              }

              if (!next) return;
              setState(next);
              if (next !== "buffering") setError(null);

              onStateChangeRef.current?.(next, readCurrentTime(playerRef));
            },
            onError: (e: YT.OnErrorEvent) => {
              if (disposed) return;
              setError(describeError(e.data));
              setState("error");
            },
          },
        });
      })
      .catch((err: unknown) => {
        if (disposed) return;
        setError(
          err instanceof Error
            ? err.message
            : "Could not load the YouTube player",
        );
        setState("error");
      });

    return () => {
      disposed = true;
      setReady(false);
      try {
        playerRef.current?.stopVideo();
        playerRef.current?.destroy();
      } catch {
        // The iframe may already be gone; nothing to clean up.
      }
      playerRef.current = null;
      container.innerHTML = "";
    };
  }, [containerRef]);

  // Progress polling only makes sense once the player exists.
  useEffect(() => {
    if (!ready) return;

    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        setCurrentTime(player.getCurrentTime());
        setDuration(player.getDuration());
      } catch {
        // Player is mid-transition; the next tick will pick it up.
      }
    }, 500);

    return () => clearInterval(interval);
  }, [ready]);

  const loadVideo = useCallback((videoId: string, startSeconds = 0) => {
    setError(null);
    setCurrentTime(startSeconds);
    setDuration(0);

    const player = playerRef.current;
    if (player) {
      setState("buffering");
      player.loadVideoById(videoId, startSeconds);
      return;
    }

    // Player not constructed yet — onReady drains this.
    pendingVideo.current = { videoId, startSeconds, paused: false };
    setState("buffering");
  }, []);

  /**
   * Like `loadVideo` but loads the video into a paused/cued state without
   * auto-playing. Maps to `cueVideoById` in the YouTube IFrame API.
   * Use this whenever the room's `isPlaying` is false on a fresh load so the
   * video doesn't start playing before a `pause()` call can reach the player.
   */
  const cueVideo = useCallback((videoId: string, startSeconds = 0) => {
    setError(null);
    setCurrentTime(startSeconds);
    setDuration(0);

    const player = playerRef.current;
    if (player) {
      // cueVideoById puts the player in CUED state — no auto-play.
      setState("idle");
      player.cueVideoById(videoId, startSeconds);
      return;
    }

    // Player not constructed yet — onReady drains this with paused: true.
    pendingVideo.current = { videoId, startSeconds, paused: true };
    setState("idle");
  }, []);

  const play = useCallback(() => {
    try {
      playerRef.current?.playVideo();
    } catch {
      // Ignore commands sent while the player is tearing down.
    }
  }, []);

  const pause = useCallback(() => {
    try {
      playerRef.current?.pauseVideo();
    } catch {
      // Ignore commands sent while the player is tearing down.
    }
  }, []);

  const stopVideo = useCallback(() => {
    pendingVideo.current = null;
    setError(null);
    setCurrentTime(0);
    setDuration(0);
    setState("idle");
    try {
      playerRef.current?.stopVideo();
      playerRef.current?.pauseVideo();
    } catch {
      // Ignore commands sent while the player is tearing down.
    }
  }, []);

  const seekTo = useCallback((seconds: number) => {
    try {
      playerRef.current?.seekTo(seconds, true);
      setCurrentTime(seconds);
    } catch {
      // Ignore commands sent while the player is tearing down.
    }
  }, []);

  const getCurrentTime = useCallback(() => readCurrentTime(playerRef), []);

  const setVolume = useCallback((volume: number) => {
    try {
      playerRef.current?.setVolume(volume);
    } catch {
      // Ignore commands sent while the player is tearing down.
    }
  }, []);

  const getVolume = useCallback(() => {
    try {
      return playerRef.current?.getVolume() ?? 100;
    } catch {
      return 100;
    }
  }, []);

  const mute = useCallback(() => {
    try {
      playerRef.current?.mute();
    } catch {
      // Ignore commands sent while the player is tearing down.
    }
  }, []);

  const unMute = useCallback(() => {
    try {
      playerRef.current?.unMute();
    } catch {
      // Ignore commands sent while the player is tearing down.
    }
  }, []);

  const isMuted = useCallback(() => {
    try {
      return playerRef.current?.isMuted() ?? false;
    } catch {
      return false;
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    try {
      playerRef.current?.setPlaybackRate(rate);
    } catch {
      // Ignore commands sent while the player is tearing down.
    }
  }, []);

  const getPlaybackRate = useCallback(() => {
    try {
      return playerRef.current?.getPlaybackRate() ?? 1;
    } catch {
      return 1;
    }
  }, []);

  const setPlaybackQuality = useCallback((quality: string) => {
    try {
      playerRef.current?.setPlaybackQuality(quality as YT.SuggestedVideoQuality);
      setPlaybackQualityState(quality);
    } catch {
      // Ignore
    }
  }, []);

  const getPlaybackQuality = useCallback(() => {
    try {
      return playerRef.current?.getPlaybackQuality() ?? playbackQuality;
    } catch {
      return playbackQuality;
    }
  }, [playbackQuality]);

  return {
    state,
    ready,
    error,
    currentTime,
    duration,
    loadVideo,
    cueVideo,
    play,
    pause,
    stopVideo,
    seekTo,
    getCurrentTime,
    setVolume,
    getVolume,
    mute,
    unMute,
    isMuted,
    setPlaybackRate,
    getPlaybackRate,
    setPlaybackQuality,
    getPlaybackQuality,
    playbackQuality,
    availableQualityLevels,
  };
}
