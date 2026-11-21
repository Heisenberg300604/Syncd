import { create } from "zustand";
import { type AppInfo, type SystemHealth, invokeCommand } from "../services/tauriBridge";

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

export const useAppStore = create<AppState>((set, get) => ({
  currentView: "home",
  appInfo: null,
  health: null,
  isInitializing: false,
  initError: null,
  isDrawerOpen: false,
  drawerTab: "queue",

  setCurrentView: (view) => set({ currentView: view }),
  openDrawer: (tab) => set((s) => ({ isDrawerOpen: true, drawerTab: tab || s.drawerTab })),
  closeDrawer: () => set({ isDrawerOpen: false }),
  toggleDrawer: (tab) =>
    set((s) => {
      if (!s.isDrawerOpen) {
        return { isDrawerOpen: true, drawerTab: tab || s.drawerTab };
      }
      if (tab && tab !== s.drawerTab) {
        return { isDrawerOpen: true, drawerTab: tab };
      }
      return { isDrawerOpen: false };
    }),
  setDrawerTab: (tab) => set({ drawerTab: tab }),

  initialize: async () => {
    try {
      const [appInfo, health] = await Promise.all([
        invokeCommand<AppInfo>("get_app_info"),
        invokeCommand<SystemHealth>("get_system_health"),
      ]);
      set({ appInfo, health });
    } catch (err) {
      console.warn("Native core health check non-fatal warning:", err);
    }
  },
}));

