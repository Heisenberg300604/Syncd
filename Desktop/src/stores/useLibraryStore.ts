import { create } from 'zustand';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { IndexedFolder, TrackRow, ScanProgress, ScanCompleteEvent, LibraryStats } from '../types/library';

const getInitialViewMode = (): 'list' | 'grid' => {
  try {
    return (localStorage.getItem('syncd_library_view_mode') as 'list' | 'grid') || 'grid';
  } catch {
    return 'grid';
  }
};

interface LibraryState {
  folders: IndexedFolder[];
  tracks: TrackRow[];
  stats: LibraryStats | null;
  isLoading: boolean;
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  hasUnscannedAudio: boolean;
  searchQuery: string;
  sortBy: 'title' | 'artist' | 'album' | 'duration' | 'year';
  sortOrder: 'asc' | 'desc';
  selectedTrackId: string | null;
  artworkCache: Record<string, string>;
  artworkDir: string | null;
  viewMode: 'list' | 'grid';

  // Actions
  loadFolders: () => Promise<void>;
  addFolder: (path: string) => Promise<void>;
  removeFolder: (id: string) => Promise<void>;
  loadTracks: () => Promise<void>;
  searchTracks: (query: string) => Promise<void>;
  startScan: () => Promise<void>;
  cancelScan: () => Promise<void>;
  checkPendingAudio: () => Promise<void>;
  loadStats: () => Promise<void>;
  loadArtworkDir: () => Promise<void>;
  getArtworkUrl: (artworkHash: string | null | undefined) => string | null;
  setSort: (sortBy: 'title' | 'artist' | 'album' | 'duration' | 'year', sortOrder: 'asc' | 'desc') => void;
  setSelectedTrackId: (id: string | null) => void;
  setViewMode: (mode: 'list' | 'grid') => void;
  getArtwork: (trackId: string) => Promise<string | null>;
  setupEventListeners: () => Promise<() => void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  folders: [],
  tracks: [],
  stats: null,
  isLoading: false,
  isScanning: false,
  scanProgress: null,
  hasUnscannedAudio: false,
  searchQuery: '',
  sortBy: 'title',
  sortOrder: 'asc',
  selectedTrackId: null,
  artworkCache: {},
  artworkDir: null,
  viewMode: getInitialViewMode(),

