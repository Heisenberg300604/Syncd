import { useState, useEffect } from 'react';
import { useAppStore, type NavigationDestination } from '../../stores/useAppStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { AppLogo } from '../ui/AppLogo';
import { AnimatedNavIcon, type NavIconType } from '../ui/animated-icons';
import { CountUp } from '../ui/CountUp';

interface NavItem {
  id: NavigationDestination;
  label: string;
  iconName: NavIconType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', iconName: 'home' },
  { id: 'library', label: 'Library', iconName: 'library' },
  { id: 'playlists', label: 'Playlists', iconName: 'playlists' },
  { id: 'rooms', label: 'Social Rooms', iconName: 'rooms' },
  { id: 'settings', label: 'Settings', iconName: 'settings' },
];

export function Sidebar() {
  const { currentView, setCurrentView } = useAppStore();
  const { user, isAuthenticated } = useAuthStore();
  const { stats, tracks, hasUnscannedAudio, isScanning } = useLibraryStore();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const trackCount = stats?.trackCount || tracks.length;

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

  return (
    <aside className="w-full h-full bg-zinc-950/80 backdrop-blur-xl border-r border-zinc-800/60 flex flex-col pb-3 select-none shrink-0">
      {/* Brand Header & Top-Left Account Info */}
      <div className="px-3 pt-3 pb-3 border-b border-zinc-800/60 flex flex-col gap-2.5">
        <div className="px-1">
          <AppLogo size={24} showWordmark badge="Desktop" />
        </div>

        {/* Account Info (Top Left) */}
        {isAuthenticated && user ? (
          <button
            type="button"
            onClick={() => setCurrentView('settings')}
            title="Account Settings"
            className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-900/60 hover:bg-zinc-900 transition-all cursor-pointer border border-zinc-800/70 hover:border-zinc-700 group text-left w-full"
          >
            <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-amber-400 text-xs shrink-0 uppercase group-hover:scale-105 transition-transform">
              {user.username ? user.username.slice(0, 2) : 'ME'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-200 truncate group-hover:text-amber-400 transition-colors">
                {user.username}
              </p>
              <p className="text-[10px] text-zinc-500 flex items-center gap-1.5 font-medium">
                <span
                  className={`w-1.5 h-1.5 rounded-full inline-block ${
                    isOnline
                      ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                      : 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)] animate-pulse'
                  }`}
                />
                {isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrentView('settings')}
            title="Sign In / Connect"
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800/60 hover:border-amber-500/40 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer group w-full"
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 group-hover:bg-amber-400 transition-colors" />
              <span>Guest Mode</span>
            </div>
            <span className="text-[10px] text-amber-400 font-semibold group-hover:underline">
              Sign In &rarr;
            </span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-2 pt-3 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentView(item.id)}
              className={[
                'group flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-medium transition-all duration-150 cursor-pointer text-left w-full',
                isActive
                  ? 'bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60 border border-transparent',
              ].join(' ')}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <AnimatedNavIcon
                  name={item.iconName}
                  isActive={isActive}
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-amber-400' : 'text-zinc-500 group-hover:text-amber-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
                {item.id === 'library' && hasUnscannedAudio && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5 shrink-0" title="New audio pending scan" />
                )}
              </div>

              {/* Clean Track Count Badge on Library button */}
              {item.id === 'library' && trackCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-full shrink-0 transition-colors ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-zinc-900 text-zinc-500 border border-zinc-800/80 group-hover:text-amber-400 group-hover:border-amber-500/30'
                  }`}
                >
                  <CountUp to={trackCount} from={0} duration={1.2} startWhen={!isScanning} />
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
