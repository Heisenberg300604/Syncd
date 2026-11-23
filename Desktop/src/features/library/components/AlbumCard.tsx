import React, { useState, useEffect } from 'react';
import { Play, Pause, Disc3, Music2, Edit3 } from 'lucide-react';
import type { AlbumGroup } from '../../../types/album';
import { usePlayerStore } from '../../../stores/usePlayerStore';
import { useLibraryStore } from '../../../stores/useLibraryStore';

export interface AlbumCardProps {
  album: AlbumGroup;
  onOpenDetail: (album: AlbumGroup) => void;
  onEditAlbum?: (album: AlbumGroup) => void;
}

const MusicFolderIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor">
    <path
      d="M3 7V5a2 2 0 0 1 2-2h4.5a2 2 0 0 1 1.4.6L12.5 5H19a2 2 0 0 1 2 2v2"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-amber-500"
    />
    <rect
      x="2"
      y="7"
      width="20"
      height="13"
      rx="2.5"
      fill="currentColor"
      fillOpacity="0.25"
      strokeWidth="1.8"
      strokeLinejoin="round"
      className="text-amber-400"
    />
    <path
      d="M13 14.5V11a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1.5M13 14.5a1.5 1.5 0 1 1-2-1.42 1.5 1.5 0 0 1 2 1.42Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-amber-300 fill-amber-300"
    />
  </svg>
);

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album, onOpenDetail, onEditAlbum }) => {
  const { currentTrack, status, playTrack, play, pause } = usePlayerStore();
  const { getArtworkUrl, artworkCache, getArtwork, invalidateArtworkUrl } = useLibraryStore();

  const syncArtwork =
    (album.artworkHash ? getArtworkUrl(album.artworkHash) : null) ||
    artworkCache[album.representativeTrackId] ||
    null;

  const [artwork, setArtwork] = useState<string | null>(syncArtwork);
  const [hasError, setHasError] = useState(false);

  const isCurrentAlbum = Boolean(
    currentTrack && album.tracks.some((t) => t.id === currentTrack.id)
  );
  const isPlayingThisAlbum = isCurrentAlbum && status === 'playing';

  useEffect(() => {
    if (syncArtwork && !hasError) {
      setArtwork(syncArtwork);
      return;
    }
    let isMounted = true;
    if (album.hasArtwork && (!artwork || hasError)) {
      getArtwork(album.representativeTrackId).then((src) => {
        if (isMounted) {
          if (src) {
            setArtwork(src);
            setHasError(false);
          } else {
            setHasError(true);
          }
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [album.representativeTrackId, album.hasArtwork, syncArtwork, artwork, hasError, getArtwork]);

  const handleImageError = () => {
    if (album.artworkHash) {
      invalidateArtworkUrl(album.artworkHash);
    }
    invalidateArtworkUrl(album.representativeTrackId);

    if (album.hasArtwork) {
      getArtwork(album.representativeTrackId).then((src) => {
        if (src && src !== artwork) {
          setArtwork(src);
          setHasError(false);
        } else {
          setHasError(true);
        }
      }).catch(() => setHasError(true));
    } else {
      setHasError(true);
    }
  };

  const handlePlayAlbum = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isPlayingThisAlbum) {
      await pause();
      return;
    }

    if (isCurrentAlbum && status === 'paused') {
      await play();
      return;
    }

    if (album.tracks.length === 0) return;

    const queueTracks = album.tracks.map((t) => ({
      id: t.id,
      trackId: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      durationSeconds: t.durationSeconds,
      artworkUrl:
        artworkCache[t.id] ||
        (t.artworkHash ? getArtworkUrl(t.artworkHash) : undefined) ||
        artwork ||
        undefined,
      source: 'local' as const,
      path: t.path,
      format: t.format,
      bitrateKbps: t.bitrateKbps ?? undefined,
    }));

    await playTrack(queueTracks[0], queueTracks);
  };

  const hasNoArtwork = !album.hasArtwork || !artwork || hasError;

  return (
    <div
      onClick={() => onOpenDetail(album)}
      data-album-id={album.id}
      className={`group cursor-pointer select-none transition-all duration-200 flex flex-col justify-between p-3 rounded-2xl w-full overflow-hidden ${
        hasNoArtwork
          ? 'bg-zinc-900/70 hover:bg-zinc-850 border border-zinc-800/80 hover:border-amber-500/40 shadow-md backdrop-blur-sm'
          : 'bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800/80 hover:border-zinc-700 shadow-md'
      } ${isCurrentAlbum ? 'ring-1 ring-amber-500/50' : ''}`}
    >
      {/* Artwork Container */}
      <div className="relative aspect-square w-full rounded-xl overflow-hidden flex items-center justify-center bg-zinc-950/40">
        {artwork && !hasError ? (
          <img
            src={artwork}
            alt=""
            onError={handleImageError}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-white/5 to-transparent">
            <div className="absolute w-20 h-20 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />
            {album.isUnknownAlbum ? (
              <Music2 className="w-10 h-10 text-zinc-500/70 group-hover:text-amber-400/80 group-hover:scale-110 transition-all duration-300" />
            ) : (
              <Disc3 className="w-10 h-10 text-zinc-500/70 group-hover:text-amber-400/80 group-hover:scale-110 transition-all duration-300" />
            )}
          </div>
        )}

        {/* Floating Play Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs">
          <button
            type="button"
            onClick={handlePlayAlbum}
            className="w-11 h-11 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-all cursor-pointer"
            aria-label={isPlayingThisAlbum ? 'Pause Album' : 'Play Album'}
          >
            {isPlayingThisAlbum ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>
        </div>

        {/* Edit Album Button on Card */}
        {onEditAlbum && !album.isUnknownAlbum && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditAlbum(album);
            }}
            className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/60 text-zinc-300 hover:text-amber-400 hover:bg-black/80 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10"
            title="Edit Album Metadata & Tags"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Scaled Merged Header Pill (Image 1 & Image 2) */}
        <div className="absolute top-2 right-2 z-10 pointer-events-none">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-950/90 backdrop-blur-md border border-zinc-800 shadow-md ring-1 ring-white/[0.08] whitespace-nowrap">
            <MusicFolderIcon className="w-3 h-3 shrink-0" />
            <span className="text-[10px] font-mono font-bold text-zinc-200 whitespace-nowrap">
              {album.trackCount} {album.isUnknownAlbum ? 'singles' : album.trackCount === 1 ? 'track' : 'tracks'}
            </span>
            {album.format && (
              <>
                <span className="text-zinc-600 text-[10px]">•</span>
                <span className="text-[10px] font-mono font-black text-amber-400 uppercase tracking-wider whitespace-nowrap">
                  {album.format}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Album Info */}
      <div className="pt-3 pb-1 px-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`text-xs font-semibold truncate ${
              isCurrentAlbum ? 'text-amber-400' : 'text-zinc-100 group-hover:text-amber-300'
            } transition-colors`}
            title={album.album}
          >
            {album.album}
          </p>
          <span className="text-[10px] font-mono text-zinc-500 tabular-nums shrink-0">
            {formatDuration(album.totalDuration)}
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 truncate mt-0.5" title={album.artist}>
          {album.artist}
          {album.year ? ` • ${album.year}` : ''}
        </p>
      </div>
    </div>
  );
};
