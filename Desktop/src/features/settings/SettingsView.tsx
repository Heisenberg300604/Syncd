import React, { useState, useEffect } from 'react';
import {
  Volume2,
  Folder,
  User,
  Palette,
  Trash2,
  RefreshCw,
  LogOut,
  LogIn,
  ChevronDown,
  Server,
  ExternalLink,
  Clipboard,
  Download,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowUpCircle,
} from 'lucide-react';
import { useUpdater } from '../../hooks/useUpdater';
import { useAuthStore } from '../../stores/useAuthStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useToastStore } from '../../stores/useToastStore';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import CodeSlots, { type CodeSlotsStatus } from '../../components/ui/CodeSlots';
import { AnimatedCheckmark } from '../../components/ui/AnimatedCheckmark';
import { FolderManagerModal } from '../library/components/FolderManagerModal';
import GlideSelect from '../../components/ui/GlideSelect';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { requestNotificationPermission, showTrackNotification } from '../../services/notificationService';

export function SettingsView() {
  const { appInfo } = useAppStore();
  const updater = useUpdater();
  const {
    user,
    isAuthenticated,
    isAuthenticating,
    authError,
    apiUrl,
    socketUrl,
    openBrowserLinkingPage,
    exchangeLinkingCode,
    setToken,
    setEndpoints,
    fetchCurrentUser,
    logout,
  } = useAuthStore();
  const { devices, loadDevices } = usePlayerStore();
  const { stats, loadStats, startScan, isScanning } = useLibraryStore();
  const { addToast } = useToastStore();

  // Music Player Toggles & Settings from SQLite
  const {
    selectedDevice,
    volumeNormalization,
    gaplessPlayback,
    trackNotifications,
    autoQueue,
    selectedAccent,
    setSelectedDevice,
    setVolumeNormalization,
    setGaplessPlayback,
    setTrackNotifications,
    setAutoQueue,
    setSelectedAccent,
  } = useSettingsStore();
  const [socialPresence, setSocialPresence] = useState(true);

  // Modals & Developer State
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isCelebrationOpen, setIsCelebrationOpen] = useState(false);
  const [codeSlotsStatus, setCodeSlotsStatus] = useState<CodeSlotsStatus>('idle');
  const [enteredCode, setEnteredCode] = useState('');
  const [showManualToken, setShowManualToken] = useState(false);
  const [authInputToken, setAuthInputToken] = useState('');
  const [inputApiUrl, setInputApiUrl] = useState(apiUrl);
  const [inputSocketUrl, setInputSocketUrl] = useState(socketUrl);
  const [isTestingBackend, setIsTestingBackend] = useState(false);

  const activeAccentHex =
    selectedAccent === 'gold'
      ? '#eab308'
      : selectedAccent === 'emerald'
      ? '#10b981'
      : selectedAccent === 'cyan'
      ? '#06b6d4'
      : '#f59e0b';

  useEffect(() => {
    loadDevices();
    loadStats();
    if (isAuthenticated && !user) {
      fetchCurrentUser();
    }
  }, [loadDevices, loadStats, isAuthenticated, user, fetchCurrentUser]);

  const handleOpenAuthModal = async () => {
    setIsAuthModalOpen(true);
    setCodeSlotsStatus('idle');
    setEnteredCode('');
    await openBrowserLinkingPage();
    addToast({
      type: 'info',
      title: 'Sign In Page Opened',
      message: 'Look for your 9-digit linking code in your browser.',
    });
  };

  const handleOpenBrowserAgain = async () => {
    await openBrowserLinkingPage();
    addToast({
      type: 'info',
      title: 'Browser Opened',
      message: 'Navigated to SyncD Web linking page.',
    });
  };

  const handleCodeComplete = async (code: string) => {
    if (code.length !== 9) return;
    setCodeSlotsStatus('idle');
    const success = await exchangeLinkingCode(code);
    if (success) {
      setCodeSlotsStatus('success');
      setTimeout(() => {
        setIsAuthModalOpen(false);
        setIsCelebrationOpen(true);
        setEnteredCode('');
      }, 500);
      addToast({
        type: 'success',
        title: 'Account Linked',
        message: 'Welcome to SyncDesk!',
      });
    } else {
      setCodeSlotsStatus('error');
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const cleanCode = text.replace(/[^a-zA-Z0-9!@#$%&*?]/g, '').toUpperCase().slice(0, 9);
      if (cleanCode) {
        setEnteredCode(cleanCode);
        if (codeSlotsStatus !== 'idle') setCodeSlotsStatus('idle');
        if (cleanCode.length === 9) {
          handleCodeComplete(cleanCode);
        }
      }
    } catch (err) {
      console.warn('Could not read clipboard:', err);
    }
  };

  const handleConfirmLogout = async () => {
    setIsLogoutConfirmOpen(false);
    await logout();
    addToast({
      type: 'info',
      title: 'Signed Out',
      message: 'Switched to offline library mode. Local audio files preserved.',
    });
  };

  const handleSaveAuthToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authInputToken.trim()) return;

    await setToken(authInputToken.trim());
    setIsAuthModalOpen(false);
    setAuthInputToken('');
    addToast({
      type: 'success',
      title: 'Authenticated',
      message: 'Successfully linked SyncD account session.',
    });
  };

  const handleClearCache = () => {
    addToast({
      type: 'info',
      title: 'Cache Cleared',
      message: 'Temporary artwork cache memory cleared.',
    });
  };

  const handleSaveEndpoints = () => {
    setEndpoints(inputApiUrl.trim(), inputSocketUrl.trim());
    addToast({
      type: 'success',
      title: 'Endpoints Saved',
      message: 'Network configuration updated.',
    });
  };

  const handleTestBackend = async () => {
    setIsTestingBackend(true);
    try {
      const res = await fetch(`${inputApiUrl.trim()}/health`);
      if (res.ok) {
        addToast({
          type: 'success',
          title: 'Connected',
          message: 'SyncD backend server is online and operational.',
        });
      } else {
        addToast({
          type: 'error',
          title: 'Server Error',
          message: `Backend responded with HTTP ${res.status}.`,
        });
      }
    } catch {
      addToast({
        type: 'error',
        title: 'Connection Refused',
        message: 'Could not reach backend server at specified URL.',
      });
    } finally {
      setIsTestingBackend(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 pb-28 flex flex-col gap-8 w-full max-w-5xl select-none">
      {/* Top Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">Preferences</h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Customize playback quality, audio hardware, music folders, and interface options
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {/* 1. Account & Profile Section */}
        <section className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
            <div className="flex items-center gap-2 text-zinc-200">
              <User className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold">Account & Social Profile</h2>
            </div>
            {isAuthenticated ? (
              <Badge variant="success" className="text-[10px]">
                Connected
              </Badge>
            ) : (
              <Badge variant="neutral" className="text-[10px]">
                Guest Mode
              </Badge>
            )}
          </div>

          {isAuthenticated && user ? (
            <div className="flex items-center justify-between p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-sm text-amber-400 uppercase">
                  {user.username.slice(0, 2)}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-100">{user.username}</h3>
                  <p className="text-[11px] text-zinc-400">SyncD Social Member</p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsLogoutConfirmOpen(true)}
                className="text-xs text-red-400 hover:text-red-300 hover:border-red-500/40"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-zinc-950/70 border border-zinc-800 rounded-xl gap-4">
              <div>
                <h3 className="text-xs font-semibold text-zinc-200">Connect to SyncD</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Sign in to join social listening rooms, chat in real-time, and sync music with friends.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenAuthModal}
                className="text-xs shrink-0"
              >
                <LogIn className="w-3.5 h-3.5 mr-1.5" />
                Sign In / Connect
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between text-xs pt-1">
            <div>
              <span className="font-medium text-zinc-200 block">Social Room Presence</span>
              <span className="text-[11px] text-zinc-400">
                Broadcast online status and listening activity to members inside listening rooms
              </span>
            </div>
            <input
              type="checkbox"
              checked={socialPresence}
              onChange={(e) => setSocialPresence(e.target.checked)}
              className="accent-amber-500 w-4 h-4 cursor-pointer"
            />
          </div>
        </section>

        {/* 2. Audio Hardware & Playback Engine */}
        <section className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
            <div className="flex items-center gap-2 text-zinc-200">
              <Volume2 className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold">Audio Output & Quality</h2>
            </div>
            <Badge variant="codec" className="text-[9px]">
              WASAPI BIT-PERFECT
            </Badge>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-medium text-zinc-200 block">Sound Output Device</span>
              <span className="text-[11px] text-zinc-400">
                Direct native WASAPI output with sub-millisecond audio rendering
              </span>
            </div>

            <GlideSelect
              options={
                devices.length === 0
                  ? [{ value: 'default', label: 'Default Windows Audio Device' }]
                  : devices.map((d) => ({ value: d.id, label: d.name + (d.isDefault ? ' (Default)' : '') }))
              }
              value={selectedDevice}
              onChange={(v, opt) => {
                setSelectedDevice(v);
                addToast({
                  type: 'success',
                  title: 'Audio Device Configured',
                  message: `Output routed to ${typeof opt.label === 'string' ? opt.label : v}.`,
                });
              }}
              accentColor={activeAccentHex}
              surfaceColor="#18181b"
              size="md"
              placement="top"
              ariaLabel="Sound Output Device"
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-850">
            <div>
              <span className="font-medium text-zinc-200 block">Gapless Playback</span>
              <span className="text-[11px] text-zinc-400">
                Eliminate silence between album tracks for seamless transitions
              </span>
            </div>
            <input
              type="checkbox"
              checked={gaplessPlayback}
              onChange={(e) => setGaplessPlayback(e.target.checked)}
              className="accent-amber-500 w-4 h-4 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-850">
            <div>
              <span className="font-medium text-zinc-200 block">Auto-Queue Library Tracks</span>
              <span className="text-[11px] text-zinc-400">
                Automatically queue upcoming tracks into Up Next when playing from library or search
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoQueue}
              onChange={(e) => setAutoQueue(e.target.checked)}
              className="accent-amber-500 w-4 h-4 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-850">
            <div>
              <span className="font-medium text-zinc-200 block">Volume Normalization (ReplayGain)</span>
              <span className="text-[11px] text-zinc-400">
                Adjust loudness automatically across different music formats and albums
              </span>
            </div>
            <input
              type="checkbox"
              checked={volumeNormalization}
              onChange={(e) => setVolumeNormalization(e.target.checked)}
              className="accent-amber-500 w-4 h-4 cursor-pointer"
            />
          </div>
        </section>

        {/* 3. Music Library & Cache Management */}
        <section className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
            <div className="flex items-center gap-2 text-zinc-200">
              <Folder className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold">Local Music Library</h2>
            </div>
            {stats && (
              <span className="text-xs font-mono text-zinc-400">
                {stats.trackCount} tracks · {stats.albumCount} albums
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            SyncD indexes audio files on your computer and preserves your folders untouched.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsFolderModalOpen(true)}
              className="text-xs"
            >
              <Folder className="w-3.5 h-3.5 mr-1.5" />
              Manage Music Folders
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => startScan()}
              isLoading={isScanning}
              className="text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Rescan All Files
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Clear Album Art Cache
            </Button>
          </div>
        </section>

        {/* 4. Appearance & Theme Accents (Strict Purple Ban) */}
        <section className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
            <div className="flex items-center gap-2 text-zinc-200">
              <Palette className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold">Theme & Appearance</h2>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-medium text-zinc-200 block">Accent Palette</span>
              <span className="text-[11px] text-zinc-400">
                Curated high-contrast accents designed for calm, dark surfaces
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {[
                { id: 'amber', label: 'Warm Amber', color: '#f59e0b', ring: 'ring-[#f59e0b]' },
                { id: 'gold', label: 'Golden Sand', color: '#eab308', ring: 'ring-[#eab308]' },
                { id: 'emerald', label: 'Emerald Sound', color: '#10b981', ring: 'ring-[#10b981]' },
                { id: 'cyan', label: 'Cyber Cyan', color: '#06b6d4', ring: 'ring-[#06b6d4]' },
              ].map((accent) => {
                const isSelected = selectedAccent === accent.id;
                return (
                  <button
                    key={accent.id}
                    type="button"
                    onClick={() => {
                      setSelectedAccent(accent.id as typeof selectedAccent);
                      addToast({
                        type: 'success',
                        title: 'Theme Accent Applied',
                        message: `Switched interface palette to ${accent.label}.`,
                      });
                    }}
                    style={{ backgroundColor: accent.color }}
                    className={`w-6 h-6 rounded-full transition-all cursor-pointer relative flex items-center justify-center ${
                      isSelected
                        ? `ring-2 ring-offset-2 ring-offset-zinc-950 ${accent.ring} scale-110 shadow-sm`
                        : 'opacity-65 hover:opacity-100 hover:scale-105'
                    }`}
                    title={accent.label}
                    aria-label={accent.label}
                  >
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-850">
            <div>
              <span className="font-medium text-zinc-200 block">Desktop Track Notifications</span>
              <span className="text-[11px] text-zinc-400">
                Display a brief title and artist notification in background when playback changes
              </span>
            </div>
            <div className="flex items-center gap-3">
              {trackNotifications && (
                <button
                  type="button"
                  onClick={async () => {
                    const hasPerm = await requestNotificationPermission();
                    if (!hasPerm && typeof Notification !== 'undefined' && Notification.permission === 'denied') {
                      addToast({
                        type: 'error',
                        title: 'Permission Blocked',
                        message: 'Desktop notification permission is blocked in system settings.',
                      });
                      return;
                    }
                    const sent = showTrackNotification({
                      title: 'SyncDesk Test',
                      artist: 'Audio Output Ready',
                      album: 'Bit-Perfect Playback',
                      force: true,
                    });
                    if (sent) {
                      addToast({
                        type: 'success',
                        title: 'Test Notification Sent',
                        message: 'A desktop notification was dispatched.',
                      });
                    }
                  }}
                  className="text-[11px] text-zinc-400 hover:text-amber-400 cursor-pointer underline underline-offset-2 transition-colors"
                >
                  Test Notification
                </button>
              )}
              <input
                type="checkbox"
                checked={trackNotifications}
                onChange={async (e) => {
                  const enabled = e.target.checked;
                  await setTrackNotifications(enabled);
                  if (enabled) {
                    const granted = await requestNotificationPermission();
                    if (granted) {
                      addToast({
                        type: 'success',
                        title: 'Desktop Notifications Enabled',
                        message: 'You will receive track alerts when the app is in the background.',
                      });
                    } else {
                      addToast({
                        type: 'warning',
                        title: 'Notification Permission Needed',
                        message: 'Please allow notification permissions in your browser or desktop system.',
                      });
                    }
                  } else {
                    addToast({
                      type: 'info',
                      title: 'Notifications Disabled',
                      message: 'Track change desktop notifications turned off.',
                    });
                  }
                }}
                className="accent-amber-500 w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        </section>

        {/* 5. Advanced / Developer Accordion (Collapsed by Default) */}
        <details className="group rounded-2xl bg-zinc-900/20 border border-zinc-850/80 p-4 transition-colors">
          <summary className="flex items-center justify-between cursor-pointer list-none text-xs font-medium text-zinc-400 hover:text-zinc-200">
            <span className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-zinc-400" />
              Advanced Developer Options (Network & Server Endpoints)
            </span>
            <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
          </summary>

          <div className="pt-4 mt-3 border-t border-zinc-850 flex flex-col gap-4 text-xs">
            <p className="text-[11px] text-zinc-400">
              Configure backend network endpoints for local testing or custom deployment origins.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-400 font-mono text-[11px] block mb-1">REST API URL</label>
                <input
                  type="text"
                  value={inputApiUrl}
                  onChange={(e) => setInputApiUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 font-mono text-[11px] block mb-1">Socket.IO URL</label>
                <input
                  type="text"
                  value={inputSocketUrl}
                  onChange={(e) => setInputSocketUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestBackend}
                isLoading={isTestingBackend}
                className="text-xs"
              >
                Test Connectivity
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveEndpoints}
                className="text-xs"
              >
                Apply Overrides
              </Button>
            </div>
          </div>
        </details>

        {/* 6. Application & System Updates */}
        <section className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
            <div className="flex items-center gap-2 text-zinc-200">
              <ArrowUpCircle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold">Application & Updates</h2>
            </div>
            <Badge variant="codec" className="text-[9px]">
              TAURI NSIS UPDATER
            </Badge>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-medium text-zinc-200 block">Installed Version</span>
              <span className="text-[11px] text-zinc-400 font-mono">
                v{updater.currentVersion} (SyncDesk)
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => updater.checkForUpdates(false)}
              disabled={updater.status === 'checking' || updater.status === 'downloading' || updater.status === 'installing'}
              className="text-xs flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${updater.status === 'checking' ? 'animate-spin' : ''}`} />
              {updater.status === 'checking' ? 'Checking…' : 'Check for Updates'}
            </Button>
          </div>

          {/* State: Up to date */}
          {updater.status === 'upToDate' && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>SyncDesk is currently up to date (v{updater.currentVersion}).</span>
            </div>
          )}

          {/* State: Update available / downloading / installing */}
          {(updater.status === 'available' || updater.status === 'downloading' || updater.status === 'installing') && (
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400 font-medium text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>New Version Available: v{updater.newVersion}</span>
                </div>
                {updater.releaseDate && (
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {new Date(updater.releaseDate).toLocaleDateString()}
                  </span>
                )}
              </div>

              {updater.releaseNotes && (
                <div className="text-xs text-zinc-300 max-h-24 overflow-y-auto whitespace-pre-wrap p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800/80 font-mono text-[11px]">
                  {updater.releaseNotes}
                </div>
              )}

              {updater.status === 'downloading' && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>Downloading release package…</span>
                    <span className="font-semibold text-amber-400">{updater.downloadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-200"
                      style={{ width: `${updater.downloadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {updater.status === 'installing' && (
                <div className="flex items-center gap-2 text-amber-400 text-xs py-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Installing update and relaunching SyncD…</span>
                </div>
              )}

              {updater.status === 'available' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={updater.downloadAndInstall}
                  className="text-xs flex items-center justify-center gap-2 w-full sm:w-auto self-start"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download and Install v{updater.newVersion}
                </Button>
              )}
            </div>
          )}

          {/* State: Error */}
          {updater.status === 'error' && updater.errorMessage && (
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="line-clamp-2">{updater.errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={updater.resetStatus}
                className="text-[11px] underline shrink-0 hover:text-red-300 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}
        </section>

        {/* 7. Application Footer */}
        <div className="flex items-center justify-between text-xs text-zinc-400 px-1 pt-2">
          <span>SyncDesk v{appInfo?.version || updater.currentVersion || '0.0.1'}</span>
        </div>
      </div>

      {/* Music Folder Manager Modal */}
      <FolderManagerModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
      />

      {/* Confirm Sign-Out Dialog */}
      <ConfirmDialog
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleConfirmLogout}
        title="Sign Out of SyncD"
        description="Are you sure you want to sign out? Your social listening session will end, but your indexed music library and playlists will remain completely untouched."
        confirmLabel="Sign Out"
        isDestructive={true}
      />

      {/* Modern 9-Character Code Linking Modal */}
      <Modal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setCodeSlotsStatus('idle');
        }}
        title="Connect SyncD Account"
        description="Enter the 9-character code displayed in your browser to link your desktop app."
        maxWidth="lg"
      >
        <div className="flex flex-col gap-4 pt-1">
          {/* Step 1: Browser Info Banner */}
          <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <ExternalLink className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-100">Step 1: Sign in via browser</p>
                <p className="text-[11px] text-zinc-400">
                  A verification window was opened in your default browser.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenBrowserAgain}
              className="text-[11px] shrink-0"
            >
              Reopen Browser
            </Button>
          </div>

          {/* Step 2: 9-Character Code Entry with CodeSlots */}
          <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col items-center text-center gap-3.5">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Step 2: Enter Linking Code</h3>
              <p className="text-xs text-zinc-400 mt-0.5 max-w-sm">
                Type or paste the 9-character code displayed on your browser screen.
              </p>
            </div>

            <div className="py-2.5 flex items-center justify-center w-full">
              <CodeSlots
                length={9}
                value={enteredCode}
                autoFocus
                slotSize={38}
                gap={6}
                radius={8}
                accentColor={activeAccentHex}
                status={codeSlotsStatus}
                onChange={(code) => {
                  setEnteredCode(code);
                  if (codeSlotsStatus !== 'idle') setCodeSlotsStatus('idle');
                }}
                onComplete={handleCodeComplete}
                disabled={isAuthenticating}
              />
            </div>

            {/* Paste from Clipboard Helper Button */}
            <div className="flex items-center justify-center pt-0.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePasteFromClipboard}
                disabled={isAuthenticating}
                className="text-[11px] text-zinc-300 hover:text-amber-400 hover:border-amber-500/40"
              >
                <Clipboard className="w-3.5 h-3.5 mr-1.5" />
                Paste Code from Clipboard
              </Button>
            </div>

            {isAuthenticating && (
              <div className="flex items-center gap-2 text-xs text-amber-400 font-medium animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Verifying code with SyncD server...</span>
              </div>
            )}

            {authError && (
              <div className="text-xs text-red-400 font-medium bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg max-w-sm">
                {authError}
              </div>
            )}

            <p className="text-[11px] text-zinc-500">
              Codes expire after 2 minutes for your security.
            </p>
          </div>

          {/* Secondary Developer Manual Token Fallback */}
          <div className="border-t border-zinc-800/80 pt-2">
            <button
              type="button"
              onClick={() => setShowManualToken(!showManualToken)}
              className="text-[11px] text-zinc-500 hover:text-zinc-400 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>{showManualToken ? 'Hide manual token input' : 'Developer: Enter manual token'}</span>
            </button>

            {showManualToken && (
              <form onSubmit={handleSaveAuthToken} className="flex flex-col gap-3 pt-3">
                <div>
                  <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                    Direct JWT Session Token
                  </label>
                  <input
                    type="password"
                    placeholder="Paste session token..."
                    value={authInputToken}
                    onChange={(e) => setAuthInputToken(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={!authInputToken.trim()}
                    className="text-xs"
                  >
                    Connect Manual Token
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </Modal>

      {/* Celebratory Confirmation Modal */}
      <Modal
        isOpen={isCelebrationOpen}
        onClose={() => setIsCelebrationOpen(false)}
        title="Account Linked"
        maxWidth="sm"
      >
        <div className="flex flex-col items-center text-center gap-4 py-2">
          <div className="py-2 flex items-center justify-center">
            <AnimatedCheckmark size={64} />
          </div>

          <div>
            <h3 className="text-base font-bold text-zinc-100">
              Welcome, @{user?.username || 'listener'}!
            </h3>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed max-w-xs">
              Your SyncD account is securely connected. You can now host rooms, sync YouTube audio, and chat with friends while your local music collection remains completely safe.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsCelebrationOpen(false)}
            className="w-full text-xs font-semibold mt-1"
          >
            Start Listening
          </Button>
        </div>
      </Modal>
    </div>
  );
}