  loadFolders: async () => {
    try {
      const folders = await invoke<IndexedFolder[]>('get_folders');
      set({ folders });
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  },

  addFolder: async (path: string) => {
    try {
      await invoke<IndexedFolder>('add_folder', { path });
      await get().loadFolders();
      await get().loadStats();
      // Auto-trigger scan for new folder
      await get().startScan();
    } catch (err) {
      console.error('Failed to add folder:', err);
      throw err;
    }
  },

  removeFolder: async (id: string) => {
    const prevFolders = get().folders;
    const remainingFolders = prevFolders.filter((f) => f.id !== id);

    // Optimistic immediate UI update & purge cache if no folders remain
    set({
      folders: remainingFolders,
      ...(remainingFolders.length === 0
        ? {
            tracks: [],
            stats: { trackCount: 0, albumCount: 0, artistCount: 0, folderCount: 0 },
            artworkCache: {},
            isLoading: false,
          }
        : {}),
    });

    try {
      await invoke('remove_folder', { id });
      await get().loadFolders();
      const { sortBy, sortOrder } = get();
      const tracks = await invoke<TrackRow[]>('get_tracks', {
        sortBy,
        order: sortOrder,
        limit: 1000,
        offset: 0,
      });
      set({
        tracks,
        isLoading: false,
        ...(get().folders.length === 0 ? { artworkCache: {} } : {}),
      });
      await get().loadStats();
    } catch (err) {
      console.error('Failed to remove folder:', err);
      set({ folders: prevFolders });
      throw err;
    }
  },

  loadTracks: async () => {
    if (get().isLoading) return;
    const { sortBy, sortOrder, tracks: currentTracks } = get();
    if (currentTracks.length === 0) {
      set({ isLoading: true });
    }
    try {
      const tracks = await invoke<TrackRow[]>('get_tracks', {
        sortBy,
        order: sortOrder,
        limit: 1000,
        offset: 0,
      });
      set({ tracks, isLoading: false });
    } catch (err) {
      console.error('Failed to load tracks:', err);
      set({ isLoading: false });
    }
  },

  searchTracks: async (query: string) => {
    set({ searchQuery: query });
    if (!query.trim()) {
      await get().loadTracks();
      return;
    }

    set({ isLoading: true });
    try {
      const tracks = await invoke<TrackRow[]>('search_library', {
        query,
        limit: 100,
      });
      set({ tracks, isLoading: false });
    } catch (err) {
      console.error('Search failed:', err);
      set({ isLoading: false });
    }
  },

  startScan: async () => {
    if (get().isScanning) return;
    set({ isScanning: true, scanProgress: null });
    try {
      await invoke('scan_library');
    } catch (err) {
      console.error('Failed to start library scan:', err);
      set({ isScanning: false });
    }
  },

  cancelScan: async () => {
    // Immediate optimistic cancellation in UI
    set({ isScanning: false, scanProgress: null });
    try {
      await invoke('cancel_scan');
    } catch (err) {
      console.error('Failed to cancel scan:', err);
    }
  },

  checkPendingAudio: async () => {
    try {
      const folders = await invoke<IndexedFolder[]>('get_folders');
      const currentTracks = get().tracks;
      const stats = get().stats;
      set({ folders });

      // A folder is only considered pending if it has never been scanned and has 0 indexed tracks
      const hasUnscanned = folders.some(
        (f) => !f.lastScanned && (!f.trackCount || f.trackCount === 0)
      );

      // Only flag if there are genuinely unindexed folders and the library is currently empty
      const shouldFlag =
        hasUnscanned &&
        currentTracks.length === 0 &&
        (!stats || stats.trackCount === 0);

      set({ hasUnscannedAudio: shouldFlag });

      if (shouldFlag && !get().isScanning) {
        await get().startScan();
      }
    } catch (err) {
      console.warn('Deferred audio check non-fatal error:', err);
    }
  },

  loadStats: async () => {
    try {
      const stats = await invoke<LibraryStats>('get_library_stats');
      set({ stats });
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  },

  loadArtworkDir: async () => {
    if (get().artworkDir) return;
    try {
      const dir = await invoke<string>('get_artwork_dir');
      set({ artworkDir: dir });
    } catch (err) {
      console.warn('Failed to resolve artwork directory:', err);
    }
  },

  getArtworkUrl: (artworkHash) => {
    if (!artworkHash) return null;
    const { artworkDir, artworkCache } = get();

    // In-memory cache hit
    if (artworkCache[artworkHash]) {
      return artworkCache[artworkHash];
    }

    if (!artworkDir) return null;

    try {
      const separator = artworkDir.includes('/') ? '/' : '\\';
      const fullPath = `${artworkDir}${separator}${artworkHash}.jpg`;
      const assetUrl = convertFileSrc(fullPath);
      // Cache the computed asset URL synchronously
      artworkCache[artworkHash] = assetUrl;
      return assetUrl;
    } catch {
      return null;
    }
  },

  setSort: (sortBy, sortOrder) => {
    set({ sortBy, sortOrder });
    get().loadTracks();
  },

  setSelectedTrackId: (id) => {
    set({ selectedTrackId: id });
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
    try {
      localStorage.setItem('syncd_library_view_mode', mode);
    } catch {
      // Ignore storage error
    }
  },

  getArtwork: async (trackId: string) => {
    const cached = get().artworkCache[trackId];
    if (cached) return cached;

    try {
      const filePath = await invoke<string | null>('get_artwork', { trackId });
      if (filePath) {
        const assetUrl = convertFileSrc(filePath);
        set((state) => ({
          artworkCache: { ...state.artworkCache, [trackId]: assetUrl },
        }));
        return assetUrl;
      }
    } catch (err) {
      console.error('Failed to load artwork for track:', trackId, err);
    }
    return null;
  },

  setupEventListeners: async () => {
    const unlistenProgress = await listen<ScanProgress>('library:scan-progress', (event) => {
      set({ scanProgress: event.payload, isScanning: true });
    });

    const unlistenComplete = await listen<ScanCompleteEvent>('library:scan-complete', async () => {
      set({ isScanning: false, scanProgress: null, hasUnscannedAudio: false });
      await get().loadTracks();
      await get().loadFolders();
      await get().loadStats();
    });

    const unlistenError = await listen<string>('library:scan-error', () => {
      set({ isScanning: false, scanProgress: null });
    });

    return () => {
      unlistenProgress();
      unlistenComplete();
      unlistenError();
    };
  },
}));
