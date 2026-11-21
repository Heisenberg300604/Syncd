import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CodecBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  format?: string | null;
  bitrateKbps?: number | null;
  showBitrate?: boolean;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'folder' | 'pill';
}

interface CodecConfig {
  label: string;
  isLossless: boolean;
  badgeClasses: string;
  dotClasses?: string;
  pillClasses: string;
  textClasses: string;
}

function getCodecConfig(format: string | null | undefined): CodecConfig {
  const norm = (format || 'UNKNOWN').trim().toLowerCase();

  switch (norm) {
    case 'flac':
      return {
        label: 'FLAC',
        isLossless: true,
        badgeClasses:
          'bg-emerald-950/50 text-emerald-300 border-emerald-500/35 shadow-[0_0_10px_rgba(16,185,129,0.12)]',
        dotClasses: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse',
        pillClasses: 'fill-emerald-950/90 stroke-emerald-500/80',
        textClasses: 'fill-emerald-300',
      };

    case 'wav':
    case 'wave':
      return {
        label: 'WAV',
        isLossless: true,
        badgeClasses:
          'bg-amber-950/50 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
        dotClasses: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)] animate-pulse',
        pillClasses: 'fill-amber-950/90 stroke-amber-500/80',
        textClasses: 'fill-amber-300',
      };

    case 'aiff':
    case 'aif':
      return {
        label: 'AIFF',
        isLossless: true,
        badgeClasses:
          'bg-amber-950/50 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
        dotClasses: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)] animate-pulse',
        pillClasses: 'fill-amber-950/90 stroke-amber-500/80',
        textClasses: 'fill-amber-300',
      };

    case 'alac':
      return {
        label: 'ALAC',
        isLossless: true,
        badgeClasses:
          'bg-cyan-950/50 text-cyan-300 border-cyan-500/35 shadow-[0_0_10px_rgba(6,182,212,0.12)]',
        dotClasses: 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)] animate-pulse',
        pillClasses: 'fill-cyan-950/90 stroke-cyan-500/80',
        textClasses: 'fill-cyan-300',
      };

    case 'mp3':
      return {
        label: 'MP3',
        isLossless: false,
        badgeClasses:
          'bg-zinc-900/90 text-zinc-300 border-zinc-750/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
        pillClasses: 'fill-zinc-900/95 stroke-zinc-650',
        textClasses: 'fill-zinc-200',
      };

    case 'aac':
      return {
        label: 'AAC',
        isLossless: false,
        badgeClasses:
          'bg-sky-950/40 text-sky-300 border-sky-500/30 shadow-[0_0_8px_rgba(14,165,233,0.1)]',
        pillClasses: 'fill-sky-950/90 stroke-sky-500/70',
        textClasses: 'fill-sky-300',
      };

    case 'm4a':
      return {
        label: 'M4A',
        isLossless: false,
        badgeClasses:
          'bg-sky-950/40 text-sky-300 border-sky-500/30 shadow-[0_0_8px_rgba(14,165,233,0.1)]',
        pillClasses: 'fill-sky-950/90 stroke-sky-500/70',
        textClasses: 'fill-sky-300',
      };

    case 'opus':
      return {
        label: 'OPUS',
        isLossless: false,
        badgeClasses:
          'bg-teal-950/40 text-teal-300 border-teal-500/30 shadow-[0_0_8px_rgba(20,184,166,0.1)]',
        pillClasses: 'fill-teal-950/90 stroke-teal-500/70',
        textClasses: 'fill-teal-300',
      };

    case 'ogg':
    case 'vorbis':
      return {
        label: 'OGG',
        isLossless: false,
        badgeClasses:
          'bg-teal-950/40 text-teal-300 border-teal-500/30 shadow-[0_0_8px_rgba(20,184,166,0.1)]',
        pillClasses: 'fill-teal-950/90 stroke-teal-500/70',
        textClasses: 'fill-teal-300',
      };

    default:
      return {
        label: (format || 'AUDIO').toUpperCase(),
        isLossless: false,
        badgeClasses: 'bg-zinc-900 text-zinc-400 border-zinc-800',
        pillClasses: 'fill-zinc-900 stroke-zinc-700',
        textClasses: 'fill-zinc-300',
      };
  }
}

