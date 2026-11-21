import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { AudioPlaybackStatus, PlaybackState, AudioDeviceDescriptor } from '../types/audio';
import { useSettingsStore } from './useSettingsStore';
import { showTrackNotification } from '../services/notificationService';
import { soundService } from '../services/soundService';

export interface CurrentTrack {
  id: string;
  trackId?: string;
  title: string;
  artist: string;
  album: string;
  durationSeconds: number;
  artworkUrl?: string;
  source: 'local' | 'youtube';
  path?: string;
  format?: string;
  bitrateKbps?: number;
  isCurrent?: boolean;
}

export interface BackendQueuedTrack {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  album: string;
  durationSeconds: number;
  artworkUrl?: string;
  source: 'local' | 'youtube';
  path?: string;
  format?: string;
  bitrateKbps?: number;
  queueOrder: number;
  isCurrent: boolean;
  createdAt: string;
}

export function fromBackendTrack(bt: BackendQueuedTrack): CurrentTrack {
  return {
    id: bt.id,
    trackId: bt.trackId,
    title: bt.title,
    artist: bt.artist,
    album: bt.album,
    durationSeconds: bt.durationSeconds,
    artworkUrl: bt.artworkUrl,
    source: bt.source || 'local',
    path: bt.path,
    format: bt.format,
    bitrateKbps: bt.bitrateKbps,
    isCurrent: bt.isCurrent,
  };
}

export function toBackendInput(t: CurrentTrack) {
  return {
    id: t.id,
    trackId: t.trackId || t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    durationSeconds: t.durationSeconds,
    artworkUrl: t.artworkUrl,
    source: t.source || 'local',
    path: t.path,
    format: t.format,
    bitrateKbps: t.bitrateKbps,
  };
}

interface PlayerState {
  currentTrack: CurrentTrack | null;
  queue: CurrentTrack[];
  queueIndex: number;
  status: PlaybackState;
  positionSeconds: number;
  durationSeconds: number;
  volume: number; // 0 to 100
  isMuted: boolean;
  isSeeking: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  devices: AudioDeviceDescriptor[];
  errorMessage: string | null;
  hasPlaybackStarted: boolean;

