import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import {
  resolveYouTubeLink,
  resolveYouTubePlaylist,
  searchMusic,
} from "../services/api";
import { formatIsoDuration } from "../utils/duration";
import type { YouTubeSearchResult } from "../services/types";

interface RoomNavbarSearchProps {
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

export function RoomNavbarSearch({
  onSelect,
  disabled = false,
  canQueue = false,
  onQueue,
  disabledMessage,
}: RoomNavbarSearchProps) {
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Link preview state
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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
      setIsOpen(true);
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
          err instanceof Error
            ? err.message
            : "Failed to resolve link preview";
        setPreviewError(msg);
        setLinkPreview(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, getToken]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || busy || disabled) return;

    // If already showing a single video preview, play it
    if (linkPreview && linkPreview.type === "video") {
      onSelect(linkPreview.track);
      setQuery("");
      setLinkPreview(null);
      setIsOpen(false);
      return;
    }

    // If showing a playlist preview, play first track and queue the rest
    if (linkPreview && linkPreview.type === "playlist") {
      handlePlayPlaylist(linkPreview);
      return;
    }

    // Plain text search
    setBusy(true);
    setError(null);
    setHasSearched(true);
    setIsOpen(true);

    try {
      const data = await searchMusic(getToken, trimmed);
      setResults(data.results);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Search failed. Try again.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function handlePlayVideo(track: YouTubeSearchResult) {
    onSelect(track);
    setQuery("");
    setResults([]);
    setLinkPreview(null);
    setIsOpen(false);
  }

  function handleQueueVideo(track: YouTubeSearchResult) {
    if (!onQueue) return;
    onQueue(track);
    setQuery("");
    setResults([]);
    setLinkPreview(null);
    setIsOpen(false);
  }

  function handlePlayPlaylist(preview: PlaylistPreview) {
    if (preview.tracks.length === 0) return;
    const [first, ...rest] = preview.tracks;
    if (first) onSelect(first);
    if (onQueue && rest.length > 0) {
      rest.forEach((t) => onQueue(t));
    }
    setQuery("");
    setLinkPreview(null);
    setIsOpen(false);
  }

  function handleQueueAllPlaylist(preview: PlaylistPreview) {
    if (!onQueue) return;
    preview.tracks.forEach((t) => onQueue(t));
    setQuery("");
    setLinkPreview(null);
    setIsOpen(false);
  }

  const isPlaylist = isYouTubePlaylistLink(query.trim());
  const hasDropdownContent =
    isOpen &&
    (previewLoading ||
      previewError ||
      linkPreview !== null ||
      busy ||
      error !== null ||
      results.length > 0 ||
      (hasSearched && results.length === 0));

  return (
    <div ref={containerRef} className="relative w-full max-w-md lg:max-w-xl">
      {/* Pill Search Form matching reference image */}
      <form
        onSubmit={handleSearch}
        className="group relative flex h-10 w-full items-center rounded-full border border-white/10 bg-[#12100e] text-ink transition-all duration-200 hover:border-white/20 focus-within:border-accent/60 focus-within:ring-1 focus-within:ring-accent/40"
      >
        {/* YouTube Logo Left Cap */}
        <div className="flex h-full w-12 sm:w-14 shrink-0 items-center justify-center rounded-l-full border-r border-white/10 bg-white/[0.04]">
          <svg viewBox="-2 0 30 20" className="h-5 w-[2.5rem]" aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="30" height="20" rx="5" fill="#FF0000"/>
            <path d="M13 14V6L21 10L13 14Z" fill="white"/>
          </svg>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim().length > 0 || results.length > 0 || linkPreview) {
              setIsOpen(true);
            }
          }}
          placeholder="Search songs or paste YouTube link…"
          autoComplete="off"
          disabled={disabled}
          className="h-full min-w-0 flex-1 bg-transparent pl-3 pr-2 text-sm text-ink placeholder:text-ink-faint/80 focus:outline-none disabled:opacity-50"
        />

        {/* Clear query button */}
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
              setLinkPreview(null);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="mr-1 rounded-full p-1 text-xs text-ink-faint transition-colors hover:bg-white/10 hover:text-ink"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}

        {/* Integrated Right Search Cap with Magnifying Glass */}
        <button
          type="submit"
          disabled={disabled || query.trim().length === 0 || busy}
          className="flex h-full w-12 sm:w-14 shrink-0 items-center justify-center rounded-r-full border-l border-white/10 bg-white/[0.04] text-ink-muted transition-all duration-150 hover:bg-white/[0.08] hover:text-ink active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          aria-label="Search"
          title="Search"
        >
          {busy ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          ) : (
            <svg
              className="h-4 w-4 text-inherit"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          )}
        </button>
      </form>

      {/* Floating Popover Dropdown for Results & Previews */}
      {hasDropdownContent && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[75vh] overflow-y-auto rounded-2xl border border-line-strong bg-surface/95 p-3.5 shadow-2xl backdrop-blur-xl syncd-scrollbar">
          {/* Header Row in Dropdown */}
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
              {linkPreview
                ? isPlaylist
                  ? "Playlist Preview"
                  : "Track Preview"
                : results.length > 0
                  ? `Results (${results.length})`
                  : "Search"}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full px-1.5 py-0.5 text-[11px] text-ink-faint transition-colors hover:bg-white/10 hover:text-ink"
            >
              Esc to close
            </button>
          </div>

          {/* Loading Preview Spinner */}
          {previewLoading && (
            <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white/3 p-3 text-xs text-ink-muted animate-pulse">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent shrink-0" />
              <span>Resolving {isPlaylist ? "playlist" : "video"} preview…</span>
            </div>
          )}

          {/* Preview Error */}
          {previewError && (
            <div className="flex items-center justify-between rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
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
            <div className="relative overflow-hidden rounded-xl border border-line-strong bg-white/4 p-3 shadow-xl backdrop-blur-sm">
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
            <div className="overflow-hidden rounded-xl border border-line-strong bg-white/4 p-3 shadow-xl backdrop-blur-sm">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs text-ink-muted font-medium">
                  {linkPreview.tracks.length}{" "}
                  {linkPreview.tracks.length === 1 ? "track" : "tracks"}
                </span>
              </div>

              <div className="mb-3">
                <h3 className="font-semibold text-sm text-ink truncate">
                  {linkPreview.title}
                </h3>
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  1st video plays immediately, remaining {linkPreview.tracks.length - 1} queued for the room.
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
              <div className="space-y-1 max-h-40 overflow-y-auto syncd-scrollbar border-t border-line/50 pt-2 pr-1">
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

          {/* Search Busy Spinner */}
          {busy && (
            <div className="flex items-center justify-center gap-2.5 py-6 text-sm text-ink-muted">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span>Searching YouTube…</span>
            </div>
          )}

          {/* Search Error */}
          {error && <p className="p-3 text-center text-sm text-danger">{error}</p>}

          {/* No Results Message */}
          {!busy && hasSearched && results.length === 0 && !error && !linkPreview && (
            <p className="py-6 text-center text-sm text-ink-faint">
              No results found. Try a different search.
            </p>
          )}

          {/* Search Results List */}
          {results.length > 0 && !busy && (
            <ul className="space-y-1">
              {results.map((result) => {
                const length = formatIsoDuration(result.duration);
                return (
                  <li
                    key={result.videoId}
                    className="group flex w-full items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/5"
                  >
                    <img
                      src={result.thumbnailUrl}
                      alt=""
                      className="h-11 w-16 shrink-0 rounded-lg bg-white/5 object-cover"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs sm:text-sm font-medium text-ink group-hover:text-accent">
                        {result.title}
                      </p>
                      <p className="truncate text-[11px] text-ink-muted">
                        {result.channelTitle}
                      </p>
                    </div>
                    {length && (
                      <span className="shrink-0 font-mono text-[11px] text-ink-faint">
                        {length}
                      </span>
                    )}
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => handlePlayVideo(result)}
                        disabled={disabled}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-ink-muted ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-ink disabled:pointer-events-none disabled:opacity-50"
                      >
                        Play now
                      </button>
                      {canQueue && onQueue && (
                        <button
                          onClick={() => handleQueueVideo(result)}
                          disabled={disabled}
                          className="rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/25 disabled:pointer-events-none disabled:opacity-50"
                        >
                          + Queue
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {disabled && disabledMessage && (
            <p className="mt-2 text-center text-xs text-warning">
              {disabledMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
