import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../services/tauriBridge';
import { soundService } from '../services/soundService';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'upToDate'
  | 'downloading'
  | 'installing'
  | 'error';

export interface UpdaterState {
  status: UpdateStatus;
  currentVersion: string;
  updateAvailable: boolean;
  newVersion: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
  downloadProgress: number; // 0-100
  downloadedBytes: number;
  totalBytes: number;
  errorMessage: string | null;
  checkForUpdates: (silent?: boolean) => Promise<boolean>;
  downloadAndInstall: () => Promise<void>;
  resetStatus: () => void;
}

export function useUpdater(): UpdaterState {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [currentVersion, setCurrentVersion] = useState<string>('0.0.2');
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [releaseDate, setReleaseDate] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingUpdateRef = useRef<any>(null);

  // Fetch compiled app version
  useEffect(() => {
    if (!isTauri()) return;

    invoke<string>('get_app_version')
      .then((ver) => {
        if (ver) setCurrentVersion(ver);
      })
      .catch(() => {
        // Fallback default
      });
  }, []);

  const resetStatus = useCallback(() => {
    setStatus('idle');
    setErrorMessage(null);
    setDownloadProgress(0);
  }, []);

  const checkForUpdates = useCallback(async (silent = false): Promise<boolean> => {
    if (!isTauri()) {
      if (!silent) {
        setStatus('error');
        setErrorMessage('Updater is only active in native desktop mode.');
      }
      return false;
    }

    try {
      if (!silent) setStatus('checking');
      setErrorMessage(null);

      // Dynamically load updater plugin so dev mode or missing plugin does not crash the UI bundle
      const { check } = await import('@tauri-apps/plugin-updater').catch(() => ({
        check: null,
      }));

      if (!check) {
        setStatus('error');
        setErrorMessage('Updater plugin is in local dev bypass mode (no pubkey configured).');
        return false;
      }

      const update = await check();

      if (update) {
        pendingUpdateRef.current = update;
        setNewVersion(update.version);
        setReleaseDate(update.date ?? null);
        setReleaseNotes(update.body ?? null);
        setStatus('available');
        soundService.play('update:available');
        return true;
      } else {
        pendingUpdateRef.current = null;
        setNewVersion(null);
        setStatus('upToDate');
        return false;
      }
    } catch (err: unknown) {
      console.warn('Update check failed:', err);
      const errMsg =
        typeof err === 'string'
          ? err
          : err instanceof Error
          ? err.message
          : 'Unable to check for updates (no release found or network unreachable)';
      setErrorMessage(errMsg);
      setStatus('error');
      return false;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    const update = pendingUpdateRef.current;
    if (!update) return;

    try {
      setStatus('downloading');
      setDownloadProgress(0);
      setDownloadedBytes(0);
      setTotalBytes(0);
      setErrorMessage(null);

      let contentLength = 0;
      let downloaded = 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await update.downloadAndInstall((event: any) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength || 0;
          setTotalBytes(contentLength);
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          setDownloadedBytes(downloaded);
          if (contentLength > 0) {
            const percent = Math.min(100, Math.round((downloaded / contentLength) * 100));
            setDownloadProgress(percent);
          }
        } else if (event.event === 'Finished') {
          setStatus('installing');
          setDownloadProgress(100);
        }
      });

      // App will exit or restart via NSIS installer on Windows
      try {
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      } catch {
        // Installer may have already terminated the process
      }
    } catch (err: unknown) {
      console.error('Update download/installation failed:', err);
      const errMsg =
        typeof err === 'string'
          ? err
          : err instanceof Error
          ? err.message
          : 'Failed to download or install update';
      setErrorMessage(errMsg);
      setStatus('error');
    }
  }, []);

  return {
    status,
    currentVersion,
    updateAvailable: status === 'available',
    newVersion,
    releaseDate,
    releaseNotes,
    downloadProgress,
    downloadedBytes,
    totalBytes,
    errorMessage,
    checkForUpdates,
    downloadAndInstall,
    resetStatus,
  };
}
