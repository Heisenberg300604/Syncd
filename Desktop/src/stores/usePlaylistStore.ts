import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../services/tauriBridge';
import { soundService } from '../services/soundService';
import type { TrackRow } from '../types/library';

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  importFolderPath?: string;
  createdAt: string;
  updatedAt: string;
  trackIds: string[];
}

export interface PlaylistFolderScanResult {
  folderName: string;
  folderPath: string;
  trackIds: string[];
  trackCount: number;
  detectedCoverUrl?: string;
}

interface PlaylistState {
  playlists: Playlist[];
  activePlaylistId: string | null;
  loadPlaylists: () => Promise<void>;
  createPlaylist: (
    name: string,
    description?: string,
    coverUrl?: string,
    importFolderPath?: string,
    addToLibrary?: boolean
  ) => Promise<Playlist>;
  updatePlaylist: (id: string, name: string, description?: string, coverUrl?: string) => Promise<void>;
  savePlaylistCover: (id: string, fileOrBase64: { path?: string; base64?: string; ext?: string }) => Promise<string | null>;
  deletePlaylistCover: (id: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<boolean>;
  addTracksToPlaylist: (playlistId: string, trackIds: string[]) => Promise<number>;
  scanFolderForPlaylist: (folderPath: string, addToLibrary: boolean) => Promise<PlaylistFolderScanResult>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  getPlaylistFullTracks: (playlistId: string) => Promise<TrackRow[]>;
  setActivePlaylistId: (id: string | null) => void;
}

const STORAGE_KEY = 'syncd_playlists_v1';

function loadStoredPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load playlists from localStorage:', err);
  }
  return [];
}

