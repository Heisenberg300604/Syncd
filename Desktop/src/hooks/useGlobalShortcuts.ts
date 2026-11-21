import { useEffect } from "react";
import { useAppStore } from "../stores/useAppStore";
import { usePlayerStore } from "../stores/usePlayerStore";

export interface ShortcutHandlers {
  onToggleSearch?: () => void;
  onToggleDrawer?: () => void;
  onCloseModals?: () => void;
}

export function useGlobalShortcuts(handlers: ShortcutHandlers = {}) {
  const { setCurrentView } = useAppStore();
  const { status, positionSeconds, togglePlay, seek } = usePlayerStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger playback hotkeys if actively typing in an input or textarea
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Space -> Play / Pause Toggle
      if (e.code === "Space" && !isInput) {
        e.preventDefault();
        togglePlay();
        return;
      }

      // ArrowLeft / ArrowRight -> Seek 5s
      if (e.key === "ArrowLeft" && !isInput) {
        e.preventDefault();
        seek(Math.max(0, positionSeconds - 5));
        return;
      }
      if (e.key === "ArrowRight" && !isInput) {
        e.preventDefault();
        seek(positionSeconds + 5);
        return;
      }

      // Ctrl + Shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "k":
            e.preventDefault();
            handlers.onToggleSearch?.();
            break;
          case "q":
            e.preventDefault();
            handlers.onToggleDrawer?.();
            break;
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

      // Escape -> Close
      if (e.key === "Escape") {
        handlers.onCloseModals?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers, status, positionSeconds, togglePlay, seek, setCurrentView]);
}

