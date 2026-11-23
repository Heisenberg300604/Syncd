import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { TrackRow } from "../types/library";
import type {
  DetailedAudioMetadata,
  TrackMetadataUpdate,
  AlbumMetadataUpdatePayload,
  CreateAlbumPayload,
} from "../types/metadata";

export interface AppInfo {
  name: string;
  version: string;
  installDir: string;
  databasePath: string;
}

export interface LibraryStats {
  trackCount: number;
  albumCount: number;
  artistCount: number;
  folderCount: number;
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "error";
  databaseOk: boolean;
  message?: string;
}

export interface AuthListenerInfo {
  port: number;
  state: string;
}

export interface AuthCallbackPayload {
  token: string;
  refreshToken?: string;
  userId?: string;
  username?: string;
}

export interface StoredAuthSession {
  token?: string | null;
  refreshToken?: string | null;
  userId?: string | null;
  username?: string | null;
  isAuthenticated: boolean;
}

/** Check if running inside the native Tauri desktop environment */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Safely invokes native Tauri commands with error normalization and web fallback */
export async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    // Provide development mocks if loaded directly in a web browser without Tauri host
    console.warn(`[TauriBridge] Native host not detected. Mocking command: ${cmd}`);
    return mockCommand<T>(cmd, args);
  }

  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (err) {
    const errorMsg = typeof err === "string" ? err : err instanceof Error ? err.message : "Unknown native error";
    console.error(`[TauriBridge Error] Command '${cmd}' failed:`, errorMsg);
    throw new Error(errorMsg);
  }
}

function mockCommand<T>(cmd: string, _args?: Record<string, unknown>): T {
  switch (cmd) {
    case "get_app_info":
      return {
        name: "SyncDesk",
        version: "0.0.1",
        installDir: "F:\\Code Projects\\Syncd\\Desktop",
        databasePath: "F:\\Code Projects\\Syncd\\Desktop\\Index\\library.db",
      } as T;
    case "get_system_health":
      return {
        status: "healthy",
        databaseOk: true,
        message: "Native bridge active",
      } as T;
    case "get_library_stats":
      return {
        trackCount: 0,
        albumCount: 0,
        artistCount: 0,
        folderCount: 0,
      } as T;
    case "start_auth_listener":
      return {
        port: 48291,
        state: "mock_state_nonce_12345",
      } as T;
    case "cancel_auth_listener":
      return undefined as T;
    case "get_auth_credentials":
      return {
        token: null,
        refreshToken: null,
        userId: null,
        username: null,
        isAuthenticated: false,
      } as T;
    case "save_auth_credentials":
    case "clear_auth_credentials":
    case "open_browser_url":
      return undefined as T;
    default:
      throw new Error(`Unhandled mock command: ${cmd}`);
  }
}

export const tauriBridge = {
  isTauri,
  invoke: invokeCommand,
  startAuthListener: () => invokeCommand<AuthListenerInfo>("start_auth_listener"),
  cancelAuthListener: () => invokeCommand<void>("cancel_auth_listener"),
  saveAuthCredentials: (token: string, refreshToken?: string, userId?: string, username?: string) =>
    invokeCommand<void>("save_auth_credentials", { token, refreshToken, userId, username }),
  getAuthCredentials: () => invokeCommand<StoredAuthSession>("get_auth_credentials"),
  clearAuthCredentials: () => invokeCommand<void>("clear_auth_credentials"),
  openBrowserUrl: (url: string) => invokeCommand<void>("open_browser_url", { url }),
  readTrackMetadata: (trackId: string) =>
    invokeCommand<DetailedAudioMetadata>("read_track_metadata", { trackId }),
  updateTrackMetadata: (trackId: string, update: TrackMetadataUpdate) =>
    invokeCommand<TrackRow>("update_track_metadata", { trackId, update }),
  updateAlbumMetadata: (trackIds: string[], payload: AlbumMetadataUpdatePayload) =>
    invokeCommand<TrackRow[]>("update_album_metadata", { trackIds, payload }),
  createAlbumFromTracks: (payload: CreateAlbumPayload) =>
    invokeCommand<TrackRow[]>("create_album_from_tracks", { payload }),
  revealInFolder: (path: string) => invokeCommand<void>("reveal_in_folder", { path }),
};

