import { useState, useEffect, useMemo, useRef } from 'react';
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
  Edit3,
  Image as ImageIcon,
  Upload,
  FolderPlus,
  FolderSearch,
  CheckCircle2,
  Loader2,
  Database,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { soundService } from '../../services/soundService';
import { usePlaylistStore, type Playlist } from '../../stores/usePlaylistStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useToastStore } from '../../stores/useToastStore';
import type { TrackRow } from '../../types/library';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { PlaylistCover } from './components/PlaylistCover';
import { RubberSegment } from '../../components/ui/RubberSegment';
import { CodecBadge } from '../../components/ui/CodecBadge';
import { cleanTrackTitle, sortTracksByNumber } from '../../utils/trackNumbering';
import { TrackMetadataModal } from '../library/components/TrackMetadataModal';
import { useSettingsStore } from '../../stores/useSettingsStore';

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
  const { getArtworkUrl, artworkCache, getArtwork, invalidateArtworkUrl } = useLibraryStore();
  const syncSrc = getArtworkUrl(artworkHash) || artworkCache[trackId] || null;
  const [src, setSrc] = useState<string | null>(syncSrc);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
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

    getArtwork(trackId)
      .then((img) => {
        if (img && img !== src) {
          setSrc(img);
          setHasError(false);
        } else {
          setHasError(true);
        }
      })
      .catch(() => setHasError(true));
  };

  if (!src || hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-600">
        <Music className="w-4 h-4" />
      </div>
    );
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