function saveStoredPlaylists(playlists: Playlist[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
  } catch (err) {
    console.error('Failed to persist playlists:', err);
  }
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: loadStoredPlaylists(),
  activePlaylistId: null,

  loadPlaylists: async () => {
    if (isTauri()) {
      try {
        const rows = await invoke<Array<{
          id: string;
          name: string;
          description?: string;
          coverUrl?: string;
          createdAt: string;
          updatedAt: string;
          trackCount: number;
        }>>('get_playlists');

        if (rows && Array.isArray(rows)) {
          const fullPlaylists: Playlist[] = await Promise.all(
            rows.map(async (r) => {
              const trackIds = await invoke<string[]>('get_playlist_tracks', {
                playlistId: r.id,
              }).catch(() => []);
              return {
                id: r.id,
                name: r.name,
                description: r.description,
                coverUrl: r.coverUrl,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
                trackIds: trackIds || [],
              };
            })
          );
          set({ playlists: fullPlaylists });
          saveStoredPlaylists(fullPlaylists);
          return;
        }
      } catch (err) {
        console.warn('Failed to load playlists from SQLite playlists.db:', err);
      }
    }
    set({ playlists: loadStoredPlaylists() });
  },

  createPlaylist: async (
    name: string,
    description?: string,
    coverUrl?: string,
    importFolderPath?: string,
    addToLibrary?: boolean
  ) => {
    const trimmed = name.trim();
    if (isTauri()) {
      try {
        const row = await invoke<{
          id: string;
          name: string;
          description?: string;
          coverUrl?: string;
          importFolderPath?: string;
          createdAt: string;
          updatedAt: string;
        }>('create_playlist', {
          name: trimmed,
          description: description?.trim() || null,
          coverUrl: coverUrl?.trim() || null,
          importFolderPath: importFolderPath?.trim() || null,
          addToLibrary: Boolean(addToLibrary),
        });

        const newPl: Playlist = {
          id: row.id,
          name: row.name,
          description: row.description,
          coverUrl: row.coverUrl,
          importFolderPath: row.importFolderPath,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          trackIds: [],
        };
        const updated = [newPl, ...get().playlists];
        set({ playlists: updated });
        saveStoredPlaylists(updated);
        return newPl;
      } catch (err) {
        console.error('Failed to create playlist in SQLite playlists.db:', err);
      }
    }

    const id = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const newPlaylist: Playlist = {
      id,
      name: trimmed || 'Untitled Playlist',
      description: description?.trim(),
      coverUrl: coverUrl?.trim(),
      importFolderPath: importFolderPath?.trim(),
      createdAt: now,
      updatedAt: now,
      trackIds: [],
    };
    const updated = [newPlaylist, ...get().playlists];
    set({ playlists: updated });
    saveStoredPlaylists(updated);
    return newPlaylist;
  },

  updatePlaylist: async (id: string, name: string, description?: string, coverUrl?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();

    if (isTauri()) {
      try {
        await invoke('update_playlist', {
          id,
          name: trimmed,
          description: description?.trim() || null,
          coverUrl: coverUrl !== undefined ? (coverUrl === 'none' ? 'none' : coverUrl?.trim() || null) : null,
        });
      } catch (err) {
        console.error('Failed to update playlist in SQLite playlists.db:', err);
      }
    }

    const updated = get().playlists.map((p) =>
      p.id === id
        ? {
            ...p,
            name: trimmed,
            description: description?.trim(),
            coverUrl: coverUrl !== undefined ? (coverUrl === 'none' ? 'none' : coverUrl?.trim()) : p.coverUrl,
            updatedAt: now,
          }
        : p
    );
    set({ playlists: updated });
    saveStoredPlaylists(updated);
  },

  savePlaylistCover: async (id: string, fileOrBase64: { path?: string; base64?: string; ext?: string }) => {
    if (isTauri()) {
      try {
        let savedPath: string;
        if (fileOrBase64.path) {
          savedPath = await invoke<string>('save_playlist_cover', {
            playlistId: id,
            sourcePath: fileOrBase64.path,
          });
        } else if (fileOrBase64.base64) {
          savedPath = await invoke<string>('save_playlist_cover_bytes', {
            playlistId: id,
            base64Data: fileOrBase64.base64,
            extension: fileOrBase64.ext || null,
          });
        } else {
          return null;
        }

        const now = new Date().toISOString();
        const updated = get().playlists.map((p) =>
          p.id === id ? { ...p, coverUrl: savedPath, updatedAt: now } : p
        );
        set({ playlists: updated });
        saveStoredPlaylists(updated);
        return savedPath;
      } catch (err) {
        console.error('Failed to save playlist cover:', err);
        return null;
      }
    }
    return null;
  },

  deletePlaylistCover: async (id: string) => {
    if (isTauri()) {
      try {
        await invoke('delete_playlist_cover', { playlistId: id });
      } catch (err) {
        console.error('Failed to delete playlist cover:', err);
      }
    }
    const now = new Date().toISOString();
    const updated = get().playlists.map((p) =>
      p.id === id ? { ...p, coverUrl: 'none', updatedAt: now } : p
    );
    set({ playlists: updated });
    saveStoredPlaylists(updated);
  },

  deletePlaylist: async (id: string) => {
    soundService.play('action:delete');
    if (isTauri()) {
      try {
        await invoke('delete_playlist', { id });
      } catch (err) {
        console.error('Failed to delete playlist from SQLite playlists.db:', err);
      }
    }
    const updated = get().playlists.filter((p) => p.id !== id);
    set((state) => ({
      playlists: updated,
      activePlaylistId: state.activePlaylistId === id ? null : state.activePlaylistId,
    }));
    saveStoredPlaylists(updated);
  },

  renamePlaylist: async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (isTauri()) {
      try {
        await invoke('rename_playlist', { id, name: trimmed });
      } catch (err) {
        console.error('Failed to rename playlist in SQLite playlists.db:', err);
      }
    }
    const now = new Date().toISOString();
    const updated = get().playlists.map((p) =>
      p.id === id ? { ...p, name: trimmed, updatedAt: now } : p
    );
    set({ playlists: updated });
    saveStoredPlaylists(updated);
  },

  addTrackToPlaylist: async (playlistId: string, trackId: string) => {
    const playlist = get().playlists.find((p) => p.id === playlistId);
    if (!playlist) return false;
    if (playlist.trackIds.includes(trackId)) return false;

    if (isTauri()) {
      try {
        await invoke('add_track_to_playlist', { playlistId, trackId });
      } catch (err) {
        console.error('Failed to add track to SQLite playlists.db:', err);
      }
    }

    const now = new Date().toISOString();
    const updated = get().playlists.map((p) =>
      p.id === playlistId
        ? { ...p, trackIds: [...p.trackIds, trackId], updatedAt: now }
        : p
    );
    set({ playlists: updated });
    saveStoredPlaylists(updated);
    return true;
  },

  addTracksToPlaylist: async (playlistId: string, trackIds: string[]) => {
    if (!trackIds.length) return 0;
    const playlist = get().playlists.find((p) => p.id === playlistId);
    if (!playlist) return 0;

    const newTrackIds = trackIds.filter((id) => !playlist.trackIds.includes(id));
    if (!newTrackIds.length) return 0;

    if (isTauri()) {
      try {
        await invoke('add_tracks_to_playlist', { playlistId, trackIds: newTrackIds });
      } catch (err) {
        console.error('Failed to add tracks to SQLite playlists.db:', err);
      }
    }

    const now = new Date().toISOString();
    const updated = get().playlists.map((p) =>
      p.id === playlistId
        ? { ...p, trackIds: [...p.trackIds, ...newTrackIds], updatedAt: now }
        : p
    );
    set({ playlists: updated });
    saveStoredPlaylists(updated);
    return newTrackIds.length;
  },

  scanFolderForPlaylist: async (folderPath: string, addToLibrary: boolean) => {
    if (isTauri()) {
      const result = await invoke<PlaylistFolderScanResult>('scan_folder_for_playlist', {
        folderPath,
        addToLibrary,
      });
      return result;
    }
    throw new Error('Folder scanning requires desktop native mode.');
  },

  removeTrackFromPlaylist: async (playlistId: string, trackId: string) => {
    soundService.play('action:delete');
    if (isTauri()) {
      try {
        await invoke('remove_track_from_playlist', { playlistId, trackId });
      } catch (err) {
        console.error('Failed to remove track from SQLite playlists.db:', err);
      }
    }

    const now = new Date().toISOString();
    const updated = get().playlists.map((p) =>
      p.id === playlistId
        ? { ...p, trackIds: p.trackIds.filter((tId) => tId !== trackId), updatedAt: now }
        : p
    );
    set({ playlists: updated });
    saveStoredPlaylists(updated);
  },

  getPlaylistFullTracks: async (playlistId: string) => {
    if (isTauri()) {
      try {
        return await invoke<TrackRow[]>('get_playlist_full_tracks', { playlistId });
      } catch (err) {
        console.error('Failed to fetch full playlist tracks:', err);
      }
    }
    return [];
  },

  setActivePlaylistId: (id: string | null) => {
    set({ activePlaylistId: id });
  },
}));
