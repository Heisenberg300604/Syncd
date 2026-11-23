import React, { useState } from 'react';
import { Play, Pause, Music, Disc, Clock, Edit3 } from 'lucide-react';
import type { TrackRow } from '../../../types/library';
import { usePlayerStore } from '../../../stores/usePlayerStore';
import { useLibraryStore } from '../../../stores/useLibraryStore';
import { useSettingsStore } from '../../../stores/useSettingsStore';
import { CodecBadge } from '../../../components/ui/CodecBadge';

interface TrackTableProps {
  tracks: TrackRow[];
  isLoading?: boolean;
  onEditMetadata?: (track: TrackRow) => void;
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export const TrackTable: React.FC<TrackTableProps> = ({ tracks, isLoading, onEditMetadata }) => {
  const { currentTrack, status, playTrack, play, pause } = usePlayerStore();
  const { selectedTrackId, setSelectedTrackId, getArtwork, artworkCache } = useLibraryStore();

  const handleRowClick = (track: TrackRow) => {
    setSelectedTrackId(track.id);
  };

  const handlePlayTrack = async (track: TrackRow) => {
    if (currentTrack?.id === track.id) {
      if (status === 'playing') {
        await pause();
      } else {
        await play();
      }
      return;
    }

    const cachedArtwork = artworkCache[track.id];
    const { autoQueue } = useSettingsStore.getState();

    let queueTracks: any = undefined;
    if (autoQueue) {
      queueTracks = tracks.map((t) => ({
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

    // Trigger local native audio playback immediately with zero delay
    playTrack(
      {
        id: track.id,
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        durationSeconds: track.durationSeconds,
        artworkUrl: cachedArtwork || undefined,
        source: 'local',
        path: track.path,
        format: track.format,
        bitrateKbps: track.bitrateKbps ?? undefined,
      },
      queueTracks
    );

    // Lazily update player artwork in background if not yet cached in memory
    if (track.hasArtwork && !cachedArtwork) {
      getArtwork(track.id).then((src) => {
        if (src) {
          const current = usePlayerStore.getState().currentTrack;
          if (current && current.id === track.id) {
            usePlayerStore.setState({
              currentTrack: { ...current, artworkUrl: src },
            });
          }
        }
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-zinc-500 gap-3">
        <div className="w-6 h-6 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-xs">Loading tracks...</span>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center text-zinc-500">
        <Disc className="w-12 h-12 text-zinc-700 mb-3" />
        <p className="text-sm font-medium text-zinc-300">No tracks found</p>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm">
          Try a different search query or add a music directory from the folder manager above.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full select-none overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-800/80 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider sticky top-0 bg-zinc-950/90 backdrop-blur-xs z-10">
              <th className="py-2.5 px-3 w-12 text-center">#</th>
              <th className="py-2.5 px-3">Title</th>
              <th className="py-2.5 px-3 hidden md:table-cell">Album</th>
              <th className="py-2.5 px-3 hidden lg:table-cell w-32">Format</th>
              <th className="py-2.5 px-3 w-20 text-right pr-4">
                <Clock className="w-3.5 h-3.5 inline-block opacity-70" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900/40">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="animate-pulse border-b border-zinc-900/30">
                  <td className="py-2.5 px-3 w-12 text-center">
                    <div className="w-5 h-3 bg-zinc-800/60 rounded mx-auto" />
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-zinc-800/70 shrink-0" />
                      <div className="flex flex-col gap-1.5 flex-1 max-w-xs">
                        <div className="h-3 w-3/4 bg-zinc-800/80 rounded" />
                        <div className="h-2.5 w-1/2 bg-zinc-800/40 rounded" />
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 hidden md:table-cell">
                    <div className="h-2.5 w-32 bg-zinc-800/50 rounded" />
                  </td>
                  <td className="py-2.5 px-3 hidden lg:table-cell w-32">
                    <div className="h-2.5 w-14 bg-zinc-800/40 rounded" />
                  </td>
                  <td className="py-2.5 px-3 w-20 text-right pr-4">
                    <div className="h-2.5 w-8 bg-zinc-800/50 rounded ml-auto" />
                  </td>
                </tr>
              ))
            ) : (
              tracks.map((track, idx) => {
              const isSelected = selectedTrackId === track.id;
              const isCurrent = currentTrack?.id === track.id;
              const isCurrentlyPlaying = isCurrent && status === 'playing';

              return (
                <tr
                  key={track.id}
                  data-track-id={track.id}
                  onClick={() => handleRowClick(track)}
                  onDoubleClick={() => handlePlayTrack(track)}
                  onContextMenu={() => setSelectedTrackId(track.id)}
                  className={`group transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-900/90 text-zinc-100'
                      : isCurrent
                      ? 'bg-amber-950/20 text-amber-300 hover:bg-amber-950/30'
                      : 'text-zinc-300 hover:bg-zinc-900/50'
                  }`}
                >
                  {/* # / Play Button */}
                  <td className="py-2 px-3 text-center w-12 text-zinc-500 group-hover:text-zinc-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayTrack(track);
                      }}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-zinc-800 transition-colors mx-auto"
                    >
                      {isCurrentlyPlaying ? (
                        <Pause className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <span className="group-hover:hidden text-xs font-mono">
                          {isCurrent ? (
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          ) : (
                            idx + 1
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
                  <td className="py-2 px-3 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700/50 flex items-center justify-center shrink-0 text-zinc-500 overflow-hidden">
                        {track.hasArtwork ? (
                          <TrackThumbnail trackId={track.id} artworkHash={track.artworkHash} />
                        ) : (
                          <Music className="w-4 h-4 opacity-50" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div
                          className={`font-medium truncate ${
                            isCurrent ? 'text-amber-400' : 'text-zinc-100'
                          }`}
                        >
                          {track.title}
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate">
                          {track.artist}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Album */}
                  <td className="py-2 px-3 hidden md:table-cell text-zinc-400 truncate max-w-xs">
                    {track.album}
                  </td>

                  {/* Format & Bitrate */}
                  <td className="py-2 px-3 hidden lg:table-cell">
                    <CodecBadge
                      format={track.format}
                      bitrateKbps={track.bitrateKbps}
                      showBitrate={true}
                      size="xs"
                    />
                  </td>

                  {/* Duration & Edit Action */}
                  <td className="py-2 px-3 text-right text-zinc-400 font-mono text-[11px] pr-4">
                    <div className="flex items-center justify-end gap-2">
                      {onEditMetadata && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditMetadata(track);
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
            })
          )}
          </tbody>
        </table>
      </div>
    </>
  );
};

const TrackThumbnail: React.FC<{ trackId: string; artworkHash: string | null }> = ({ trackId, artworkHash }) => {
  const { getArtworkUrl, artworkCache, getArtwork, invalidateArtworkUrl } = useLibraryStore();
  const syncSrc = getArtworkUrl(artworkHash) || artworkCache[trackId] || null;
  const [src, setSrc] = useState<string | null>(syncSrc);
  const [hasError, setHasError] = useState(false);

  React.useEffect(() => {
    if (syncSrc && !hasError) {
      setSrc(syncSrc);
      return;
    }
    let isMounted = true;
    getArtwork(trackId).then((img) => {
      if (isMounted) {
        if (img) {
          setSrc(img);
          setHasError(false);
        } else {
          setHasError(true);
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, [trackId, syncSrc, hasError, getArtwork]);

  const handleError = () => {
    if (artworkHash) {
      invalidateArtworkUrl(artworkHash);
    }
    invalidateArtworkUrl(trackId);

    getArtwork(trackId).then((img) => {
      if (img && img !== src) {
        setSrc(img);
        setHasError(false);
      } else {
        setHasError(true);
      }
    }).catch(() => setHasError(true));
  };

  if (!src || hasError) {
    return <Music className="w-4 h-4 opacity-40 text-amber-400" />;
  }

  return (
    <img
      src={src}
      alt=""
      onError={handleError}
      className="w-full h-full object-cover"
      loading="lazy"
      decoding="async"
    />
  );
};
