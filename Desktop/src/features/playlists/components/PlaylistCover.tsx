import React, { useState, useEffect } from 'react';
import { ListMusic } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { usePlaylistStore, type Playlist } from '../../../stores/usePlaylistStore';
import { useLibraryStore } from '../../../stores/useLibraryStore';
import type { TrackRow } from '../../../types/library';

interface PlaylistCoverProps {
  playlist: Playlist;
  tracks?: TrackRow[];
  size?: 'sm' | 'card' | 'lg';
  className?: string;
}

export const PlaylistCover: React.FC<PlaylistCoverProps> = ({
  playlist,
  tracks: propTracks,
  size = 'card',
  className = '',
}) => {
  const { tracks: libraryTracks, getArtworkUrl, artworkCache, getArtwork } = useLibraryStore();
  const [artworks, setArtworks] = useState<string[]>([]);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const [customCoverFailed, setCustomCoverFailed] = useState(false);

  useEffect(() => {
    setCustomCoverFailed(false);
  }, [playlist.id, playlist.coverUrl]);

  useEffect(() => {
    setFailedUrls(new Set());
  }, [playlist.id, playlist.trackIds]);

  useEffect(() => {
    // If a valid custom cover exists or explicitly removed ('none'), skip collage artwork collection
    if ((playlist.coverUrl && playlist.coverUrl !== 'none' && !customCoverFailed) || playlist.coverUrl === 'none') {
      return;
    }

    let isMounted = true;

    const resolveArtworks = async () => {
      let playlistTracks =
        propTracks && propTracks.length > 0
          ? propTracks
          : libraryTracks.filter((t) => playlist.trackIds.includes(t.id));

      if (playlistTracks.length === 0 && playlist.trackIds.length > 0) {
        try {
          const fetched = await usePlaylistStore.getState().getPlaylistFullTracks(playlist.id);
          if (fetched && fetched.length > 0) {
            playlistTracks = fetched;
          }
        } catch {
          // ignore
        }
      }

      if (!isMounted) return;

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
    };

    resolveArtworks();

    return () => {
      isMounted = false;
    };
  }, [
    playlist.coverUrl,
    customCoverFailed,
    playlist.trackIds,
    propTracks,
    libraryTracks,
    getArtworkUrl,
    artworkCache,
    getArtwork,
  ]);

  const sizeClasses = {
    sm: 'w-9 h-9 rounded-lg shrink-0',
    card: 'aspect-square w-full rounded-xl',
    lg: 'w-20 h-20 sm:w-28 sm:h-28 rounded-2xl shrink-0 shadow-xl',
  }[size];

  // If user explicitly removed cover or set no cover
  if (playlist.coverUrl === 'none') {
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

  // Helper to resolve custom cover source (handles local filesystem path via Tauri asset protocol)
  const resolveCoverSrc = (rawUrl?: string): string | null => {
    if (!rawUrl || rawUrl === 'none') return null;
    if (
      rawUrl.startsWith('data:') ||
      rawUrl.startsWith('http://') ||
      rawUrl.startsWith('https://') ||
      rawUrl.startsWith('asset://')
    ) {
      return rawUrl;
    }
    try {
      return convertFileSrc(rawUrl);
    } catch {
      return rawUrl;
    }
  };

  const customSrc = resolveCoverSrc(playlist.coverUrl);

  // 1. Custom Cover (Priority)
  if (customSrc && !customCoverFailed) {
    return (
      <div
        className={`${sizeClasses} overflow-hidden border border-zinc-800/80 bg-zinc-900 shadow-md select-none ${className}`}
      >
        <img
          src={customSrc}
          alt=""
          onError={() => setCustomCoverFailed(true)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  const validArtworks = artworks.filter((url) => !failedUrls.has(url));

  // 2. Spotify 2x2 Grid Cover: 4+ unique artworks
  if (validArtworks.length >= 4) {
    return (
      <div
        className={`${sizeClasses} grid grid-cols-2 grid-rows-2 overflow-hidden border border-zinc-800/80 bg-zinc-900 shadow-md select-none ${className}`}
      >
        {validArtworks.slice(0, 4).map((url, idx) => (
          <div key={idx} className="relative w-full h-full overflow-hidden bg-zinc-950">
            <img
              src={url}
              alt=""
              onError={() => setFailedUrls((prev) => new Set([...prev, url]))}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              decoding="async"
            />
          </div>
        ))}
      </div>
    );
  }

  // 3. Fallback Clean Placeholder Cover
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
};
