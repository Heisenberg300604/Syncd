import React, { useState, useEffect } from 'react';
import { Play, Pause, ListPlus, X, Clock, Disc3, Music2, Edit3 } from 'lucide-react';
import type { AlbumGroup } from '../../../types/album';
import type { TrackRow } from '../../../types/library';
import { usePlayerStore } from '../../../stores/usePlayerStore';
import { useLibraryStore } from '../../../stores/useLibraryStore';
import { useToastStore } from '../../../stores/useToastStore';
import { CodecBadge } from '../../../components/ui/CodecBadge';

export interface AlbumDetailModalProps {
  isOpen: boolean;
  album: AlbumGroup | null;
  onClose: () => void;
  onEditAlbum?: (album: AlbumGroup) => void;
  onEditTrack?: (track: TrackRow) => void;
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export const AlbumDetailModal: React.FC<AlbumDetailModalProps> = ({
  isOpen,
  album,
  onClose,
  onEditAlbum,
  onEditTrack,
}) => {
  const { currentTrack, status, playTrack, enqueueTracks, play, pause } = usePlayerStore();
  const { getArtworkUrl, artworkCache, getArtwork, selectedTrackId, setSelectedTrackId } = useLibraryStore();
  const { addToast } = useToastStore();

  const [artwork, setArtwork] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!album) {
      setArtwork(null);
      setHasError(false);
      return;
    }

    const sync =
      (album.artworkHash ? getArtworkUrl(album.artworkHash) : null) ||
      artworkCache[album.representativeTrackId] ||
      null;

    if (sync && !hasError) {
      setArtwork(sync);
      return;
    }

