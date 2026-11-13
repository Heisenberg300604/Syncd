import { useEffect, useState } from "react";

/**
 * Fetches the highest-resolution album art from the iTunes Search API.
 * No API key required. Returns null while loading or on failure.
 */
export function useAlbumArt(title: string, artist: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const query = encodeURIComponent(`${title} ${artist}`);
    fetch(`https://itunes.apple.com/search?term=${query}&media=music&limit=1`)
      .then((r) => r.json())
      .then((data) => {
        const art: string | undefined = data.results?.[0]?.artworkUrl100;
        if (art) {
          setUrl(art.replace("100x100bb", "500x500bb"));
        }
      })
      .catch(() => {
        // Silently fall back – the caller renders a gradient placeholder.
      });
  }, [title, artist]);

  return url;
}
