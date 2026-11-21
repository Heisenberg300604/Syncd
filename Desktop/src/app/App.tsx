import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sidebar } from "../components/layout/Sidebar";
import { BottomPlayer } from "../components/player/BottomPlayer";
import ShapeGrid from "../components/ui/ShapeGrid/ShapeGrid";
import { TitleBar } from "../components/layout/TitleBar";
import { ResizeHandle } from "../components/layout/ResizeHandle";
import { GlobalSearchModal } from "../components/layout/GlobalSearchModal";
import { GlobalContextMenu } from "../components/layout/GlobalContextMenu";
import { ToastContainer } from "../components/feedback/ToastContainer";
import { OfflineBanner } from "../components/feedback/OfflineBanner";
import { ErrorBoundary } from "../components/feedback/ErrorBoundary";
import { ScanProgressBanner } from "../features/library/components/ScanProgressBanner";
import { HomeView } from "../features/home/HomeView";
import { useAppStore } from "../stores/useAppStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useLibraryStore } from "../stores/useLibraryStore";
import { usePlaylistStore } from "../stores/usePlaylistStore";
import { usePlayerStore } from "../stores/usePlayerStore";
import { useAuthStore } from "../stores/useAuthStore";
import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "../services/tauriBridge";
import { AppLoadingScreen } from "../components/feedback/AppLoadingScreen";
import { ShortcutsModal } from "../components/feedback/ShortcutsModal";

// Code-split heavy secondary views to achieve ultra-fast cold start (<300ms JS evaluation)
const LibraryView = lazy(() =>
  import("../features/library/LibraryView").then((m) => ({ default: m.LibraryView }))
);
const PlaylistsView = lazy(() =>
  import("../features/playlists/PlaylistsView").then((m) => ({ default: m.PlaylistsView }))
);
const RoomsView = lazy(() =>
  import("../features/rooms/RoomsView").then((m) => ({ default: m.RoomsView }))
);
const SettingsView = lazy(() =>
  import("../features/settings/SettingsView").then((m) => ({ default: m.SettingsView }))
);
const RightDrawer = lazy(() =>
  import("../components/layout/RightDrawer").then((m) => ({ default: m.RightDrawer }))
);

