import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface ElasticSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  formatTooltip?: (value: number) => string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export const ElasticSlider: React.FC<ElasticSliderProps> = ({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  formatTooltip = (v) => `${Math.round(v * 100)}%`,
  className = '',
  ariaLabel = 'Volume Slider',
  disabled = false,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState<number | null>(null);

  const range = max - min;
  const effectiveValue = isDragging && dragValue !== null ? dragValue : value;
  const currentPercent = range > 0 ? Math.min(100, Math.max(0, ((effectiveValue - min) / range) * 100)) : 0;

  const calculateRatio = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const rawRatio = (clientX - rect.left) / rect.width;
      // Rubber-band resistance if dragged past boundaries
      if (rawRatio < 0) return rawRatio * 0.2;
      if (rawRatio > 1) return 1 + (rawRatio - 1) * 0.2;
      return rawRatio;
    },
    []
  );

  const snapToStep = useCallback(
    (val: number) => {
      const clamped = Math.max(min, Math.min(max, val));
      if (!step || step <= 0) return clamped;
      const stepsCount = Math.round((clamped - min) / step);
      const stepped = min + stepsCount * step;
      // Avoid JS floating point inaccuracies (e.g. 0.30000000000000004)
      const decimals = (step.toString().split('.')[1] || '').length;
      return parseFloat(stepped.toFixed(decimals));
    },
    [min, max, step]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // quiet fallback
    }
    setIsDragging(true);
    const ratio = calculateRatio(e.clientX);
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const nextVal = snapToStep(min + clampedRatio * range);
    setDragValue(nextVal);
    onChange(nextVal);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled) return;
    const ratio = calculateRatio(e.clientX);
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const nextVal = snapToStep(min + clampedRatio * range);
    setDragValue(nextVal);
    onChange(nextVal);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // quiet fallback
    }
    if (isDragging) {
      if (dragValue !== null) {
        onChange(dragValue);
      }
      setIsDragging(false);
      setDragValue(null);
    }
  };

  const handlePointerCancel = () => {
    setIsDragging(false);
    setDragValue(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const increment = step || 0.05;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(snapToStep(value + increment));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(snapToStep(value - increment));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(max);
    }
  };

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={effectiveValue}
      aria-label={ariaLabel}
      className={`w-full h-5 flex items-center cursor-pointer relative touch-none select-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500/50 rounded-full ${
        disabled ? 'opacity-40 pointer-events-none' : ''
      } ${className}`}
    >
      {/* Floating Tooltip during Hover or Drag */}
      <AnimatePresence>
        {(isDragging || isHovered) && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.85 }}
            animate={{ opacity: 1, y: -20, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 600, damping: 28 }}
            className="absolute pointer-events-none px-2 py-0.5 rounded-md bg-zinc-900/95 border border-zinc-700/80 text-[10px] font-mono text-zinc-100 shadow-xl -translate-x-1/2 z-50 backdrop-blur-md"
            style={{ left: `${currentPercent}%` }}
          >
            {formatTooltip(effectiveValue)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Elastic Track Groove */}
      <motion.div
        animate={{
          height: isDragging ? 8 : isHovered ? 7 : 5,
          scaleY: isDragging ? 1.06 : 1,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 24 }}
        className="w-full bg-zinc-800/90 rounded-full relative overflow-visible border border-white/[0.06] shadow-inner"
      >
        {/* Elastic Progress Fill Bar */}
        <motion.div
          className="h-full bg-amber-500 rounded-full relative"
          style={{
            backgroundColor: 'var(--syncd-accent-primary, #f59e0b)',
          }}
          animate={{
            width: `${currentPercent}%`,
            boxShadow:
              isHovered || isDragging
                ? '0 0 14px var(--syncd-accent-primary, rgba(245, 158, 11, 0.6))'
                : '0 0 6px var(--syncd-accent-muted, rgba(245, 158, 11, 0.25))',
          }}
          transition={isDragging ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 28 }}
        >
          {/* Refined Theme-Colored Elastic Scrub Knob */}
          <motion.div
            animate={{
              scale: isDragging ? 1.25 : isHovered ? 1 : 0.8,
              scaleX: isDragging ? 1.3 : 1,
              opacity: isHovered || isDragging ? 1 : 0.9,
            }}
            transition={{ type: 'spring', stiffness: 650, damping: 26 }}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-amber-400 border-2 border-zinc-950 shadow-[0_0_8px_var(--syncd-accent-primary,rgba(245,158,11,0.6)),0_2px_4px_rgba(0,0,0,0.6)] pointer-events-none z-10"
            style={{
              backgroundColor: 'var(--syncd-accent-primary, #f59e0b)',
            }}
          />
        </motion.div>
      </motion.div>
    </div>
  );
};
