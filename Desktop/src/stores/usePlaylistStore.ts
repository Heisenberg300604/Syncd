import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../services/tauriBridge';
import { soundService } from '../services/soundService';

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  trackIds: string[];
}

interface PlaylistState {
  playlists: Playlist[];
  activePlaylistId: string | null;
  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<boolean>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
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

  createPlaylist: async (name: string, description?: string) => {
    const trimmed = name.trim();
    if (isTauri()) {
      try {
        const row = await invoke<{
          id: string;
          name: string;
          description?: string;
          createdAt: string;
          updatedAt: string;
        }>('create_playlist', {
          name: trimmed,
          description: description?.trim() || null,
        });

        const newPl: Playlist = {
          id: row.id,
          name: row.name,
          description: row.description,
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
      createdAt: now,
      updatedAt: now,
      trackIds: [],
    };
    const updated = [newPlaylist, ...get().playlists];
    set({ playlists: updated });
    saveStoredPlaylists(updated);
    return newPlaylist;
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

  setActivePlaylistId: (id: string | null) => {
    set({ activePlaylistId: id });
  },
}));