    let isMounted = true;
    if (album.hasArtwork) {
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
  }, [album, hasError, getArtworkUrl, artworkCache, getArtwork]);

  const handleImageError = () => {
    if (album?.artworkHash) {
      useLibraryStore.getState().invalidateArtworkUrl(album.artworkHash);
    }
    if (album?.representativeTrackId) {
      useLibraryStore.getState().invalidateArtworkUrl(album.representativeTrackId);
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

  if (!isOpen || !album) return null;

  const isCurrentAlbum = Boolean(
    currentTrack && album.tracks.some((t) => t.id === currentTrack.id)
  );
  const isPlayingThisAlbum = isCurrentAlbum && status === 'playing';

  const buildQueueTracks = (startIdx = 0) => {
    const all = album.tracks.map((t) => ({
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
    return {
      selected: all[startIdx],
      queue: all,
    };
  };

  const handlePlayAll = async () => {
    if (isPlayingThisAlbum) {
      await pause();
      return;
    }
    if (isCurrentAlbum && status === 'paused') {
      await play();
      return;
    }
    if (album.tracks.length === 0) return;
    const { selected, queue } = buildQueueTracks(0);
    await playTrack(selected, queue);
  };

  const handleEnqueueAll = async () => {
    if (album.tracks.length === 0) return;
    const { queue } = buildQueueTracks(0);
    await enqueueTracks(queue);
    addToast({
      type: 'success',
      title: 'Added Album to Queue',
      message: `Enqueued ${album.tracks.length} tracks from "${album.album}".`,
    });
  };

  const handlePlaySpecificTrack = async (track: TrackRow, idx: number) => {
    if (currentTrack?.id === track.id) {
      if (status === 'playing') {
        await pause();
      } else {
        await play();
      }
      return;
    }
    const { selected, queue } = buildQueueTracks(idx);
    await playTrack(selected, queue);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ring-1 ring-white/[0.08]"
        onClick={(e) => e.stopPropagation()}
        data-album-id={album.id}
      >
        {/* Album Header Banner */}
        <div
          data-album-id={album.id}
          className="relative p-6 bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-800/80 flex flex-col sm:flex-row items-center sm:items-end gap-6"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Large Album Artwork */}
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl shrink-0 flex items-center justify-center">
            {artwork && !hasError ? (
              <img
                src={artwork}
                alt=""
                onError={handleImageError}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-amber-500/10 to-transparent">
                {album.isUnknownAlbum ? (
                  <Music2 className="w-14 h-14 text-zinc-600" />
                ) : (
                  <Disc3 className="w-14 h-14 text-zinc-600" />
                )}
              </div>
            )}
          </div>

          {/* Album Title & Metadata */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-300 uppercase tracking-widest inline-block mb-2">
              {album.isUnknownAlbum ? 'Collection' : 'Album'}
            </span>

            <h2 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight truncate leading-tight" title={album.album}>
              {album.album}
            </h2>

            <p className="text-sm font-semibold text-zinc-300 mt-1 truncate" title={album.artist}>
              {album.artist}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-zinc-400 mt-2 font-mono">
              {album.year && <span>{album.year}</span>}
              {album.year && <span>•</span>}
              <span>{album.trackCount} {album.trackCount === 1 ? 'song' : 'songs'}</span>
              <span>•</span>
              <span>{formatDuration(album.totalDuration)}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center sm:justify-start gap-3 mt-4">
              <button
                type="button"
                onClick={handlePlayAll}
                className="flex items-center gap-2 px-5 py-2 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-zinc-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              >
                {isPlayingThisAlbum ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause Album</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Play All</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleEnqueueAll}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 active:scale-95 border border-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs font-semibold transition-all cursor-pointer"
              >
                <ListPlus className="w-4 h-4" />
                <span>Add to Queue</span>
              </button>

              {onEditAlbum && (
                <button
                  type="button"
                  onClick={() => onEditAlbum(album)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 active:scale-95 border border-zinc-800 text-zinc-300 hover:text-amber-400 text-xs font-semibold transition-all cursor-pointer"
                  title="Batch Edit Album Tags & Artwork across all audio files"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Album</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tracks Table Container */}
        <div className="flex-1 overflow-y-auto p-4 select-none">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/80 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider sticky top-0 bg-zinc-950/95 backdrop-blur-xs z-10">
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3">Title</th>
                <th className="py-2.5 px-3 w-28 text-center hidden sm:table-cell">Format</th>
                <th className="py-2.5 px-3 w-20 text-right pr-4">
                  <Clock className="w-3.5 h-3.5 inline-block opacity-70" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/60">
              {album.tracks.map((track, idx) => {
                const isSelected = selectedTrackId === track.id;
                const isCurrent = currentTrack?.id === track.id;
                const isPlaying = isCurrent && status === 'playing';

                return (
                  <tr
                    key={track.id}
                    data-track-id={track.id}
                    onClick={() => setSelectedTrackId(track.id)}
                    onDoubleClick={() => handlePlaySpecificTrack(track, idx)}
                    className={`group transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-900/90 text-zinc-100'
                        : isCurrent
                        ? 'bg-amber-950/20 text-amber-300 hover:bg-amber-950/30'
                        : 'text-zinc-300 hover:bg-zinc-900/50'
                    }`}
                  >
                    {/* Track Number / Play Icon */}
                    <td className="py-2.5 px-3 text-center w-12 text-zinc-500 group-hover:text-zinc-200">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlaySpecificTrack(track, idx);
                        }}
                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-zinc-800 transition-colors mx-auto"
                      >
                        {isPlaying ? (
                          <Pause className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <span className="group-hover:hidden text-xs font-mono">
                            {isCurrent ? (
                              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            ) : (
                              track.trackNumber || idx + 1
                            )}
                          </span>
                        )}
                        <Play
                          className={`w-3.5 h-3.5 hidden group-hover:block ${
                            isCurrent ? 'text-amber-400' : 'text-zinc-200'
                          }`}
                        />
                      </button>
                    </td>

                    {/* Title & Artist */}
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col min-w-0">
                        <span
                          className={`font-semibold truncate ${
                            isCurrent ? 'text-amber-400' : 'text-zinc-200 group-hover:text-amber-300'
                          }`}
                        >
                          {track.title}
                        </span>
                        <span className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {track.artist}
                        </span>
                      </div>
                    </td>

                    {/* Format Badge */}
                    <td className="py-2.5 px-3 text-center hidden sm:table-cell">
                      {track.format ? (
                        <CodecBadge format={track.format} size="xs" />
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>

                    {/* Duration & Track Edit Action */}
                    <td className="py-2.5 px-3 text-right pr-4 font-mono text-zinc-400 tabular-nums">
                      <div className="flex items-center justify-end gap-2">
                        {onEditTrack && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditTrack(track);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-all cursor-pointer"
                            title="Edit Track Metadata & File Tags"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span>{formatDuration(track.durationSeconds)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
