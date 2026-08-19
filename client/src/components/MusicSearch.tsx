import { useState } from "react";
import { useAuth } from "@clerk/react";
import { searchMusic } from "../services/api";
import type { YouTubeSearchResult } from "../services/types";

interface MusicSearchProps {
  onSelect: (result: YouTubeSearchResult) => void;
}

export function MusicSearch({ onSelect }: MusicSearchProps) {
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length === 0) return;

    setSearching(true);
    setError(null);
    setHasSearched(true);
    try {
      const { results } = await searchMusic(getToken, trimmed);
      setResults(results);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Search failed";
      setError(message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
      <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
        Search Music
      </h2>
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a song..."
          autoComplete="off"
          disabled={searching}
          className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={searching || query.trim().length === 0}
          className="rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-400 mb-3">{error}</p>
      )}

      {!searching && hasSearched && results.length === 0 && !error && (
        <p className="text-sm text-zinc-500 text-center py-4">
          No results found. Try a different search.
        </p>
      )}

      {results.length > 0 && (
        <ul className="space-y-2 max-h-80 overflow-y-auto">
          {results.map((result) => (
            <li key={result.videoId}>
              <button
                onClick={() => onSelect(result)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
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
                {result.duration && (
                  <span className="text-xs text-zinc-500 font-mono flex-shrink-0">
                    {result.duration}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}