  // Actions
  dismissPlayer: () => void;
  restorePlayer: () => void;
  playTrack: (track: CurrentTrack, queue?: CurrentTrack[]) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlay: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  handleTrackEnded: () => Promise<void>;
  seek: (positionSeconds: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  syncStatus: () => Promise<void>;
  loadDevices: () => Promise<void>;

  // User DB Queued Playback Actions
  addToQueue: (track: CurrentTrack) => Promise<void>;
  enqueueTracks: (tracks: CurrentTrack[]) => Promise<void>;
  removeFromQueue: (idOrIndex: string | number) => Promise<void>;
  clearQueue: () => Promise<void>;
  loadPersistedQueue: () => Promise<void>;
  playQueuedTrack: (index: number) => Promise<void>;
}

let syncTimer: number | null = null;

function startSyncLoop(get: () => PlayerState, set: (partial: Partial<PlayerState>) => void) {
  if (syncTimer !== null) return;

  syncTimer = window.setInterval(async () => {
    const { currentTrack, status, isSeeking, durationSeconds } = get();
    if (!currentTrack || status !== 'playing' || currentTrack.source !== 'local' || isSeeking) {
      return;
    }

    try {
      const audioStatus = await invoke<AudioPlaybackStatus>('audio_get_status');
      // Strict guard: if user paused while IPC was in flight, discard the response!
      if (get().status !== 'playing') {
        return;
      }

      const curDur = audioStatus.durationSeconds > 0
        ? audioStatus.durationSeconds
        : (durationSeconds || currentTrack.durationSeconds || 0);

      const isEnded =
        audioStatus.state === 'ended' ||
        (curDur > 0 && audioStatus.positionSeconds >= curDur);

      set({
        positionSeconds: isEnded ? curDur : Math.min(audioStatus.positionSeconds, curDur > 0 ? curDur : Infinity),
        durationSeconds: curDur,
        status: isEnded ? 'ended' : 'playing',
      });

      if (isEnded) {
        await get().handleTrackEnded();
      }
    } catch {
      // IPC quiet fallback
    }
  }, 100);
}

function stopSyncLoop() {
  if (syncTimer !== null) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  status: 'stopped',
  positionSeconds: 0,
  durationSeconds: 0,
  volume: 80,
  isMuted: false,
  isSeeking: false,
  isShuffle: false,
  repeatMode: 'off',
  devices: [],
  errorMessage: null,
  hasPlaybackStarted: false,

  dismissPlayer: () => set({ hasPlaybackStarted: false }),
  restorePlayer: () => {
    const { currentTrack, queue } = get();
    if (currentTrack) {
      set({ hasPlaybackStarted: true });
    } else if (queue.length > 0) {
      set({
        currentTrack: queue[0],
        hasPlaybackStarted: true,
        durationSeconds: queue[0].durationSeconds,
      });
    }
  },

  playTrack: async (track, newQueue) => {
    const queue = newQueue !== undefined ? newQueue : get().queue;
    let queueIndex = queue.findIndex(
      (t) => t.id === track.id || (track.trackId && t.trackId === track.trackId)
    );
    if (queueIndex < 0 && track.trackId) {
      queueIndex = queue.findIndex((t) => t.id === track.trackId);
    }

    set({
      currentTrack: track,
      queue,
      queueIndex: queueIndex >= 0 ? queueIndex : 0,
      status: 'loading',
      positionSeconds: 0,
      durationSeconds: track.durationSeconds,
      errorMessage: null,
      hasPlaybackStarted: true,
    });

    const { trackNotifications } = useSettingsStore.getState();
    if (trackNotifications) {
      showTrackNotification({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artworkUrl: track.artworkUrl,
      });
    }

    // Update backend user_db with current playing track and queue
    if (newQueue && newQueue.length > 0) {
      const inputs = newQueue.map(toBackendInput);
      invoke('queue_save_all', {
        tracks: inputs,
        currentTrackId: track.trackId || track.id,
      }).catch((e) => console.error('Failed to sync queue to user_db:', e));
    } else {
      invoke('queue_set_current', { trackId: track.trackId || track.id }).catch(() => {});
    }

    if (track.source === 'local' && track.path) {
      try {
        await invoke('audio_play_track', { path: track.path, startPos: 0 });
        set({ status: 'playing' });
        startSyncLoop(get, set);
      } catch (err: unknown) {
        console.error('Failed to play local track:', err);
        set({
          status: 'error',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      // YouTube / Social playback mode
      set({ status: 'playing' });
      startSyncLoop(get, set);
    }
  },

  handleTrackEnded: async () => {
    const { repeatMode, currentTrack, queue, queueIndex, playNext, seek, play } = get();
    if (!currentTrack) return;

    if (repeatMode === 'one') {
      // Replay the current track from beginning
      await seek(0);
      await play();
      return;
    }

    if (repeatMode === 'all') {
      await playNext();
      return;
    }

    // repeatMode === 'off'
    const effectiveIndex = queueIndex >= 0 ? queueIndex : queue.findIndex((t) => t.id === currentTrack.id);
    if (queue.length > 0 && effectiveIndex >= 0 && effectiveIndex < queue.length - 1) {
      await playNext();
    } else {
      // End of queue with repeat off
      set({ status: 'stopped', positionSeconds: 0 });
      stopSyncLoop();
    }
  },

  playNext: async () => {
    const { queue, queueIndex, currentTrack, isShuffle, repeatMode, playTrack, seek, play } = get();
    if (queue.length === 0) {
      if (currentTrack) {
        await seek(0);
        await play();
      }
      return;
    }

    let nextIndex: number;
    const currentIndex =
      queueIndex >= 0
        ? queueIndex
        : queue.findIndex(
            (t) =>
              t.id === currentTrack?.id ||
              (currentTrack?.trackId && t.trackId === currentTrack.trackId) ||
              (currentTrack?.id && t.trackId === currentTrack.id)
          );

    if (isShuffle && queue.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === currentIndex && queue.length > 1);
    } else {
      nextIndex = currentIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeatMode === 'all') {
          nextIndex = 0;
        } else {
          set({ status: 'stopped', positionSeconds: 0 });
          stopSyncLoop();
          return;
        }
      }
    }

    const nextTrack = queue[nextIndex];
    if (nextTrack) {
      set({ queueIndex: nextIndex });
      await playTrack(nextTrack);
    }
  },

  playPrevious: async () => {
    const { queue, queueIndex, currentTrack, positionSeconds, playTrack, seek, play } = get();
    if (positionSeconds > 3) {
      await seek(0);
      return;
    }

    if (queue.length === 0) {
      if (currentTrack) {
        await seek(0);
        await play();
      }
      return;
    }

    const currentIndex =
      queueIndex >= 0
        ? queueIndex
        : queue.findIndex(
            (t) =>
              t.id === currentTrack?.id ||
              (currentTrack?.trackId && t.trackId === currentTrack.trackId) ||
              (currentTrack?.id && t.trackId === currentTrack.id)
          );
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }

    const prevTrack = queue[prevIndex];
    if (prevTrack) {
      set({ queueIndex: prevIndex });
      await playTrack(prevTrack);
    }
  },

