import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Volume2,
  VolumeX,
  Disc,
  ListMusic,
  Music,
  X,
  ChevronDown,
  Check,
} from 'lucide-react';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useToastStore } from '../../stores/useToastStore';
import { CodecBadge } from '../ui/CodecBadge';
import CometDial from '../ui/CometDial';
import {
  AnimatedPlayPause,
  AnimatedSkip,
  AnimatedShuffle,
  AnimatedRepeat,
  AnimatedVolumeMute,
} from '../ui/animated-icons';

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export interface BottomPlayerProps {
  isDrawerOpen?: boolean;
  onToggleDrawer?: () => void;
}

export function BottomPlayer({ isDrawerOpen = false, onToggleDrawer }: BottomPlayerProps) {
  const {
    currentTrack,
    status,
    positionSeconds,
    durationSeconds,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    hasPlaybackStarted,
    dismissPlayer,
    togglePlay,
    playNext,
    playPrevious,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    devices,
    loadDevices,
  } = usePlayerStore();

  const { selectedDevice, setSelectedDevice } = useSettingsStore();
  const { addToast } = useToastStore();

  const scrubberRef = useRef<HTMLDivElement>(null);
  const [showVolumeDial, setShowVolumeDial] = useState(false);
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false);
  const dialRef = useRef<HTMLDivElement>(null);
  const deviceDropdownRef = useRef<HTMLDivElement>(null);

  const [isHoveredScrubber, setIsHoveredScrubber] = useState(false);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [dragSeekPercent, setDragSeekPercent] = useState<number | null>(null);
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const isVisible = Boolean(currentTrack && hasPlaybackStarted);

  const isPlaying = status === 'playing';
  const duration = durationSeconds > 0 ? durationSeconds : currentTrack?.durationSeconds || 0;
  const progressPercent = duration > 0 ? Math.min(100, (positionSeconds / duration) * 100) : 0;

  const calculateRatio = useCallback((clientX: number) => {
    if (!scrubberRef.current || duration <= 0) return 0;
    const rect = scrubberRef.current.getBoundingClientRect();
    const rawRatio = (clientX - rect.left) / rect.width;
    if (rawRatio < 0) return rawRatio * 0.25;
    if (rawRatio > 1) return 1 + (rawRatio - 1) * 0.25;
    return rawRatio;
  }, [duration]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // quiet fallback
    }
    setIsDraggingSeek(true);
    const ratio = calculateRatio(e.clientX);
    const clamped = Math.max(0, Math.min(1, ratio));
    setDragSeekPercent(clamped * 100);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const ratio = calculateRatio(e.clientX);
    if (isDraggingSeek) {
      const clamped = Math.max(0, Math.min(1, ratio));
      setDragSeekPercent(clamped * 100);
    } else {
      const clamped = Math.max(0, Math.min(1, ratio));
      setHoverPercent(clamped * 100);
      setHoverTime(clamped * duration);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSeek || duration <= 0) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // quiet fallback
    }
    const ratio = calculateRatio(e.clientX);
    const clamped = Math.max(0, Math.min(1, ratio));
    seek(clamped * duration);
    setIsDraggingSeek(false);
    setDragSeekPercent(null);
  };

  const handlePointerCancel = () => {
    setIsDraggingSeek(false);
    setDragSeekPercent(null);
  };

  const effectivePercent = isDraggingSeek && dragSeekPercent !== null ? dragSeekPercent : progressPercent;
  const effectiveTime = isDraggingSeek && dragSeekPercent !== null ? (dragSeekPercent / 100) * duration : positionSeconds;

  // Close dial and device dropdown on outside click
  useEffect(() => {
    if (!showVolumeDial) return;
    const handler = (e: MouseEvent) => {
      if (dialRef.current && !dialRef.current.contains(e.target as Node)) {
        setShowVolumeDial(false);
        setIsDeviceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showVolumeDial]);

  // Close device dropdown on click outside of device dropdown
  useEffect(() => {
    if (!isDeviceMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (deviceDropdownRef.current && !deviceDropdownRef.current.contains(e.target as Node)) {
        setIsDeviceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isDeviceMenuOpen]);

  // Refresh audio devices list whenever volume menu opens
  useEffect(() => {
    if (showVolumeDial) {
      loadDevices();
    } else {
      setIsDeviceMenuOpen(false);
    }
  }, [showVolumeDial, loadDevices]);

  // Keyboard accessibility: Escape key closes menus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDeviceMenuOpen) {
          setIsDeviceMenuOpen(false);
        } else if (showVolumeDial) {
          setShowVolumeDial(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDeviceMenuOpen, showVolumeDial]);

  // Resolved device list & currently active device
  const availableDevices =
    devices && devices.length > 0
      ? devices
      : [{ id: 'default', name: 'Default Windows Audio Device', isDefault: true }];

  const currentDevice =
    availableDevices.find((d) => d.id === selectedDevice) ||
    availableDevices.find((d) => d.isDefault) ||
    availableDevices[0];

  const currentDeviceName = currentDevice?.name || 'Default Audio Device';

  const handleSelectDevice = async (deviceId: string, deviceName: string) => {
    await setSelectedDevice(deviceId);
    setIsDeviceMenuOpen(false);
    addToast({
      type: 'success',
      title: 'Audio Device Configured',
      message: `Output routed to ${deviceName}.`,
    });
  };

  const handleDialChange = useCallback((v: number) => {
    setVolume(v);
  }, [setVolume]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.footer
          key="floating-bottom-player"
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }}
          data-player-bar="true"
          className="fixed bottom-4 left-0 right-0 mx-auto w-[calc(100%-2.5rem)] max-w-5xl h-[72px] glass-player px-5 flex items-center justify-between select-none z-40"
        >
      {/* Track Info (Left) */}
      <div
        className="flex items-center gap-3 w-64 sm:w-72 min-w-0 shrink"
        data-track-id={currentTrack?.id}
      >
        <div className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
          {currentTrack?.artworkUrl ? (
            <img src={currentTrack.artworkUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
          ) : isPlaying ? (
            <Disc className="w-5 h-5 text-amber-500 animate-spin" />
          ) : (
            <Music className="w-4 h-4 text-zinc-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-xs font-semibold text-zinc-100 truncate">
              {currentTrack?.title || 'No track loaded'}
            </p>
            {currentTrack?.format && (
              <CodecBadge
                format={currentTrack.format}
                bitrateKbps={currentTrack.bitrateKbps}
                size="xs"
                className="shrink-0"
              />
            )}
          </div>
          <p className="text-[11px] text-zinc-500 truncate mt-0.5">
            {currentTrack?.artist || 'Select a track to begin'}
          </p>
        </div>
      </div>

      {/* Playback Controls + Scrubber (Center) */}
      <div className="flex-1 max-w-xl flex flex-col items-center justify-center gap-0.5 px-4 min-w-0 pt-2 pb-0.5">
        <div className="flex items-center gap-3">
          {/* Shuffle Toggle */}
          <button
            type="button"
            onClick={toggleShuffle}
            title={isShuffle ? 'Shuffle: ON' : 'Shuffle: OFF'}
            className={`p-1.5 rounded-full transition-all cursor-pointer ${
              isShuffle ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            <AnimatedShuffle isActive={isShuffle} className="w-3.5 h-3.5" />
          </button>

          {/* Previous Track */}
          <button
            type="button"
            onClick={playPrevious}
            className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Previous track"
            disabled={!currentTrack}
          >
            <AnimatedSkip direction="prev" className="w-4 h-4" />
          </button>

          {/* Play / Pause Primary Button */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={!currentTrack}
            className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center transition-transform active:scale-90 shadow-lg shadow-amber-500/25 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <AnimatedPlayPause isPlaying={isPlaying} className="w-4 h-4" />
          </button>

          {/* Next Track */}
          <button
            type="button"
            onClick={playNext}
            className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Next track"
            disabled={!currentTrack}
          >
            <AnimatedSkip direction="next" className="w-4 h-4" />
          </button>

          {/* Repeat Toggle */}
          <button
            type="button"
            onClick={toggleRepeat}
            title={repeatMode === 'off' ? 'Repeat: OFF' : repeatMode === 'one' ? 'Repeat: ONE' : 'Repeat: ALL'}
            className={`p-1.5 rounded-full transition-all cursor-pointer ${
              repeatMode !== 'off' ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            <AnimatedRepeat mode={repeatMode} className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Elastic Scrubber */}
        <div className="w-full flex items-center gap-2.5">
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums w-10 text-right select-none font-medium">
            {formatTime(effectiveTime)}
          </span>

          <div
            ref={scrubberRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onMouseEnter={() => setIsHoveredScrubber(true)}
            onMouseLeave={() => {
              setIsHoveredScrubber(false);
              setHoverPercent(null);
              setHoverTime(null);
            }}
            className="flex-1 h-4 flex items-center cursor-pointer relative touch-none select-none"
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={effectiveTime}
            aria-label="Track Progress"
          >
            {/* Tooltip on hover/drag */}
            <AnimatePresence>
              {(isDraggingSeek || (isHoveredScrubber && hoverPercent !== null)) && duration > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.85 }}
                  animate={{ opacity: 1, y: -20, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 28 }}
                  className="absolute pointer-events-none px-2 py-0.5 rounded-md bg-zinc-900/95 border border-zinc-700/80 text-[10px] font-mono text-zinc-100 shadow-xl -translate-x-1/2 z-50 backdrop-blur-md"
                  style={{ left: `${isDraggingSeek && dragSeekPercent !== null ? dragSeekPercent : (hoverPercent ?? 0)}%` }}
                >
                  {formatTime(isDraggingSeek && dragSeekPercent !== null ? (dragSeekPercent / 100) * duration : (hoverTime ?? 0))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Elastic Track Groove */}
            <motion.div
              animate={{
                height: isDraggingSeek ? 9 : isHoveredScrubber ? 8 : 6,
                scaleY: isDraggingSeek ? 1.08 : 1,
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 24 }}
              className="w-full bg-zinc-800/90 rounded-full relative overflow-visible border border-white/[0.06] shadow-inner"
            >
              {/* Elastic Progress Fill Bar */}
              <motion.div
                className="h-full bg-amber-500 rounded-full relative"
                animate={{
                  width: `${effectivePercent}%`,
                  boxShadow: isHoveredScrubber || isDraggingSeek
                    ? '0 0 14px var(--syncd-accent-primary)'
                    : '0 0 6px var(--syncd-accent-muted)',
                }}
                transition={isDraggingSeek ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 28 }}
              >
                {/* Refined Theme-Colored Elastic Scrub Knob */}
                <motion.div
                  animate={{
                    scale: isDraggingSeek ? 1.2 : isHoveredScrubber ? 1 : 0,
                    scaleX: isDraggingSeek ? 1.25 : 1,
                    opacity: isHoveredScrubber || isDraggingSeek ? 1 : 0,
                  }}
                  transition={{ type: 'spring', stiffness: 650, damping: 26 }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-amber-400 border-2 border-zinc-950 shadow-[0_0_8px_var(--syncd-accent-primary),0_2px_4px_rgba(0,0,0,0.6)] pointer-events-none z-10"
                />
              </motion.div>
            </motion.div>
          </div>

          <span className="text-[10px] font-mono text-zinc-500 tabular-nums w-10 select-none">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Volume + Status (Right) */}
      <div className="flex items-center justify-end gap-2 w-64 sm:w-72 shrink">
        {/* Queue toggle */}
        <button
          type="button"
          onClick={onToggleDrawer}
          className={[
            'p-1.5 rounded-full border transition-all cursor-pointer',
            isDrawerOpen
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'text-zinc-500 hover:text-zinc-200 border-transparent hover:bg-zinc-800/60',
          ].join(' ')}
          aria-label="Toggle Queue"
        >
          <ListMusic className="w-4 h-4" />
        </button>

        {/* CometDial volume — popup on click */}
        <div className="relative" ref={dialRef}>
          <button
            type="button"
            onClick={() => setShowVolumeDial((v) => !v)}
            onContextMenu={(e) => {
              e.preventDefault();
              toggleMute();
            }}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer rounded-full hover:bg-zinc-800/60 active:scale-95"
            aria-label={isMuted ? 'Unmute' : 'Volume'}
            title="Left-click: Volume dial • Right-click: Mute/Unmute"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          <AnimatePresence>
            {showVolumeDial && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                className="absolute bottom-[68px] right-0 z-50 flex flex-col items-center gap-2 p-3 bg-zinc-950/95 backdrop-blur-2xl border border-zinc-750/70 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] select-none w-52"
              >
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">Volume</p>
                <CometDial
                  value={isMuted ? 0 : volume}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  label="Volume"
                  accent="#f59e0b"
                  ink="#f4f4f5"
                  size={130}
                  sweep={270}
                  thickness={5}
                  onChange={handleDialChange}
                />
                <AnimatedVolumeMute
                  isMuted={isMuted}
                  onToggle={toggleMute}
                  className="mt-0.5"
                />

                {/* Subtle divider */}
                <div className="w-full h-px bg-zinc-800/80 my-0.5" />

                {/* Audio Device Pill Dropdown */}
                <div className="relative w-full" ref={deviceDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsDeviceMenuOpen((v) => !v)}
                    className={`w-full h-8 px-2.5 rounded-full bg-zinc-900/90 hover:bg-zinc-850 border transition-all cursor-pointer group flex items-center justify-between gap-1.5 active:scale-[0.98] ${
                      isDeviceMenuOpen
                        ? 'border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                        : 'border-zinc-750/80 hover:border-zinc-600'
                    }`}
                    title={`Audio Output: ${currentDeviceName}`}
                    aria-label="Select Audio Output Device"
                    aria-expanded={isDeviceMenuOpen}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0 group-hover:scale-105 transition-transform" />
                      <span className="text-[11px] font-medium text-zinc-300 group-hover:text-zinc-100 truncate text-left">
                        {currentDeviceName}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-transform duration-200 shrink-0 ${
                        isDeviceMenuOpen ? 'rotate-180 text-amber-400' : ''
                      }`}
                    />
                  </button>

                  {/* Floating Device Dropdown Menu */}
                  <AnimatePresence>
                    {isDeviceMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                        className="absolute bottom-full mb-2 right-0 w-60 z-50 bg-zinc-950/95 backdrop-blur-2xl border border-zinc-700/80 rounded-2xl p-2 shadow-[0_20px_45px_rgba(0,0,0,0.9)] flex flex-col gap-1 select-none"
                      >
                        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-zinc-800/80 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                          <span className="flex items-center gap-1.5">
                            <Volume2 className="w-3 h-3 text-amber-400" />
                            Audio Output
                          </span>
                          <span className="text-[9px] font-mono text-zinc-500">
                            {availableDevices.length} {availableDevices.length === 1 ? 'device' : 'devices'}
                          </span>
                        </div>

                        <div className="max-h-48 overflow-y-auto py-1 flex flex-col gap-0.5 custom-scrollbar">
                          {availableDevices.map((device) => {
                            const isCurrent =
                              selectedDevice === device.id ||
                              (selectedDevice === 'default' && device.isDefault) ||
                              (availableDevices.length === 1 && device.id === 'default');

                            return (
                              <button
                                key={device.id}
                                type="button"
                                onClick={() => handleSelectDevice(device.id, device.name)}
                                className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                  isCurrent
                                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium shadow-xs'
                                    : 'text-zinc-300 hover:bg-zinc-850 hover:text-zinc-100 border border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                      isCurrent
                                        ? 'bg-amber-500/20 text-amber-400'
                                        : 'bg-zinc-900 text-zinc-400'
                                    }`}
                                  >
                                    <Volume2 className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[11.5px] truncate leading-tight font-medium">
                                      {device.name}
                                    </p>
                                    {device.isDefault && (
                                      <span className="text-[9px] text-zinc-500 leading-tight block">
                                        System Default
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {isCurrent && (
                                  <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dismiss/Minimize Player */}
        <button
          type="button"
          onClick={dismissPlayer}
          className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors cursor-pointer rounded-full ml-0.5"
          title="Minimize player"
          aria-label="Minimize player"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.footer>
  )}
</AnimatePresence>
  );
}
