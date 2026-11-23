import React, { useState, useEffect, useCallback } from "react";
import { Minus, Square, X, Search, PanelRight } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "../../services/tauriBridge";
import { AppLogo } from "../ui/AppLogo";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useAppStore } from "../../stores/useAppStore";
import { useAuthStore } from "../../stores/useAuthStore";

export interface TitleBarProps {
  onSearchClick?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onSearchClick }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const navLayout = useSettingsStore((s) => s.navLayout);
  const isTopbar = navLayout === 'topbar';

  const { setCurrentView, isDrawerOpen, toggleDrawer } = useAppStore();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isTauri()) return;
    getCurrentWindow()
      .isMaximized()
      .then(setIsMaximized)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
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
      className="h-9 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/60 flex items-center justify-between pl-3 pr-0 select-none shrink-0 z-50 transition-all duration-150"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Brand (Left) */}
      <div
        className="flex items-center gap-2.5 shrink-0"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => setCurrentView('home')}
          className="flex items-center gap-2 text-left cursor-pointer group py-1"
          title="SyncDesk Home"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <AppLogo size={18} showWordmark badge={isTopbar ? "Desktop" : undefined} />
          {!isTopbar && (
            <span className="font-semibold text-zinc-300 text-[11px] tracking-wide leading-none">
              Sync<span className="text-amber-400">Desk</span>
            </span>
          )}
        </button>
      </div>

      {/* Drag spacer before Search */}
      <div
        data-tauri-drag-region
        className="flex-1 min-w-4 h-full"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      {/* Search pill (Center) */}
      <div
        className="flex items-center justify-center shrink-0 px-2"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSearchClick?.();
          }}
          className="group h-6 w-64 md:w-72 lg:w-80 max-w-sm rounded-md bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800/60 hover:border-amber-500/40 px-2.5 flex items-center justify-between text-[11px] text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer shadow-xs"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <span className="flex items-center gap-1.5 truncate">
            <Search className="w-3 h-3 text-amber-400 transition-colors shrink-0" />
            <span className="truncate">Search library, tracks, rooms...</span>
          </span>
          <kbd className="text-[9px] font-mono bg-zinc-800/90 text-zinc-500 group-hover:text-amber-400 group-hover:border-amber-500/30 px-1 rounded border border-zinc-700/60 transition-colors shrink-0 ml-1">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Drag spacer after Search */}
      <div
        data-tauri-drag-region
        className="flex-1 min-w-4 h-full"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      {/* Right Controls & Utilities */}
      <div
        className="flex items-center shrink-0"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {/* Topbar Mode Utilities: Profile & Drawer */}
        {isTopbar && (
          <div
            className="flex items-center gap-1.5 mr-2"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            {/* Right Drawer (Queue / Social) Trigger */}
            <button
              type="button"
              onClick={() => toggleDrawer()}
              title={isDrawerOpen ? "Close Queue / Drawer (Ctrl+B)" : "Open Queue / Drawer (Ctrl+B)"}
              className={`p-1 rounded-md border transition-all cursor-pointer ${
                isDrawerOpen
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80 border-transparent hover:border-zinc-800'
              }`}
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <PanelRight className="w-3.5 h-3.5" />
            </button>

            {/* User Profile Avatar / Sign-In */}
            {isAuthenticated && user ? (
              <button
                type="button"
                onClick={() => setCurrentView('settings')}
                title={`Account: ${user.username} (Click to open Settings)`}
                className="flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800/80 hover:border-amber-500/40 text-left transition-all cursor-pointer group"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              >
                <div className="relative">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-amber-400 text-[10px] uppercase shrink-0">
                    {user.username ? user.username.slice(0, 2) : 'ME'}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-zinc-950 ${
                      isOnline
                        ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]'
                        : 'bg-amber-400 shadow-[0_0_4px_rgba(245,158,11,0.6)]'
                    }`}
                  />
                </div>
                <span className="hidden xl:inline text-xs font-medium text-zinc-300 group-hover:text-amber-400 truncate max-w-24 transition-colors">
                  {user.username}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentView('settings')}
                title="Sign In / Account"
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/70 hover:border-amber-500/40 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                <span className="hidden sm:inline">Guest</span>
              </button>
            )}
          </div>
        )}

        {/* Window controls (Right) */}
        <div
          data-tauri-drag-region="false"
          className="flex items-stretch relative z-50 pointer-events-auto h-full"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button
            type="button"
            data-tauri-drag-region="false"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            onClick={handleMinimize}
            className="w-11 h-9 flex items-center justify-center text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
            aria-label="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            data-tauri-drag-region="false"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            onClick={handleMaximize}
            className="w-11 h-9 flex items-center justify-center text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-current">
                <rect x="3" y="1" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
                <path d="M1 4v6a1 1 0 001 1h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
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
            className="w-12 h-9 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-red-600 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
