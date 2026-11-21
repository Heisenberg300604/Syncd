import React, { useState } from 'react';
import { Play, Pause, ListPlus, ChevronDown, ChevronRight, Disc3, Music2, Clock } from 'lucide-react';
import type { AlbumGroup } from '../../../types/album';
import type { TrackRow } from '../../../types/library';
import { usePlayerStore } from '../../../stores/usePlayerStore';
import { useLibraryStore } from '../../../stores/useLibraryStore';
import { useToastStore } from '../../../stores/useToastStore';
import { CodecBadge } from '../../../components/ui/CodecBadge';

export interface AlbumSectionListProps {
  albumGroups: AlbumGroup[];
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export const AlbumSectionList: React.FC<AlbumSectionListProps> = ({ albumGroups }) => {
  const { currentTrack, status, playTrack, enqueueTracks, play, pause } = usePlayerStore();
  const { selectedTrackId, setSelectedTrackId, getArtworkUrl, artworkCache } = useLibraryStore();
  const { addToast } = useToastStore();

  const [collapsedAlbums, setCollapsedAlbums] = useState<Record<string, boolean>>({});

  const toggleCollapse = (albumId: string) => {
    setCollapsedAlbums((prev) => ({
      ...prev,
      [albumId]: !prev[albumId],
    }));
  };

  const handlePlayAlbum = async (album: AlbumGroup, e: React.MouseEvent) => {
    e.stopPropagation();

    const isCurrentAlbum = Boolean(
      currentTrack && album.tracks.some((t) => t.id === currentTrack.id)
    );

    if (isCurrentAlbum && status === 'playing') {
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
        undefined,
      source: 'local' as const,
      path: t.path,
      format: t.format,
      bitrateKbps: t.bitrateKbps ?? undefined,
    }));

