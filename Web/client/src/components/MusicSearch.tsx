import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import {
  resolveYouTubeLink,
  resolveYouTubePlaylist,
  searchMusic,
} from "../services/api";
import { formatIsoDuration } from "../utils/duration";
import type { YouTubeSearchResult } from "../services/types";
import { Card } from "./ui/Card";

interface MusicSearchProps {
  onSelect: (result: YouTubeSearchResult) => void;
  disabled?: boolean;
  /** When true the host can queue tracks instead of (or alongside) playing them immediately. */
  canQueue?: boolean;
  /** Called when the user clicks "Add to queue". */
  onQueue?: (result: YouTubeSearchResult) => void;
  /** Overrides the default "connecting" copy shown while disabled. */
  disabledMessage?: string;
}

interface VideoPreview {
  type: "video";
  track: YouTubeSearchResult;
}

interface PlaylistPreview {
  type: "playlist";
  title: string;
  tracks: YouTubeSearchResult[];
}

type LinkPreview = VideoPreview | PlaylistPreview;

/** Matches any youtube.com / youtu.be URL, with or without a scheme. */
const YOUTUBE_LINK_REGEX =
  /(^|\/\/|\s)((www|m|music)\.)?(youtube(-nocookie)?\.com|youtu\.be)\//i;

function isYouTubeLink(value: string): boolean {
  return YOUTUBE_LINK_REGEX.test(value);
}

function isYouTubePlaylistLink(value: string): boolean {
  return isYouTubeLink(value) && /[?&]list=/.test(value);
}

