import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

// --- Animated Play / Pause Icon (Ultra Snappy) ---
interface PlayPauseProps {
  isPlaying: boolean;
  className?: string;
}

export const AnimatedPlayPause: React.FC<PlayPauseProps> = ({ isPlaying, className = 'w-4 h-4' }) => {
  return (
    <div className={`relative flex items-center justify-center ${className} select-none pointer-events-none`}>
      {/* Pause Bars */}
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`w-full h-full text-zinc-950 absolute inset-0 transition-all duration-150 ease-out ${
          isPlaying
            ? 'opacity-100 scale-100 rotate-0'
            : 'opacity-0 scale-75 -rotate-45'
        }`}
      >
        <rect x="6" y="4" width="4" height="16" rx="1.5" />
        <rect x="14" y="4" width="4" height="16" rx="1.5" />
      </svg>

      {/* Play Triangle */}
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`w-full h-full text-zinc-950 absolute inset-0 transition-all duration-150 ease-out ${
          !isPlaying
            ? 'opacity-100 scale-100 rotate-0'
            : 'opacity-0 scale-75 rotate-45'
        }`}
      >
        <path d="M6 4.5a1.5 1.5 0 0 1 2.3-1.27l12 7.5a1.5 1.5 0 0 1 0 2.54l-12 7.5A1.5 1.5 0 0 1 6 19.5v-15Z" />
      </svg>
    </div>
  );
};

// --- Animated Skip (Forward / Back) ---
interface SkipProps {
  direction: 'next' | 'prev';
  className?: string;
}

export const AnimatedSkip: React.FC<SkipProps> = ({ direction, className = 'w-4 h-4' }) => {
  const isNext = direction === 'next';
  return (
    <motion.svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      whileHover={{
        x: isNext ? 2.5 : -2.5,
        transition: { type: 'spring', stiffness: 800, damping: 20 },
      }}
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 800, damping: 22 }}
    >
      {isNext ? (
        <>
          <path d="M5 4.5a1 1 0 0 1 1.54-.84l9 6a1 1 0 0 1 0 1.68l-9 6A1 1 0 0 1 5 16.5v-12Z" />
          <path d="M18 4a1 1 0 0 1 1 1v14a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Z" />
        </>
      ) : (
        <>
          <path d="M19 19.5a1 1 0 0 1-1.54.84l-9-6a1 1 0 0 1 0-1.68l9-6A1 1 0 0 1 19 7.5v12Z" />
          <path d="M6 20a1 1 0 0 1-1-1V5a1 1 0 1 1 2 0v14a1 1 0 0 1-1 1Z" />
        </>
      )}
    </motion.svg>
  );
};

// --- Animated Shuffle ---
interface ShuffleProps {
  isActive: boolean;
  className?: string;
}

export const AnimatedShuffle: React.FC<ShuffleProps> = ({ isActive = false, className = 'w-4 h-4' }) => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} ${isActive ? 'text-amber-400' : ''}`}
      whileHover={{ scale: 1.15, rotate: 8 }}
      whileTap={{ scale: 0.9, rotate: -8 }}
      transition={{ type: 'spring', stiffness: 750, damping: 20 }}
    >
      <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" />
      <path d="m18 2 4 4-4 4" />
      <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
      <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
      <path d="m18 14 4 4-4 4" />
    </motion.svg>
  );
};

// --- Animated Repeat ---
interface RepeatProps {
  mode: 'off' | 'all' | 'one';
  className?: string;
}

export const AnimatedRepeat: React.FC<RepeatProps> = ({ mode, className = 'w-4 h-4' }) => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      whileHover={{ rotate: 90 }}
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 700, damping: 22 }}
    >
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
      {mode === 'one' && (
        <text x="12" y="15" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold" textAnchor="middle">
          1
        </text>
      )}
    </motion.svg>
  );
};

// --- Animated 21st.dev Mute / Speaker Icon ---
interface VolumeMuteProps {
  isMuted: boolean;
  onToggle: () => void;
  className?: string;
}

export const AnimatedVolumeMute: React.FC<VolumeMuteProps> = ({
  isMuted,
  onToggle,
  className = 'w-8 h-8',
}) => {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-label={isMuted ? 'Unmute volume' : 'Mute volume'}
      title={isMuted ? 'Unmute' : 'Mute'}
      className={`relative inline-flex items-center justify-center rounded-xl p-2 transition-all cursor-pointer ${
        isMuted
          ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
          : 'bg-zinc-900/80 text-amber-400 border border-amber-500/30 hover:bg-amber-500/15 hover:border-amber-500/50'
      } ${className}`}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 700, damping: 22 }}
    >
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
      >
        {/* Speaker cone */}
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />

        <AnimatePresence>
          {!isMuted && (
            <>
              {/* Inner wave */}
              <motion.path
                d="M15.54 8.46a5 5 0 0 1 0 7.07"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.12 }}
              />
              {/* Outer wave */}
              <motion.path
                d="M19.07 4.93a10 10 0 0 1 0 14.14"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.12 }}
              />
            </>
          )}

          {isMuted && (
            <>
              {/* Cross X marks */}
              <motion.line
                x1="22"
                y1="9"
                x2="16"
                y2="15"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ pathLength: 0, opacity: 0 }}
                transition={{ duration: 0.12 }}
              />
              <motion.line
                x1="16"
                y1="9"
                x2="22"
                y2="15"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ pathLength: 0, opacity: 0 }}
                transition={{ duration: 0.12 }}
              />
            </>
          )}
        </AnimatePresence>
      </motion.svg>
    </motion.button>
  );
};
