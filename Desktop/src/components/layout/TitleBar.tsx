import React, { useState, useEffect, useCallback } from "react";
import { Minus, Square, X, Search } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "../../services/tauriBridge";
import { AppLogo } from "../ui/AppLogo";

export interface TitleBarProps {
  onSearchClick?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onSearchClick }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    getCurrentWindow()
      .isMaximized()
      .then(setIsMaximized)
      .catch(() => {});
  }, []);

  const handleMinimize = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (isTauri()) {
        const win = getCurrentWindow();
        await win.minimize();
      }
    } catch (err) {
      console.error('[TitleBar] Minimize error:', err);
    }
  }, []);

  const handleMaximize = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (isTauri()) {
        const win = getCurrentWindow();
        await win.toggleMaximize();
        const max = await win.isMaximized().catch(() => false);
        setIsMaximized(max);
      }
    } catch (err) {
      console.error('[TitleBar] Maximize error:', err);
    }
  }, []);

  const handleClose = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (isTauri()) {
        const win = getCurrentWindow();
        await win.close();
      }
    } catch (err) {
      console.error('[TitleBar] Close error:', err);
    }
  }, []);

  return (
    <header
      data-tauri-drag-region
      className="h-9 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/60 flex items-stretch justify-between pl-3 pr-0 select-none shrink-0 z-50"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Brand (Left) — pointer-events-none so drag still works */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2.5 pointer-events-none"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <AppLogo size={18} />
        <span className="font-semibold text-zinc-300 text-[11px] tracking-wide leading-none">
          SyncD Desktop
        </span>
      </div>

      {/* Search pill (Center) */}
      <div
        data-tauri-drag-region
        className="flex-1 flex items-center justify-center px-6"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSearchClick?.(); }}
          className="h-6 w-72 max-w-sm rounded-md bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/60 px-2.5 flex items-center justify-between text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <span className="flex items-center gap-1.5">
            <Search className="w-3 h-3" />
            Search library, tracks, rooms...
          </span>
          <kbd className="text-[9px] font-mono bg-zinc-800 text-zinc-500 px-1 rounded border border-zinc-700/60">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Window controls (Right) */}
      <div
        data-tauri-drag-region="false"
        className="flex items-stretch relative z-50 pointer-events-auto"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          type="button"
          data-tauri-drag-region="false"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          onClick={handleMinimize}
          className="w-11 flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          aria-label="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          data-tauri-drag-region="false"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          onClick={handleMaximize}
          className="w-11 flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            /* Restore icon: two overlapping squares */
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-current">
              <rect x="3" y="1" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
              <path d="M1 4v6a1 1 0 001 1h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>

        <button
          type="button"
          data-tauri-drag-region="false"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          onClick={handleClose}
          className="w-12 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-red-600 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
