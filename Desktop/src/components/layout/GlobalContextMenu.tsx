import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
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
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { usePlaylistStore } from '../../stores/usePlaylistStore';
import { useToastStore } from '../../stores/useToastStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import type { TrackRow } from '../../types/library';
import { CodecBadge } from '../ui/CodecBadge';

interface MenuPosition {
  x: number;
  y: number;
}

type MenuContextType =
  | { type: 'track'; track: TrackRow }
  | { type: 'playlist'; playlistId: string }
  | { type: 'player' }
  | { type: 'general' };

export const GlobalContextMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const [context, setContext] = useState<MenuContextType>({ type: 'general' });
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);

  const { setCurrentView } = useAppStore();
  const { tracks, startScan, getArtworkUrl, artworkCache } = useLibraryStore();
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
    enqueueTracks,
  } = usePlayerStore();
  const { playlists, addTrackToPlaylist, deletePlaylist, setActivePlaylistId } =
    usePlaylistStore();
  const { addToast } = useToastStore();

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Completely eliminate native webview right click menu everywhere
      e.preventDefault();

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 1. Detect if right click is on a track
      const trackElem = target.closest('[data-track-id]');
      if (trackElem) {
        const trackId = trackElem.getAttribute('data-track-id');
        const found = tracks.find((t) => t.id === trackId);
        if (found) {
          setContext({ type: 'track', track: found });
          setShowPlaylistSubmenu(false);
          setPosition({ x: e.clientX, y: e.clientY });
          setIsOpen(true);
          return;
        }
      }

      // 2. Detect if right click is on a playlist
      const playlistElem = target.closest('[data-playlist-id]');
      if (playlistElem) {
        const playlistId = playlistElem.getAttribute('data-playlist-id');
        if (playlistId) {
          setContext({ type: 'playlist', playlistId });
          setShowPlaylistSubmenu(false);
          setPosition({ x: e.clientX, y: e.clientY });
          setIsOpen(true);
          return;
        }
      }

      // 3. Detect if right click is on the bottom player
      const playerElem = target.closest('[data-player-bar]');
      if (playerElem) {
        setContext({ type: 'player' });
        setShowPlaylistSubmenu(false);
        setPosition({ x: e.clientX, y: e.clientY });
        setIsOpen(true);
        return;
      }

      // 4. Default to General App Context
      setContext({ type: 'general' });
      setShowPlaylistSubmenu(false);
      setPosition({ x: e.clientX, y: e.clientY });
      setIsOpen(true);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        (!submenuRef.current || !submenuRef.current.contains(e.target as Node))
      ) {
        setIsOpen(false);
        setShowPlaylistSubmenu(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setShowPlaylistSubmenu(false);
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [tracks]);

  if (!isOpen) return null;

  // Screen clamping
  const menuWidth = 224;
  const menuHeight = 280;
  const clampedX = Math.min(position.x, window.innerWidth - menuWidth - 10);
  const clampedY = Math.min(position.y, window.innerHeight - menuHeight - 10);

  const handlePlaySelectedTrack = async (track: TrackRow) => {
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
    setIsOpen(false);
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
    setIsOpen(false);
    setShowPlaylistSubmenu(false);
  };

  return (
    <>
      <div
        ref={menuRef}
        style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
        className="fixed z-50 w-56 bg-zinc-950/95 border border-zinc-800/90 rounded-2xl shadow-2xl p-1.5 flex flex-col gap-0.5 select-none backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100"
      >
        {/* TRACK CONTEXT */}
        {context.type === 'track' && (
          <>
            <div className="px-3 py-1.5 border-b border-zinc-800/80 mb-1 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-100 truncate">
                  {context.track.title}
                </p>
                <p className="text-[10px] text-zinc-400 truncate">
                  {context.track.artist || 'Unknown Artist'}
                </p>
              </div>
              {context.track.format && (
                <CodecBadge format={context.track.format} size="xs" />
              )}
            </div>

            <button
              type="button"
              onClick={() => handlePlaySelectedTrack(context.track)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-amber-400 transition-colors text-left cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current text-amber-500" />
              <span>Play Now</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                const track = context.track;
                const artworkUrl =
                  getArtworkUrl(track.artworkHash) ||
                  artworkCache[track.id] ||
                  undefined;
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
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100 transition-colors text-left cursor-pointer"
            >
              <ListPlus className="w-3.5 h-3.5 text-zinc-400" />
              <span>Add to Queue</span>
            </button>

            {/* Add to Playlist with Hover Submenu */}
            <div
              className="relative"
              onMouseEnter={() => setShowPlaylistSubmenu(true)}
            >
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <ListMusic className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Add to Playlist</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
              </button>

              {/* Submenu of Playlists */}
              {showPlaylistSubmenu && (
                <div
                  ref={submenuRef}
                  style={{
                    left: `${menuWidth - 8}px`,
                    top: '-6px',
                  }}
                  className="absolute z-50 w-48 bg-zinc-950/95 border border-zinc-800/90 rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5 backdrop-blur-2xl animate-in fade-in duration-100 max-h-56 overflow-y-auto scrollbar-thin"
                >
                  <div className="px-2 py-1 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                    Your Playlists
                  </div>

                  {playlists.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentView('playlists');
                        setIsOpen(false);
                        setShowPlaylistSubmenu(false);
                      }}
                      className="w-full text-left p-2 rounded-lg text-xs text-zinc-400 hover:text-amber-400 hover:bg-zinc-800"
                    >
                      + Create First Playlist
                    </button>
                  ) : (
                    playlists.map((pl) => (
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
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-zinc-200 hover:bg-zinc-800 hover:text-amber-400 transition-colors text-left truncate cursor-pointer"
                      >
                        <span className="truncate">{pl.name}</span>
                        {pl.trackIds.includes(context.track.id) && (
                          <Check className="w-3 h-3 text-amber-500 shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="h-px bg-zinc-800/80 my-1" />

            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(context.track.path);
                addToast({
                  type: 'success',
                  title: 'Path Copied',
                  message: 'Absolute audio file path copied to clipboard.',
                });
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100 transition-colors text-left cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-zinc-400" />
              <span>Copy File Path</span>
            </button>
          </>
        )}

        {/* PLAYLIST CONTEXT */}
        {context.type === 'playlist' && (
          <>
            <button
              type="button"
              onClick={async () => {
                const targetPl = playlists.find((p) => p.id === context.playlistId);
                if (!targetPl) return;
                const plTracks = tracks.filter((t) => targetPl.trackIds.includes(t.id));
                if (plTracks.length === 0) {
                  addToast({
                    type: 'warning',
                    title: 'Empty Playlist',
                    message: 'Add tracks to this playlist first.',
                  });
                  setIsOpen(false);
                  return;
                }
                const queue = plTracks.map((t) => ({
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
                await playTrack(queue[0], queue);
                addToast({
                  type: 'info',
                  title: 'Playing Playlist',
                  message: `Starting "${targetPl.name}" (${queue.length} tracks).`,
                });
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-amber-400 transition-colors text-left cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current text-amber-500" />
              <span>Play Playlist</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                const targetPl = playlists.find((p) => p.id === context.playlistId);
                if (!targetPl) return;
                const plTracks = tracks.filter((t) => targetPl.trackIds.includes(t.id));
                if (plTracks.length === 0) {
                  addToast({
                    type: 'warning',
                    title: 'Empty Playlist',
                    message: 'Add tracks to this playlist first.',
                  });
                  setIsOpen(false);
                  return;
                }
                const formattedTracks = plTracks.map((t) => ({
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
                await enqueueTracks(formattedTracks);
                addToast({
                  type: 'info',
                  title: 'Added to Queue',
                  message: `"${targetPl.name}" (${formattedTracks.length} tracks) added to queue.`,
                });
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-amber-400 transition-colors text-left cursor-pointer"
            >
              <ListPlus className="w-3.5 h-3.5 text-zinc-400" />
              <span>Add to Queue</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActivePlaylistId(context.playlistId);
                setCurrentView('playlists');
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-amber-400 transition-colors text-left cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
              <span>Open Playlist</span>
            </button>

            <button
              type="button"
              onClick={() => {
                deletePlaylist(context.playlistId);
                addToast({
                  type: 'delete',
                  title: 'Playlist Deleted',
                  message: 'Playlist removed from your library.',
                });
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors text-left cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Playlist</span>
            </button>
          </>
        )}

        {/* PLAYER CONTEXT */}
        {context.type === 'player' && (
          <>
            <button
              type="button"
              onClick={() => {
                if (status === 'playing') pause();
                else play();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-amber-400 transition-colors text-left cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current text-amber-500" />
              <span>{status === 'playing' ? 'Pause' : 'Play'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playNext();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors text-left cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5 text-zinc-400" />
              <span>Next Track</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playPrevious();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors text-left cursor-pointer"
            >
              <SkipBack className="w-3.5 h-3.5 text-zinc-400" />
              <span>Previous Track</span>
            </button>

            <div className="h-px bg-zinc-800/80 my-1" />

            <button
              type="button"
              onClick={() => {
                toggleMute();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors text-left cursor-pointer"
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
              )}
              <span>{isMuted ? 'Unmute Audio' : 'Mute Audio'}</span>
            </button>
          </>
        )}

        {/* GENERAL APP CONTEXT */}
        {context.type === 'general' && (
          <>
            <button
              type="button"
              onClick={() => {
                setCurrentView('home');
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors text-left cursor-pointer"
            >
              <Home className="w-3.5 h-3.5 text-zinc-400" />
              <span>Home</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentView('library');
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors text-left cursor-pointer"
            >
              <Music className="w-3.5 h-3.5 text-amber-400" />
              <span>Music Library</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentView('playlists');
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors text-left cursor-pointer"
            >
              <ListMusic className="w-3.5 h-3.5 text-amber-400" />
              <span>Playlists</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentView('rooms');
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors text-left cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>Social Rooms</span>
            </button>

            <div className="h-px bg-zinc-800/80 my-1" />

            <button
              type="button"
              onClick={() => {
                startScan();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors text-left cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
              <span>Rescan Library</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentView('settings');
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors text-left cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-zinc-400" />
              <span>Settings</span>
            </button>
          </>
        )}
      </div>
    </>
  );
};
