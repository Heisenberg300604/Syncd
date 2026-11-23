import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CodecBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  format?: string | null;
  bitrateKbps?: number | null;
  showBitrate?: boolean;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'folder' | 'pill' | 'card';
}

interface CodecConfig {
  label: string;
  isLossless: boolean;
  qualityTag: string;
  badgeClasses: string;
  accentBarColor: string;
  glowColor: string;
  dotColor: string;
}

function getCodecConfig(format: string | null | undefined): CodecConfig {
  const norm = (format || 'UNKNOWN').trim().toLowerCase();

  switch (norm) {
    case 'flac':
      return {
        label: 'FLAC',
        isLossless: true,
        qualityTag: 'Lossless',
        badgeClasses:
          'bg-emerald-950/85 text-emerald-300 border-emerald-500/40 shadow-[0_2px_8px_rgba(16,185,129,0.18)] hover:border-emerald-400 hover:text-emerald-200 hover:shadow-[0_0_12px_rgba(52,211,153,0.35)]',
        accentBarColor: 'bg-emerald-400',
        glowColor: 'rgba(16, 185, 129, 0.4)',
        dotColor: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]',
      };

    case 'wav':
    case 'wave':
      return {
        label: 'WAV',
        isLossless: true,
        qualityTag: 'Studio Hi-Res',
        badgeClasses:
          'bg-amber-950/85 text-amber-300 border-amber-500/40 shadow-[0_2px_8px_rgba(245,158,11,0.18)] hover:border-amber-400 hover:text-amber-200 hover:shadow-[0_0_12px_rgba(251,191,36,0.35)]',
        accentBarColor: 'bg-amber-400',
        glowColor: 'rgba(245, 158, 11, 0.4)',
        dotColor: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]',
      };

    case 'aiff':
    case 'aif':
      return {
        label: 'AIFF',
        isLossless: true,
        qualityTag: 'Uncompressed',
        badgeClasses:
          'bg-amber-950/85 text-amber-300 border-amber-500/40 shadow-[0_2px_8px_rgba(245,158,11,0.18)] hover:border-amber-400 hover:text-amber-200 hover:shadow-[0_0_12px_rgba(251,191,36,0.35)]',
        accentBarColor: 'bg-amber-400',
        glowColor: 'rgba(245, 158, 11, 0.4)',
        dotColor: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]',
      };

    case 'alac':
      return {
        label: 'ALAC',
        isLossless: true,
        qualityTag: 'Apple Lossless',
        badgeClasses:
          'bg-cyan-950/85 text-cyan-300 border-cyan-500/40 shadow-[0_2px_8px_rgba(6,182,212,0.18)] hover:border-cyan-400 hover:text-cyan-200 hover:shadow-[0_0_12px_rgba(34,211,238,0.35)]',
        accentBarColor: 'bg-cyan-400',
        glowColor: 'rgba(6, 182, 212, 0.4)',
        dotColor: 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]',
      };

    case 'mp3':
      return {
        label: 'MP3',
        isLossless: false,
        qualityTag: 'Audio',
        badgeClasses:
          'bg-zinc-900/90 text-zinc-100 border-zinc-700/80 shadow-[0_2px_6px_rgba(0,0,0,0.4)] hover:border-amber-400/60 hover:text-white hover:shadow-[0_0_10px_rgba(245,158,11,0.2)]',
        accentBarColor: 'bg-amber-400',
        glowColor: 'rgba(245, 158, 11, 0.3)',
        dotColor: 'bg-zinc-400',
      };

    case 'aac':
      return {
        label: 'AAC',
        isLossless: false,
        qualityTag: 'Advanced Audio',
        badgeClasses:
          'bg-sky-950/85 text-sky-300 border-sky-500/40 shadow-[0_2px_8px_rgba(14,165,233,0.18)] hover:border-sky-400 hover:text-sky-200 hover:shadow-[0_0_12px_rgba(56,189,248,0.35)]',
        accentBarColor: 'bg-sky-400',
        glowColor: 'rgba(14, 165, 233, 0.4)',
        dotColor: 'bg-sky-400',
      };

    case 'm4a':
      return {
        label: 'M4A',
        isLossless: false,
        qualityTag: 'AAC/ALAC',
        badgeClasses:
          'bg-sky-950/85 text-sky-300 border-sky-500/40 shadow-[0_2px_8px_rgba(14,165,233,0.18)] hover:border-sky-400 hover:text-sky-200 hover:shadow-[0_0_12px_rgba(56,189,248,0.35)]',
        accentBarColor: 'bg-sky-400',
        glowColor: 'rgba(14, 165, 233, 0.4)',
        dotColor: 'bg-sky-400',
      };

    case 'opus':
      return {
        label: 'OPUS',
        isLossless: false,
        qualityTag: 'Hi-Fi Stream',
        badgeClasses:
          'bg-teal-950/85 text-teal-300 border-teal-500/40 shadow-[0_2px_8px_rgba(20,184,166,0.18)] hover:border-teal-400 hover:text-teal-200 hover:shadow-[0_0_12px_rgba(45,212,191,0.35)]',
        accentBarColor: 'bg-teal-400',
        glowColor: 'rgba(20, 184, 166, 0.4)',
        dotColor: 'bg-teal-400',
      };

    case 'ogg':
    case 'vorbis':
      return {
        label: 'OGG',
        isLossless: false,
        qualityTag: 'Vorbis',
        badgeClasses:
          'bg-teal-950/85 text-teal-300 border-teal-500/40 shadow-[0_2px_8px_rgba(20,184,166,0.18)] hover:border-teal-400 hover:text-teal-200 hover:shadow-[0_0_12px_rgba(45,212,191,0.35)]',
        accentBarColor: 'bg-teal-400',
        glowColor: 'rgba(20, 184, 166, 0.4)',
        dotColor: 'bg-teal-400',
      };

    default:
      return {
        label: (format || 'AUDIO').toUpperCase(),
        isLossless: false,
        qualityTag: 'Audio',
        badgeClasses:
          'bg-zinc-900/90 text-zinc-200 border-zinc-700/80 shadow-[0_2px_6px_rgba(0,0,0,0.4)] hover:border-zinc-500 hover:text-white',
        accentBarColor: 'bg-zinc-400',
        glowColor: 'rgba(161, 161, 170, 0.3)',
        dotColor: 'bg-zinc-400',
      };
  }
}

