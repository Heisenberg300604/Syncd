import React, { useEffect, useState, useMemo } from "react";
import { motion } from "motion/react";
import { AppLogo } from "../ui/AppLogo";
import { AlertCircle, RefreshCw } from "lucide-react";

export interface AppLoadingScreenProps {
  /** Optional manual progress override (0 to 100). If omitted, an automatic smooth boot curve is executed. */
  progress?: number;
  /** Callback fired once loading reaches 100% and exit delay completes. */
  onFinished?: () => void;
  /** Fatal error message if initialization failed. */
  error?: string | null;
  /** Callback when user clicks retry after an error. */
  onRetry?: () => void;
}

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
  progress: manualProgress,
  onFinished,
  error,
  onRetry,
}) => {
  const [autoProgress, setAutoProgress] = useState(0);

  // Controlled or automated progression
  const currentProgress = useMemo(() => {
    if (typeof manualProgress === "number") {
      return Math.min(100, Math.max(0, manualProgress));
    }
    return autoProgress;
  }, [manualProgress, autoProgress]);

  // Automated smooth progression curve (luxurious, calm 1.8s duration)
  useEffect(() => {
    if (typeof manualProgress === "number" || error) return;

    let frameId: number;
    let finishTimeout: number | undefined;
    const startTime = performance.now();
    const DURATION = 1800; // ms (smooth and slow)

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / DURATION);

      // Silky cosine ease-in-out curve
      const eased = 0.5 * (1 - Math.cos(Math.PI * t));
      const nextProgress = eased * 100;

      setAutoProgress(nextProgress);

      if (t < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        // Complete! Gentle hold at 100% before cinematic dissolve
        finishTimeout = window.setTimeout(() => {
          onFinished?.();
        }, 180);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frameId);
      if (finishTimeout) clearTimeout(finishTimeout);
    };
  }, [manualProgress, onFinished, error]);

  return (
    <motion.div
      key="app-loading-screen-overlay"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
      role="status"
      aria-label="Loading SyncDesk"
      className="fixed inset-0 w-screen h-screen z-50 flex flex-col items-center justify-center select-none bg-zinc-950/70 backdrop-blur-md"
    >
      {/* Ambient Center Accent Spotlight Glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none opacity-25 blur-3xl"
        style={{
          background: "radial-gradient(circle, var(--syncd-accent-primary, #f59e0b) 0%, transparent 70%)",
        }}
      />

      {/* Main Center Stage (Icon + Sleek Loading Bar) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.02 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center max-w-sm w-full px-6"
      >
        {/* Actual SyncD App Icon with Soft Accent Halo */}
        <div className="relative mb-8 flex items-center justify-center">
          <div
            className="absolute -inset-4 rounded-3xl opacity-40 blur-2xl pointer-events-none"
            style={{
              background: "var(--syncd-accent-primary, #f59e0b)",
            }}
          />
          <AppLogo size={68} className="relative z-10 drop-shadow-2xl" />
        </div>

        {/* Error State Display (only shown on failure) */}
        {error ? (
          <div className="w-full bg-zinc-900/95 border border-red-500/30 rounded-xl p-4 flex flex-col items-center text-center gap-2.5 backdrop-blur-md shadow-2xl">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <span className="text-xs font-semibold text-zinc-200">Engine Initialization Error</span>
            <p className="text-[11px] text-zinc-400 font-mono leading-relaxed line-clamp-3">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            )}
          </div>
        ) : (
          /* Sleek Animated Loading Bar Container (No text, pure minimal hardware aesthetic) */
          <div
            role="progressbar"
            aria-valuenow={Math.round(currentProgress)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-64 max-w-full h-1.5 bg-zinc-900/90 rounded-full border border-white/10 p-[1px] relative overflow-hidden shadow-inner backdrop-blur-sm"
          >
            {/* Active Animated Fill Bar */}
            <div
              className="h-full rounded-full relative overflow-hidden will-change-[width]"
              style={{
                width: `${currentProgress}%`,
                background:
                  "linear-gradient(90deg, var(--syncd-accent-600, #d97706), var(--syncd-accent-primary, #f59e0b), var(--syncd-accent-300, #fcd34d))",
                boxShadow: "0 0 12px var(--syncd-accent-primary, rgba(245, 158, 11, 0.65))",
              }}
            >
              {/* Luminous Shimmer Traveling Beam */}
              <div
                className="absolute inset-0 w-full h-full opacity-70"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent)",
                  animation: "syncd-bar-shimmer 2.2s infinite linear",
                }}
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* Shimmer Keyframe */}
      <style>{`
        @keyframes syncd-bar-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </motion.div>
  );
};
