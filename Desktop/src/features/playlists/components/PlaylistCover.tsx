import React, { useState, useEffect } from 'react';
import { ListMusic } from 'lucide-react';
import type { Playlist } from '../../../stores/usePlaylistStore';
import { useLibraryStore } from '../../../stores/useLibraryStore';

interface PlaylistCoverProps {
  playlist: Playlist;
  size?: 'sm' | 'card' | 'lg';
  className?: string;
}

export const PlaylistCover: React.FC<PlaylistCoverProps> = ({
  playlist,
  size = 'card',
  className = '',
}) => {
  const { tracks: libraryTracks, getArtworkUrl, artworkCache, getArtwork } = useLibraryStore();
  const [artworks, setArtworks] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    const playlistTracks = libraryTracks.filter((t) => playlist.trackIds.includes(t.id));

    // Collect synchronous cached artworks
    const collected: string[] = [];
    const seenKeys = new Set<string>();
    const missingTrackIds: string[] = [];

    for (const t of playlistTracks) {
      const url = getArtworkUrl(t.artworkHash) || artworkCache[t.id];
      if (url) {
        const key = t.artworkHash || url;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          collected.push(url);
          if (collected.length === 4) break;
        }
      } else if (t.hasArtwork) {
        missingTrackIds.push(t.id);
      }
    }

    setArtworks([...collected]);

    // Asynchronously resolve missing artworks if less than 4 unique artworks are found
    if (collected.length < 4 && missingTrackIds.length > 0) {
      const needed = 4 - collected.length;
      const toFetch = missingTrackIds.slice(0, needed);

      Promise.all(toFetch.map((id) => getArtwork(id))).then((fetched) => {
        if (!isMounted) return;
        const valid = fetched.filter((u): u is string => Boolean(u));
        if (valid.length > 0) {
          setArtworks((prev) => {
            const next = [...prev];
            for (const u of valid) {
              if (!next.includes(u) && next.length < 4) {
                next.push(u);
              }
            }
            return next;
          });
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [playlist.trackIds, libraryTracks, getArtworkUrl, artworkCache, getArtwork]);

  const sizeClasses = {
    sm: 'w-9 h-9 rounded-lg shrink-0',
    card: 'aspect-square w-full rounded-xl',
    lg: 'w-20 h-20 sm:w-28 sm:h-28 rounded-2xl shrink-0 shadow-xl',
  }[size];

  // 1. Fallback Cover: 0 artworks
  if (artworks.length === 0) {
    return (
      <div
        className={`${sizeClasses} bg-gradient-to-br from-zinc-850 to-zinc-950 border border-zinc-800/80 flex items-center justify-center overflow-hidden shadow-inner select-none ${className}`}
      >
        <ListMusic
          className={`${
            size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-12 h-12'
          } text-zinc-600 group-hover:text-amber-400/80 transition-colors`}
        />
      </div>
    );
  }

  // 2. Single Full Cover: 1 to 3 unique artworks
  if (artworks.length < 4) {
    return (
      <div
        className={`${sizeClasses} overflow-hidden border border-zinc-800/80 bg-zinc-900 shadow-md select-none ${className}`}
      >
        <img
          src={artworks[0]}
          alt={playlist.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  // 3. Spotify 2x2 Grid Cover: 4+ unique artworks
  return (
    <div
      className={`${sizeClasses} overflow-hidden border border-zinc-800/80 bg-zinc-900 grid grid-cols-2 grid-rows-2 shadow-md select-none ${className}`}
    >
      {artworks.slice(0, 4).map((url, i) => (
        <div key={i} className="relative w-full h-full overflow-hidden bg-zinc-950/60">
          <img
            src={url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      ))}
    </div>
  );
};
