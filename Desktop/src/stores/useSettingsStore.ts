import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface SettingsState {
  isLoaded: boolean;
  selectedDevice: string;
  volumeNormalization: boolean;
  gaplessPlayback: boolean;
  trackNotifications: boolean;
  autoQueue: boolean;
  selectedAccent: 'amber' | 'gold' | 'emerald' | 'cyan';
  apiUrl: string;
  socketUrl: string;

  // Actions
  loadSettings: () => Promise<void>;
  setSettingValue: (key: string, value: string) => Promise<void>;
  setSelectedDevice: (deviceId: string) => Promise<void>;
  setVolumeNormalization: (enabled: boolean) => Promise<void>;
  setGaplessPlayback: (enabled: boolean) => Promise<void>;
  setTrackNotifications: (enabled: boolean) => Promise<void>;
  setAutoQueue: (enabled: boolean) => Promise<void>;
  setSelectedAccent: (accent: 'amber' | 'gold' | 'emerald' | 'cyan') => Promise<void>;
  setEndpoints: (apiUrl: string, socketUrl: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isLoaded: false,
  selectedDevice: 'default',
  volumeNormalization: true,
  gaplessPlayback: true,
  trackNotifications: true,
  autoQueue: false,
  selectedAccent: 'amber',
  apiUrl: 'http://localhost:5000/api',
  socketUrl: 'http://localhost:5000',

  loadSettings: async () => {
    try {
      const all = await invoke<Record<string, string>>('get_all_settings');
      if (all) {
        set({
          isLoaded: true,
          selectedDevice: all['audio.device'] || 'default',
          volumeNormalization: all['audio.normalization'] !== 'false',
          gaplessPlayback: all['audio.gapless'] !== 'false',
          trackNotifications: all['ui.notifications'] !== 'false',
          autoQueue: all['playback.autoQueue'] === 'true',
          selectedAccent: (all['ui.accent'] as 'amber') || 'amber',
          apiUrl: all['network.apiUrl'] || 'http://localhost:5000/api',
          socketUrl: all['network.socketUrl'] || 'http://localhost:5000',
        });
      }
    } catch (err) {
      console.warn('Failed to load settings from SQLite, using defaults:', err);
      set({ isLoaded: true });
    }
  },

  setSettingValue: async (key: string, value: string) => {
    try {
      await invoke('set_setting', { key, value });
    } catch (err) {
      console.error(`Failed to save setting ${key} to SQLite:`, err);
    }
  },

  setSelectedDevice: async (deviceId: string) => {
    set({ selectedDevice: deviceId });
    await get().setSettingValue('audio.device', deviceId);
  },

  setVolumeNormalization: async (enabled: boolean) => {
    set({ volumeNormalization: enabled });
    await get().setSettingValue('audio.normalization', String(enabled));
  },

  setGaplessPlayback: async (enabled: boolean) => {
    set({ gaplessPlayback: enabled });
    await get().setSettingValue('audio.gapless', String(enabled));
  },

  setTrackNotifications: async (enabled: boolean) => {
    set({ trackNotifications: enabled });
    await get().setSettingValue('ui.notifications', String(enabled));
  },

  setAutoQueue: async (enabled: boolean) => {
    set({ autoQueue: enabled });
    await get().setSettingValue('playback.autoQueue', String(enabled));
  },

  setSelectedAccent: async (accent) => {
    set({ selectedAccent: accent });
    await get().setSettingValue('ui.accent', accent);
  },

  setEndpoints: async (apiUrl: string, socketUrl: string) => {
    set({ apiUrl, socketUrl });
    await get().setSettingValue('network.apiUrl', apiUrl);
    await get().setSettingValue('network.socketUrl', socketUrl);
  },
}));

