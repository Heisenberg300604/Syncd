// Desktop Audio Effects Engine for SyncDesk
// Powered by Web Audio API with preloading, volume normalization, choking, and concurrency control

export type SoundEffect =
  | 'room:create'
  | 'room:join'
  | 'room:leave'
  | 'scan:success'
  | 'scan:nothing_new'
  | 'scan:fail'
  | 'drawer:open'
  | 'drawer:close'
  | 'notification:ping'
  | 'notification:chat'
  | 'update:available'
  | 'toggle:on'
  | 'toggle:off'
  | 'action:delete';

type SoundCategory = 'room' | 'scan' | 'drawer' | 'notification' | 'update' | 'toggle' | 'action';

interface SoundMeta {
  path: string;
  category: SoundCategory;
}

const SOUND_REGISTRY: Record<SoundEffect, SoundMeta> = {
  'room:create': { path: '/audio/Room/Create/pluck.mp3', category: 'room' },
  'room:join': { path: '/audio/Room/Join/arrive.mp3', category: 'room' },
  'room:leave': { path: '/audio/Room/Leave/petal.mp3', category: 'room' },
  'scan:success': { path: '/audio/Scan/Success/wrap.mp3', category: 'scan' },
  'scan:nothing_new': { path: '/audio/Scan/Nothing_New/tally.mp3', category: 'scan' },
  'scan:fail': { path: '/audio/Scan/Fail/tally.mp3', category: 'scan' },
  'drawer:open': { path: '/audio/Drawer/Open/drawer.mp3', category: 'drawer' },
  'drawer:close': { path: '/audio/Drawer/Close/drawer.mp3', category: 'drawer' },
  'notification:ping': { path: '/audio/Notification/ping.mp3', category: 'notification' },
  'notification:chat': { path: '/audio/Notification/Chat/settle.mp3', category: 'notification' },
  'update:available': { path: '/audio/Update/tine.mp3', category: 'update' },
  'toggle:on': { path: '/audio/Toggle/spring.mp3', category: 'toggle' },
  'toggle:off': { path: '/audio/Toggle/nightfall.mp3', category: 'toggle' },
  'action:delete': { path: '/audio/Deletion/undo.mp3', category: 'action' },
};

class SoundService {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bufferCache: Map<string, AudioBuffer> = new Map();
  private pendingFetches: Map<string, Promise<AudioBuffer | null>> = new Map();
  private isEnabled: boolean = true;
  private volume: number = 0.7; // 0 to 1

  // Choke tracking: map category to active AudioBufferSourceNode
  private activeCategoryNodes: Map<SoundCategory, AudioBufferSourceNode> = new Map();
  // Throttle tracking: map category to last play timestamp
  private lastCategoryPlayTime: Map<SoundCategory, number> = new Map();

  private throttleWindowMs = 80; // 80ms choke throttle window

  constructor() {
    this.setupUserGestureUnlock();
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.isEnabled ? this.volume : 0, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
      }
    }
    return this.audioCtx;
  }

  private setupUserGestureUnlock() {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(
        this.isEnabled ? this.volume : 0,
        this.audioCtx.currentTime
      );
    }
  }

  public setVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    this.volume = clamped;
    if (this.masterGain && this.audioCtx && this.isEnabled) {
      this.masterGain.gain.setValueAtTime(clamped, this.audioCtx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url)!;
    }

    if (this.pendingFetches.has(url)) {
      return this.pendingFetches.get(url)!;
    }

    const fetchPromise = (async () => {
      const ctx = this.initContext();
      if (!ctx) return null;

      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`[SoundService] Failed to load sound asset: ${url} (status: ${res.status})`);
          return null;
        }
        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        this.bufferCache.set(url, audioBuffer);
        return audioBuffer;
      } catch (err) {
        console.warn(`[SoundService] Error decoding sound asset: ${url}`, err);
        return null;
      } finally {
        this.pendingFetches.delete(url);
      }
    })();

    this.pendingFetches.set(url, fetchPromise);
    return fetchPromise;
  }

  public async preloadAll(): Promise<void> {
    const urls = Object.values(SOUND_REGISTRY).map((meta) => meta.path);
    await Promise.allSettled(urls.map((url) => this.loadBuffer(url)));
  }

  public async play(effect: SoundEffect, customVolume?: number): Promise<void> {
    if (!this.isEnabled) return;

    const meta = SOUND_REGISTRY[effect];
    if (!meta) return;

    const now = performance.now();
    const lastPlayed = this.lastCategoryPlayTime.get(meta.category) || 0;

    // 80ms Throttle rule per category
    if (now - lastPlayed < this.throttleWindowMs) {
      return;
    }
    this.lastCategoryPlayTime.set(meta.category, now);

    const ctx = this.initContext();
    if (!ctx || !this.masterGain) {
      this.playHtmlAudioFallback(meta.path, customVolume);
      return;
    }

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Fallback or ignore if user interaction hasn't unlocked audio yet
      }
    }

    // Audio Choking: smooth-stop any currently playing sound in the same category
    const activeNode = this.activeCategoryNodes.get(meta.category);
    if (activeNode) {
      try {
        activeNode.stop();
        activeNode.disconnect();
      } catch {
        // Ignore if already stopped
      }
      this.activeCategoryNodes.delete(meta.category);
    }

    try {
      const buffer = await this.loadBuffer(meta.path);
      if (!buffer) {
        this.playHtmlAudioFallback(meta.path, customVolume);
        return;
      }

      const sourceNode = ctx.createBufferSource();
      sourceNode.buffer = buffer;

      if (customVolume !== undefined && customVolume !== 1) {
        const localGain = ctx.createGain();
        localGain.gain.setValueAtTime(Math.max(0, Math.min(1, customVolume)), ctx.currentTime);
        sourceNode.connect(localGain);
        localGain.connect(this.masterGain);
      } else {
        sourceNode.connect(this.masterGain);
      }

      this.activeCategoryNodes.set(meta.category, sourceNode);
      sourceNode.onended = () => {
        if (this.activeCategoryNodes.get(meta.category) === sourceNode) {
          this.activeCategoryNodes.delete(meta.category);
        }
      };

      sourceNode.start(0);
    } catch (err) {
      console.warn(`[SoundService] Failed to play buffer for ${effect}:`, err);
      this.playHtmlAudioFallback(meta.path, customVolume);
    }
  }

  private playHtmlAudioFallback(url: string, customVolume?: number) {
    try {
      const audio = new Audio(url);
      const effectiveVol = this.volume * (customVolume !== undefined ? customVolume : 1);
      audio.volume = Math.max(0, Math.min(1, effectiveVol));
      audio.play().catch(() => {});
    } catch {
      // Ignore background audio failures
    }
  }
}

export const soundService = new SoundService();
