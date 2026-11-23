import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  ListPlus,
  Copy,
  Music,
  ListMusic,
  Radio,
  Settings,
  RefreshCw,
  Volume2,
  VolumeX,
  SkipForward,
  SkipBack,
  Trash2,
  ChevronRight,
  FolderOpen,
  Home,
  Check,
  Edit3,
  Disc3,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { usePlayerStore, type CurrentTrack } from '../../stores/usePlayerStore';
import { usePlaylistStore } from '../../stores/usePlaylistStore';
import { useToastStore } from '../../stores/useToastStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { tauriBridge } from '../../services/tauriBridge';
import { groupTracksByAlbum, type AlbumGroup } from '../../types/album';
import type { TrackRow } from '../../types/library';
import { CodecBadge } from '../ui/CodecBadge';
import { sortTracksByNumber } from '../../utils/trackNumbering';

interface MenuPosition {
  x: number;
  y: number;
}

type MenuContextType =
  | { type: 'track'; track: TrackRow }
  | { type: 'album'; album: AlbumGroup }
  | { type: 'playlist'; playlistId: string }
  | { type: 'player' }
  | { type: 'general' };

export const GlobalContextMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const [context, setContext] = useState<MenuContextType>({ type: 'general' });
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [submenuFocusedIndex, setSubmenuFocusedIndex] = useState<number>(-1);

  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);

  const { setCurrentView } = useAppStore();
  const {
    tracks,
    startScan,
    getArtworkUrl,
    artworkCache,
    openTrackMetadata,
    openAlbumMetadata,
  } = useLibraryStore();
  const {
    status,
    playTrack,
    play,
    pause,
    playNext,
    playPrevious,
    toggleMute,
    isMuted,
    addToQueue,
    addToQueueNext,
    enqueueTracks,
  } = usePlayerStore();
  const {
    playlists,
    addTrackToPlaylist,
    deletePlaylist,
    setActivePlaylistId,
    getPlaylistFullTracks,
  } = usePlaylistStore();
  const { addToast } = useToastStore();

  // All albums cached for fast lookup on album right-click
  const allAlbums = useMemo(() => groupTracksByAlbum(tracks), [tracks]);

  // Close context menu handler
  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setShowPlaylistSubmenu(false);
    setFocusedIndex(-1);
    setSubmenuFocusedIndex(-1);
  }, []);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Completely eliminate native webview right click menu everywhere
      e.preventDefault();

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Reset keyboard navigation states
      setFocusedIndex(-1);
      setSubmenuFocusedIndex(-1);
      setShowPlaylistSubmenu(false);

      // 1. Detect if right click is on a track
      const trackElem = target.closest('[data-track-id]');
      if (trackElem) {
        const trackId = trackElem.getAttribute('data-track-id');
        const found = tracks.find((t) => t.id === trackId);
        if (found) {
          setContext({ type: 'track', track: found });
          setPosition({ x: e.clientX, y: e.clientY });
          setIsOpen(true);
          return;
        }
      }

      // 2. Detect if right click is on an album (Card, Section Header, Detail Modal)
      const albumElem = target.closest('[data-album-id]');
      if (albumElem) {
        const albumId = albumElem.getAttribute('data-album-id');
        const foundAlbum = allAlbums.find((a) => a.id === albumId);
        if (foundAlbum) {
          setContext({ type: 'album', album: foundAlbum });
          setPosition({ x: e.clientX, y: e.clientY });
          setIsOpen(true);
          return;
        }
      }

      // 3. Detect if right click is on a playlist
      const playlistElem = target.closest('[data-playlist-id]');
      if (playlistElem) {
        const playlistId = playlistElem.getAttribute('data-playlist-id');
        if (playlistId) {
          setContext({ type: 'playlist', playlistId });
          setPosition({ x: e.clientX, y: e.clientY });
          setIsOpen(true);
          return;
        }
      }

      // 4. Detect if right click is on the bottom player
      const playerElem = target.closest('[data-player-bar]');
      if (playerElem) {
        setContext({ type: 'player' });
        setPosition({ x: e.clientX, y: e.clientY });
        setIsOpen(true);
        return;
      }

      // 5. Default to General App Context
      setContext({ type: 'general' });
      setPosition({ x: e.clientX, y: e.clientY });
      setIsOpen(true);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        (!submenuRef.current || !submenuRef.current.contains(e.target as Node))
      ) {
        closeMenu();
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [tracks, allAlbums, closeMenu]);

  // Track Actions
  const handlePlaySelectedTrack = async (track: TrackRow) => {
    const { autoQueue } = useSettingsStore.getState();

    let queueTracks: CurrentTrack[] | undefined = undefined;
    if (autoQueue) {
      queueTracks = tracks.map((t) => ({
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
    }

    await playTrack(
      {
        id: track.id,
        trackId: track.id,
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
      queueTracks
    );
    closeMenu();
  };

  const handlePlayNextTrack = async (track: TrackRow) => {
    const artworkUrl = getArtworkUrl(track.artworkHash) || artworkCache[track.id] || undefined;
    await addToQueueNext({
      id: track.id,
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      durationSeconds: track.durationSeconds,
      artworkUrl,
      source: 'local',
      path: track.path,
      format: track.format,
      bitrateKbps: track.bitrateKbps ?? undefined,
    });
    addToast({
      type: 'success',
      title: 'Playing Next',
      message: `"${track.title}" will play next.`,
    });
    closeMenu();
  };

  const handleAddToQueue = async (track: TrackRow) => {
    const artworkUrl = getArtworkUrl(track.artworkHash) || artworkCache[track.id] || undefined;
    await addToQueue({
      id: track.id,
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      durationSeconds: track.durationSeconds,
      artworkUrl,
      source: 'local',
      path: track.path,
      format: track.format,
      bitrateKbps: track.bitrateKbps ?? undefined,
    });
    addToast({
      type: 'info',
      title: 'Added to Queue',
      message: `"${track.title}" added to queue.`,
    });
    closeMenu();
  };

  const handleEditTrackMetadata = (track: TrackRow) => {
    closeMenu();
    openTrackMetadata(track);
  };

  const handleRevealInExplorer = async (filePath?: string) => {
    if (!filePath) return;
    try {
      await tauriBridge.revealInFolder(filePath);
      addToast({
        type: 'info',
        title: 'Revealed in Explorer',
        message: 'File location opened in Windows Explorer.',
      });
    } catch (err) {
      console.error('Failed to reveal file in folder:', err);
      addToast({
        type: 'error',
        title: 'Explorer Error',
        message: String(err),
      });
    }
    closeMenu();
  };

  const handleCopyPath = async (filePath?: string) => {
    if (!filePath) return;
    await navigator.clipboard.writeText(filePath);
    addToast({
      type: 'success',
      title: 'Path Copied',
      message: 'File path copied to clipboard.',
    });
    closeMenu();
  };

  const handleAddToPlaylistAction = async (playlistId: string, trackId: string, trackTitle: string) => {
    const added = await addTrackToPlaylist(playlistId, trackId);
    if (added) {
      addToast({
        type: 'success',
        title: 'Added to Playlist',
        message: `"${trackTitle}" added successfully.`,
      });
    } else {
      addToast({
        type: 'info',
        title: 'Already in Playlist',
        message: `"${trackTitle}" is already in this playlist.`,
      });
    }
    closeMenu();
  };

  // Album Actions
  const handlePlayAlbum = async (album: AlbumGroup) => {
    if (album.tracks.length === 0) return;
    const queueTracks = album.tracks.map((t) => ({
      id: t.id,
      trackId: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      durationSeconds: t.durationSeconds,
      artworkUrl: artworkCache[t.id] || (t.artworkHash ? getArtworkUrl(t.artworkHash) : undefined) || undefined,
      source: 'local' as const,
      path: t.path,
      format: t.format,
      bitrateKbps: t.bitrateKbps ?? undefined,
    }));
    await playTrack(queueTracks[0], queueTracks);
    closeMenu();
  };

  const handleEnqueueAlbum = async (album: AlbumGroup) => {
    if (album.tracks.length === 0) return;
    const queueTracks = album.tracks.map((t) => ({
      id: t.id,
      trackId: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      durationSeconds: t.durationSeconds,
      artworkUrl: artworkCache[t.id] || (t.artworkHash ? getArtworkUrl(t.artworkHash) : undefined) || undefined,
      source: 'local' as const,
      path: t.path,
      format: t.format,
      bitrateKbps: t.bitrateKbps ?? undefined,
    }));
    await enqueueTracks(queueTracks);
    addToast({
      type: 'success',
      title: 'Album Enqueued',
      message: `Enqueued ${album.tracks.length} tracks from "${album.album}".`,
    });
    closeMenu();
  };

  const handleEditAlbumMetadata = (album: AlbumGroup) => {
    closeMenu();
    openAlbumMetadata(album);
  };

  const handleCopyAlbumFolderPath = async (album: AlbumGroup) => {
    const firstTrack = album.tracks[0];
    if (!firstTrack?.path) return;
    const folderPath = firstTrack.path.replace(/\\/g, '/').split('/').slice(0, -1).join('\\');
    await navigator.clipboard.writeText(folderPath);
    addToast({
      type: 'success',
      title: 'Folder Path Copied',
      message: 'Album folder directory path copied to clipboard.',
    });
    closeMenu();
  };

  // Build actionable list for keyboard navigation
  const actionsList = useMemo(() => {
    if (!isOpen) return [];
    if (context.type === 'track') {
      return [
        { label: 'Play Now', action: () => handlePlaySelectedTrack(context.track) },
        { label: 'Play Next', action: () => handlePlayNextTrack(context.track) },
        { label: 'Add to Queue', action: () => handleAddToQueue(context.track) },
        { label: 'Edit Tags & Metadata', action: () => handleEditTrackMetadata(context.track) },
        { label: 'Add to Playlist', isSubmenu: true, action: () => setShowPlaylistSubmenu(true) },
        { label: 'Reveal in Explorer', action: () => handleRevealInExplorer(context.track.path) },
        { label: 'Copy File Path', action: () => handleCopyPath(context.track.path) },
      ];
    }
    if (context.type === 'album') {
      return [
        { label: 'Play Album', action: () => handlePlayAlbum(context.album) },
        { label: 'Add to Queue', action: () => handleEnqueueAlbum(context.album) },
        { label: 'Edit Album Metadata', action: () => handleEditAlbumMetadata(context.album) },
        { label: 'Reveal in Explorer', action: () => handleRevealInExplorer(context.album.tracks[0]?.path) },
        { label: 'Copy Folder Path', action: () => handleCopyAlbumFolderPath(context.album) },
      ];
    }
    if (context.type === 'playlist') {
      const targetPl = playlists.find((p) => p.id === context.playlistId);
      return [
        {
          label: 'Play Playlist',
          action: async () => {
            if (!targetPl) return;
            let plTracks: TrackRow[] = [];
            try {
              plTracks = await getPlaylistFullTracks(targetPl.id);
            } catch (err) {
              console.error('Failed to get playlist full tracks:', err);
            }
            if (!plTracks || plTracks.length === 0) {
              plTracks = tracks.filter((t) => targetPl.trackIds.includes(t.id));
            }
            if (plTracks.length === 0) {
              addToast({ type: 'warning', title: 'Empty Playlist', message: 'Add tracks first.' });
              closeMenu();
              return;
            }
            const sorted = sortTracksByNumber(plTracks);
            const queue = sorted.map((t) => ({
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
            await playTrack(queue[0], queue);
            closeMenu();
          },
        },
        {
          label: 'Add to Queue',
          action: async () => {
            if (!targetPl) return;
            let plTracks: TrackRow[] = [];
            try {
              plTracks = await getPlaylistFullTracks(targetPl.id);
            } catch (err) {
              console.error('Failed to get playlist full tracks:', err);
            }
            if (!plTracks || plTracks.length === 0) {
              plTracks = tracks.filter((t) => targetPl.trackIds.includes(t.id));
            }
            if (plTracks.length === 0) {
              addToast({ type: 'warning', title: 'Empty Playlist', message: 'Add tracks first.' });
              closeMenu();
              return;
            }
            const sorted = sortTracksByNumber(plTracks);
            const formattedTracks = sorted.map((t) => ({
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
            await enqueueTracks(formattedTracks);
            addToast({
              type: 'info',
              title: 'Added to Queue',
              message: `"${targetPl.name}" (${formattedTracks.length} tracks) added to queue.`,
            });
            closeMenu();
          },
        },
        {
          label: 'Open Playlist',
          action: () => {
            setActivePlaylistId(context.playlistId);
            setCurrentView('playlists');
            closeMenu();
          },
        },
        {
          label: 'Delete Playlist',
          action: () => {
            deletePlaylist(context.playlistId);
            closeMenu();
          },
        },
      ];
    }
    if (context.type === 'player') {
      return [
        { label: status === 'playing' ? 'Pause' : 'Play', action: () => { if (status === 'playing') pause(); else play(); closeMenu(); } },
        { label: 'Next Track', action: () => { playNext(); closeMenu(); } },
        { label: 'Previous Track', action: () => { playPrevious(); closeMenu(); } },
        { label: isMuted ? 'Unmute Audio' : 'Mute Audio', action: () => { toggleMute(); closeMenu(); } },
      ];
    }
    return [
      { label: 'Home', action: () => { setCurrentView('home'); closeMenu(); } },
      { label: 'Music Library', action: () => { setCurrentView('library'); closeMenu(); } },
      { label: 'Playlists', action: () => { setCurrentView('playlists'); closeMenu(); } },
      { label: 'Social Rooms', action: () => { setCurrentView('rooms'); closeMenu(); } },
      { label: 'Rescan Library', action: () => { startScan(); closeMenu(); } },
      { label: 'Settings', action: () => { setCurrentView('settings'); closeMenu(); } },
    ];
  }, [
    isOpen,
    context,
    tracks,
    playlists,
    status,
    isMuted,
    playTrack,
    play,
    pause,
    playNext,
    playPrevious,
    toggleMute,
    enqueueTracks,
    deletePlaylist,
    setActivePlaylistId,
    setCurrentView,
    startScan,
    getArtworkUrl,
    artworkCache,
    closeMenu,
  ]);

  // Full Keyboard Navigation (Up/Down/Enter/Escape/ArrowRight/ArrowLeft)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
        return;
      }

      // If submenu is active
      if (showPlaylistSubmenu) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setShowPlaylistSubmenu(false);
          setSubmenuFocusedIndex(-1);
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSubmenuFocusedIndex((prev) => (prev + 1) % Math.max(1, playlists.length));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSubmenuFocusedIndex((prev) =>
            prev <= 0 ? Math.max(0, playlists.length - 1) : prev - 1
          );
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (playlists.length > 0 && submenuFocusedIndex >= 0 && submenuFocusedIndex < playlists.length) {
            const targetPl = playlists[submenuFocusedIndex];
            if (context.type === 'track') {
              handleAddToPlaylistAction(targetPl.id, context.track.id, context.track.title);
            }
          }
          return;
        }
      }

      // Main menu navigation
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % actionsList.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev <= 0 ? actionsList.length - 1 : prev - 1));
        return;
      }
      if (e.key === 'ArrowRight') {
        if (focusedIndex >= 0 && actionsList[focusedIndex]?.isSubmenu) {
          e.preventDefault();
          setShowPlaylistSubmenu(true);
          setSubmenuFocusedIndex(0);
          return;
        }
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < actionsList.length) {
          actionsList[focusedIndex].action();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showPlaylistSubmenu, focusedIndex, submenuFocusedIndex, actionsList, playlists, context, closeMenu]);

  if (!isOpen) return null;

  // Viewport-aware Clamping
  const menuWidth = 260;
  const menuHeight = 360;
  const clampedX = Math.min(position.x, window.innerWidth - menuWidth - 14);
  const clampedY = Math.min(position.y, window.innerHeight - menuHeight - 14);

  // Submenu collision detection: flips left if it exceeds the right screen boundary
  const submenuWidth = 224;
  const flipsSubmenuLeft = clampedX + menuWidth + submenuWidth > window.innerWidth - 14;

  return (
    <div
      ref={menuRef}
      style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
      className="fixed z-[100] w-64 bg-zinc-950/92 backdrop-blur-2xl border border-zinc-800/80 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_30px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.08] rounded-2xl p-1.5 flex flex-col gap-0.5 select-none animate-in fade-in zoom-in-95 duration-150"
    >
      {/* TRACK CONTEXT */}
      {context.type === 'track' && (
        <>
          {/* Track Header Pill */}
          <div className="px-3 py-2 border-b border-zinc-800/80 mb-1 flex items-center justify-between gap-2 bg-zinc-900/40 rounded-xl">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-zinc-100 truncate">
                {context.track.title}
              </p>
              <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                {context.track.artist || 'Unknown Artist'}
              </p>
            </div>
            {context.track.format && (
              <CodecBadge format={context.track.format} size="xs" />
            )}
          </div>

          {/* Action 0: Play Now */}
          <button
            type="button"
            onClick={() => handlePlaySelectedTrack(context.track)}
            onMouseEnter={() => { setFocusedIndex(0); setShowPlaylistSubmenu(false); }}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 0
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <Play className="w-3.5 h-3.5 fill-current text-amber-500 shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate font-semibold text-amber-400">Play Now</span>
            </div>
            <kbd className="ml-auto font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800">
              ↵
            </kbd>
          </button>

          {/* Action 1: Play Next */}
          <button
            type="button"
            onClick={() => handlePlayNextTrack(context.track)}
            onMouseEnter={() => { setFocusedIndex(1); setShowPlaylistSubmenu(false); }}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 1
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <SkipForward className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0 transition-transform group-hover:scale-110" />
              <span className="truncate">Play Next</span>
            </div>
            <kbd className="ml-auto font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800">
              Alt+↵
            </kbd>
          </button>

          {/* Action 2: Add to Queue */}
          <button
            type="button"
            onClick={() => handleAddToQueue(context.track)}
            onMouseEnter={() => { setFocusedIndex(2); setShowPlaylistSubmenu(false); }}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 2
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <ListPlus className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0 transition-transform group-hover:scale-110" />
              <span className="truncate">Add to Queue</span>
            </div>
          </button>

          {/* Action 3: Edit Tags & Metadata */}
          <button
            type="button"
            onClick={() => handleEditTrackMetadata(context.track)}
            onMouseEnter={() => { setFocusedIndex(3); setShowPlaylistSubmenu(false); }}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 3
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <Edit3 className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0 transition-transform group-hover:scale-110" />
              <span className="truncate">Edit Tags & Metadata</span>
            </div>
            <kbd className="ml-auto font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800">
              Ctrl+E
            </kbd>
          </button>

          <div className="h-px bg-zinc-800/80 my-1" />

          {/* Action 4: Add to Playlist (Collision-Aware Submenu) */}
          <div
            className="relative"
            onMouseEnter={() => { setFocusedIndex(4); setShowPlaylistSubmenu(true); }}
            onMouseLeave={() => setShowPlaylistSubmenu(false)}
          >
            <button
              type="button"
              className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
                focusedIndex === 4
                  ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                  : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
              }`}
            >
              <span
                className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                  focusedIndex === 4 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
                }`}
              />
              <div className="flex items-center gap-2.5 pl-2 min-w-0">
                <ListMusic className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0 transition-transform group-hover:scale-110" />
                <span className="truncate">Add to Playlist</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 shrink-0" />
            </button>

            {/* Submenu of Playlists */}
            {showPlaylistSubmenu && (
              <div
                ref={submenuRef}
                style={{
                  ...(flipsSubmenuLeft
                    ? { right: '100%', marginRight: '8px', top: '-6px' }
                    : { left: '100%', marginLeft: '8px', top: '-6px' }),
                }}
                className="absolute z-[110] w-52 bg-zinc-950/95 border border-zinc-800/90 rounded-2xl shadow-2xl p-1.5 flex flex-col gap-0.5 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto scrollbar-thin ring-1 ring-white/[0.08]"
              >
                <div className="px-2.5 py-1 text-[9px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-1 mb-0.5">
                  Your Playlists
                </div>

                {playlists.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentView('playlists');
                      closeMenu();
                    }}
                    className="w-full text-left p-2 rounded-xl text-xs text-zinc-400 hover:text-amber-400 hover:bg-zinc-800/80 transition-colors"
                  >
                    + Create First Playlist
                  </button>
                ) : (
                  playlists.map((pl, pIdx) => {
                    const isPlFocused = submenuFocusedIndex === pIdx;
                    return (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() =>
                          handleAddToPlaylistAction(
                            pl.id,
                            context.track.id,
                            context.track.title
                          )
                        }
                        onMouseEnter={() => setSubmenuFocusedIndex(pIdx)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all text-left truncate cursor-pointer ${
                          isPlFocused
                            ? 'bg-zinc-800/90 text-amber-400 translate-x-1'
                            : 'text-zinc-200 hover:bg-zinc-800/80 hover:text-amber-400 hover:translate-x-1 active:scale-[0.98]'
                        }`}
                      >
                        <span className="truncate">{pl.name}</span>
                        {pl.trackIds.includes(context.track.id) && (
                          <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-zinc-800/80 my-1" />

          {/* Action 5: Reveal in Explorer */}
          <button
            type="button"
            onClick={() => handleRevealInExplorer(context.track.path)}
            onMouseEnter={() => { setFocusedIndex(5); setShowPlaylistSubmenu(false); }}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 5
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 5 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <FolderOpen className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0 transition-transform group-hover:scale-110" />
              <span className="truncate">Reveal in Explorer</span>
            </div>
            <kbd className="ml-auto font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800">
              Ctrl+R
            </kbd>
          </button>

          {/* Action 6: Copy File Path */}
          <button
            type="button"
            onClick={() => handleCopyPath(context.track.path)}
            onMouseEnter={() => { setFocusedIndex(6); setShowPlaylistSubmenu(false); }}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 6
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 6 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <Copy className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0 transition-transform group-hover:scale-110" />
              <span className="truncate">Copy File Path</span>
            </div>
            <kbd className="ml-auto font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800">
              Ctrl+C
            </kbd>
          </button>
        </>
      )}

      {/* ALBUM CONTEXT */}
      {context.type === 'album' && (
        <>
          {/* Album Header Pill */}
          <div className="px-3 py-2 border-b border-zinc-800/80 mb-1 flex items-center justify-between gap-2.5 bg-zinc-900/40 rounded-xl">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <Disc3 className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-zinc-100 truncate">
                  {context.album.album}
                </p>
                <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                  {context.album.artist} • {context.album.trackCount} {context.album.trackCount === 1 ? 'track' : 'tracks'}
                </p>
              </div>
            </div>
            {context.album.format && (
              <CodecBadge format={context.album.format} size="xs" />
            )}
          </div>

          {/* Action 0: Play Album */}
          <button
            type="button"
            onClick={() => handlePlayAlbum(context.album)}
            onMouseEnter={() => setFocusedIndex(0)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 0
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <Play className="w-3.5 h-3.5 fill-current text-amber-500 shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate font-semibold text-amber-400">Play Album</span>
            </div>
            <kbd className="ml-auto font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800">
              ↵
            </kbd>
          </button>

          {/* Action 1: Add Album to Queue */}
          <button
            type="button"
            onClick={() => handleEnqueueAlbum(context.album)}
            onMouseEnter={() => setFocusedIndex(1)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 1
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <ListPlus className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0 transition-transform group-hover:scale-110" />
              <span className="truncate">Add to Queue</span>
            </div>
          </button>

          {/* Action 2: Edit Album Metadata & Tags */}
          <button
            type="button"
            onClick={() => handleEditAlbumMetadata(context.album)}
            onMouseEnter={() => setFocusedIndex(2)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 2
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <Edit3 className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0 transition-transform group-hover:scale-110" />
              <span className="truncate">Edit Album Metadata</span>
            </div>
            <kbd className="ml-auto font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800">
              Ctrl+E
            </kbd>
          </button>

          <div className="h-px bg-zinc-800/80 my-1" />

          {/* Action 3: Reveal in Explorer */}
          <button
            type="button"
            onClick={() => handleRevealInExplorer(context.album.tracks[0]?.path)}
            onMouseEnter={() => setFocusedIndex(3)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 3
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <FolderOpen className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0 transition-transform group-hover:scale-110" />
              <span className="truncate">Reveal in Explorer</span>
            </div>
            <kbd className="ml-auto font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800">
              Ctrl+R
            </kbd>
          </button>

          {/* Action 4: Copy Folder Path */}
          <button
            type="button"
            onClick={() => handleCopyAlbumFolderPath(context.album)}
            onMouseEnter={() => setFocusedIndex(4)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 4
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 4 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <Copy className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0 transition-transform group-hover:scale-110" />
              <span className="truncate">Copy Folder Path</span>
            </div>
            <kbd className="ml-auto font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800">
              Ctrl+C
            </kbd>
          </button>
        </>
      )}

      {/* PLAYLIST CONTEXT */}
      {context.type === 'playlist' && (
        <>
          <button
            type="button"
            onClick={actionsList[0]?.action}
            onMouseEnter={() => setFocusedIndex(0)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 0
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <Play className="w-3.5 h-3.5 fill-current text-amber-500 shrink-0" />
              <span className="truncate font-semibold text-amber-400">Play Playlist</span>
            </div>
            <kbd className="ml-auto font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800">
              ↵
            </kbd>
          </button>

          <button
            type="button"
            onClick={actionsList[1]?.action}
            onMouseEnter={() => setFocusedIndex(1)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 1
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <ListPlus className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0" />
              <span className="truncate">Add to Queue</span>
            </div>
          </button>

          <button
            type="button"
            onClick={actionsList[2]?.action}
            onMouseEnter={() => setFocusedIndex(2)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 2
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <FolderOpen className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0" />
              <span className="truncate">Open Playlist</span>
            </div>
          </button>

          <div className="h-px bg-zinc-800/80 my-1" />

          <button
            type="button"
            onClick={actionsList[3]?.action}
            onMouseEnter={() => setFocusedIndex(3)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 3
                ? 'bg-rose-500/10 text-rose-300 translate-x-1 ring-1 ring-rose-500/30 shadow-sm'
                : 'text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.7)] transition-all duration-150 ${
                focusedIndex === 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Delete Playlist</span>
            </div>
          </button>
        </>
      )}

      {/* PLAYER CONTEXT */}
      {context.type === 'player' && (
        <>
          <button
            type="button"
            onClick={actionsList[0]?.action}
            onMouseEnter={() => setFocusedIndex(0)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 0
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              {status === 'playing' ? (
                <Pause className="w-3.5 h-3.5 fill-current text-amber-500 shrink-0" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current text-amber-500 shrink-0" />
              )}
              <span className="truncate font-semibold text-amber-400">
                {status === 'playing' ? 'Pause' : 'Play'}
              </span>
            </div>
            <kbd className="ml-auto font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800">
              Space
            </kbd>
          </button>

          <button
            type="button"
            onClick={actionsList[1]?.action}
            onMouseEnter={() => setFocusedIndex(1)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 1
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <SkipForward className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0" />
              <span className="truncate">Next Track</span>
            </div>
          </button>

          <button
            type="button"
            onClick={actionsList[2]?.action}
            onMouseEnter={() => setFocusedIndex(2)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 2
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <SkipBack className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0" />
              <span className="truncate">Previous Track</span>
            </div>
          </button>

          <div className="h-px bg-zinc-800/80 my-1" />

          <button
            type="button"
            onClick={actionsList[3]?.action}
            onMouseEnter={() => setFocusedIndex(3)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 3
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0" />
              )}
              <span className="truncate">{isMuted ? 'Unmute Audio' : 'Mute Audio'}</span>
            </div>
            <kbd className="ml-auto font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800">
              M
            </kbd>
          </button>
        </>
      )}

      {/* GENERAL APP CONTEXT */}
      {context.type === 'general' && (
        <>
          <button
            type="button"
            onClick={actionsList[0]?.action}
            onMouseEnter={() => setFocusedIndex(0)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 0
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <Home className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0" />
              <span className="truncate">Home</span>
            </div>
          </button>

          <button
            type="button"
            onClick={actionsList[1]?.action}
            onMouseEnter={() => setFocusedIndex(1)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 1
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <Music className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Music Library</span>
            </div>
          </button>

          <button
            type="button"
            onClick={actionsList[2]?.action}
            onMouseEnter={() => setFocusedIndex(2)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 2
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <ListMusic className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Playlists</span>
            </div>
          </button>

          <button
            type="button"
            onClick={actionsList[3]?.action}
            onMouseEnter={() => setFocusedIndex(3)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 3
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">Social Rooms</span>
            </div>
          </button>

          <div className="h-px bg-zinc-800/80 my-1" />

          <button
            type="button"
            onClick={actionsList[4]?.action}
            onMouseEnter={() => setFocusedIndex(4)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 4
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 4 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <RefreshCw className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0" />
              <span className="truncate">Rescan Library</span>
            </div>
          </button>

          <button
            type="button"
            onClick={actionsList[5]?.action}
            onMouseEnter={() => setFocusedIndex(5)}
            className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none outline-none ${
              focusedIndex === 5
                ? 'bg-zinc-800/90 text-zinc-100 translate-x-1 ring-1 ring-zinc-700/60 shadow-sm'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 hover:translate-x-1 active:scale-[0.98]'
            }`}
          >
            <span
              className={`absolute left-1 w-1 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] transition-all duration-150 ${
                focusedIndex === 5 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
              }`}
            />
            <div className="flex items-center gap-2.5 pl-2 min-w-0">
              <Settings className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0" />
              <span className="truncate">Settings</span>
            </div>
          </button>
        </>
      )}
    </div>
  );
};
