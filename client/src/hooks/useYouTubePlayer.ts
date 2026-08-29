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
  loadVideo: (videoId: string, startSeconds?: number) => void;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
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
  const pendingVideo = useRef<{ videoId: string; startSeconds: number } | null>(
    null,
  );

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
            controls: 1,
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

              const pending = pendingVideo.current;
              if (pending) {
                pendingVideo.current = null;
                playerRef.current?.loadVideoById(
                  pending.videoId,
                  pending.startSeconds,
                );
              }
            },
            onStateChange: (e: YT.OnStateChangeEvent) => {
              if (disposed) return;

              let next: PlayerState | null = null;
              switch (e.data) {
                case YT.PlayerState.PLAYING:
                  next = "playing";
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
    pendingVideo.current = { videoId, startSeconds };
    setState("buffering");
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

  const seekTo = useCallback((seconds: number) => {
    try {
      playerRef.current?.seekTo(seconds, true);
      setCurrentTime(seconds);
    } catch {
      // Ignore commands sent while the player is tearing down.
    }
  }, []);

  const getCurrentTime = useCallback(() => readCurrentTime(playerRef), []);

  return {
    state,
    ready,
    error,
    currentTime,
    duration,
    loadVideo,
    play,
    pause,
    seekTo,
    getCurrentTime,
  };
}