  play: async () => {
    const { currentTrack } = get();
    if (!currentTrack) return;

    // Optimistically update playing state on the exact click tick
    set({ status: 'playing', hasPlaybackStarted: true });
    startSyncLoop(get, set);

    if (currentTrack.source === 'local') {
      try {
        await invoke('audio_resume');
      } catch (err) {
        console.error('Failed to resume audio:', err);
        set({ status: 'paused' });
        stopSyncLoop();
      }
    }
  },

  pause: async () => {
    const { currentTrack } = get();
    // Instantly halt sync polling and update to paused
    stopSyncLoop();
    set({ status: 'paused' });

    if (currentTrack?.source === 'local') {
      try {
        await invoke('audio_pause');
      } catch (err) {
        console.error('Failed to pause audio:', err);
      }
    }
  },

  togglePlay: async () => {
    const { status, play, pause } = get();
    if (status === 'playing') {
      await pause();
    } else {
      await play();
    }
  },

  seek: async (positionSeconds) => {
    const { currentTrack } = get();
    set({ positionSeconds, isSeeking: false });

    if (currentTrack?.source === 'local') {
      try {
        await invoke('audio_seek', { positionSeconds });
      } catch (err) {
        console.error('Failed to seek native audio:', err);
      }
    }
  },

  setVolume: async (volume) => {
    const clamped = Math.max(0, Math.min(100, volume));
    set({ volume: clamped });
    try {
      await invoke('audio_set_volume', { volume: clamped / 100 });
    } catch {
      // IPC fallback
    }
  },

  toggleMute: async () => {
    const isMuted = !get().isMuted;
    set({ isMuted });
    try {
      await invoke('audio_toggle_mute');
    } catch {
      // IPC fallback
    }
  },

  toggleShuffle: () => {
    set((state) => ({ isShuffle: !state.isShuffle }));
  },

  toggleRepeat: () => {
    set((state) => {
      const next: 'off' | 'all' | 'one' =
        state.repeatMode === 'off' ? 'all' : state.repeatMode === 'all' ? 'one' : 'off';
      return { repeatMode: next };
    });
  },

  syncStatus: async () => {
    try {
      const audioStatus = await invoke<AudioPlaybackStatus>('audio_get_status');
      set({
        status: audioStatus.state,
        positionSeconds: audioStatus.positionSeconds,
        durationSeconds: audioStatus.durationSeconds,
        isMuted: audioStatus.isMuted,
      });
    } catch {
      // IPC quiet
    }
  },

  loadDevices: async () => {
    try {
      const devices = await invoke<AudioDeviceDescriptor[]>('audio_list_devices');
      set({ devices });
    } catch (err) {
      console.error('Failed to load audio devices:', err);
    }
  },

  addToQueue: async (track) => {
    const input = toBackendInput(track);
    try {
      const rows = await invoke<BackendQueuedTrack[]>('queue_add_tracks', {
        tracks: [input],
      });
      const updatedQueue = rows.map(fromBackendTrack);
      const curr = get().currentTrack;
      if (!curr && updatedQueue.length > 0) {
        set({
          queue: updatedQueue,
          queueIndex: 0,
          currentTrack: updatedQueue[0],
          durationSeconds: updatedQueue[0].durationSeconds,
        });
      } else {
        const currIndex = updatedQueue.findIndex(
          (t) =>
            t.id === curr?.id ||
            (curr?.trackId && t.trackId === curr.trackId) ||
            (curr?.id && t.trackId === curr.id)
        );
        set({
          queue: updatedQueue,
          queueIndex: currIndex >= 0 ? currIndex : get().queueIndex,
        });
      }
    } catch (err) {
      console.error('Failed to add track to backend queue:', err);
      const fallbackTrack = { ...track, trackId: track.trackId || track.id };
      const newQueue = [...get().queue, fallbackTrack];
      set({ queue: newQueue });
    }
  },