export function PlaylistsView() {
  const isTopbar = useSettingsStore((s) => s.navLayout) === 'topbar';
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');

  // Create Playlist state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [newPlaylistCover, setNewPlaylistCover] = useState<{
    path?: string;
    base64?: string;
    preview: string;
  } | null>(null);

  // Folder scanning state inside Create Playlist modal
  const [isScanningFolder, setIsScanningFolder] = useState(false);
  const [scannedResult, setScannedResult] = useState<{
    folderName: string;
    folderPath: string;
    trackIds: string[];
    trackCount: number;
  } | null>(null);
  const [addToLibrary, setAddToLibrary] = useState(true);

  // Edit Playlist state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editPlaylistName, setEditPlaylistName] = useState('');
  const [editPlaylistDesc, setEditPlaylistDesc] = useState('');
  const [editPlaylistCover, setEditPlaylistCover] = useState<{
    path?: string;
    base64?: string;
    preview: string;
  } | null>(null);
  const [removeCoverMarked, setRemoveCoverMarked] = useState(false);

  // Add Tracks state
  const [isAddTracksModalOpen, setIsAddTracksModalOpen] = useState(false);
  const [trackSearch, setTrackSearch] = useState('');

  // Track Metadata Editor state
  const [editingTrack, setEditingTrack] = useState<TrackRow | null>(null);
  const [isTrackMetadataModalOpen, setIsTrackMetadataModalOpen] = useState(false);

  // Hidden file input refs for fallback
  const createFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const {
    playlists,
    activePlaylistId,
    setActivePlaylistId,
    createPlaylist,
    updatePlaylist,
    savePlaylistCover,
    deletePlaylistCover,
    deletePlaylist,
    addTrackToPlaylist,
    addTracksToPlaylist,
    scanFolderForPlaylist,
    removeTrackFromPlaylist,
    getPlaylistFullTracks,
  } = usePlaylistStore();

  const { tracks: libraryTracks, getArtworkUrl, artworkCache } = useLibraryStore();
  const { playTrack, currentTrack, status, enqueueTracks, durationSeconds } = usePlayerStore();
  const { addToast } = useToastStore();

  const [playlistTracksMap, setPlaylistTracksMap] = useState<Record<string, TrackRow[]>>({});

  const activePlaylist = playlists.find((p) => p.id === activePlaylistId) || null;

  useEffect(() => {
    if (!activePlaylistId) return;
    getPlaylistFullTracks(activePlaylistId).then((tracks) => {
      if (tracks && tracks.length > 0) {
        setPlaylistTracksMap((prev) => ({ ...prev, [activePlaylistId]: tracks }));
      }
    });
  }, [activePlaylistId, activePlaylist?.trackIds, getPlaylistFullTracks]);

  // Arranged & sorted tracks with track number logic (1..N ascending, then unnumbered)
  const sortedPlaylistTracks = useMemo(() => {
    if (!activePlaylist) return [];
    const fullTracks = playlistTracksMap[activePlaylist.id];
    const plTracks =
      fullTracks && fullTracks.length > 0
        ? fullTracks
        : libraryTracks.filter((t) => activePlaylist.trackIds.includes(t.id));
    return sortTracksByNumber(plTracks);
  }, [activePlaylist, playlistTracksMap, libraryTracks]);

  // Pick image via native dialog or file input
  const handleSelectImage = async (
    onSelected: (data: { path?: string; base64?: string; preview: string }) => void,
    fallbackRef: React.RefObject<HTMLInputElement | null>
  ) => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
        title: 'Select Playlist Cover Image',
      });

      if (selected && typeof selected === 'string') {
        const preview = convertFileSrc(selected);
        onSelected({ path: selected, preview });
        return;
      }
    } catch {
      // Fallback to browser file input
      fallbackRef.current?.click();
    }
  };

  const handleFileInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    onSelected: (data: { path?: string; base64?: string; preview: string }) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSelected({
          base64: reader.result,
          preview: reader.result,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Folder scanning handler
  const handleScanFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Music Folder to Scan for Playlist',
      });

      if (!selected || typeof selected !== 'string') return;

      setIsScanningFolder(true);
      const res = await scanFolderForPlaylist(selected, false);

      // Natural number sort the track IDs using their metadata
      let sortedIds = res.trackIds;
      try {
        const fullTracks = await invoke<TrackRow[]>('get_tracks_by_ids', { trackIds: res.trackIds });
        if (fullTracks && fullTracks.length > 0) {
          const sorted = sortTracksByNumber(fullTracks);
          sortedIds = sorted.map((t) => t.id);
        }
      } catch {
        // Fallback to original order
      }

      setScannedResult({
        folderName: res.folderName,
        folderPath: res.folderPath,
        trackIds: sortedIds.length > 0 ? sortedIds : res.trackIds,
        trackCount: res.trackCount,
      });

      // Auto-fill playlist name if blank
      if (!newPlaylistName.trim()) {
        setNewPlaylistName(res.folderName);
      }

      // Smart pre-fill detected cover if available (3:A)
      if (res.detectedCoverUrl && !newPlaylistCover) {
        setNewPlaylistCover({
          path: res.detectedCoverUrl,
          preview: convertFileSrc(res.detectedCoverUrl),
        });
      }

      addToast({
        type: 'success',
        title: 'Folder Scanned',
        message: `Found ${res.trackCount} tracks in "${res.folderName}".`,
      });
    } catch (err: unknown) {
      console.error('Failed to scan folder for playlist:', err);
      addToast({
        type: 'error',
        title: 'Scan Failed',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsScanningFolder(false);
    }
  };

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPlaylistName.trim()) return;

    try {
      const created = await createPlaylist(
        newPlaylistName,
        newPlaylistDesc,
        newPlaylistCover?.path,
        scannedResult?.folderPath,
        addToLibrary
      );

      // Save custom cover if base64 data was supplied
      if (newPlaylistCover?.base64) {
        await savePlaylistCover(created.id, {
          base64: newPlaylistCover.base64,
        });
      }

      // Add scanned tracks if present
      if (scannedResult && scannedResult.trackIds.length > 0) {
        await addTracksToPlaylist(created.id, scannedResult.trackIds);
      }

      // If user selected to add to permanent library, refresh library store
      if (addToLibrary && scannedResult) {
        await useLibraryStore.getState().loadTracks();
        await useLibraryStore.getState().loadFolders();
        await useLibraryStore.getState().loadStats();
      }

      addToast({
        type: 'success',
        title: 'Playlist Created',
        message: scannedResult
          ? `"${created.name}" created with ${scannedResult.trackCount} tracks.`
          : `"${created.name}" is ready for music.`,
      });

      // Navigate directly into newly created playlist
      setActivePlaylistId(created.id);

      setNewPlaylistName('');
      setNewPlaylistDesc('');
      setNewPlaylistCover(null);
      setScannedResult(null);
      setIsCreateModalOpen(false);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Creation Failed',
        message: String(err),
      });
    }
  };

  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activePlaylist || !editPlaylistName.trim()) return;

    try {
      if (removeCoverMarked) {
        await deletePlaylistCover(activePlaylist.id);
        await updatePlaylist(activePlaylist.id, editPlaylistName, editPlaylistDesc, 'none');
      } else if (editPlaylistCover) {
        const savedCover = await savePlaylistCover(activePlaylist.id, {
          path: editPlaylistCover.path,
          base64: editPlaylistCover.base64,
        });
        await updatePlaylist(activePlaylist.id, editPlaylistName, editPlaylistDesc, savedCover || undefined);
      } else {
        await updatePlaylist(activePlaylist.id, editPlaylistName, editPlaylistDesc);
      }

      addToast({
        type: 'edit',
        title: 'Playlist Updated',
        message: `Changes saved to "${editPlaylistName}".`,
      });

      setIsEditModalOpen(false);
      setEditPlaylistCover(null);
      setRemoveCoverMarked(false);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: String(err),
      });
    }
  };

  const handleDelete = async (playlist: Playlist, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await deletePlaylist(playlist.id);
      await useLibraryStore.getState().loadTracks();
      await useLibraryStore.getState().loadFolders();
      await useLibraryStore.getState().loadStats();
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

    let rawTracks: TrackRow[] = [];

    // 1. If currently inside active playlist view and already sorted
    if (playlist.id === activePlaylist?.id && sortedPlaylistTracks.length > 0) {
      rawTracks = sortedPlaylistTracks;
    } else if (playlistTracksMap[playlist.id]?.length > 0) {
      // 2. Cached in map
      rawTracks = playlistTracksMap[playlist.id];
    } else {
      // 3. Fetch directly from SQLite database via getPlaylistFullTracks
      try {
        const fetched = await getPlaylistFullTracks(playlist.id);
        if (fetched && fetched.length > 0) {
          rawTracks = fetched;
          setPlaylistTracksMap((prev) => ({ ...prev, [playlist.id]: fetched }));
        }
      } catch (err) {
        console.error('Failed to get playlist full tracks:', err);
      }
    }

    // 4. Fallback to library tracks filter if database lookup returned nothing
    if (rawTracks.length === 0) {
      rawTracks = libraryTracks.filter((t) => playlist.trackIds.includes(t.id));
    }

    const tracksToPlay = sortTracksByNumber(rawTracks);

    if (tracksToPlay.length === 0) {
      addToast({
        type: 'warning',
        title: 'Empty Playlist',
        message: 'Add tracks to this playlist before playing.',
      });
      return;
    }

    const queueTracks = tracksToPlay.map((t) => ({
      id: t.id,
      trackId: t.id,
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
      {/* Hidden file inputs for image upload fallbacks */}
      <input
        type="file"
        ref={createFileInputRef}
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleFileInputChange(e, setNewPlaylistCover)}
      />
      <input
        type="file"
        ref={editFileInputRef}
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          handleFileInputChange(e, (data) => {
            setEditPlaylistCover(data);
            setRemoveCoverMarked(false);
          });
        }}
      />

      {/* Detail View of an open playlist */}
      {activePlaylist ? (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div
            className={`${
              isTopbar ? 'pt-20 px-6 sm:px-10 lg:px-12' : 'p-6'
            } border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur-xs flex flex-col gap-4 transition-all duration-200`}
          >
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
                <PlaylistCover playlist={activePlaylist} tracks={sortedPlaylistTracks} size="lg" />
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
                    let rawTracks = sortedPlaylistTracks;
                    if (rawTracks.length === 0 && activePlaylist) {
                      try {
                        rawTracks = await getPlaylistFullTracks(activePlaylist.id);
                      } catch (err) {
                        console.error('Failed to get playlist full tracks for queue:', err);
                      }
                    }
                    if (!rawTracks || rawTracks.length === 0) return;
                    const formatted = sortTracksByNumber(rawTracks).map((t) => ({
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
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditPlaylistName(activePlaylist.name);
                    setEditPlaylistDesc(activePlaylist.description || '');
                    setEditPlaylistCover(null);
                    setRemoveCoverMarked(false);
                    setIsEditModalOpen(true);
                  }}
                  className="px-3 py-2 text-xs"
                  title="Edit Playlist details and cover image"
                >
                  <Edit3 className="w-3.5 h-3.5" />
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
            {sortedPlaylistTracks.length === 0 ? (
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
                    {sortedPlaylistTracks.map((track, index) => {
                      const isCurrent = currentTrack?.id === track.id;
                      const cleanTitle = cleanTrackTitle(track.title);

                      return (
                        <tr
                          key={track.id}
                          data-track-id={track.id}
                          className="hover:bg-zinc-900/60 transition-colors group cursor-pointer"
                          onClick={() => {
                            const queue = sortedPlaylistTracks.map((t) => ({
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
                            playTrack(
                              {
                                id: track.id,
                                title: track.title,
                                artist: track.artist,
                                album: track.album,
                                durationSeconds: track.durationSeconds,
                                artworkUrl: getArtworkUrl(track.artworkHash) || artworkCache[track.id] || undefined,
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
                                <span
                                  className="font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors truncate"
                                  title={track.title}
                                >
                                  {cleanTitle}
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
                            {formatSeconds(
                              track.durationSeconds > 0
                                ? track.durationSeconds
                                : currentTrack?.id === track.id && durationSeconds > 0
                                ? durationSeconds
                                : 0
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTrack(track);
                                  setIsTrackMetadataModalOpen(true);
                                }}
                                className="p-1 rounded text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                                title="Edit Track Metadata & File Tags"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeTrackFromPlaylist(activePlaylist.id, track.id);
                                  addToast({
                                    type: 'edit',
                                    title: 'Track Removed',
                                    message: `Removed "${cleanTitle}" from playlist.`,
                                  });
                                }}
                                className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Remove from playlist"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
          <div
            className={`${
              isTopbar ? 'pt-20 px-6 sm:px-10 lg:px-12' : 'p-6'
            } pb-4 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-between gap-4 transition-all duration-200`}
          >
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
                onClick={() => {
                  setNewPlaylistName('');
                  setNewPlaylistDesc('');
                  setNewPlaylistCover(null);
                  setScannedResult(null);
                  setAddToLibrary(true);
                  setIsCreateModalOpen(true);
                }}
                className="px-3.5 py-1.5 text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>New Playlist</span>
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className={`flex-1 ${isTopbar ? 'p-6 sm:px-10 lg:px-12' : 'p-6'} pb-28`}>
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
                  onClick={() => {
                    setNewPlaylistName('');
                    setNewPlaylistDesc('');
                    setNewPlaylistCover(null);
                    setScannedResult(null);
                    setAddToLibrary(true);
                    setIsCreateModalOpen(true);
                  }}
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
        description="Name your custom playlist, optionally scan a folder, or set a custom cover."
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          {/* Scan Folder for Tracks Section */}
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderSearch className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-zinc-200">Import Tracks From Folder</span>
              </div>
              {scannedResult ? (
                <button
                  type="button"
                  onClick={() => setScannedResult(null)}
                  className="text-[11px] text-zinc-400 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              ) : null}
            </div>

            {scannedResult ? (
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-amber-200 truncate">
                      {scannedResult.folderName}
                    </p>
                    <p className="text-[10px] text-amber-400/80 font-mono">
                      {scannedResult.trackCount} tracks discovered
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleScanFolder}
                  disabled={isScanningFolder}
                  className="px-2.5 py-1 rounded-md bg-zinc-850 hover:bg-zinc-800 text-[11px] text-zinc-300 transition-colors cursor-pointer shrink-0 ml-2"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-zinc-400 leading-tight">
                  Quickly populate this playlist with all audio files from a local directory.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleScanFolder}
                  disabled={isScanningFolder}
                  className="text-xs shrink-0 px-3 py-1.5"
                >
                  {isScanningFolder ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      <span>Scanning...</span>
                    </>
                  ) : (
                    <>
                      <FolderPlus className="w-3.5 h-3.5 mr-1" />
                      <span>Scan Folder</span>
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Modern Sliding Switch Card (A3) */}
            <div
              onClick={() => {
                soundService.play(addToLibrary ? 'toggle:off' : 'toggle:on');
                setAddToLibrary((prev) => !prev);
              }}
              className={`mt-2 rounded-xl p-3 flex items-center justify-between gap-3 border transition-all cursor-pointer select-none group ${
                addToLibrary
                  ? 'bg-amber-950/20 border-amber-500/35 hover:border-amber-500/50'
                  : 'bg-zinc-950/50 border-zinc-800/80 hover:border-zinc-700/80'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Database
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    addToLibrary ? 'text-amber-400' : 'text-zinc-500 group-hover:text-zinc-400'
                  }`}
                />
                <div className="flex flex-col min-w-0">
                  <span
                    className={`text-xs font-semibold leading-tight transition-colors ${
                      addToLibrary ? 'text-zinc-100' : 'text-zinc-300 group-hover:text-zinc-200'
                    }`}
                  >
                    Also add folder to permanent Library
                  </span>
                  <span className="text-[11px] text-zinc-500 leading-tight mt-0.5 truncate">
                    {addToLibrary
                      ? 'Folder registered & tracks appear in permanent Library'
                      : 'Playlist-only tracks — isolated from Library tabs & counts'}
                  </span>
                </div>
              </div>

              {/* Sliding Switch Pill */}
              <div
                className={`relative shrink-0 w-9 h-5 rounded-full transition-colors duration-200 ease-in-out p-0.5 flex items-center ${
                  addToLibrary ? 'bg-amber-500' : 'bg-zinc-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${
                    addToLibrary ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Custom Cover Picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-300">Playlist Cover (Optional)</label>
            <div className="flex items-center gap-3">
              <div
                onClick={() => handleSelectImage(setNewPlaylistCover, createFileInputRef)}
                className="w-20 h-20 rounded-xl border border-dashed border-zinc-700/80 hover:border-amber-500/70 bg-zinc-950 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all group shrink-0 relative"
                title="Click to choose a cover image"
              >
                {newPlaylistCover ? (
                  <>
                    <img
                      src={newPlaylistCover.preview}
                      alt="Cover Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Upload className="w-5 h-5 text-amber-400" />
                    </div>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6 text-zinc-600 group-hover:text-amber-400 transition-colors mb-1" />
                    <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 transition-colors">
                      Upload
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-col justify-center gap-1 min-w-0">
                <span className="text-xs text-zinc-300 font-medium">Custom Cover Image</span>
                <span className="text-[11px] text-zinc-500">
                  {newPlaylistCover
                    ? 'Cover selected. Stored locally.'
                    : 'Leave blank to use 4-track mosaic automatically.'}
                </span>
                {newPlaylistCover && (
                  <button
                    type="button"
                    onClick={() => setNewPlaylistCover(null)}
                    className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer w-fit mt-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Remove cover</span>
                  </button>
                )}
              </div>
            </div>
          </div>

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
              disabled={!newPlaylistName.trim() || isScanningFolder}
            >
              Create Playlist
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Playlist Modal */}
      {activePlaylist && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Playlist"
          description="Update playlist details or change custom cover image."
          maxWidth="sm"
        >
          <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
            {/* Custom Cover Picker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Playlist Cover</label>
              <div className="flex items-center gap-3">
                <div
                  onClick={() =>
                    handleSelectImage((data) => {
                      setEditPlaylistCover(data);
                      setRemoveCoverMarked(false);
                    }, editFileInputRef)
                  }
                  className="w-20 h-20 rounded-xl border border-dashed border-zinc-700/80 hover:border-amber-500/70 bg-zinc-950 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all group shrink-0 relative"
                  title="Click to change cover image"
                >
                  {editPlaylistCover ? (
                    <>
                      <img
                        src={editPlaylistCover.preview}
                        alt="New Cover Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Upload className="w-5 h-5 text-amber-400" />
                      </div>
                    </>
                  ) : activePlaylist.coverUrl && activePlaylist.coverUrl !== 'none' && !removeCoverMarked ? (
                    <>
                      <img
                        src={
                          activePlaylist.coverUrl.startsWith('data:') ||
                          activePlaylist.coverUrl.startsWith('http') ||
                          activePlaylist.coverUrl.startsWith('asset:')
                            ? activePlaylist.coverUrl
                            : convertFileSrc(activePlaylist.coverUrl)
                        }
                        alt="Current Cover"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Upload className="w-5 h-5 text-amber-400" />
                      </div>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-6 h-6 text-zinc-600 group-hover:text-amber-400 transition-colors mb-1" />
                      <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 transition-colors">
                        Upload
                      </span>
                    </>
                  )}
                </div>

                <div className="flex flex-col justify-center gap-1 min-w-0">
                  <span className="text-xs text-zinc-300 font-medium">Custom Cover Image</span>
                  <span className="text-[11px] text-zinc-500">
                    {editPlaylistCover
                      ? 'New cover chosen. Stored locally.'
                      : removeCoverMarked
                      ? 'Cover removed. Clean icon will display.'
                      : activePlaylist.coverUrl && activePlaylist.coverUrl !== 'none'
                      ? 'Custom cover active on local device.'
                      : 'No custom cover set.'}
                  </span>
                  {(editPlaylistCover || (activePlaylist.coverUrl && activePlaylist.coverUrl !== 'none' && !removeCoverMarked)) && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditPlaylistCover(null);
                        setRemoveCoverMarked(true);
                      }}
                      className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer w-fit mt-1"
                    >
                      <X className="w-3 h-3" />
                      <span>Remove cover</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Playlist Name</label>
              <input
                type="text"
                autoFocus
                value={editPlaylistName}
                onChange={(e) => setEditPlaylistName(e.target.value)}
                placeholder="Playlist name"
                className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Description (Optional)</label>
              <input
                type="text"
                value={editPlaylistDesc}
                onChange={(e) => setEditPlaylistDesc(e.target.value)}
                placeholder="Playlist description"
                className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500/50"
              />
            </div>

            <div className="flex items-center justify-end gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={!editPlaylistName.trim()}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

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
                  const cleanTitle = cleanTrackTitle(track.title);

                  return (
                    <div
                      key={track.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-850/60 transition-all duration-150 gap-3"
                    >
                      {/* Left: Thumbnail & Details */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* 42x42 Artwork Thumbnail */}
                        <div className="w-10.5 h-10.5 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800/80 shrink-0 flex items-center justify-center relative shadow-xs">
                          <PlaylistTrackThumbnail trackId={track.id} artworkHash={track.artworkHash} />
                        </div>

                        {/* Title, Artist, Album, Specs */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-zinc-100 truncate" title={track.title}>
                            {cleanTitle}
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
                              message: `"${cleanTitle}" added to ${activePlaylist.name}.`,
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

      {/* Track Metadata Reader & Editor Modal */}
      <TrackMetadataModal
        isOpen={isTrackMetadataModalOpen}
        track={editingTrack}
        onClose={() => {
          setIsTrackMetadataModalOpen(false);
          setEditingTrack(null);
          // Refresh playlist tracks if active
          if (activePlaylistId) {
            getPlaylistFullTracks(activePlaylistId).then((tracks) => {
              setPlaylistTracksMap((prev) => ({ ...prev, [activePlaylistId]: tracks }));
            });
          }
        }}
      />
    </div>
  );
}
