import { useEffect } from "react";
import { useAppStore } from "../stores/useAppStore";
import { usePlayerStore } from "../stores/usePlayerStore";
import { useLibraryStore } from "../stores/useLibraryStore";

export interface ShortcutHandlers {
  onToggleSearch?: () => void;
  onToggleDrawer?: () => void;
  onCloseModals?: () => void;
  onToggleShortcuts?: () => void;
}

export function useGlobalShortcuts(handlers: ShortcutHandlers = {}) {
  const { setCurrentView } = useAppStore();
  const {
    currentTrack,
    positionSeconds,
    durationSeconds,
    volume,
    togglePlay,
    playNext,
    playPrevious,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    dismissPlayer,
    restorePlayer,
  } = usePlayerStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // When focused in an input field, only allow Escape or Global Search
      if (isInput) {
        if (e.key === "Escape") {
          handlers.onCloseModals?.();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          handlers.onToggleSearch?.();
        }
        return;
      }

      // ==========================================
      // 1. Single Bare Keys (when not in an input)
      // ==========================================

      // Space -> Play / Pause Toggle
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
        return;
      }

      // Bare Up Arrow -> Call / Show Floating Bottom Player
      if (e.key === "ArrowUp" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        restorePlayer();
        return;
      }

      // Bare Down Arrow -> Hide / Minimize Floating Bottom Player
      if (e.key === "ArrowDown" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        dismissPlayer();
        return;
      }

      // Bare Left Arrow -> Seek Backward (5s, or 15s if Shift pressed)
      if (e.key === "ArrowLeft" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const step = e.shiftKey ? 15 : 5;
        seek(Math.max(0, positionSeconds - step));
        return;
      }

      // Bare Right Arrow -> Seek Forward (5s, or 15s if Shift pressed)
      if (e.key === "ArrowRight" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const step = e.shiftKey ? 15 : 5;
        const maxDur = durationSeconds > 0 ? durationSeconds : currentTrack?.durationSeconds || 0;
        seek(maxDur > 0 ? Math.min(maxDur, positionSeconds + step) : positionSeconds + step);
        return;
      }

      // '?' -> Open Keyboard Shortcuts Cheatsheet
      if (e.key === "?") {
        e.preventDefault();
        handlers.onToggleShortcuts?.();
        return;
      }

      // Escape -> Close any open modals / drawer / popovers
      if (e.key === "Escape") {
        handlers.onCloseModals?.();
        return;
      }

      // ==========================================
      // 2. Ctrl / Cmd Key Combinations
      // ==========================================
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();

        switch (key) {
          // Volume Up (+5%)
          case "arrowup":
            e.preventDefault();
            setVolume(Math.min(100, volume + 5));
            break;

          // Volume Down (-5%)
          case "arrowdown":
            e.preventDefault();
            setVolume(Math.max(0, volume - 5));
            break;

          // Next Track
          case "arrowright":
          case "n":
            e.preventDefault();
            playNext();
            break;

          // Previous Track
          case "arrowleft":
          case "p":
            e.preventDefault();
            playPrevious();
            break;

          // Mute Toggle
          case "m":
            e.preventDefault();
            toggleMute();
            break;

          // Shuffle Toggle
          case "s":
            e.preventDefault();
            toggleShuffle();
            break;

          // Repeat Toggle (or Library Rescan if Shift is held)
          case "r":
            e.preventDefault();
            if (e.shiftKey) {
              useLibraryStore.getState().startScan();
            } else {
              toggleRepeat();
            }
            break;

          // Global Search Modal
          case "k":
            e.preventDefault();
            handlers.onToggleSearch?.();
            break;

          // Queue & Right Drawer Toggle
          case "q":
            e.preventDefault();
            handlers.onToggleDrawer?.();
            break;

          // Shortcuts Cheatsheet Modal (Ctrl + /)
          case "/":
            e.preventDefault();
            handlers.onToggleShortcuts?.();
            break;

          // View Switching
          case "1":
            e.preventDefault();
            setCurrentView("home");
            break;
          case "2":
            e.preventDefault();
            setCurrentView("library");
            break;
          case "3":
            e.preventDefault();
            setCurrentView("playlists");
            break;
          case "4":
            e.preventDefault();
            setCurrentView("rooms");
            break;
          case "5":
            e.preventDefault();
            setCurrentView("settings");
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handlers,
    currentTrack,
    positionSeconds,
    durationSeconds,
    volume,
    togglePlay,
    playNext,
    playPrevious,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    dismissPlayer,
    restorePlayer,
    setCurrentView,
  ]);
}
