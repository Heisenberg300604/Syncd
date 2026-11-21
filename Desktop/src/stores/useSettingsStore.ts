import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { soundService } from '../services/soundService';

interface SettingsState {
  isLoaded: boolean;
  selectedDevice: string;
  volumeNormalization: boolean;
  gaplessPlayback: boolean;
  trackNotifications: boolean;
  autoQueue: boolean;
  sfxEnabled: boolean;
  sfxVolume: number;
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
  setSfxEnabled: (enabled: boolean) => Promise<void>;
  setSfxVolume: (volume: number) => Promise<void>;
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
  sfxEnabled: true,
  sfxVolume: 0.7,
  selectedAccent: 'amber',
  apiUrl: 'http://localhost:5000/api',
  socketUrl: 'http://localhost:5000',

  loadSettings: async () => {
    try {
      const all = await invoke<Record<string, string>>('get_all_settings');
      if (all) {
        const sfxEnabled = all['audio.sfxEnabled'] !== 'false';
        const parsedVol = parseFloat(all['audio.sfxVolume'] || '0.7');
        const sfxVolume = isNaN(parsedVol) ? 0.7 : Math.max(0, Math.min(1, parsedVol));

        set({
          isLoaded: true,
          selectedDevice: all['audio.device'] || 'default',
          volumeNormalization: all['audio.normalization'] !== 'false',
          gaplessPlayback: all['audio.gapless'] !== 'false',
          trackNotifications: all['ui.notifications'] !== 'false',
          autoQueue: all['playback.autoQueue'] === 'true',
          sfxEnabled,
          sfxVolume,
          selectedAccent: ((all['ui.accent'] as 'amber' | 'gold' | 'emerald' | 'cyan') || 'amber'),
          apiUrl: all['network.apiUrl'] || 'http://localhost:5000/api',
          socketUrl: all['network.socketUrl'] || 'http://localhost:5000',
        });

        soundService.setEnabled(sfxEnabled);
        soundService.setVolume(sfxVolume);
        soundService.preloadAll().catch(() => {});

        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-accent', all['ui.accent'] || 'amber');
        }
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
    soundService.play(enabled ? 'toggle:on' : 'toggle:off');
    await get().setSettingValue('audio.normalization', String(enabled));
  },

  setGaplessPlayback: async (enabled: boolean) => {
    set({ gaplessPlayback: enabled });
    soundService.play(enabled ? 'toggle:on' : 'toggle:off');
    await get().setSettingValue('audio.gapless', String(enabled));
  },

  setTrackNotifications: async (enabled: boolean) => {
    set({ trackNotifications: enabled });
    soundService.play(enabled ? 'toggle:on' : 'toggle:off');
    await get().setSettingValue('ui.notifications', String(enabled));
  },

  setAutoQueue: async (enabled: boolean) => {
    set({ autoQueue: enabled });
    soundService.play(enabled ? 'toggle:on' : 'toggle:off');
    await get().setSettingValue('playback.autoQueue', String(enabled));
  },

  setSfxEnabled: async (enabled: boolean) => {
    set({ sfxEnabled: enabled });
    soundService.setEnabled(enabled);
    if (enabled) {
      soundService.play('toggle:on');
    }
    await get().setSettingValue('audio.sfxEnabled', String(enabled));
  },

  setSfxVolume: async (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    set({ sfxVolume: clamped });
    soundService.setVolume(clamped);
    await get().setSettingValue('audio.sfxVolume', String(clamped));
  },

  setSelectedAccent: async (accent) => {
    set({ selectedAccent: accent });
    soundService.play('toggle:on');
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-accent', accent);
    }
    await get().setSettingValue('ui.accent', accent);
  },

  setEndpoints: async (apiUrl: string, socketUrl: string) => {
    set({ apiUrl, socketUrl });
    await get().setSettingValue('network.apiUrl', apiUrl);
    await get().setSettingValue('network.socketUrl', socketUrl);
  },
}));