export function App() {
  const {
    currentView,
    isInitializing,
    initError,
    initialize,
    isDrawerOpen,
    closeDrawer,
  } = useAppStore();

  // Layout sizing state (with min/max clamps)
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [drawerWidth, setDrawerWidth] = useState(340);
  const [isDrawerResizing, setIsDrawerResizing] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [isAppReady, setIsAppReady] = useState(false);

  const isPlayerVisible = usePlayerStore((s) => Boolean(s.currentTrack && s.hasPlaybackStarted));
  const selectedAccent = useSettingsStore((s) => s.selectedAccent);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-accent", selectedAccent);
    }
  }, [selectedAccent]);

  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useEffect(() => {
    initialize();
    useSettingsStore.getState().loadSettings();
    useLibraryStore.getState().loadArtworkDir();
    useLibraryStore.getState().loadStats();
    usePlaylistStore.getState().loadPlaylists();
    usePlayerStore.getState().loadPersistedQueue();
    usePlayerStore.getState().loadDevices();
    useAuthStore.getState().initializeAuth();

    // Show window only when initial DOM is rendered and styled, completely eliminating the black box!
    if (isTauri()) {
      requestAnimationFrame(() => {
        getCurrentWindow().show().catch(() => {});
      });
    }

    // Deferred post-load check: only runs after app is fully idle (ensuring zero boot latency)
    const scanTimer = setTimeout(() => {
      useLibraryStore.getState().checkPendingAudio();
    }, 3500);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearTimeout(scanTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [initialize]);

  // Handle panel resizing
  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((prev) => Math.max(180, Math.min(320, prev + delta)));
  }, []);

  const handleDrawerResize = useCallback((delta: number) => {
    // Inverted delta because drawer is on right
    setDrawerWidth((prev) => Math.max(260, Math.min(440, prev - delta)));
  }, []);

  // Global hotkeys
  useGlobalShortcuts({
    onToggleSearch: () => setIsSearchOpen((prev) => !prev),
    onToggleDrawer: () => useAppStore.getState().toggleDrawer(),
    onCloseModals: () => {
      if (isSearchOpen) setIsSearchOpen(false);
      else if (isShortcutsOpen) setIsShortcutsOpen(false);
      else if (isDrawerOpen) closeDrawer();
    },
    onToggleShortcuts: () => setIsShortcutsOpen((prev) => !prev),
  });

  return (
    <div
      data-player-active={isPlayerVisible ? "true" : "false"}
      className="h-screen w-screen bg-zinc-950 flex flex-col overflow-hidden text-zinc-100 relative"
    >
      {/* Global Ambient Background: 3D Perspective ShapeGrid (Persistent: Mounts ONCE for entire app lifecycle) */}
      <div className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden select-none">
        <div className="absolute -inset-6 filter blur-[8px] opacity-75">
          <ShapeGrid
            shape="square"
            direction="down"
            lineColor="#3f3f46"
            hoverColor="#ffffff"
            hoverFillColor="#ffffff"
            fillOpacity={0.12}
            cellSize={46}
            speed={0.35}
            tiltX={42}
            tiltY={0}
            horizonY={-0.35}
            fade={0}
            mist={false}
            rainbow={false}
            radius={2}
            trail={0.9}
            glow={0.4}
            interactive={false}
            clickCascade={false}
            paused={!isWindowFocused}
            className="w-full h-full"
          />
        </div>
        {/* Subtle Edge Feather Vignette & Soft Diffusion Overlay */}
        <div className="absolute inset-0 backdrop-blur-[6px] bg-gradient-to-b from-zinc-950/40 via-zinc-950/15 to-zinc-950/65 pointer-events-none" />
      </div>

      {/* Loading Screen Overlay: Runs smoothly once, then seamlessly fades away */}
      <AnimatePresence>
        {(isInitializing || !isAppReady) && (
          <AppLoadingScreen
            error={initError}
            onRetry={initialize}
            onFinished={() => setIsAppReady(true)}
          />
        )}
      </AnimatePresence>

      {/* Frameless Desktop TitleBar */}
      <TitleBar onSearchClick={() => setIsSearchOpen(true)} />

      {/* Offline Status Warning */}
      <OfflineBanner isOffline={isOffline} />

      {/* 3-Column Desktop Shell */}
      <div className="flex-1 flex overflow-hidden z-10 relative">
        {/* Left Sidebar */}
        <div style={{ width: `${sidebarWidth}px` }} className="shrink-0 flex">
          <Sidebar onOpenShortcuts={() => setIsShortcutsOpen(true)} />
        </div>

        {/* Left Resize Handle */}
        <ResizeHandle onResize={handleSidebarResize} />

        {/* Main Content Viewport */}
        <main className="flex-1 flex flex-col overflow-hidden bg-transparent relative">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <Suspense fallback={null}>
                {currentView === "home" && <HomeView />}
                {currentView === "library" && <LibraryView />}
                {currentView === "playlists" && <PlaylistsView />}
                {currentView === "rooms" && <RoomsView />}
                {currentView === "settings" && <SettingsView />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Floating Detached Right Drawer: Suspended with smooth rounded edges */}
        <AnimatePresence initial={false}>
          {isDrawerOpen && (
            <motion.div
              key="right-drawer-wrapper"
              initial={{ x: "calc(100% + 20px)", opacity: 0, scale: 0.98 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: "calc(100% + 20px)", opacity: 0, scale: 0.98 }}
              transition={
                isDrawerResizing
                  ? { x: { duration: 0 }, opacity: { duration: 0 } }
                  : {
                      type: "spring",
                      stiffness: 400,
                      damping: 34,
                      mass: 0.8,
                    }
              }
              style={{ width: `${drawerWidth}px` }}
              className={`absolute top-3 right-3 ${
                isPlayerVisible ? "bottom-24" : "bottom-3"
              } z-40 flex shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),0_0_35px_rgba(0,0,0,0.5)] overflow-hidden rounded-2xl border border-zinc-800/80 ring-1 ring-white/[0.08] backdrop-blur-2xl pointer-events-auto transition-[bottom] duration-300`}
            >
              <Suspense fallback={null}>
                <ResizeHandle
                  onResize={handleDrawerResize}
                  onDragStateChange={setIsDrawerResizing}
                />
                <RightDrawer
                  isOpen={isDrawerOpen}
                  onClose={closeDrawer}
                  width={drawerWidth}
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Glass Dock Player Bar */}
      <ErrorBoundary fallback={null}>
        <BottomPlayer
          isDrawerOpen={isDrawerOpen}
          onToggleDrawer={() => useAppStore.getState().toggleDrawer('queue')}
        />
      </ErrorBoundary>

      {/* Global Search Dialog Modal (Ctrl+K) */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Global Keyboard Shortcuts Cheatsheet Dialog (?) */}
      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      {/* Toast Feedback System */}
      <ToastContainer />

      {/* Global Scan Progress Glass Toast */}
      <ScanProgressBanner />

      {/* Global Native-Replacement Glass Context Menu */}
      <GlobalContextMenu />
    </div>
  );
}

export default App;
