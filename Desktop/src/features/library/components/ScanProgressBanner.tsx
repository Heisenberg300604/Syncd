import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useLibraryStore } from '../../../stores/useLibraryStore';
import LatticeLoader from '../../../components/ui/LatticeLoader';

export const ScanProgressBanner: React.FC = () => {
  const { isScanning, scanProgress, cancelScan } = useLibraryStore();

  const percent =
    scanProgress && scanProgress.total > 0
      ? Math.min(100, Math.round((scanProgress.indexed / scanProgress.total) * 100))
      : 0;

  return (
    <AnimatePresence>
      {isScanning && (
        <motion.div
          key="scan-glass-toast"
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="fixed bottom-24 right-6 z-50 w-84 max-w-[calc(100vw-2rem)] rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-zinc-700/40 p-4 shadow-2xl shadow-black/80 flex flex-col gap-3 select-none"
        >
          {/* Top header row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-1 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
                <LatticeLoader
                  label=""
                  showTimer={false}
                  status="working"
                  pattern="orbit"
                  grid={3}
                  shape="round"
                  color="#f59e0b"
                  cellSize={4}
                  gap={1.5}
                  glow
                  glowColor="rgba(245, 158, 11, 0.4)"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-100 truncate">Indexing Audio</p>
                {scanProgress && (
                  <p className="text-[10px] text-zinc-400 font-mono">
                    {scanProgress.indexed} / {scanProgress.total} files · {percent}%
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={cancelScan}
              title="Cancel scan"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900/60 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-500/40 text-[11px] font-medium transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3 h-3" />
              <span>Cancel</span>
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-zinc-900/90 border border-zinc-800/80 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            />
          </div>

          {/* Current file name */}
          {scanProgress?.currentFile && (
            <p className="text-[10px] text-zinc-400 font-mono truncate px-0.5">
              → {scanProgress.currentFile}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