/**
 * Image 2-inspired Folder & Audio Document silhouette badge
 */
export const AudioFolderCodecIcon: React.FC<{
  format?: string | null;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}> = ({ format, size = 'sm', className }) => {
  const config = getCodecConfig(format);

  const dim = {
    xs: { w: 30, h: 30 },
    sm: { w: 36, h: 36 },
    md: { w: 44, h: 44 },
  }[size];

  return (
    <div
      className={twMerge(
        'relative inline-flex items-center justify-center select-none group/codec filter drop-shadow-md',
        className
      )}
      title={`${config.label} Audio${config.isLossless ? ' • Hi-Res Lossless' : ''}`}
    >
      <svg
        width={dim.w}
        height={dim.h}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        {/* Document Sheet Peeking Out */}
        <rect
          x="10"
          y="3"
          width="16"
          height="22"
          rx="2.5"
          className="fill-zinc-900 stroke-zinc-650"
          strokeWidth="1.4"
        />
        {/* Document Audio Note Lines */}
        <line x1="14" y1="8" x2="22" y2="8" className="stroke-zinc-400" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="14" y1="12" x2="20" y2="12" className="stroke-zinc-500" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 1.5" />
        <line x1="14" y1="16" x2="19" y2="16" className="stroke-zinc-600" strokeWidth="1.2" strokeLinecap="round" />

        {/* Folder Back Tab */}
        <path
          d="M3 13V10a2 2 0 0 1 2-2h7l3 3h16a2 2 0 0 1 2 2v2"
          className="stroke-zinc-700 fill-zinc-900/90"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />

        {/* Folder Front Pocket */}
        <rect
          x="2"
          y="13"
          width="32"
          height="20"
          rx="3.5"
          className="fill-zinc-950/95 stroke-zinc-700/90"
          strokeWidth="1.4"
        />

        {/* Embossed Codec Pill on Front (Image 2 style) */}
        <rect
          x="4"
          y="17"
          width="28"
          height="12"
          rx="6"
          className={config.pillClasses}
          strokeWidth="1.2"
        />
        <text
          x="18"
          y="25.5"
          textAnchor="middle"
          className={`font-mono font-black text-[8px] tracking-wider uppercase select-none ${config.textClasses}`}
        >
          {config.label}
        </text>
      </svg>
    </div>
  );
};

export const CodecBadge: React.FC<CodecBadgeProps> = ({
  format,
  bitrateKbps,
  showBitrate = false,
  size = 'sm',
  variant = 'pill',
  className,
  ...props
}) => {
  if (!format) return null;

  if (variant === 'folder') {
    return <AudioFolderCodecIcon format={format} size={size} className={className} />;
  }

  const config = getCodecConfig(format);

  const sizeClasses = {
    xs: 'text-[8px] px-1.5 py-0.5 rounded gap-1',
    sm: 'text-[9px] px-2 py-0.5 rounded-md gap-1.5',
    md: 'text-[10px] px-2.5 py-1 rounded-lg gap-2',
  }[size];

  const dotSize = {
    xs: 'w-1 h-1',
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
  }[size];

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center font-mono font-bold tracking-wider uppercase border backdrop-blur-xs select-none transition-colors duration-150',
          sizeClasses,
          config.badgeClasses,
          className
        )
      )}
      title={`${config.label}${config.isLossless ? ' • Hi-Res Lossless Audio' : ''}${
        bitrateKbps ? ` • ${bitrateKbps} kbps` : ''
      }`}
      {...props}
    >
      {/* Hi-Fi / Lossless Status Indicator Dot */}
      {config.isLossless && config.dotClasses && (
        <span className={clsx('rounded-full shrink-0', dotSize, config.dotClasses)} />
      )}

      <span>{config.label}</span>

      {/* Bitrate Badge suffix */}
      {showBitrate && bitrateKbps && bitrateKbps > 0 && (
        <>
          <span className="opacity-40 font-normal">|</span>
          <span className="opacity-80 font-medium text-[8px] lowercase tracking-normal">
            {bitrateKbps}k
          </span>
        </>
      )}
    </span>
  );
};
