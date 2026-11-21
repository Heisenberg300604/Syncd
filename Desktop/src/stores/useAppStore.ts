import { create } from "zustand";
import { type AppInfo, type SystemHealth, invokeCommand } from "../services/tauriBridge";
import { soundService } from "../services/soundService";

export type NavigationDestination = "home" | "library" | "playlists" | "rooms" | "settings";
export type DrawerTab = "queue" | "chat" | "listeners";

interface AppState {
  currentView: NavigationDestination;
  appInfo: AppInfo | null;
  health: SystemHealth | null;
  isInitializing: boolean;
  initError: string | null;
  isDrawerOpen: boolean;
  drawerTab: DrawerTab;

  setCurrentView: (view: NavigationDestination) => void;
  openDrawer: (tab?: DrawerTab) => void;
  closeDrawer: () => void;
  toggleDrawer: (tab?: DrawerTab) => void;
  setDrawerTab: (tab: DrawerTab) => void;
  initialize: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "home",
  appInfo: null,
  health: null,
  isInitializing: true,
  initError: null,
  isDrawerOpen: false,
  drawerTab: "queue",

  setCurrentView: (view) => set({ currentView: view }),
  openDrawer: (tab) => {
    soundService.play('drawer:open');
    set((s) => ({ isDrawerOpen: true, drawerTab: tab || s.drawerTab }));
  },
  closeDrawer: () => {
    soundService.play('drawer:close');
    set({ isDrawerOpen: false });
  },
  toggleDrawer: (tab) =>
    set((s) => {
      if (!s.isDrawerOpen) {
        soundService.play('drawer:open');
        return { isDrawerOpen: true, drawerTab: tab || s.drawerTab };
      }
      if (tab && tab !== s.drawerTab) {
        return { isDrawerOpen: true, drawerTab: tab };
      }
      soundService.play('drawer:close');
      return { isDrawerOpen: false };
    }),
  setDrawerTab: (tab) => set({ drawerTab: tab }),

  initialize: async () => {
    set({ isInitializing: true, initError: null });
    try {
      const [appInfo, health] = await Promise.all([
        invokeCommand<AppInfo>("get_app_info"),
        invokeCommand<SystemHealth>("get_system_health"),
      ]);
      set({ appInfo, health, isInitializing: false });
    } catch (err) {
      console.warn("Native core health check non-fatal warning:", err);
      set({ isInitializing: false });
    }
  },
}));

