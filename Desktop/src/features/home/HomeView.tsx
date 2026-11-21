import { useEffect } from 'react';
import {
  FolderPlus,
  ArrowRight,
  Radio,
  Headphones,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useAppStore } from '../../stores/useAppStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useToastStore } from '../../stores/useToastStore';
import { SplitText } from '../../components/ui/SplitText';
import { TrackCard } from '../library/components/TrackCard';
import { TrackCardSkeleton } from '../library/components/TrackCardSkeleton';
import { isTauri } from '../../services/tauriBridge';

export function HomeView() {
  const { setCurrentView } = useAppStore();
  const { tracks, isLoading, loadTracks, addFolder } = useLibraryStore();
  const { addToast } = useToastStore();

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  const handleImportFolder = async () => {
    if (!isTauri()) {
      addToast({
        type: 'info',
        title: 'Desktop Native Feature',
        message: 'Folder indexing runs inside the native desktop application.',
      });
      return;
    }

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Music Folder to Index',
      });

      if (selected && typeof selected === 'string') {
        await addFolder(selected);
        addToast({
          type: 'success',
          title: 'Music Folder Added',
          message: `Indexing audio files in "${selected}"...`,
        });
      }
    } catch (err: unknown) {
      console.error('Failed to select folder:', err);
      addToast({
        type: 'error',
        title: 'Import Failed',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const hasTracks = tracks.length > 0;
  const recentTracks = tracks.slice(0, 4);

  return (
    <div
      className={`flex-1 overflow-y-auto text-zinc-100 flex flex-col select-none relative scrollbar-thin ${
        !hasTracks ? 'h-full' : ''
      }`}
    >
      {/* ADAPTIVE HERO: Fills the entire screen when empty; compacts when tracks exist */}
      <section
        className={`relative flex flex-col items-center justify-center text-center px-6 transition-all duration-300 overflow-hidden ${
          hasTracks
            ? 'min-h-[440px] py-16 border-b border-zinc-900/80 bg-transparent'
            : 'flex-1 min-h-full py-16 border-b-0 bg-transparent'
        }`}
      >
        {/* Subtle ambient luxury backlight glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full bg-amber-500/[0.04] blur-3xl pointer-events-none" />

        {/* Centered Astra Brand Title */}
        <div className="relative z-10 flex flex-col items-center max-w-3xl">
          <SplitText
            text="SyncD"
            tag="h1"
            className="text-5xl sm:text-6xl font-black tracking-[0.22em] uppercase drop-shadow-2xl"
            charClassName={(char, idx) => (idx === 4 || char === 'D' ? 'text-amber-500' : 'text-white')}
            delay={70}
            duration={0.6}
            initialY={28}
          />

          <p className="mt-4 text-sm sm:text-base text-zinc-400 max-w-xl font-light tracking-wide leading-relaxed">
            The next dimension of music. Discover, create, and connect in a universe built for sound.
          </p>

          {/* Action Row */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={() => setCurrentView('library')}
              className="px-6 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs tracking-wider uppercase transition-all duration-200 cursor-pointer shadow-lg hover:shadow-zinc-200/20 active:scale-95 flex items-center gap-2"
            >
              <span>Explore Catalogue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setCurrentView('rooms')}
              className="glass-btn px-6 py-2.5 text-zinc-100 font-medium text-xs tracking-wider uppercase cursor-pointer active:scale-95 flex items-center gap-2 shadow-md"
            >
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              <span>Join Social Room</span>
            </button>

            <button
              type="button"
              onClick={handleImportFolder}
              className="glass-btn px-5 py-2.5 text-zinc-200 font-medium text-xs tracking-wide cursor-pointer active:scale-95 flex items-center gap-2 shadow-md"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Import Music</span>
            </button>
          </div>
        </div>
      </section>

      {/* CONSUMER MUSIC SECTIONS: Only shown when audio tracks are indexed */}
      {tracks.length > 0 && (
        <div className="max-w-6xl w-full mx-auto px-8 py-10 pb-28 flex flex-col gap-10">
          {/* JUMP BACK IN / RECENT TRACKS */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-200">
                  Jump Back In
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCurrentView('library')}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>View all ({tracks.length})</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {isLoading && recentTracks.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <TrackCardSkeleton key={`home-skel-${i}`} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {recentTracks.map((track) => (
                  <TrackCard key={track.id} track={track} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
