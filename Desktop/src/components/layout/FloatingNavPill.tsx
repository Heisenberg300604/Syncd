import React from 'react';
import { Keyboard } from 'lucide-react';
import { useAppStore, type NavigationDestination } from '../../stores/useAppStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
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

export interface FloatingNavPillProps {
  onOpenShortcuts?: () => void;
}

export const FloatingNavPill: React.FC<FloatingNavPillProps> = ({ onOpenShortcuts }) => {
  const { currentView, setCurrentView } = useAppStore();
  const { stats, tracks, hasUnscannedAudio, isScanning } = useLibraryStore();
  const trackCount = stats?.trackCount || tracks.length;

  return (
    <nav
      aria-label="Main Navigation Pill"
      className="flex items-center gap-1 p-1 rounded-full bg-zinc-950/85 backdrop-blur-xl border border-zinc-800/80 shadow-[0_12px_36px_rgba(0,0,0,0.65)] select-none transition-all duration-200"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setCurrentView(item.id)}
            title={item.label}
            className={[
              'group relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer',
              isActive
                ? 'bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/35 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850/70 border border-transparent',
            ].join(' ')}
          >
            <AnimatedNavIcon
              name={item.iconName}
              isActive={isActive}
              className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                isActive ? 'text-amber-400' : 'text-zinc-400 group-hover:text-amber-400'
              }`}
            />
            <span className="truncate">{item.label}</span>

            {/* Unscanned audio alert dot */}
            {item.id === 'library' && hasUnscannedAudio && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"
                title="New audio pending scan"
              />
            )}

            {/* Track count badge */}
            {item.id === 'library' && trackCount > 0 && (
              <span
                className={`px-1.5 py-0.2 text-[9px] font-mono font-medium rounded-full shrink-0 transition-colors ${
                  isActive
                    ? 'bg-amber-500/25 text-amber-400 border border-amber-500/35'
                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800/80 group-hover:text-amber-400'
                }`}
              >
                <CountUp to={trackCount} from={0} duration={1.2} startWhen={!isScanning} />
              </span>
            )}
          </button>
        );
      })}

      {/* Keyboard Shortcuts Trigger */}
      {onOpenShortcuts && (
        <>
          <div className="w-px h-4 bg-zinc-800/80 mx-0.5 shrink-0" />
          <button
            type="button"
            onClick={onOpenShortcuts}
            title="Keyboard Shortcuts (?)"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850/70 text-xs font-medium transition-all cursor-pointer group"
          >
            <Keyboard className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 transition-colors" />
            <kbd className="text-[9px] font-mono bg-zinc-900 text-zinc-500 group-hover:text-amber-400 px-1 rounded border border-zinc-800 transition-colors">
              ?
            </kbd>
          </button>
        </>
      )}
    </nav>
  );
};
