import { useState, useEffect } from 'react';
import {
  ListMusic,
  Plus,
  List,
  LayoutGrid,
  Play,
  Trash2,
  ArrowLeft,
  Music,
  Check,
  X,
  ListPlus,
} from 'lucide-react';
import { usePlaylistStore, type Playlist } from '../../stores/usePlaylistStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useToastStore } from '../../stores/useToastStore';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { PlaylistCover } from './components/PlaylistCover';
import { RubberSegment } from '../../components/ui/RubberSegment';
import { CodecBadge } from '../../components/ui/CodecBadge';

function formatSeconds(total: number): string {
  if (!total || isNaN(total) || total <= 0) return '0:00';
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const PlaylistTrackThumbnail: React.FC<{
  trackId: string;
  artworkHash: string | null;
}> = ({ trackId, artworkHash }) => {
  const { getArtworkUrl, artworkCache, getArtwork } = useLibraryStore();
  const syncSrc = getArtworkUrl(artworkHash) || artworkCache[trackId] || null;
  const [src, setSrc] = useState<string | null>(syncSrc);

  useEffect(() => {
    if (syncSrc) {
      setSrc(syncSrc);
      return;
    }
    let isMounted = true;
    getArtwork(trackId).then((img) => {
      if (isMounted && img) setSrc(img);
    });
    return () => {
      isMounted = false;
    };
  }, [trackId, syncSrc, getArtwork]);

  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-600">
        <Music className="w-4 h-4" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Track Artwork"
      className="w-full h-full object-cover"
      loading="lazy"
      decoding="async"
    />
  );
};

