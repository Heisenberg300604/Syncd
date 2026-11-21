import { useCallback, useEffect, useRef, useState } from 'react';

// Self-contained ambient declarations for YouTube IFrame API
export namespace YT {
  export enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }

  export interface PlayerOptions {
    height?: string | number;
    width?: string | number;
    videoId?: string;
    playerVars?: Record<string, unknown>;
    events?: {
      onReady?: (event: { target: Player }) => void;
      onStateChange?: (event: { target: Player; data: number }) => void;
      onPlaybackQualityChange?: (event: { target: Player; data: string }) => void;
      onError?: (event: { target: Player; data: number }) => void;
    };
  }

  export interface Player {
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    seekTo(seconds: number, allowSeekAhead?: boolean): void;
    loadVideoById(videoId: string, startSeconds?: number): void;
    cueVideoById(videoId: string, startSeconds?: number): void;
    getCurrentTime(): number;
    getDuration(): number;
    getVolume(): number;
    setVolume(volume: number): void;
    mute(): void;
    unMute(): void;
    isMuted(): boolean;
    getPlaybackRate(): number;
    setPlaybackRate(suggestedRate: number): void;
    getPlaybackQuality(): string;
    setPlaybackQuality(suggestedQuality: string): void;
    getAvailableQualityLevels(): string[];
    loadModule(module: string): void;
    unloadModule(module: string): void;
    setOption(module: string, option: string, value: unknown): void;
    getOption(module: string, option: string): unknown;
    destroy(): void;
  }
}

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement | string, options: YT.PlayerOptions) => YT.Player;
      PlayerState: typeof YT.PlayerState;
    };
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

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => {
      apiLoadingPromise = null;
      reject(new Error('Could not load the YouTube player script'));
    };
    document.head.appendChild(tag);
  });

  return apiLoadingPromise;
}

export type PlayerState =
  | 'initialising'
  | 'idle'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

