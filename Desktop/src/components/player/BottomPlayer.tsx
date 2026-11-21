import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Volume2,
  VolumeX,
  Disc,
  ListMusic,
  Loader2,
  Music,
  X,
} from 'lucide-react';
import { usePlayerStore } from '../../stores/usePlayerStore';
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
  } = usePlayerStore();

  const scrubberRef = useRef<HTMLDivElement>(null);
  const [showVolumeDial, setShowVolumeDial] = useState(false);
  const dialRef = useRef<HTMLDivElement>(null);

  const isVisible = Boolean(currentTrack && hasPlaybackStarted);

  const isPlaying = status === 'playing';
  const isLoading = status === 'loading';
  const duration = durationSeconds > 0 ? durationSeconds : currentTrack?.durationSeconds || 0;
  const progressPercent = duration > 0 ? Math.min(100, (positionSeconds / duration) * 100) : 0;

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubberRef.current || duration <= 0) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(ratio * duration);
  };

  // Close dial on outside click
  useEffect(() => {
    if (!showVolumeDial) return;
    const handler = (e: MouseEvent) => {
      if (dialRef.current && !dialRef.current.contains(e.target as Node)) {
        setShowVolumeDial(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showVolumeDial]);

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
      <div className="flex-1 max-w-xl flex flex-col items-center gap-1 px-4 min-w-0">
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
            className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
            ) : (
              <AnimatedPlayPause isPlaying={isPlaying} className="w-4 h-4" />
            )}
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

        {/* Scrubber */}
        <div className="w-full flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-500 tabular-nums w-10 text-right">
            {formatTime(positionSeconds)}
          </span>
          <div
            ref={scrubberRef}
            onClick={handleScrubberClick}
            className="flex-1 h-3 flex items-center group cursor-pointer"
          >
            <div className="w-full h-1 bg-zinc-800/80 rounded-full overflow-hidden relative group-hover:h-1.5 transition-all">
              <div
                className="h-full bg-amber-500 group-hover:bg-amber-400 rounded-full transition-all duration-75"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 tabular-nums w-10">
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

          {showVolumeDial && (
            <div
              className="absolute bottom-[68px] right-0 z-50 flex flex-col items-center gap-2.5 p-3.5 bg-zinc-950/90 backdrop-blur-2xl border border-zinc-700/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] select-none"
              style={{ width: 160 }}
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
                className="mt-1"
              />
            </div>
          )}
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
