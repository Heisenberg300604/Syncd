import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Music,
  Users,
  FolderPlus,
  ArrowRight,
  Play,
  X,
  Volume2,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../../stores/useAppStore";
import { useLibraryStore } from "../../stores/useLibraryStore";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { useToastStore } from "../../stores/useToastStore";
import { isTauri } from "../../services/tauriBridge";
import type { TrackRow } from "../../types/library";
import { CodecBadge } from "../ui/CodecBadge";
import "./GlobalSearchModal.css";

export interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { setCurrentView } = useAppStore();
  const { tracks, addFolder } = useLibraryStore();
  const { playTrack, currentTrack } = usePlayerStore();
  const { addToast } = useToastStore();

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredTracks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return tracks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [tracks, query]);

  const handleSelectView = (view: "library" | "rooms") => {
    setCurrentView(view);
    onClose();
  };

  const handlePlayFoundTrack = async (track: TrackRow) => {
    const queueTracks = tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      durationSeconds: t.durationSeconds,
      source: "local" as const,
      path: t.path,
      format: t.format,
      bitrateKbps: t.bitrateKbps ?? undefined,
    }));

    await playTrack(
      {
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        durationSeconds: track.durationSeconds,
        source: "local",
        path: track.path,
        format: track.format,
        bitrateKbps: track.bitrateKbps ?? undefined,
      },
      queueTracks
    );
    onClose();
  };

  const handleImportMusic = async () => {
    if (!isTauri()) {
      addToast({
        type: "info",
        title: "Desktop Native Feature",
        message: "Folder indexing runs inside the native desktop application.",
      });
      return;
    }

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Music Folder to Index",
      });

      if (selected && typeof selected === "string") {
        await addFolder(selected);
        addToast({
          type: "success",
          title: "Music Folder Added",
          message: `Indexing audio files in "${selected}"...`,
        });
        onClose();
      }
    } catch (err: unknown) {
      console.error("Failed to select folder:", err);
      addToast({
        type: "error",
        title: "Import Failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none animate-in fade-in duration-150"
    >
      {/* Click outside backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Redesigned Glass Card Panel Container */}
      <div className="search-glass-panel relative z-10 w-full animate-in zoom-in-95 duration-150 shadow-2xl">
        {/* Search Input Bar */}
        <div className="p-4.5 border-b border-white/10 flex items-center gap-3 bg-white/[0.03]">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-xs">
            <Search className="w-4 h-4" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracks, albums, artists, or social room codes..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden font-normal tracking-wide"
          />

          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="text-[10px] font-mono text-zinc-400 bg-white/10 px-2 py-0.5 rounded-md border border-white/15 shadow-2xs">
              ESC
            </kbd>
          )}
        </div>

        {/* Content Area: Search Results or Quick Actions */}
        <div className="p-3.5 flex flex-col gap-2 max-h-[380px] overflow-y-auto scrollbar-thin">
          {query.trim().length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div className="px-2 py-1 text-[10px] font-bold text-amber-400/90 uppercase tracking-widest flex items-center justify-between">
                <span>Matching Indexed Audio ({filteredTracks.length})</span>
                <span className="text-zinc-500 lowercase font-normal">click to play</span>
              </div>

              {filteredTracks.length > 0 ? (
                filteredTracks.map((track) => {
                  const isCurrent = currentTrack?.id === track.id;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => handlePlayFoundTrack(track)}
                      className={`search-action-tile w-full flex items-center justify-between p-2.5 rounded-xl text-left cursor-pointer group ${
                        isCurrent ? "border-amber-500/50 bg-amber-500/10" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                            isCurrent
                              ? "bg-amber-500 text-zinc-950 border-amber-400 shadow-xs"
                              : "bg-white/10 text-zinc-300 border-white/15 group-hover:bg-amber-500/20 group-hover:text-amber-400 group-hover:border-amber-500/40"
                          }`}
                        >
                          {isCurrent ? (
                            <Volume2 className="w-4 h-4 animate-pulse" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-100 truncate group-hover:text-amber-300 transition-colors">
                            {track.title}
                          </p>
                          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {track.artist} • {track.album}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {track.format && (
                          <CodecBadge
                            format={track.format}
                            bitrateKbps={track.bitrateKbps}
                            size="xs"
                          />
                        )}
                        <span className="text-[11px] font-mono text-zinc-400">
                          {Math.floor(track.durationSeconds / 60)}:
                          {(track.durationSeconds % 60).toString().padStart(2, "0")}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-8 px-4 text-center flex flex-col items-center justify-center gap-2 text-zinc-400">
                  <Music className="w-6 h-6 text-zinc-600" />
                  <p className="text-xs font-medium text-zinc-300">
                    No indexed tracks match &ldquo;{query}&rdquo;
                  </p>
                  <p className="text-[11px] text-zinc-500 max-w-xs">
                    Try searching by artist or album name, or browse your full library.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelectView("library")}
                    className="mt-2 text-xs text-amber-400 hover:text-amber-300 font-medium underline underline-offset-4 cursor-pointer"
                  >
                    Go to Music Library &rarr;
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Default Quick Actions with Glass Tiles */
            <div className="flex flex-col gap-2">
              <div className="px-2 py-0.5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Quick Navigation & Actions
              </div>

              <button
                type="button"
                onClick={() => handleSelectView("library")}
                className="search-action-tile w-full flex items-center justify-between p-3 rounded-xl text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors">
                      Search in Local Library
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      Query indexed audio tracks in SQLite FTS5 database
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </button>

              <button
                type="button"
                onClick={() => handleSelectView("rooms")}
                className="search-action-tile w-full flex items-center justify-between p-3 rounded-xl text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors">
                      Search Social Rooms
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      Find listening rooms by 6-character room code
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
              </button>

              <button
                type="button"
                onClick={handleImportMusic}
                className="search-action-tile w-full flex items-center justify-between p-3 rounded-xl text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 group-hover:scale-105 transition-transform">
                    <FolderPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-100 group-hover:text-sky-400 transition-colors">
                      Index Local Music Directory
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      Scan audio files into high-speed SQLite catalogue
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2.5 bg-black/40 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="font-mono text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-zinc-400 border border-white/10">
                ↵
              </kbd>
              <span>Select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-zinc-400 border border-white/10">
                ESC
              </kbd>
              <span>Close</span>
            </span>
          </div>
          <span className="text-[10px] text-zinc-500">SyncD Fast Search</span>
        </div>
      </div>
    </div>
  );
};