export function PlaylistsView() {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [isAddTracksModalOpen, setIsAddTracksModalOpen] = useState(false);
  const [trackSearch, setTrackSearch] = useState('');

  const {
    playlists,
    activePlaylistId,
    setActivePlaylistId,
    createPlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
  } = usePlaylistStore();

  const { tracks: libraryTracks, getArtworkUrl, artworkCache } = useLibraryStore();
  const { playTrack, currentTrack, status, enqueueTracks } = usePlayerStore();
  const { addToast } = useToastStore();

  const activePlaylist = playlists.find((p) => p.id === activePlaylistId) || null;

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPlaylistName.trim()) return;

    try {
      const created = await createPlaylist(newPlaylistName, newPlaylistDesc);
      addToast({
        type: 'success',
        title: 'Playlist Created',
        message: `"${created.name}" is ready for music.`,
      });
      setNewPlaylistName('');
      setNewPlaylistDesc('');
      setIsCreateModalOpen(false);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Creation Failed',
        message: String(err),
      });
    }
  };

  const handleDelete = async (playlist: Playlist, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await deletePlaylist(playlist.id);
      addToast({
        type: 'delete',
        title: 'Playlist Deleted',
        message: `"${playlist.name}" was removed.`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: String(err),
      });
    }
  };

  const handlePlayPlaylist = async (playlist: Playlist, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const playlistTrackRows = libraryTracks.filter((t) =>
      playlist.trackIds.includes(t.id)
    );

    if (playlistTrackRows.length === 0) {
      addToast({
        type: 'warning',
        title: 'Empty Playlist',
        message: 'Add tracks to this playlist before playing.',
      });
      return;
    }

    const queueTracks = playlistTrackRows.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      durationSeconds: t.durationSeconds,
      artworkUrl: getArtworkUrl(t.artworkHash) || artworkCache[t.id] || undefined,
      source: 'local' as const,
      path: t.path,
      format: t.format,
      bitrateKbps: t.bitrateKbps ?? undefined,
    }));

    await playTrack(queueTracks[0], queueTracks);
    addToast({
      type: 'info',
      title: 'Playing Playlist',
      message: `Starting "${playlist.name}" (${queueTracks.length} tracks).`,
    });
  };

  // Filter available tracks for Add Tracks modal
  const availableToAdd = libraryTracks.filter((t) => {
    if (!activePlaylist) return false;
    const matchesQuery =
      !trackSearch ||
      t.title.toLowerCase().includes(trackSearch.toLowerCase()) ||
      t.artist.toLowerCase().includes(trackSearch.toLowerCase()) ||
      t.album.toLowerCase().includes(trackSearch.toLowerCase());
    return matchesQuery;
  });

  return (
    <div className="flex-1 overflow-y-auto flex flex-col select-none">
      {/* Detail View of an open playlist */}
      {activePlaylist ? (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur-xs flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setActivePlaylistId(null)}
              className="text-xs text-zinc-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors cursor-pointer w-fit"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to All Playlists</span>
            </button>

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="flex items-center gap-4">
                <PlaylistCover playlist={activePlaylist} size="lg" />
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                    {activePlaylist.name}
                  </h1>
                  {activePlaylist.description && (
                    <p className="text-xs text-zinc-400 mt-1 max-w-md">
                      {activePlaylist.description}
                    </p>
                  )}
                  <p className="text-xs text-zinc-500 mt-1 font-mono">
                    {activePlaylist.trackIds.length} tracks • Created{' '}
                    {new Date(activePlaylist.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={(e) => handlePlayPlaylist(activePlaylist, e)}
                  disabled={activePlaylist.trackIds.length === 0}
                  className="px-4 py-2 text-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play All</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const plTracks = libraryTracks.filter((t) =>
                      activePlaylist.trackIds.includes(t.id)
                    );
                    if (plTracks.length === 0) return;
                    const formatted = plTracks.map((t) => ({
                      id: t.id,
                      trackId: t.id,
                      title: t.title,
                      artist: t.artist,
                      album: t.album,
                      durationSeconds: t.durationSeconds,
                      artworkUrl:
                        getArtworkUrl(t.artworkHash) ||
                        artworkCache[t.id] ||
                        undefined,
                      source: 'local' as const,
                      path: t.path,
                      format: t.format,
                      bitrateKbps: t.bitrateKbps ?? undefined,
                    }));
                    await enqueueTracks(formatted);
                    addToast({
                      type: 'info',
                      title: 'Added to Queue',
                      message: `"${activePlaylist.name}" (${formatted.length} tracks) added to queue.`,
                    });
                  }}
                  disabled={activePlaylist.trackIds.length === 0}
                  className="px-3.5 py-2 text-xs"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  <span>Add to Queue</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsAddTracksModalOpen(true)}
                  className="px-3.5 py-2 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Tracks</span>
                </Button>

                <Button
                  variant="danger"
                  size="sm"
                  onClick={(e) => {
                    handleDelete(activePlaylist, e);
                    setActivePlaylistId(null);
                  }}
                  className="px-3 py-2 text-xs"
                  title="Delete playlist"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Tracks Table in Playlist */}
          <div className="flex-1 p-6 pb-28">
            {activePlaylist.trackIds.length === 0 ? (
              <div className="min-h-[280px] rounded-2xl border border-dashed border-zinc-800 flex flex-col items-center justify-center p-8 text-center bg-zinc-900/20">
                <Music className="w-8 h-8 text-zinc-600 mb-3" />
                <p className="text-sm font-semibold text-zinc-200">No tracks in this playlist yet</p>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mb-4">
                  Add songs from your music library to build this playlist.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAddTracksModalOpen(true)}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Add Tracks From Library</span>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col border border-zinc-850 rounded-2xl overflow-hidden bg-zinc-950/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900/60 text-zinc-400 font-semibold border-b border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">#</th>
                      <th className="py-2.5 px-4">Title</th>
                      <th className="py-2.5 px-4">Artist</th>
                      <th className="py-2.5 px-4">Album</th>
                      <th className="py-2.5 px-4 w-20 text-right">Time</th>
                      <th className="py-2.5 px-4 w-16 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850">
                    {activePlaylist.trackIds.map((trackId, index) => {
                      const track = libraryTracks.find((t) => t.id === trackId);
                      if (!track) return null;
                      const isCurrent = currentTrack?.id === track.id;

                      return (
                        <tr
                          key={track.id}
                          data-track-id={track.id}
                          className="hover:bg-zinc-900/60 transition-colors group cursor-pointer"
                          onClick={() => {
                            const queue = libraryTracks
                              .filter((t) => activePlaylist.trackIds.includes(t.id))
                              .map((t) => ({
                                id: t.id,
                                title: t.title,
                                artist: t.artist,
                                album: t.album,
                                durationSeconds: t.durationSeconds,
                                source: 'local' as const,
                                path: t.path,
                                format: t.format,
                                bitrateKbps: t.bitrateKbps ?? undefined,
                              }));
                            playTrack(
                              {
                                id: track.id,
                                title: track.title,
                                artist: track.artist,
                                album: track.album,
                                durationSeconds: track.durationSeconds,
                                source: 'local',
                                path: track.path,
                                format: track.format,
                                bitrateKbps: track.bitrateKbps ?? undefined,
                              },
                              queue
                            );
                          }}
                        >
                          <td className="py-2.5 px-4 text-center text-zinc-500 font-mono w-10">
                            {isCurrent && status === 'playing' ? (
                              <span className="text-amber-400 font-bold">▶</span>
                            ) : (
                              index + 1
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-zinc-100 group-hover:text-amber-400 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800/80 overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                                <PlaylistTrackThumbnail
                                  trackId={track.id}
                                  artworkHash={track.artworkHash}
                                />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors truncate">
                                  {track.title}
                                </span>
                                {track.format && (
                                  <div className="mt-0.5">
                                    <CodecBadge
                                      format={track.format}
                                      bitrateKbps={track.bitrateKbps}
                                      size="xs"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-zinc-400">{track.artist}</td>
                          <td className="py-2.5 px-4 text-zinc-400">{track.album}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-zinc-400">
                            {formatSeconds(track.durationSeconds)}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTrackFromPlaylist(activePlaylist.id, track.id);
                                addToast({
                                  type: 'edit',
                                  title: 'Track Removed',
                                  message: `Removed "${track.title}" from playlist.`,
                                });
                              }}
                              className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Remove from playlist"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Overview of all Playlists */
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-6 pb-4 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
                <span>Playlists</span>
                {playlists.length > 0 && (
                  <span className="text-xs font-normal text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full font-mono">
                    {playlists.length}
                  </span>
                )}
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">Your curated collections</p>
            </div>

            <div className="flex items-center gap-2.5">
              {/* RubberSegment View Toggle */}
              <RubberSegment
                items={[
                  {
                    value: 'list',
                    label: 'List',
                    icon: <List className="w-3.5 h-3.5" />,
                  },
                  {
                    value: 'grid',
                    label: 'Cards',
                    icon: <LayoutGrid className="w-3.5 h-3.5" />,
                  },
                ]}
                value={viewMode}
                onChange={(val) => setViewMode(val as 'list' | 'grid')}
                size="sm"
                trackColor="#18181b"
                thumbColor="#f59e0b"
                textColor="#a1a1aa"
                activeTextColor="#09090b"
                radius={9999}
                className="border border-zinc-800"
              />

              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3.5 py-1.5 text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>New Playlist</span>
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 p-6 pb-28">
            {playlists.length === 0 ? (
              <div className="flex-1 min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-5 shadow-inner">
                  <ListMusic className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1.5">No Playlists Yet</h3>
                <p className="text-xs text-zinc-500 max-w-xs mb-6 leading-relaxed">
                  Curate your perfect listening experience. Create playlists from your local library and save them for any mood.
                </p>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="text-xs px-5 py-2.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Playlist</span>
                </Button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    data-playlist-id={playlist.id}
                    onClick={() => setActivePlaylistId(playlist.id)}
                    className="group cursor-pointer select-none bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800/80 hover:border-zinc-700 p-3.5 rounded-2xl transition-all duration-200 flex flex-col justify-between shadow-md"
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/50 group-hover:scale-[1.02] transition-transform">
                      <PlaylistCover playlist={playlist} size="card" />

                      {/* Play overlay button */}
                      <button
                        type="button"
                        onClick={(e) => handlePlayPlaylist(playlist, e)}
                        className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 cursor-pointer z-10"
                        title="Play Playlist"
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </button>
                    </div>

                    <div className="pt-3 px-1 flex flex-col">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold text-zinc-100 truncate group-hover:text-amber-400 transition-colors">
                          {playlist.name}
                        </h4>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(playlist, e)}
                          className="text-zinc-600 hover:text-rose-400 transition-colors p-1 -mr-1 cursor-pointer opacity-0 group-hover:opacity-100"
                          title="Delete playlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                        {playlist.trackIds.length} tracks
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col border border-zinc-850 rounded-2xl overflow-hidden bg-zinc-950/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900/60 text-zinc-400 font-semibold border-b border-zinc-800">
                    <tr>
                      <th className="py-3 px-4">Playlist Name</th>
                      <th className="py-3 px-4">Tracks</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 w-24 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850">
                    {playlists.map((playlist) => (
                      <tr
                        key={playlist.id}
                        data-playlist-id={playlist.id}
                        onClick={() => setActivePlaylistId(playlist.id)}
                        className="hover:bg-zinc-900/60 transition-colors group cursor-pointer"
                      >
                        <td className="py-3 px-4 font-semibold text-zinc-100 group-hover:text-amber-400 flex items-center gap-3">
                          <PlaylistCover playlist={playlist} size="sm" />
                          <span className="truncate">{playlist.name}</span>
                        </td>
                        <td className="py-3 px-4 text-zinc-400 font-mono">
                          {playlist.trackIds.length} tracks
                        </td>
                        <td className="py-3 px-4 text-zinc-500">
                          {new Date(playlist.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handlePlayPlaylist(playlist, e)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                              title="Play"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDelete(playlist, e)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Playlist Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Playlist"
        description="Name your custom playlist and start adding tracks."
        maxWidth="sm"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-300">Playlist Name</label>
            <input
              type="text"
              autoFocus
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="e.g. Ambient Deep Focus"
              className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-300">Description (Optional)</label>
            <input
              type="text"
              value={newPlaylistDesc}
              onChange={(e) => setNewPlaylistDesc(e.target.value)}
              placeholder="e.g. High-bitrate soundtrack collection"
              className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/50"
            />
          </div>

          <div className="flex items-center justify-end gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={!newPlaylistName.trim()}
            >
              Create Playlist
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Tracks to Playlist Modal */}
      {activePlaylist && (
        <Modal
          isOpen={isAddTracksModalOpen}
          onClose={() => setIsAddTracksModalOpen(false)}
          title={`Add Tracks to "${activePlaylist.name}"`}
          description="Select indexed audio tracks from your library to add."
          maxWidth="lg"
        >
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={trackSearch}
              onChange={(e) => setTrackSearch(e.target.value)}
              placeholder="Filter tracks by title, artist, or album..."
              className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/50"
            />

            <div className="max-h-72 overflow-y-auto flex flex-col gap-1 pr-1 scrollbar-thin">
              {availableToAdd.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-6">
                  No matching tracks found in library.
                </p>
              ) : (
                availableToAdd.map((track) => {
                  const isAlreadyIn = activePlaylist.trackIds.includes(track.id);
                  const trackArt =
                    getArtworkUrl(track.artworkHash) ||
                    artworkCache[track.id] ||
                    null;

                  return (
                    <div
                      key={track.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-850/60 transition-all duration-150 gap-3"
                    >
                      {/* Left: Thumbnail & Details */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* 42x42 Artwork Thumbnail */}
                        <div className="w-10.5 h-10.5 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800/80 shrink-0 flex items-center justify-center relative shadow-xs">
                          {trackArt ? (
                            <img
                              src={trackArt}
                              alt={track.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-850 to-zinc-950 text-zinc-600">
                              <Music className="w-4 h-4" />
                            </div>
                          )}
                        </div>

                        {/* Title, Artist, Album, Specs */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-zinc-100 truncate">
                            {track.title}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-400 truncate mt-0.5">
                            <span className="truncate">{track.artist || 'Unknown Artist'}</span>
                            <span className="text-zinc-600">•</span>
                            <span className="truncate text-zinc-500">{track.album || 'Unknown Album'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Badges (Codec, Bitrate, Time) */}
                      <div className="flex items-center gap-2 shrink-0">
                        {track.format && (
                          <CodecBadge
                            format={track.format}
                            bitrateKbps={track.bitrateKbps}
                            showBitrate={true}
                            size="xs"
                          />
                        )}
                        <span className="text-[11px] font-mono text-zinc-400 w-10 text-right">
                          {formatSeconds(track.durationSeconds)}
                        </span>

                        {/* Add Button */}
                        <button
                          type="button"
                          disabled={isAlreadyIn}
                          onClick={() => {
                            addTrackToPlaylist(activePlaylist.id, track.id);
                            addToast({
                              type: 'success',
                              title: 'Track Added',
                              message: `"${track.title}" added to ${activePlaylist.name}.`,
                            });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ml-1 ${
                            isAlreadyIn
                              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                              : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/10 active:scale-95'
                          }`}
                        >
                          {isAlreadyIn ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsAddTracksModalOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
