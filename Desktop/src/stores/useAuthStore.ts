import { create } from 'zustand';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { tauriBridge, type AuthCallbackPayload } from '../services/tauriBridge';
import type { UserProfile } from '../types/social';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  apiUrl: string;
  socketUrl: string;
  webAppUrl: string;

  initializeAuth: () => Promise<void>;
  openBrowserLinkingPage: () => Promise<void>;
  exchangeLinkingCode: (code: string) => Promise<boolean>;
  loginWithBrowser: () => Promise<boolean>;
  cancelBrowserLogin: () => Promise<void>;
  setToken: (token: string | null, refreshToken?: string | null) => Promise<void>;
  setUser: (user: UserProfile | null) => void;
  setEndpoints: (apiUrl: string, socketUrl: string, webAppUrl?: string) => void;
  fetchCurrentUser: () => Promise<UserProfile | null>;
  logout: () => Promise<void>;
  startTokenRefreshWorker: () => void;
  stopTokenRefreshWorker: () => void;
}

const STORAGE_KEY_TOKEN = 'syncd_desktop_token';
const STORAGE_KEY_REFRESH = 'syncd_desktop_refresh_token';
const STORAGE_KEY_USER = 'syncd_desktop_user';
const STORAGE_KEY_API = 'syncd_desktop_api_url';
const STORAGE_KEY_SOCKET = 'syncd_desktop_socket_url';
const STORAGE_KEY_WEB = 'syncd_desktop_web_url';

let activeUnlistenFn: UnlistenFn | null = null;
let refreshWorkerInterval: number | null = null;
let focusHeartbeatListener: (() => void) | null = null;

function getInitialUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getInitialEndpoint(key: string, envVal: string | undefined, defaultVal: string): string {
  try {
    const stored = localStorage.getItem(key);
    if (stored && !stored.includes('localhost')) {
      return stored;
    }
  } catch {
    // ignore
  }
  return envVal || defaultVal;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem(STORAGE_KEY_TOKEN) || null,
  refreshToken: localStorage.getItem(STORAGE_KEY_REFRESH) || null,
  user: getInitialUser(),
  isAuthenticated: Boolean(localStorage.getItem(STORAGE_KEY_TOKEN) || getInitialUser()),
  isLoading: false,
  isAuthenticating: false,
  authError: null,
  apiUrl: getInitialEndpoint(STORAGE_KEY_API, import.meta.env.VITE_API_URL, 'https://syncd-api.onrender.com/api'),
  socketUrl: getInitialEndpoint(STORAGE_KEY_SOCKET, import.meta.env.VITE_SOCKET_URL, 'https://syncd-api.onrender.com'),
  webAppUrl: getInitialEndpoint(STORAGE_KEY_WEB, import.meta.env.VITE_WEB_APP_URL, 'https://syncd-tau.vercel.app'),

  initializeAuth: async () => {
    set({ isLoading: true });
    try {
      // 1. Dual-Layer Fault Tolerance: Query native OS/SQLite vault
      const credentials = await tauriBridge.getAuthCredentials();
      const localToken = localStorage.getItem(STORAGE_KEY_TOKEN);
      const localRefresh = localStorage.getItem(STORAGE_KEY_REFRESH);
      const effectiveToken = credentials.token || localToken;
      const effectiveRefresh = credentials.refreshToken || localRefresh;

      let effectiveUser = get().user;
      if (!effectiveUser && credentials.username) {
        effectiveUser = {
          id: credentials.userId || 'user',
          clerkUserId: credentials.userId || 'user',
          username: credentials.username,
        };
      }

      if (effectiveToken) {
        // Heal LocalStorage if it was wiped
        localStorage.setItem(STORAGE_KEY_TOKEN, effectiveToken);
        if (effectiveRefresh) localStorage.setItem(STORAGE_KEY_REFRESH, effectiveRefresh);
        if (effectiveUser) localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(effectiveUser));

        // Heal native SQLite vault if LocalStorage had credentials missing in vault
        if (!credentials.token && effectiveToken) {
          tauriBridge
            .saveAuthCredentials(
              effectiveToken,
              effectiveRefresh || undefined,
              effectiveUser?.id,
              effectiveUser?.username
            )
            .catch(() => { });
        }

        set({
          token: effectiveToken,
          refreshToken: effectiveRefresh,
          user: effectiveUser,
          isAuthenticated: true,
        });

        // 2. Start background heartbeat worker (10 min cadence)
        get().startTokenRefreshWorker();

        // 3. Silently revalidate against backend in background without dropping offline sessions
        get()
          .fetchCurrentUser()
          .catch((err) => {
            console.warn('[Auth] Background session revalidation notice:', err);
          });
      }
    } catch (err) {
      console.warn('[Auth] Cold start auto-login notice:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  openBrowserLinkingPage: async () => {
    const { webAppUrl } = get();
    const authUrl = `${webAppUrl}/desktop-auth`;
    try {
      await tauriBridge.openBrowserUrl(authUrl);
    } catch {
      window.open(authUrl, '_blank');
    }
  },

  exchangeLinkingCode: async (code: string) => {
    set({ isAuthenticating: true, authError: null });
    const { apiUrl } = get();

    try {
      const res = await fetch(`${apiUrl}/auth/desktop-exchange`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Invalid or expired linking code.');
      }

      const data = await res.json();
      if (!data.token) {
        throw new Error('No authentication token returned by server.');
      }

      await get().setToken(data.token);
      if (data.user) {
        set({ user: data.user, isAuthenticated: true });
        try {
          await tauriBridge.saveAuthCredentials(data.token, undefined, data.user.id, data.user.username);
        } catch {
          // ignore
        }
      }

      set({ isAuthenticating: false, authError: null });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ isAuthenticating: false, authError: msg });
      return false;
    }
  },

  loginWithBrowser: async () => {
    set({ isAuthenticating: true, authError: null });

    try {
      // 1. Cancel any existing listener
      if (activeUnlistenFn) {
        activeUnlistenFn();
        activeUnlistenFn = null;
      }
      await tauriBridge.cancelAuthListener();

      // 2. Bind ephemeral loopback listener in native Rust
      const listenerInfo = await tauriBridge.startAuthListener();
      const { port, state } = listenerInfo;

      // 3. Register Tauri event listener for callback
      const authPromise = new Promise<AuthCallbackPayload>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          if (activeUnlistenFn) {
            activeUnlistenFn();
            activeUnlistenFn = null;
          }
          tauriBridge.cancelAuthListener();
          reject(new Error('Authentication timed out after 120 seconds.'));
        }, 120_000);

        listen<AuthCallbackPayload>('auth:callback', (event) => {
          window.clearTimeout(timeoutId);
          if (activeUnlistenFn) {
            activeUnlistenFn();
            activeUnlistenFn = null;
          }
          resolve(event.payload);
        }).then((unlisten) => {
          activeUnlistenFn = unlisten;
        }).catch(reject);
      });

      // 4. Open default system browser to Web handoff page
      const { webAppUrl } = get();
      const authUrl = `${webAppUrl}/desktop-auth?port=${port}&state=${encodeURIComponent(state)}`;

      try {
        await tauriBridge.openBrowserUrl(authUrl);
      } catch {
        window.open(authUrl, '_blank');
      }

      // 5. Await callback from loopback server or protocol
      const payload = await authPromise;

      if (!payload.token) {
        throw new Error('No authentication token received from browser.');
      }

      // 6. Save token to native vault & localStorage
      await get().setToken(payload.token, payload.refreshToken);

      set({ isAuthenticating: false });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Auth Error] Browser login failed:', msg);
      set({ isAuthenticating: false, authError: msg });
      return false;
    }
  },

  cancelBrowserLogin: async () => {
    if (activeUnlistenFn) {
      activeUnlistenFn();
      activeUnlistenFn = null;
    }
    await tauriBridge.cancelAuthListener();
    set({ isAuthenticating: false, authError: null });
  },

  setToken: async (token, refreshToken = null) => {
    if (token) {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      if (refreshToken) {
        localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
      }
      set({ token, refreshToken, isAuthenticated: true });

      // Save to native vault
      try {
        await tauriBridge.saveAuthCredentials(token, refreshToken || undefined);
      } catch (e) {
        console.warn('Native vault save notice:', e);
      }

      const user = await get().fetchCurrentUser();
      if (user) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
        try {
          await tauriBridge.saveAuthCredentials(token, refreshToken || undefined, user.id, user.username);
        } catch {
          // ignore
        }
      }

      get().startTokenRefreshWorker();
    } else {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_REFRESH);
      localStorage.removeItem(STORAGE_KEY_USER);
      get().stopTokenRefreshWorker();
      set({ token: null, refreshToken: null, user: null, isAuthenticated: false });
    }
  },

  setUser: (user) => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
    set({ user, isAuthenticated: Boolean(user) });
  },

  setEndpoints: (apiUrl, socketUrl, webAppUrl) => {
    localStorage.setItem(STORAGE_KEY_API, apiUrl);
    localStorage.setItem(STORAGE_KEY_SOCKET, socketUrl);
    if (webAppUrl) {
      localStorage.setItem(STORAGE_KEY_WEB, webAppUrl);
    }
    set({ apiUrl, socketUrl, ...(webAppUrl ? { webAppUrl } : {}) });
  },

  fetchCurrentUser: async () => {
    const { token, apiUrl, user: existingUser } = get();
    if (!token) {
      set({ user: null, isAuthenticated: false });
      return null;
    }

    set({ isLoading: true });
    try {
      const res = await fetch(`${apiUrl}/me`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (res.status === 304 && existingUser) {
        // Cached response is still valid
        set({ isLoading: false, isAuthenticated: true });
        return existingUser;
      }

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired or invalid
          await get().logout();
        }
        set({ isLoading: false });
        return null;
      }

      const data = await res.json();
      if (data.authenticated && data.user) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));
        set({ user: data.user, isAuthenticated: true, isLoading: false });
        return data.user as UserProfile;
      } else if (data.authenticated) {
        // Authenticated in Clerk, maintain or create a session profile
        const activeProfile: UserProfile = existingUser || {
          id: 'user_sync',
          clerkUserId: 'user',
          username: 'SyncD Member',
        };
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(activeProfile));
        set({ user: activeProfile, isAuthenticated: true, isLoading: false });
        return activeProfile;
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return null;
      }
    } catch (err) {
      console.warn('Failed to fetch user identity (network offline?):', err);
      // Keep existing user and authentication state offline
      set({ isLoading: false, isAuthenticated: Boolean(existingUser || token) });
      return existingUser;
    }
  },

  // 7-Step Non-Destructive Safe Logout Protocol
  logout: async () => {
    get().stopTokenRefreshWorker();

    try {
      // Step 1 & 2: Safely leave active social room and disconnect socket
      // Dynamically access room store to prevent circular dependency
      const { useRoomStore } = await import('./useRoomStore');
      const roomStore = useRoomStore.getState();
      if (roomStore.activeRoom) {
        await roomStore.leaveRoom();
      }

      const { socketService } = await import('../services/socketService');
      socketService.disconnect();
    } catch (err) {
      console.warn('[Logout Notice] Room cleanup:', err);
    }

    // Step 3: Purge OS Credential Vault
    try {
      await tauriBridge.clearAuthCredentials();
    } catch (err) {
      console.warn('[Logout Notice] Vault cleanup:', err);
    }

    // Step 4: Clear LocalStorage
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_REFRESH);
    localStorage.removeItem(STORAGE_KEY_USER);

    // Step 5 & 6: Purge memory state (Local library database remains 100% intact!)
    set({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isAuthenticating: false,
      authError: null,
    });
  },

  // Internal helper methods
  startTokenRefreshWorker: () => {
    get().stopTokenRefreshWorker();

    let lastHeartbeat = Date.now();
    const HEARTBEAT_INTERVAL = 600_000; // 10 minutes

    focusHeartbeatListener = () => {
      if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL) {
        lastHeartbeat = Date.now();
        get().fetchCurrentUser().catch(() => { });
      }
    };
    window.addEventListener('focus', focusHeartbeatListener);

    refreshWorkerInterval = window.setInterval(async () => {
      lastHeartbeat = Date.now();
      const { isAuthenticated, token, apiUrl } = get();
      if (!isAuthenticated || !token) return;

      try {
        const res = await fetch(`${apiUrl}/me`, {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });

        if (res.status === 401) {
          console.warn('[Session Heartbeat] Session revoked or expired, signing out...');
          await get().logout();
        }
      } catch {
        // Temporary network drop or backend restart, preserve user offline state
      }
    }, HEARTBEAT_INTERVAL);
  },

  stopTokenRefreshWorker: () => {
    if (refreshWorkerInterval) {
      window.clearInterval(refreshWorkerInterval);
      refreshWorkerInterval = null;
    }
    if (focusHeartbeatListener) {
      window.removeEventListener('focus', focusHeartbeatListener);
      focusHeartbeatListener = null;
    }
  },
}));
