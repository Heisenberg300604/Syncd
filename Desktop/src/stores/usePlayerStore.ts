import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { AudioPlaybackStatus, PlaybackState, AudioDeviceDescriptor } from '../types/audio';
import { useSettingsStore } from './useSettingsStore';
import { useLibraryStore } from './useLibraryStore';
import { showTrackNotification } from '../services/notificationService';
import { soundService } from '../services/soundService';
import { isTauri } from '../services/tauriBridge';

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
  saveCurrentSession: () => void;

  // User DB Queued Playback Actions
  addToQueue: (track: CurrentTrack) => Promise<void>;
  addToQueueNext: (track: CurrentTrack) => Promise<void>;
  enqueueTracks: (tracks: CurrentTrack[]) => Promise<void>;
  removeFromQueue: (idOrIndex: string | number) => Promise<void>;
  clearQueue: () => Promise<void>;
  loadPersistedQueue: () => Promise<void>;
  playQueuedTrack: (index: number) => Promise<void>;
}

export const PLAYBACK_SESSION_KEY = 'syncd_playback_session';

export interface PlaybackSession {
  trackId: string;
  positionSeconds: number;
  durationSeconds: number;
  isFinished: boolean;
  updatedAt: number;
}

/**
 * Returns true if the position is at or near the end of the track.
 * Criteria: natural end, within 2 seconds of duration, or >= 98% complete.
 */
export function isTrackFinished(position: number, duration: number): boolean {
  if (!duration || duration <= 0) return false;
  if (position >= duration) return true;
  if (duration > 2 && position >= duration - 2) return true;
  if (position / duration >= 0.98) return true;
  return false;
}

let lastPersistedTime = 0;
const PERSIST_INTERVAL_MS = 1500;