  enqueueTracks: async (tracks) => {
    if (tracks.length === 0) return;
    const inputs = tracks.map(toBackendInput);
    try {
      const rows = await invoke<BackendQueuedTrack[]>('queue_add_tracks', {
        tracks: inputs,
      });
      const updatedQueue = rows.map(fromBackendTrack);
      const curr = get().currentTrack;
      if (!curr && updatedQueue.length > 0) {
        set({
          queue: updatedQueue,
          queueIndex: 0,
          currentTrack: updatedQueue[0],
          durationSeconds: updatedQueue[0].durationSeconds,
        });
      } else {
        const currIndex = updatedQueue.findIndex(
          (t) =>
            t.id === curr?.id ||
            (curr?.trackId && t.trackId === curr.trackId) ||
            (curr?.id && t.trackId === curr.id)
        );
        set({
          queue: updatedQueue,
          queueIndex: currIndex >= 0 ? currIndex : get().queueIndex,
        });
      }
    } catch (err) {
      console.error('Failed to enqueue tracks in backend:', err);
      set({ queue: [...get().queue, ...tracks] });
    }
  },

  removeFromQueue: async (idOrIndex) => {
    soundService.play('action:delete');
    const queue = [...get().queue];
    let targetId: string | undefined;
    let targetIndex = -1;

    if (typeof idOrIndex === 'number') {
      targetIndex = idOrIndex;
      targetId = queue[idOrIndex]?.id;
    } else {
      targetIndex = queue.findIndex(
        (t) => t.id === idOrIndex || t.trackId === idOrIndex
      );
      targetId = idOrIndex;
    }

    if (targetIndex >= 0) {
      queue.splice(targetIndex, 1);
      const currentQueueIndex = get().queueIndex;
      let newQueueIndex = currentQueueIndex;
      if (targetIndex < currentQueueIndex) {
        newQueueIndex = currentQueueIndex - 1;
      } else if (targetIndex === currentQueueIndex) {
        newQueueIndex = Math.min(currentQueueIndex, queue.length - 1);
      }
      if (queue.length === 0) {
        set({ queue: [], queueIndex: -1, currentTrack: null, status: 'stopped', hasPlaybackStarted: false });
      } else {
        set({ queue, queueIndex: newQueueIndex });
      }
    }

    if (targetId) {
      try {
        await invoke('queue_remove_track', { id: targetId });
      } catch (err) {
        console.error('Failed to remove track from backend queue:', err);
      }
    }
  },

  clearQueue: async () => {
    soundService.play('action:delete');
    set({ queue: [], queueIndex: -1, currentTrack: null, status: 'stopped', hasPlaybackStarted: false });
    try {
      await invoke('queue_clear');
    } catch (err) {
      console.error('Failed to clear backend queue:', err);
    }
  },

  loadPersistedQueue: async () => {
    try {
      const rows = await invoke<BackendQueuedTrack[]>('queue_get');
      if (rows && rows.length > 0) {
        const queue = rows.map(fromBackendTrack);
        const currentIndex = queue.findIndex((t) => t.isCurrent);
        if (currentIndex >= 0) {
          const currentTrack = queue[currentIndex];
          set({
            queue,
            queueIndex: currentIndex,
            currentTrack,
            durationSeconds: currentTrack.durationSeconds,
            hasPlaybackStarted: false,
          });
        } else {
          set({
            queue,
            queueIndex: -1,
            hasPlaybackStarted: false,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load persisted queue:', err);
    }
  },

  playQueuedTrack: async (index) => {
    const { queue, playTrack } = get();
    if (index < 0 || index >= queue.length) return;
    const track = queue[index];
    set({ queueIndex: index });
    await playTrack(track);
  },
}));
