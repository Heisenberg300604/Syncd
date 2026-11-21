import React from 'react';
import { motion } from 'motion/react';

interface AnimatedCheckmarkProps {
  size?: number;
  className?: string;
}

export const AnimatedCheckmark: React.FC<AnimatedCheckmarkProps> = ({
  size = 64,
  className = '',
}) => {
  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* 1. Ambient Glow Bloom - Soft & Slow */}
      <motion.div
        className="absolute inset-0 rounded-full bg-emerald-500/25 blur-xl pointer-events-none"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 0.6, 0.35], scale: [0.6, 1.3, 1] }}
        transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
      />

      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible drop-shadow-[0_0_18px_rgba(16,185,129,0.45)]"
      >
        {/* 2. Expanding Ripple Ring - Smooth & Majestic */}
        <motion.circle
          cx="32"
          cy="32"
          r="28"
          stroke="#10b981"
          strokeWidth="2"
          fill="none"
          initial={{ scale: 0.8, opacity: 0.8 }}
          animate={{ scale: 1.35, opacity: 0 }}
          transition={{ duration: 1.6, ease: 'easeOut', delay: 0.35 }}
          style={{ transformOrigin: 'center' }}
        />

        {/* 3. Base Badge Circle Background */}
        <motion.circle
          cx="32"
          cy="32"
          r="28"
          fill="rgba(16, 185, 129, 0.14)"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 160, damping: 22, mass: 1 }}
          style={{ transformOrigin: 'center' }}
        />

        {/* 4. Drawn Border Ring - Deliberate Pace (1.1s) */}
        <motion.circle
          cx="32"
          cy="32"
          r="28"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, rotate: -90 }}
          animate={{ pathLength: 1, rotate: -90 }}
          transition={{ duration: 1.1, ease: [0.25, 1, 0.5, 1] }}
          style={{ transformOrigin: 'center' }}
        />

        {/* 5. Animated Check Path - Smooth Stroke Draw (0.9s, delayed until circle forms) */}
        <motion.path
          d="M19 33 L28 42 L45 23"
          stroke="#34d399"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{
            duration: 0.9,
            delay: 0.65,
            ease: [0.25, 1, 0.5, 1],
          }}
        />
      </svg>
    </div>
  );
};

export default AnimatedCheckmark;