function describeError(code: number): string {
  switch (code) {
    case 2:
      return 'That video ID is not valid.';
    case 5:
      return 'This video cannot be played in the HTML5 player.';
    case 100:
      return 'That video was removed or is private.';
    case 101:
    case 150:
      return 'The owner of this video does not allow playback on other sites.';
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
  ready: boolean;
  error: string | null;
  currentTime: number;
  duration: number;
  captionsEnabled: boolean;
  toggleCaptions: () => void;
  setCaptionsEnabled: (enabled: boolean) => void;
  loadVideo: (videoId: string, startSeconds?: number) => void;
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
  playbackQuality: string;
  availableQualityLevels: string[];
}

export interface YouTubePlayerOptions {
  onStateChange?: (state: PlayerState, currentTime: number) => void;
  onEnded?: () => void;
}

export function useYouTubePlayer(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: YouTubePlayerOptions = {},
): YouTubePlayerHandle {
  const playerRef = useRef<YT.Player | null>(null);
  const [state, setState] = useState<PlayerState>('initialising');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [captionsEnabled, setCaptionsEnabledState] = useState(false);
  const captionsEnabledRef = useRef(false);
  const [playbackQuality, setPlaybackQualityState] = useState<string>('auto');
  const [availableQualityLevels, setAvailableQualityLevels] = useState<string[]>([]);
  const pendingVideo = useRef<{
    videoId: string;
    startSeconds: number;
    paused: boolean;
  } | null>(null);

  const onStateChangeRef = useRef(options.onStateChange);
  const onEndedRef = useRef(options.onEnded);
  useEffect(() => {
    onStateChangeRef.current = options.onStateChange;
    onEndedRef.current = options.onEnded;
  });

  useEffect(() => {
    let disposed = false;
    let pollInterval: NodeJS.Timeout | null = null;

    const applyCaptions = (enabled: boolean) => {
      const p = playerRef.current;
      if (!p) return;
      try {
        if (enabled) {
          p.loadModule('captions');
          p.setOption('captions', 'track', { languageCode: 'en' });
          p.setOption('captions', 'reload', true);
        } else {
          p.unloadModule('captions');
          p.setOption('captions', 'track', {});
        }
      } catch {
        // Ignore
      }
    };

    const setupPlayer = (container: HTMLDivElement) => {
      if (disposed) return;
      container.innerHTML = '';
      const mountPoint = document.createElement('div');
      mountPoint.style.width = '100%';
      mountPoint.style.height = '100%';
      container.appendChild(mountPoint);

      loadYouTubeAPI()
        .then(() => {
          if (disposed || !window.YT?.Player) return;

          playerRef.current = new window.YT.Player(mountPoint, {
            height: '100%',
            width: '100%',
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              iv_load_policy: 3,
              modestbranding: 1,
              rel: 0,
              playsinline: 1,
            },
            events: {
              onReady: () => {
                if (disposed) return;
                setReady(true);
                setError(null);
                setState('idle');

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
                    playerRef.current?.cueVideoById(pending.videoId, pending.startSeconds);
                  } else {
                    playerRef.current?.loadVideoById(pending.videoId, pending.startSeconds);
                  }
                }

                if (captionsEnabledRef.current) {
                  applyCaptions(true);
                }
              },
              onPlaybackQualityChange: (e) => {
                if (disposed) return;
                if (e?.data) setPlaybackQualityState(e.data);
                try {
                  const levels = playerRef.current?.getAvailableQualityLevels();
                  if (levels && levels.length > 0) setAvailableQualityLevels(levels);
                } catch {
                  // Ignore
                }
              },
              onStateChange: (e) => {
                if (disposed) return;

                let next: PlayerState | null = null;
                switch (e.data) {
                  case 1: // PLAYING
                    next = 'playing';
                    if (captionsEnabledRef.current) {
                      applyCaptions(true);
                    }
                    try {
                      const q = playerRef.current?.getPlaybackQuality();
                      if (q) setPlaybackQualityState(q);
                    } catch {
                      // Ignore
                    }
                    break;
                  case 2: // PAUSED
                    next = 'paused';
                    break;
                  case 0: // ENDED
                    next = 'ended';
                    onEndedRef.current?.();
                    break;
                  case 3: // BUFFERING
                    next = 'buffering';
                    break;
                  case 5: // CUED
                    next = 'idle';
                    break;
                }

                if (!next) return;
                setState(next);
                if (next !== 'buffering') setError(null);

                onStateChangeRef.current?.(next, readCurrentTime(playerRef));
              },
              onError: (e) => {
                if (disposed) return;
                setError(describeError(e.data));
                setState('error');
              },
            },
          });
        })
        .catch((err: unknown) => {
          if (disposed) return;
          setError(err instanceof Error ? err.message : 'Could not load YouTube player.');
          setState('error');
        });
    };

    if (containerRef.current) {
      setupPlayer(containerRef.current);
    } else {
      // Retry checking until container is mounted in the DOM
      pollInterval = setInterval(() => {
        if (containerRef.current) {
          if (pollInterval) clearInterval(pollInterval);
          setupPlayer(containerRef.current);
        }
      }, 50);
    }

    return () => {
      disposed = true;
      if (pollInterval) clearInterval(pollInterval);
      setReady(false);
      try {
        playerRef.current?.stopVideo();
        playerRef.current?.destroy();
      } catch {
        // Ignored
      }
      playerRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [containerRef]);

  // Polling for playhead progress
  useEffect(() => {
    if (!ready) return;

    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        setCurrentTime(player.getCurrentTime());
        setDuration(player.getDuration());
      } catch {
        // Transition
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
      setState('buffering');
      player.loadVideoById(videoId, startSeconds);
      return;
    }

    pendingVideo.current = { videoId, startSeconds, paused: false };
    setState('buffering');
  }, []);

  const cueVideo = useCallback((videoId: string, startSeconds = 0) => {
    setError(null);
    setCurrentTime(startSeconds);
    setDuration(0);

    const player = playerRef.current;
    if (player) {
      setState('idle');
      player.cueVideoById(videoId, startSeconds);
      return;
    }

    pendingVideo.current = { videoId, startSeconds, paused: true };
    setState('idle');
  }, []);

  const play = useCallback(() => {
    try {
      playerRef.current?.playVideo();
    } catch {
      // Ignored
    }
  }, []);

  const pause = useCallback(() => {
    try {
      playerRef.current?.pauseVideo();
    } catch {
      // Ignored
    }
  }, []);

  const stopVideo = useCallback(() => {
    pendingVideo.current = null;
    setError(null);
    setCurrentTime(0);
    setDuration(0);
    setState('idle');
    try {
      playerRef.current?.stopVideo();
      playerRef.current?.pauseVideo();
    } catch {
      // Ignored
    }
  }, []);

  const seekTo = useCallback((seconds: number) => {
    try {
      playerRef.current?.seekTo(seconds, true);
      setCurrentTime(seconds);
    } catch {
      // Ignored
    }
  }, []);

  const getCurrentTime = useCallback(() => readCurrentTime(playerRef), []);

  const setVolume = useCallback((volume: number) => {
    try {
      playerRef.current?.setVolume(volume);
    } catch {
      // Ignored
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
      // Ignored
    }
  }, []);

  const unMute = useCallback(() => {
    try {
      playerRef.current?.unMute();
    } catch {
      // Ignored
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
      // Ignored
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
      playerRef.current?.setPlaybackQuality(quality);
      setPlaybackQualityState(quality);
    } catch {
      // Ignored
    }
  }, []);

  const getPlaybackQuality = useCallback(() => {
    try {
      return playerRef.current?.getPlaybackQuality() ?? playbackQuality;
    } catch {
      return playbackQuality;
    }
  }, [playbackQuality]);

  const toggleCaptions = useCallback(() => {
    setCaptionsEnabledState((prev) => {
      const next = !prev;
      captionsEnabledRef.current = next;
      const p = playerRef.current;
      if (p) {
        try {
          if (next) {
            p.loadModule('captions');
            p.setOption('captions', 'track', { languageCode: 'en' });
            p.setOption('captions', 'reload', true);
          } else {
            p.unloadModule('captions');
            p.setOption('captions', 'track', {});
          }
        } catch {
          // Ignore
        }
      }
      return next;
    });
  }, []);

  const setCaptionsEnabled = useCallback((enabled: boolean) => {
    captionsEnabledRef.current = enabled;
    setCaptionsEnabledState(enabled);
    const p = playerRef.current;
    if (p) {
      try {
        if (enabled) {
          p.loadModule('captions');
          p.setOption('captions', 'track', { languageCode: 'en' });
          p.setOption('captions', 'reload', true);
        } else {
          p.unloadModule('captions');
          p.setOption('captions', 'track', {});
        }
      } catch {
        // Ignore
      }
    }
  }, []);

  return {
    state,
    ready,
    error,
    currentTime,
    duration,
    captionsEnabled,
    toggleCaptions,
    setCaptionsEnabled,
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