export function persistPlaybackSession(session: PlaybackSession, immediate = false) {
  const now = Date.now();
  if (!immediate && now - lastPersistedTime < PERSIST_INTERVAL_MS) {
    return;
  }
  lastPersistedTime = now;
  try {
    localStorage.setItem(PLAYBACK_SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('Failed to persist playback session to localStorage:', e);
  }
  // Quiet background sync to SQLite settings
  invoke('set_setting', {
    key: 'playback.session',
    value: JSON.stringify(session),
  }).catch(() => {});
}

export function clearPlaybackSession(trackId?: string) {
  const session: PlaybackSession = {
    trackId: trackId || '',
    positionSeconds: 0,
    durationSeconds: 0,
    isFinished: true,
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(PLAYBACK_SESSION_KEY, JSON.stringify(session));
  } catch {
    // quiet
  }
  invoke('set_setting', {
    key: 'playback.session',
    value: JSON.stringify(session),
  }).catch(() => {});
}

export function getPersistedSession(): PlaybackSession | null {
  try {
    const raw = localStorage.getItem(PLAYBACK_SESSION_KEY);
    if (raw) {
      return JSON.parse(raw) as PlaybackSession;
    }
  } catch {
    // quiet
  }
  return null;
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

      // Self-heal missing duration in memory, SQLite, and library store
      if (currentTrack.durationSeconds <= 0 && curDur > 0) {
        currentTrack.durationSeconds = curDur;
        if (isTauri()) {
          invoke('update_track_duration', {
            trackId: currentTrack.id,
            durationSeconds: curDur,
          }).catch(console.error);
        }
        useLibraryStore.getState().updateTrackDuration(currentTrack.id, curDur);
      }

      const finished =
        audioStatus.state === 'ended' ||
        isTrackFinished(audioStatus.positionSeconds, curDur);

      const isEnded =
        audioStatus.state === 'ended' ||
        (curDur > 0 && audioStatus.positionSeconds >= curDur);

      set({
        positionSeconds: isEnded ? curDur : Math.min(audioStatus.positionSeconds, curDur > 0 ? curDur : Infinity),
        durationSeconds: curDur,
        status: isEnded ? 'ended' : 'playing',
      });

      // Throttle session persistence during active playback
      if (!finished) {
        persistPlaybackSession({
          trackId: currentTrack.trackId || currentTrack.id,
          positionSeconds: audioStatus.positionSeconds,
          durationSeconds: curDur,
          isFinished: false,
          updatedAt: Date.now(),
        });
      } else {
        persistPlaybackSession({
          trackId: currentTrack.trackId || currentTrack.id,
          positionSeconds: 0,
          durationSeconds: curDur,
          isFinished: true,
          updatedAt: Date.now(),
        }, true);
      }

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

    persistPlaybackSession({
      trackId: track.trackId || track.id,
      positionSeconds: 0,
      durationSeconds: track.durationSeconds,
      isFinished: false,
      updatedAt: Date.now(),
    }, true);

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
      // End of queue with repeat off: Track has finished!
      clearPlaybackSession(currentTrack.trackId || currentTrack.id);
      invoke('queue_set_current', { trackId: '' }).catch(() => {});
      set({
        status: 'stopped',
        positionSeconds: 0,
        currentTrack: null,
        hasPlaybackStarted: false,
      });
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
    const { currentTrack, positionSeconds } = get();
    if (!currentTrack) return;

    // Optimistically update playing state on the exact click tick
    set({ status: 'playing', hasPlaybackStarted: true });
    startSyncLoop(get, set);

    if (currentTrack.source === 'local' && currentTrack.path) {
      try {
        const audioStatus = await invoke<AudioPlaybackStatus>('audio_get_status').catch(() => null);
        if (!audioStatus || audioStatus.state === 'stopped') {
          // Native engine has no track loaded yet (e.g. cold start):
          // Start playing from the exact left-off spot!
          await invoke('audio_play_track', {
            path: currentTrack.path,
            startPos: positionSeconds || 0,
          });
        } else {
          try {
            await invoke('audio_resume');
          } catch {
            // Fallback if resume failed because track was unloaded
            await invoke('audio_play_track', {
              path: currentTrack.path,
              startPos: positionSeconds || 0,
            });
          }
        }
      } catch (err) {
        console.error('Failed to resume audio:', err);
        set({ status: 'paused' });
        stopSyncLoop();
      }
    } else {
      // YouTube / Social playback mode
      set({ status: 'playing' });
      startSyncLoop(get, set);
    }
  },

  pause: async () => {
    const { currentTrack, positionSeconds, durationSeconds } = get();
    // Instantly halt sync polling and update to paused
    stopSyncLoop();
    set({ status: 'paused' });

    if (currentTrack) {
      const finished = isTrackFinished(positionSeconds, durationSeconds);
      persistPlaybackSession({
        trackId: currentTrack.trackId || currentTrack.id,
        positionSeconds: finished ? 0 : positionSeconds,
        durationSeconds,
        isFinished: finished,
        updatedAt: Date.now(),
      }, true);
    }

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
    const { currentTrack, durationSeconds } = get();
    set({ positionSeconds, isSeeking: false });

    if (currentTrack) {
      const finished = isTrackFinished(positionSeconds, durationSeconds);
      persistPlaybackSession({
        trackId: currentTrack.trackId || currentTrack.id,
        positionSeconds: finished ? 0 : positionSeconds,
        durationSeconds,
        isFinished: finished,
        updatedAt: Date.now(),
      }, true);
    }

    if (currentTrack?.source === 'local') {
      try {
        await invoke('audio_seek', { positionSeconds });
      } catch {
        // Native engine quiet fallback if track not yet loaded in cold-start state;
        // play() will launch with positionSeconds when clicked.
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
      const curTrack = get().currentTrack;
      if (curTrack && curTrack.durationSeconds <= 0 && audioStatus.durationSeconds > 0) {
        curTrack.durationSeconds = audioStatus.durationSeconds;
        invoke('update_track_duration', {
          trackId: curTrack.id,
          durationSeconds: audioStatus.durationSeconds,
        }).catch(console.error);
        useLibraryStore.getState().updateTrackDuration(curTrack.id, audioStatus.durationSeconds);
      }
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

  saveCurrentSession: () => {
    const { currentTrack, positionSeconds, durationSeconds, status } = get();
    if (!currentTrack) return;
    const finished = isTrackFinished(positionSeconds, durationSeconds) || status === 'ended';
    persistPlaybackSession({
      trackId: currentTrack.trackId || currentTrack.id,
      positionSeconds: finished ? 0 : positionSeconds,
      durationSeconds,
      isFinished: finished,
      updatedAt: Date.now(),
    }, true);
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

  addToQueueNext: async (track) => {
    const currentQueue = [...get().queue];
    const { currentTrack, queueIndex } = get();

    if (currentQueue.length === 0 || !currentTrack) {
      await get().addToQueue(track);
      return;
    }

    const insertIndex = queueIndex >= 0 ? queueIndex + 1 : currentQueue.length;
    const newTrack: CurrentTrack = { ...track, trackId: track.trackId || track.id };
    currentQueue.splice(insertIndex, 0, newTrack);

    set({ queue: currentQueue });

    const inputs = currentQueue.map(toBackendInput);
    try {
      const rows = await invoke<BackendQueuedTrack[]>('queue_save_all', {
        tracks: inputs,
        currentTrackId: currentTrack.trackId || currentTrack.id,
      });
      const updatedQueue = rows.map(fromBackendTrack);
      const currIndex = updatedQueue.findIndex(
        (t) =>
          t.id === currentTrack.id ||
          (currentTrack.trackId && t.trackId === currentTrack.trackId) ||
          (currentTrack.id && t.trackId === currentTrack.id)
      );
      set({
        queue: updatedQueue,
        queueIndex: currIndex >= 0 ? currIndex : queueIndex,
      });
    } catch (err) {
      console.error('Failed to sync queue after addToQueueNext:', err);
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
      let session = getPersistedSession();
      if (!session) {
        try {
          const val = await invoke<string | null>('get_setting', { key: 'playback.session' });
          if (val) {
            session = JSON.parse(val);
          }
        } catch {
          // quiet
        }
      }

      const rows = await invoke<BackendQueuedTrack[]>('queue_get');
      const queue = rows && rows.length > 0 ? rows.map(fromBackendTrack) : [];

      // Case 1: Session was explicitly marked as finished
      // Do NOT show that track after cold start in the bottom player!
      if (session && session.isFinished) {
        set({
          queue,
          queueIndex: -1,
          currentTrack: null,
          positionSeconds: 0,
          durationSeconds: 0,
          hasPlaybackStarted: false,
          status: 'stopped',
        });
        return;
      }

      // Case 2: Unfinished session exists
      // Show user that same song where they had left it with ability to play from that spot!
      if (session && !session.isFinished && session.trackId) {
        let currentIndex = queue.findIndex(
          (t) => t.id === session!.trackId || t.trackId === session!.trackId
        );
        if (currentIndex < 0) {
          currentIndex = queue.findIndex((t) => t.isCurrent);
        }

        if (currentIndex >= 0) {
          const currentTrack = queue[currentIndex];
          const pos = Math.max(0, session.positionSeconds || 0);
          const dur = session.durationSeconds || currentTrack.durationSeconds || 0;

          // Double check if near-end
          if (isTrackFinished(pos, dur)) {
            set({
              queue,
              queueIndex: -1,
              currentTrack: null,
              positionSeconds: 0,
              durationSeconds: 0,
              hasPlaybackStarted: false,
              status: 'stopped',
            });
            clearPlaybackSession(session.trackId);
            return;
          }

          set({
            queue,
            queueIndex: currentIndex,
            currentTrack,
            positionSeconds: pos,
            durationSeconds: dur,
            hasPlaybackStarted: true,
            status: 'paused',
          });
          return;
        }
      }

      // Case 3: No session saved or empty queue
      set({
        queue,
        queueIndex: -1,
        currentTrack: null,
        positionSeconds: 0,
        durationSeconds: 0,
        hasPlaybackStarted: false,
        status: 'stopped',
      });
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