    await playTrack(queueTracks[0], queueTracks);
  };

  const handleEnqueueAlbum = async (album: AlbumGroup, e: React.MouseEvent) => {
    e.stopPropagation();
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
        undefined,
      source: 'local' as const,
      path: t.path,
      format: t.format,
      bitrateKbps: t.bitrateKbps ?? undefined,
    }));

    await enqueueTracks(queueTracks);
    addToast({
      type: 'success',
      title: 'Added Album to Queue',
      message: `Enqueued ${album.tracks.length} tracks from "${album.album}".`,
    });
  };

  const handlePlayTrack = async (track: TrackRow, album: AlbumGroup) => {
    if (currentTrack?.id === track.id) {
      if (status === 'playing') {
        await pause();
      } else {
        await play();
      }
      return;
    }

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
        undefined,
      source: 'local' as const,
      path: t.path,
      format: t.format,
      bitrateKbps: t.bitrateKbps ?? undefined,
    }));

    const targetIndex = album.tracks.findIndex((t) => t.id === track.id);
    const selected = queueTracks[Math.max(0, targetIndex)];
    await playTrack(selected, queueTracks);
  };

  return (
    <div className="flex flex-col gap-5 w-full select-none pb-6">
      {albumGroups.map((album) => {
        const isCollapsed = Boolean(collapsedAlbums[album.id]);
        const isCurrentAlbum = Boolean(
          currentTrack && album.tracks.some((t) => t.id === currentTrack.id)
        );
        const isPlayingThisAlbum = isCurrentAlbum && status === 'playing';

        const artwork =
          (album.artworkHash ? getArtworkUrl(album.artworkHash) : null) ||
          artworkCache[album.representativeTrackId] ||
          null;

        return (
          <div
            key={album.id}
            className={`rounded-2xl border transition-all overflow-hidden ${
              isCurrentAlbum
                ? 'bg-zinc-950/80 border-amber-500/40 shadow-lg shadow-amber-500/5'
                : 'bg-zinc-950/60 border-zinc-800/80'
            }`}
          >
            {/* Album Header Bar */}
            <div
              onClick={() => toggleCollapse(album.id)}
              className="flex items-center justify-between gap-4 p-3.5 bg-zinc-900/60 hover:bg-zinc-900/90 border-b border-zinc-850 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <button
                  type="button"
                  className="text-zinc-500 hover:text-zinc-300 p-1"
                  aria-label={isCollapsed ? 'Expand album' : 'Collapse album'}
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {/* Thumbnail Art */}
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-850 shrink-0 flex items-center justify-center">
                  {artwork ? (
                    <img
                      src={artwork}
                      alt={album.album}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : album.isUnknownAlbum ? (
                    <Music2 className="w-5 h-5 text-zinc-600" />
                  ) : (
                    <Disc3 className="w-5 h-5 text-zinc-600" />
                  )}
                </div>

                {/* Album Details */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`text-sm font-bold truncate ${
                        isCurrentAlbum ? 'text-amber-400' : 'text-zinc-100'
                      }`}
                    >
                      {album.album}
                    </h3>
                    <span className="px-2 py-0.2 rounded-full bg-zinc-800 text-[10px] font-mono text-zinc-400 shrink-0">
                      {album.trackCount} {album.trackCount === 1 ? 'track' : 'tracks'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">
                    {album.artist}
                    {album.year ? ` • ${album.year}` : ''}
                    <span className="text-zinc-500 font-mono ml-2">
                      ({formatDuration(album.totalDuration)})
                    </span>
                  </p>
                </div>
              </div>

              {/* Quick Play & Enqueue Header Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => handlePlayAlbum(album, e)}
                  className="w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-zinc-950 flex items-center justify-center transition-all shadow-sm cursor-pointer"
                  title={isPlayingThisAlbum ? 'Pause album' : 'Play entire album'}
                >
                  {isPlayingThisAlbum ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => handleEnqueueAlbum(album, e)}
                  className="p-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-750 transition-colors cursor-pointer"
                  title="Add album to playback queue"
                >
                  <ListPlus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Collapsible Tracks Table */}
            {!isCollapsed && (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-850/60 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-950/40">
                    <th className="py-2 px-3 w-12 text-center">#</th>
                    <th className="py-2 px-3">Title</th>
                    <th className="py-2 px-3 w-28 text-center hidden sm:table-cell">Format</th>
                    <th className="py-2 px-3 w-20 text-right pr-4">
                      <Clock className="w-3 h-3 inline-block opacity-70" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/40">
                  {album.tracks.map((track, idx) => {
                    const isSelected = selectedTrackId === track.id;
                    const isCurrent = currentTrack?.id === track.id;
                    const isPlaying = isCurrent && status === 'playing';

                    return (
                      <tr
                        key={track.id}
                        onClick={() => setSelectedTrackId(track.id)}
                        onDoubleClick={() => handlePlayTrack(track, album)}
                        className={`group transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-900/90 text-zinc-100'
                            : isCurrent
                            ? 'bg-amber-950/20 text-amber-300 hover:bg-amber-950/30'
                            : 'text-zinc-300 hover:bg-zinc-900/40'
                        }`}
                      >
                        {/* Track Number / Play */}
                        <td className="py-2 px-3 text-center w-12 text-zinc-500 group-hover:text-zinc-200">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayTrack(track, album);
                            }}
                            className="w-5 h-5 rounded flex items-center justify-center hover:bg-zinc-800 transition-colors mx-auto"
                          >
                            {isPlaying ? (
                              <Pause className="w-3 h-3 text-amber-400" />
                            ) : (
                              <span className="group-hover:hidden text-[11px] font-mono">
                                {isCurrent ? (
                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                ) : (
                                  track.trackNumber || idx + 1
                                )}
                              </span>
                            )}
                            <Play
                              className={`w-3 h-3 hidden group-hover:block ${
                                isCurrent ? 'text-amber-400' : 'text-zinc-200'
                              }`}
                            />
                          </button>
                        </td>

                        {/* Title & Artist */}
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-semibold truncate ${
                                isCurrent
                                  ? 'text-amber-400'
                                  : 'text-zinc-200 group-hover:text-amber-300'
                              }`}
                            >
                              {track.title}
                            </span>
                            {track.artist !== album.artist && (
                              <span className="text-[10px] text-zinc-500 truncate">
                                ({track.artist})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Codec */}
                        <td className="py-2 px-3 text-center hidden sm:table-cell">
                          {track.format ? (
                            <CodecBadge format={track.format} size="xs" />
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>

                        {/* Duration */}
                        <td className="py-2 px-3 text-right pr-4 font-mono text-zinc-400 tabular-nums">
                          {formatDuration(track.durationSeconds)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
};
