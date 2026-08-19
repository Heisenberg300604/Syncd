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

  apiLoadingPromise = new Promise<void>((resolve) => {
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
    document.head.appendChild(tag);
  });

  return apiLoadingPromise;
}

export type PlayerState = "loading" | "ready" | "playing" | "paused" | "ended" | "error";

export interface YouTubePlayerHandle {
  state: PlayerState;
  currentTime: number;
  duration: number;
  loadVideo: (videoId: string) => void;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
}

export function useYouTubePlayer(
  containerRef: React.RefObject<HTMLDivElement | null>,
): YouTubePlayerHandle | null {
  const playerRef = useRef<YT.Player | null>(null);
  const [state, setState] = useState<PlayerState>("loading");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const pendingVideoId = useRef<string | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    loadYouTubeAPI().then(() => {
      if (!containerRef.current) return;

      // Create an inner div that the YT API will replace with an iframe.
      // Keeping the outer ref stable prevents React from fighting the iframe.
      const innerDiv = document.createElement("div");
      containerRef.current.appendChild(innerDiv);

      playerRef.current = new window.YT!.Player(innerDiv, {
        height: "100%",
        width: "100%",
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            setState("ready");
            setReady(true);
            if (pendingVideoId.current) {
              playerRef.current?.loadVideoById(pendingVideoId.current);
              pendingVideoId.current = null;
            }
            interval = setInterval(() => {
              if (playerRef.current) {
                try {
                  setCurrentTime(playerRef.current.getCurrentTime());
                  setDuration(playerRef.current.getDuration());
                } catch {
                  // Player may not be ready during state transitions
                }
              }
            }, 500);
          },
          onStateChange: (e: YT.OnStateChangeEvent) => {
            switch (e.data) {
              case YT.PlayerState.PLAYING:
                setState("playing");
                break;
              case YT.PlayerState.PAUSED:
                setState("paused");
                break;
              case YT.PlayerState.ENDED:
                setState("ended");
                break;
              case YT.PlayerState.BUFFERING:
                setState("loading");
                break;
              default:
                break;
            }
          },
          onError: () => {
            setState("error");
          },
        },
      });
    });

    return () => {
      if (interval) clearInterval(interval);
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      // Clean up any leftover iframe/inner div
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [containerRef]);

  const loadVideo = useCallback(
    (videoId: string) => {
      if (playerRef.current && ready) {
        playerRef.current.loadVideoById(videoId);
        setState("loading");
      } else {
        pendingVideoId.current = videoId;
      }
    },
    [ready],
  );

  const play = useCallback(() => {
    playerRef.current?.playVideo();
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo();
  }, []);

  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
  }, []);

  if (!ready) {
    return {
      state,
      currentTime,
      duration,
      loadVideo,
      play,
      pause,
      seekTo,
    };
  }

  return { state, currentTime, duration, loadVideo, play, pause, seekTo };
}