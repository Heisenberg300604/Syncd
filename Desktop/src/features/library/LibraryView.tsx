import React, { useEffect, useState, useMemo } from 'react';
import {
  FolderPlus,
  Search,
  RefreshCw,
  FolderSearch,
  SlidersHorizontal,
  ArrowUpDown,
  List,
  LayoutGrid,
} from 'lucide-react';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { Button } from '../../components/ui/Button';
import { FolderManagerModal } from './components/FolderManagerModal';
import { TrackTable } from './components/TrackTable';
import { TrackCard } from './components/TrackCard';
import { TrackCardSkeleton } from './components/TrackCardSkeleton';
import { AlbumCard } from './components/AlbumCard';
import { AlbumDetailModal } from './components/AlbumDetailModal';
import { AlbumSectionList } from './components/AlbumSectionList';
import { groupTracksByAlbum, type AlbumGroup } from '../../types/album';
import { RubberSegment } from '../../components/ui/RubberSegment';

export const LibraryView: React.FC = () => {
  const {
    tracks,
    folders,
    stats,
    isLoading,
    isScanning,
    hasUnscannedAudio,
    searchQuery,
    sortBy,
    sortOrder,
    viewMode,
    setViewMode,
    loadFolders,
    loadTracks,
    loadStats,
    searchTracks,
    startScan,
    setSort,
    setupEventListeners,
  } = useLibraryStore();

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumGroup | null>(null);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const albumGroups = useMemo(() => {
    if (sortBy !== 'album') return [];
    return groupTracksByAlbum(tracks, localSearch, sortOrder);
  }, [tracks, sortBy, localSearch, sortOrder]);

  // Setup background event listeners on mount
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    setupEventListeners().then((fn) => {
      unlisten = fn;
    });

    loadFolders();
    loadTracks();
    loadStats();

    return () => {
      if (unlisten) unlisten();
    };
  }, [loadFolders, loadTracks, loadStats, setupEventListeners]);

  // Handle debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchTracks(localSearch);
    }, 200);

    return () => clearTimeout(timer);
  }, [localSearch, searchTracks]);

  const handleToggleSortOrder = () => {
    setSort(sortBy, sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const handleSortChange = (newSortBy: 'title' | 'artist' | 'album' | 'duration' | 'year') => {
    if (sortBy === newSortBy) {
      handleToggleSortOrder();
    } else {
      setSort(newSortBy, 'asc');
    }
  };

  const hasNoFolders = folders.length === 0;

  return (
    <div className="flex-1 overflow-y-auto flex flex-col select-none">
      {/* Header Bar */}
      <div className="p-6 pb-4 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
              <span>Music Library</span>
              {folders.length > 0 && stats && (
                <span className="text-xs font-normal text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-full font-mono">
                  {sortBy === 'album'
                    ? `${albumGroups.length} ${albumGroups.length === 1 ? 'album' : 'albums'} (${stats.trackCount} tracks)`
                    : `${stats.trackCount} tracks`}
                </span>
              )}
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Your local music collection
            </p>
          </div>

          {/* Right Controls: RubberSegment Card/List Toggle + Icon-Only Rescan & Add Folder */}
          <div className="flex items-center gap-2">
            {/* RubberSegment View Toggle */}
            <RubberSegment
              items={[
                {
                  value: 'list',
                  label: 'List',
                  icon: <List className="w-3.5 h-3.5" />,
                },
                {
                  value: 'grid',
                  label: 'Cards',
                  icon: <LayoutGrid className="w-3.5 h-3.5" />,
                },
              ]}
              value={viewMode}
              onChange={(val) => setViewMode(val as 'list' | 'grid')}
              size="sm"
              trackColor="#18181b"
              thumbColor="#f59e0b"
              textColor="#a1a1aa"
              activeTextColor="#09090b"
              radius={9999}
              className="border border-zinc-800"
            />

            {/* Rescan Button (Icon Only) */}
            <button
              type="button"
              onClick={() => startScan()}
              disabled={isScanning || hasNoFolders}
              title={hasUnscannedAudio ? "New audio detected — click to scan" : "Rescan library"}
              className="relative w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-amber-400 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-amber-500' : ''}`} />
              {hasUnscannedAudio && !isScanning && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 animate-pulse border border-zinc-950" />
              )}
            </button>

            {/* Add Folder Button (Icon Only) */}
            <button
              type="button"
              onClick={() => setIsFolderModalOpen(true)}
              title="Add music folder"
              className="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter by title, artist, album, genre... (Ctrl+K)"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8.5 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-hidden focus:border-amber-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider">
              <SlidersHorizontal className="w-3 h-3" />
              Sort:
            </span>

            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
              {(['title', 'artist', 'album', 'duration', 'year'] as const).map((key) => {
                const isActive = sortBy === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleSortChange(key)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium capitalize transition-colors ${
                      isActive
                        ? 'bg-zinc-800 text-amber-400 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {key}
                  </button>
                );
              })}

              <button
                onClick={handleToggleSortOrder}
                className="px-2 py-1 text-zinc-400 hover:text-amber-400 border-l border-zinc-800 ml-0.5 transition-colors"
                title={`Order: ${sortOrder.toUpperCase()}`}
              >
                <ArrowUpDown className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-6 pb-28">
        {hasNoFolders ? (
          <div className="min-h-[420px] rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 flex flex-col items-center justify-center p-8 text-center mt-2">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-500 mb-4 shadow-inner">
              <FolderSearch className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-1">No Music Folders Indexed Yet</h3>
            <p className="text-xs text-zinc-400 max-w-sm mb-5 leading-relaxed">
              SyncD scans and indexes audio tags locally into high-performance SQLite without altering or moving your files. Add a music directory to get started.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsFolderModalOpen(true)}
              className="text-xs px-5 py-2.5 h-auto inline-flex items-center justify-center gap-2 shadow-md shadow-amber-500/10"
            >
              <FolderPlus className="w-4 h-4 shrink-0" />
              <span>Select Folder to Index</span>
            </Button>
          </div>
        ) : isLoading && tracks.length === 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 mt-2 pb-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <TrackCardSkeleton key={`lib-skel-${i}`} />
              ))}
            </div>
          ) : (
            <TrackTable tracks={[]} isLoading={true} />
          )
        ) : tracks.length === 0 ? (
          <div className="min-h-[300px] flex flex-col items-center justify-center p-8 text-center">
            <p className="text-sm font-medium text-zinc-300">No audio tracks found</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              Indexed directories contain no supported audio files.
            </p>
          </div>
        ) : sortBy === 'album' ? (
          albumGroups.length === 0 ? (
            <div className="min-h-[300px] flex flex-col items-center justify-center p-8 text-center">
              <p className="text-sm font-medium text-zinc-300">No albums found</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                No albums match the current search filter.
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 mt-2 pb-6">
              {albumGroups.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  onOpenDetail={(a) => setSelectedAlbum(a)}
                />
              ))}
            </div>
          ) : (
            <AlbumSectionList albumGroups={albumGroups} />
          )
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 mt-2 pb-6">
            {tracks.map((track) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </div>
        ) : (
          <TrackTable tracks={tracks} isLoading={isLoading} />
        )}
      </div>

      {/* Album Detail Modal */}
      <AlbumDetailModal
        isOpen={Boolean(selectedAlbum)}
        album={selectedAlbum}
        onClose={() => setSelectedAlbum(null)}
      />

      {/* Folder Manager Modal */}
      <FolderManagerModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
      />
    </div>
  );
};
