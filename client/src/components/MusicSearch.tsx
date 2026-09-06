import { useState } from "react";
import { useAuth } from "@clerk/react";
import { resolveYouTubeLink, searchMusic } from "../services/api";
import { formatIsoDuration } from "../utils/duration";
import type { YouTubeSearchResult } from "../services/types";
import { Card } from "./ui/Card";

interface MusicSearchProps {
  onSelect: (result: YouTubeSearchResult) => void;
  disabled?: boolean;
  /** Overrides the default "connecting" copy shown while disabled. */
  disabledMessage?: string;
}

/** Matches any youtube.com / youtu.be URL, with or without a scheme. */
const YOUTUBE_LINK_REGEX =
  /(^|\/\/|\s)((www|m|music)\.)?(youtube(-nocookie)?\.com|youtu\.be)\//i;

function isYouTubeLink(value: string): boolean {
  return YOUTUBE_LINK_REGEX.test(value);
}

export function MusicSearch({
  onSelect,
  disabled = false,
  disabledMessage,
}: MusicSearchProps) {
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length === 0) return;

    setBusy(true);
    setError(null);

    try {
      // A pasted link goes straight to the room; a phrase runs a search.
      if (isYouTubeLink(trimmed)) {
        const { result } = await resolveYouTubeLink(getToken, trimmed);
        setResults([]);
        setHasSearched(false);
        setQuery("");
        onSelect(result);
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

  const submitLabel = isYouTubeLink(query.trim()) ? "Play link" : "Search";

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
        Add music
      </h2>
      <p className="mt-1 text-xs text-ink-faint">
        Search for a song, or paste a YouTube link to play it for the whole room.
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
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