/**
 * Animated 3-Bar Mini Equalizer Icon
 */
const MiniEqualizer: React.FC<{
  colorClass: string;
  isHovered: boolean;
  size: 'xs' | 'sm' | 'md';
}> = ({ colorClass, isHovered, size }) => {
  const barWidth = size === 'xs' ? 'w-[1.5px]' : 'w-[2px]';
  const containerHeight = size === 'xs' ? 'h-2.5' : 'h-3';

  return (
    <span className={`inline-flex items-end gap-[1.5px] ${containerHeight} shrink-0`}>
      <motion.span
        className={`rounded-full ${barWidth} ${colorClass}`}
        animate={
          isHovered
            ? { height: ['3px', '9px', '4px', '7px', '3px'] }
            : { height: '4px' }
        }
        transition={{
          repeat: isHovered ? Infinity : 0,
          duration: 0.7,
          ease: 'easeInOut',
        }}
      />
      <motion.span
        className={`rounded-full ${barWidth} ${colorClass}`}
        animate={
          isHovered
            ? { height: ['7px', '3px', '10px', '4px', '7px'] }
            : { height: '8px' }
        }
        transition={{
          repeat: isHovered ? Infinity : 0,
          duration: 0.7,
          ease: 'easeInOut',
          delay: 0.15,
        }}
      />
      <motion.span
        className={`rounded-full ${barWidth} ${colorClass}`}
        animate={
          isHovered
            ? { height: ['4px', '8px', '3px', '9px', '4px'] }
            : { height: '5px' }
        }
        transition={{
          repeat: isHovered ? Infinity : 0,
          duration: 0.7,
          ease: 'easeInOut',
          delay: 0.3,
        }}
      />
    </span>
  );
};

export const CodecBadge: React.FC<CodecBadgeProps> = ({
  format,
  bitrateKbps,
  showBitrate = false,
  size = 'sm',
  variant = 'pill',
  className = '',
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);

  if (!format) return null;

  const config = getCodecConfig(format);
  const isCardOverlay = variant === 'card' || variant === 'folder';

  const sizeClasses = {
    xs: 'text-[9px] px-2 py-0.5 gap-1.5 min-h-[19px]',
    sm: 'text-[10px] px-2.5 py-0.5 gap-1.5 min-h-[22px]',
    md: 'text-xs px-3 py-1 gap-2 min-h-[26px]',
  }[size];

  // Title description for audio spec tooltip
  const tooltipText = `${config.label} • ${
    config.isLossless ? 'Hi-Res Lossless' : config.qualityTag
  }${bitrateKbps ? ` • ${bitrateKbps} kbps` : ''}`;

  return (
    <motion.span
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.06, y: -0.5 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 420, damping: 25 }}
      className={twMerge(
        clsx(
          'inline-flex items-center font-mono font-bold tracking-wider uppercase border backdrop-blur-md select-none rounded-md cursor-default transition-colors duration-200',
          sizeClasses,
          isCardOverlay
            ? 'bg-zinc-950/85 border-white/20 shadow-lg text-zinc-100 hover:border-amber-400/80 hover:bg-zinc-900/95'
            : config.badgeClasses,
          className
        )
      )}
      title={tooltipText}
      {...(props as any)}
    >
      {/* Equalizer animation */}
      <MiniEqualizer
        colorClass={config.accentBarColor}
        isHovered={isHovered}
        size={size}
      />

      {/* Codec Text */}
      <span className="font-extrabold tracking-wide leading-none select-none">
        {config.label}
      </span>

      {/* Lossless Indicator Dot */}
      {config.isLossless && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotColor} ${
            isHovered ? 'animate-ping' : ''
          }`}
          title="Hi-Res Lossless Audio"
        />
      )}

      {/* Bitrate or Micro-Reveal on Hover */}
      <AnimatePresence>
        {(showBitrate || (isHovered && bitrateKbps && bitrateKbps > 0)) && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex items-center gap-1 overflow-hidden whitespace-nowrap"
          >
            <span className="opacity-40 font-normal">|</span>
            <span className="font-semibold text-[8.5px] lowercase tracking-normal text-amber-300/90">
              {bitrateKbps}k
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.span>
  );
};

// Backwards-compatible export
export const AudioFolderCodecIcon = CodecBadge;