export function MusicSearch({
  onSelect,
  disabled = false,
  canQueue = false,
  onQueue,
  disabledMessage,
}: MusicSearchProps) {
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Link preview state
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Automatically fetch preview when a YouTube link or playlist is pasted/entered
  useEffect(() => {
    const trimmed = query.trim();
    if (!isYouTubeLink(trimmed)) {
      const timer = setTimeout(() => {
        setLinkPreview(null);
        setPreviewLoading(false);
        setPreviewError(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        if (isYouTubePlaylistLink(trimmed)) {
          const res = await resolveYouTubePlaylist(getToken, trimmed);
          if (cancelled) return;
          if (res.results.length === 0) {
            setPreviewError("No playable videos found in this playlist");
            setLinkPreview(null);
          } else {
            setLinkPreview({
              type: "playlist",
              title: res.playlistTitle || "YouTube Playlist",
              tracks: res.results,
            });
          }
        } else {
          const res = await resolveYouTubeLink(getToken, trimmed);
          if (cancelled) return;
          setLinkPreview({
            type: "video",
            track: res.result,
          });
        }
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : "Failed to load preview";
        setPreviewError(msg);
        setLinkPreview(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, getToken]);

  function handlePlayVideo(track: YouTubeSearchResult) {
    onSelect(track);
    setQuery("");
    setLinkPreview(null);
    setResults([]);
    setHasSearched(false);
  }

  function handleQueueVideo(track: YouTubeSearchResult) {
    onQueue?.(track);
    setQuery("");
    setLinkPreview(null);
    setResults([]);
    setHasSearched(false);
  }

  function handlePlayPlaylist(playlist: PlaylistPreview) {
    if (playlist.tracks.length === 0) return;
    onSelect(playlist.tracks[0]);
    if (onQueue) {
      for (const t of playlist.tracks.slice(1)) {
        onQueue(t);
      }
    }
    setQuery("");
    setLinkPreview(null);
    setResults([]);
    setHasSearched(false);
  }

  function handleQueueAllPlaylist(playlist: PlaylistPreview) {
    if (onQueue) {
      for (const t of playlist.tracks) {
        onQueue(t);
      }
    }
    setQuery("");
    setLinkPreview(null);
    setResults([]);
    setHasSearched(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length === 0) return;

    // If preview is already resolved, use it directly
    if (linkPreview) {
      if (linkPreview.type === "playlist") {
        handlePlayPlaylist(linkPreview);
      } else {
        handlePlayVideo(linkPreview.track);
      }
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (isYouTubePlaylistLink(trimmed)) {
        const { results: playlistVideos, playlistTitle } =
          await resolveYouTubePlaylist(getToken, trimmed);
        if (playlistVideos.length === 0) {
          setError("No playable videos found in this playlist");
          return;
        }

        handlePlayPlaylist({
          type: "playlist",
          title: playlistTitle || "YouTube Playlist",
          tracks: playlistVideos,
        });
        return;
      }

      if (isYouTubeLink(trimmed)) {
        const { result } = await resolveYouTubeLink(getToken, trimmed);
        setResults([result]);
        setHasSearched(false);
        setQuery("");
        if (!canQueue) {
          onSelect(result);
          setResults([]);
        }
        return;
      }

      setHasSearched(true);
      const { results: found } = await searchMusic(getToken, trimmed);
      setResults(found);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  const isLink = isYouTubeLink(query.trim());
  const isPlaylist = isYouTubePlaylistLink(query.trim());
  const submitLabel = isPlaylist
    ? "Play playlist"
    : isLink
      ? "Play link"
      : "Search";

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
        Add music
      </h2>
      <p className="mt-1 text-xs text-ink-faint">
        Search for a song, or paste a YouTube link (video or playlist) to play it for the whole room.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Song name or YouTube link…"
          autoComplete="off"
          disabled={busy || disabled}
          className="h-10 flex-1 rounded-md border border-line bg-white/3 px-4 text-sm text-ink placeholder:text-ink-faint focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || disabled || query.trim().length === 0}
          className="whitespace-nowrap rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hi disabled:opacity-50 disabled:pointer-events-none"
        >
          {busy ? "Loading…" : submitLabel}
        </button>
      </form>

      {/* Live Preview Loading Indicator */}
      {previewLoading && (
        <div className="mt-3.5 flex items-center gap-2.5 rounded-xl border border-line bg-white/3 p-3.5 text-xs text-ink-muted animate-pulse">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent shrink-0" />
          <span>
            Resolving {isPlaylist ? "playlist" : "video"} preview…
          </span>
        </div>
      )}

      {/* Link Preview Error */}
      {previewError && (
        <div className="mt-3.5 flex items-center justify-between rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-danger">
          <span>{previewError}</span>
          <button
            type="button"
            onClick={() => setPreviewError(null)}
            className="text-xs text-danger hover:opacity-80"
          >
            ✕
          </button>
        </div>
      )}

      {/* Video Preview Card */}
      {linkPreview && linkPreview.type === "video" && (
        <div className="relative mt-3.5 overflow-hidden rounded-xl border border-line-strong bg-white/4 p-3.5 shadow-xl backdrop-blur-sm transition-all">
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setLinkPreview(null);
            }}
            className="absolute top-2.5 right-2.5 rounded-full p-1 text-xs text-ink-faint hover:bg-white/10 hover:text-ink transition-colors"
            title="Dismiss preview"
          >
            ✕
          </button>

          <div className="flex items-start gap-3 pr-6">
            <div className="relative shrink-0 overflow-hidden rounded-lg bg-black/40 shadow-md">
              <img
                src={linkPreview.track.thumbnailUrl}
                alt=""
                className="h-16 w-24 object-cover"
              />
              {linkPreview.track.duration && (
                <span className="absolute bottom-1 right-1 rounded bg-black/85 px-1 py-0.5 font-mono text-[9px] font-semibold text-white">
                  {formatIsoDuration(linkPreview.track.duration)}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="line-clamp-2 text-xs font-semibold text-ink leading-snug">
                {linkPreview.track.title}
              </h4>
              <p className="mt-1 truncate text-[11px] text-ink-muted">
                {linkPreview.track.channelTitle || "YouTube"}
              </p>

              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePlayVideo(linkPreview.track)}
                  disabled={disabled}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition-all hover:bg-accent-hi active:scale-95 shadow-md shadow-accent/20 disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.5 5.11c0-.94 1.02-1.53 1.83-1.05l11.05 6.39a1.22 1.22 0 0 1 0 2.1l-11.05 6.39c-.81.48-1.83-.11-1.83-1.05V5.11Z" />
                  </svg>
                  Play now
                </button>

                {canQueue && onQueue && (
                  <button
                    type="button"
                    onClick={() => handleQueueVideo(linkPreview.track)}
                    disabled={disabled}
                    className="flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-all hover:bg-accent/20 active:scale-95 disabled:opacity-50"
                  >
                    <span>+</span>
                    Add to queue
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Playlist Preview Card */}
      {linkPreview && linkPreview.type === "playlist" && (
        <div className="mt-3.5 overflow-hidden rounded-xl border border-line-strong bg-white/4 p-3.5 shadow-xl backdrop-blur-sm transition-all">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs text-ink-muted font-medium">
              {linkPreview.tracks.length}{" "}
              {linkPreview.tracks.length === 1 ? "track" : "tracks"}
            </span>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setLinkPreview(null);
              }}
              className="rounded-full p-1 text-xs text-ink-faint hover:bg-white/10 hover:text-ink transition-colors"
              title="Dismiss preview"
            >
              ✕
            </button>
          </div>

          <div className="mb-3">
            <h3 className="font-semibold text-sm text-ink truncate">
              {linkPreview.title}
            </h3>
            <p className="mt-0.5 text-[11px] text-ink-faint">
              1st video plays immediately, remaining{" "}
              {linkPreview.tracks.length - 1} queued for the room.
            </p>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handlePlayPlaylist(linkPreview)}
              disabled={disabled}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition-all hover:bg-accent-hi active:scale-95 shadow-md shadow-accent/20 disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.5 5.11c0-.94 1.02-1.53 1.83-1.05l11.05 6.39a1.22 1.22 0 0 1 0 2.1l-11.05 6.39c-.81.48-1.83-.11-1.83-1.05V5.11Z" />
              </svg>
              Play playlist
            </button>

            {canQueue && onQueue && (
              <button
                type="button"
                onClick={() => handleQueueAllPlaylist(linkPreview)}
                disabled={disabled}
                className="flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-all hover:bg-accent/20 active:scale-95 disabled:opacity-50"
              >
                <span>+</span>
                Queue all ({linkPreview.tracks.length})
              </button>
            )}
          </div>

          {/* Scrollable list of playlist videos */}
          <div className="space-y-1 max-h-44 overflow-y-auto syncd-scrollbar border-t border-line/50 pt-2 pr-1">
            {linkPreview.tracks.map((t, idx) => {
              const len = formatIsoDuration(t.duration);
              return (
                <div
                  key={t.videoId + idx}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-white/5"
                >
                  <span className="w-4 shrink-0 font-mono text-[10px] text-ink-faint text-center">
                    {idx + 1}
                  </span>
                  <img
                    src={t.thumbnailUrl}
                    alt=""
                    className="h-7 w-11 shrink-0 rounded bg-black/40 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-ink">
                      {t.title}
                    </p>
                    {t.channelTitle && (
                      <p className="truncate text-[10px] text-ink-muted">
                        {t.channelTitle}
                      </p>
                    )}
                  </div>
                  {len && (
                    <span className="shrink-0 font-mono text-[10px] text-ink-faint">
                      {len}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {disabled && (
        <p className="mt-3 text-xs text-warning">
          {disabledMessage ??
            "Connecting to the room — playback controls will be available in a moment."}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {!busy && hasSearched && results.length === 0 && !error && (
        <p className="py-6 text-center text-sm text-ink-faint">
          No results found. Try a different search.
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-4 max-h-80 space-y-1 overflow-y-auto">
          {results.map((result) => {
            const length = formatIsoDuration(result.duration);
            return (
              <li key={result.videoId}>
                {canQueue && onQueue ? (
                  // Host with a track playing: show Play now + Add to queue
                  <div className="group flex w-full items-center gap-3 rounded-md px-2 py-2 hover:bg-white/5">
                    <img
                      src={result.thumbnailUrl}
                      alt=""
                      className="h-12 w-16 shrink-0 rounded-md bg-white/5 object-cover"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {result.title}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {result.channelTitle}
                      </p>
                    </div>
                    {length && (
                      <span className="shrink-0 font-mono text-xs text-ink-faint">
                        {length}
                      </span>
                    )}
                    <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                      <button
                        onClick={() => { onSelect(result); setResults([]); }}
                        disabled={disabled}
                        className="rounded px-2.5 py-1 text-xs font-semibold text-ink-muted ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-ink disabled:pointer-events-none disabled:opacity-50"
                      >
                        Play now
                      </button>
                      <button
                        onClick={() => { onQueue(result); setResults([]); }}
                        disabled={disabled}
                        className="rounded bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/25 disabled:pointer-events-none disabled:opacity-50"
                      >
                        + Queue
                      </button>
                    </div>
                  </div>
                ) : (
                  // Default: single-click plays immediately
                  <button
                    onClick={() => onSelect(result)}
                    disabled={disabled}
                    className="group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/5 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <img
                      src={result.thumbnailUrl}
                      alt=""
                      className="h-12 w-16 shrink-0 rounded-md bg-white/5 object-cover"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink group-hover:text-accent">
                        {result.title}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {result.channelTitle}
                      </p>
                    </div>
                    {length && (
                      <span className="shrink-0 font-mono text-xs text-ink-faint">
                        {length}
                      </span>
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
