import React, { useState, useEffect } from 'react';
import { Play, Pause, Music, Edit3 } from 'lucide-react';
import type { TrackRow } from '../../../types/library';
import { usePlayerStore } from '../../../stores/usePlayerStore';
import { useLibraryStore } from '../../../stores/useLibraryStore';
import { useSettingsStore } from '../../../stores/useSettingsStore';
import { CodecBadge } from '../../../components/ui/CodecBadge';

interface TrackCardProps {
  track: TrackRow;
  onEditMetadata?: (track: TrackRow) => void;
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export const TrackCard: React.FC<TrackCardProps> = ({ track, onEditMetadata }) => {
  const { currentTrack, status, playTrack, play, pause } = usePlayerStore();
  const { getArtworkUrl, artworkCache, getArtwork, invalidateArtworkUrl } = useLibraryStore();

  const syncArtwork = getArtworkUrl(track.artworkHash) || artworkCache[track.id] || null;
  const [artwork, setArtwork] = useState<string | null>(syncArtwork);
  const [hasError, setHasError] = useState(false);
  const isCurrent = currentTrack?.id === track.id;
  const isCurrentlyPlaying = isCurrent && status === 'playing';

  useEffect(() => {
    if (syncArtwork && !hasError) {
      setArtwork(syncArtwork);
      return;
    }
    let isMounted = true;
    if (track.hasArtwork && (!artwork || hasError)) {
      getArtwork(track.id).then((src) => {
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
  }, [track.id, track.hasArtwork, syncArtwork, artwork, hasError, getArtwork]);

  const handleImageError = () => {
    // If fast-path .jpg guess failed, invalidate cache and query real file from Rust (.png or re-extraction)
    if (track.artworkHash) {
      invalidateArtworkUrl(track.artworkHash);
    }
    invalidateArtworkUrl(track.id);

    if (track.hasArtwork) {
      getArtwork(track.id).then((src) => {
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

  const handlePlay = async () => {
    if (isCurrent) {
      if (status === 'playing') {
        await pause();
      } else {
        await play();
      }
      return;
    }

    const { autoQueue } = useSettingsStore.getState();

    let queueTracks: any = undefined;
    if (autoQueue) {
      const allTracks = useLibraryStore.getState().tracks;
      queueTracks = allTracks.map((t) => ({
        id: t.id,
        trackId: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        durationSeconds: t.durationSeconds,
        artworkUrl: artworkCache[t.id] || undefined,
        source: 'local' as const,
        path: t.path,
        format: t.format,
        bitrateKbps: t.bitrateKbps ?? undefined,
      }));
    }

    await playTrack(
      {
        id: track.id,
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        durationSeconds: track.durationSeconds,
        artworkUrl: artwork || undefined,
        source: 'local',
        path: track.path,
        format: track.format,
        bitrateKbps: track.bitrateKbps ?? undefined,
      },
      queueTracks
    );
  };

  const hasNoArtwork = !track.hasArtwork || !artwork || hasError;

  return (
    <div
      data-track-id={track.id}
      onClick={handlePlay}
      className={`group cursor-pointer select-none transition-all duration-200 flex flex-col justify-between p-3 rounded-2xl w-full overflow-hidden ${
        hasNoArtwork
          ? 'bg-zinc-900/70 hover:bg-zinc-850 border border-zinc-800/80 hover:border-amber-500/40 shadow-md backdrop-blur-sm'
          : 'bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800/80 hover:border-zinc-700 shadow-md'
      } ${isCurrent ? 'ring-1 ring-amber-500/50' : ''}`}
    >
      {/* Artwork or Glass Container */}
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
            {/* Ambient soft glow */}
            <div className="absolute w-20 h-20 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />
            <Music className="w-10 h-10 text-zinc-500/70 group-hover:text-amber-400/80 group-hover:scale-110 transition-all duration-300" />
          </div>
        )}

        {/* Floating Play Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePlay();
            }}
            className="w-11 h-11 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-all cursor-pointer"
            aria-label={isCurrentlyPlaying ? 'Pause' : 'Play'}
          >
            {isCurrentlyPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>
        </div>

        {/* Floating Edit Metadata Button */}
        {onEditMetadata && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditMetadata(track);
            }}
            className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/60 text-zinc-300 hover:text-amber-400 hover:bg-black/80 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10"
            title="Edit Metadata & File Tags"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Modern Clean Audio Codec Badge with Micro-Interactions */}
        {track.format && (
          <div className="absolute top-2 right-2 z-10 filter drop-shadow-md">
            <CodecBadge
              format={track.format}
              bitrateKbps={track.bitrateKbps}
              variant="card"
              size="xs"
            />
          </div>
        )}
      </div>

      {/* Track Info */}
      <div className="pt-3 pb-1 px-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`text-xs font-semibold truncate ${
              isCurrent ? 'text-amber-400' : 'text-zinc-100 group-hover:text-amber-300'
            } transition-colors`}
          >
            {track.title}
          </p>
          <span className="text-[10px] font-mono text-zinc-500 tabular-nums shrink-0">
            {formatDuration(track.durationSeconds)}
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
          {track.artist || 'Unknown Artist'}
        </p>
      </div>
    </div>
  );
};
