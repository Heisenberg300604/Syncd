import { useState } from "react";
import { useAuth } from "@clerk/react";
import { resolveYouTubeLink, searchMusic } from "../services/api";
import { formatIsoDuration } from "../utils/duration";
import type { YouTubeSearchResult } from "../services/types";

interface MusicSearchProps {
  onSelect: (result: YouTubeSearchResult) => void;
  disabled?: boolean;
}

/** Matches any youtube.com / youtu.be URL, with or without a scheme. */
const YOUTUBE_LINK_REGEX =
  /(^|\/\/|\s)((www|m|music)\.)?(youtube(-nocookie)?\.com|youtu\.be)\//i;

function isYouTubeLink(value: string): boolean {
  return YOUTUBE_LINK_REGEX.test(value);
}

export function MusicSearch({ onSelect, disabled = false }: MusicSearchProps) {
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
    <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
      <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-1">
        Add something to watch
      </h2>
      <p className="text-xs text-zinc-500 mb-4">
        Search for a song, or paste any YouTube link to play it for the whole
        room.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Song name or https://youtube.com/watch?v=..."
          autoComplete="off"
          disabled={busy || disabled}
          className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || disabled || query.trim().length === 0}
          className="rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {busy ? "Loading..." : submitLabel}
        </button>
      </form>

      {disabled && (
        <p className="text-xs text-amber-400 mb-3">
          Connecting to the room — playback controls will be available in a
          moment.
        </p>
      )}

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {!busy && hasSearched && results.length === 0 && !error && (
        <p className="text-sm text-zinc-500 text-center py-4">
          No results found. Try a different search.
        </p>
      )}

      {results.length > 0 && (
        <ul className="space-y-2 max-h-80 overflow-y-auto">
          {results.map((result) => {
            const length = formatIsoDuration(result.duration);
            return (
              <li key={result.videoId}>
                <button
                  onClick={() => onSelect(result)}
                  disabled={disabled}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <img
                    src={result.thumbnailUrl}
                    alt=""
                    className="h-12 w-16 rounded object-cover flex-shrink-0 bg-zinc-800"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate group-hover:text-violet-300">
                      {result.title}
                    </p>
                    <p className="text-xs text-zinc-400 truncate">
                      {result.channelTitle}
                    </p>
                  </div>
                  {length && (
                    <span className="text-xs text-zinc-500 font-mono flex-shrink-0">
                      {length}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
