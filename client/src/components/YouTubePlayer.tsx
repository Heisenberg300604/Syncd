import { useEffect, useRef } from "react";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import type { YouTubeSearchResult } from "../services/types";
import type { PlayerState } from "../hooks/useYouTubePlayer";

interface YouTubePlayerProps {
  currentVideo: YouTubeSearchResult | null;
  onCleared: () => void;
}

const stateLabels: Record<PlayerState, string> = {
  loading: "Loading...",
  ready: "Ready",
  playing: "Playing",
  paused: "Paused",
  ended: "Ended",
  error: "Error",
};

function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function YouTubePlayer({ currentVideo, onCleared }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const player = useYouTubePlayer(containerRef);

  const loadedVideoId = useRef<string | null>(null);

  useEffect(() => {
    if (!player || !currentVideo) return;
    if (loadedVideoId.current === currentVideo.videoId) return;

    loadedVideoId.current = currentVideo.videoId;
    player.loadVideo(currentVideo.videoId);
  }, [player, currentVideo]);

  useEffect(() => {
    if (!currentVideo) {
      loadedVideoId.current = null;
    }
  }, [currentVideo]);

  return (
    <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
      <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
        Now Playing
      </h2>

      {currentVideo ? (
        <div className="space-y-4">
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
            <div ref={containerRef} className="absolute inset-0" />
          </div>

          <div className="flex items-start gap-4">
            <img
              src={currentVideo.thumbnailUrl}
              alt=""
              className="h-16 w-24 rounded-lg object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-white truncate">
                {currentVideo.title}
              </h3>
              <p className="text-sm text-zinc-400 truncate">
                {currentVideo.channelTitle}
              </p>
            </div>
            <button
              onClick={onCleared}
              className="text-xs text-zinc-400 hover:text-white transition-colors flex-shrink-0"
            >
              Clear
            </button>
          </div>

          {player && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    player.state === "playing"
                      ? player.pause()
                      : player.play()
                  }
                  disabled={player.state === "loading"}
                  className="h-10 w-10 rounded-full bg-violet-500 text-white flex items-center justify-center hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={player.state === "playing" ? "Pause" : "Play"}
                >
                  {player.state === "playing" ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  ) : (
                    <svg className="h-5 w-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  )}
                </button>

                <span className="text-xs text-zinc-500 font-mono w-12 text-right">
                  {formatTime(player.currentTime)}
                </span>

                <input
                  type="range"
                  min={0}
                  max={player.duration || 0}
                  value={player.currentTime}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    player.seekTo(val);
                  }}
                  className="flex-1 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-violet-500"
                  aria-label="Seek"
                />

                <span className="text-xs text-zinc-500 font-mono w-12">
                  {formatTime(player.duration)}
                </span>
              </div>

              <p className="text-xs text-zinc-500">
                {stateLabels[player.state]}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
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
            Search and select a song to start playing.
          </p>
        </div>
      )}
    </div>
  );
}