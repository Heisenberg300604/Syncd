import React, { useEffect, useState, useRef } from 'react';
import {
  Users,
  LogIn,
  Plus,
  Copy,
  Check,
  Crown,
  LogOut,
  Clock,
  AlertTriangle,
  Search,
  PlusCircle,
  Play,
  Music2,
  ListOrdered,
  MessageSquare,
  MessageCircle,
  Zap,
  X,
  Loader2,
} from 'lucide-react';
import { useRoomStore } from '../../stores/useRoomStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAppStore } from '../../stores/useAppStore';
import { useToastStore } from '../../stores/useToastStore';
import { apiClient } from '../../services/apiClient';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Badge } from '../../components/ui/Badge';
import { YouTubeRoomPlayer } from './components/YouTubeRoomPlayer';
import CodeSlots from '../../components/ui/CodeSlots';
import { useSettingsStore } from '../../stores/useSettingsStore';

export const RoomsView: React.FC = () => {
  const isTopbar = useSettingsStore((s) => s.navLayout) === 'topbar';
  const {
    activeRoom,
    members,
    isHost,
    hostPendingDeadline,
    isLoading,
    error,
    createAndJoinRoom,
    joinRoom,
    leaveRoom,
    setTrack,
    addToQueue,
    bindSocketEvents,
    chatMessages,
  } = useRoomStore();

  const { user, isAuthenticated } = useAuthStore();
  const { setCurrentView, isDrawerOpen, drawerTab, toggleDrawer } = useAppStore();
  const { addToast } = useToastStore();

  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [copied, setCopied] = useState(false);

  // Social YouTube Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ videoId: string; title: string; thumbnailUrl: string; duration: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const unbind = bindSocketEvents();
    return () => {
      unbind();
    };
  }, [bindSocketEvents]);

  const handleCopyCode = async () => {
    if (!activeRoom) return;
    try {
      await navigator.clipboard.writeText(activeRoom.roomCode);
      setCopied(true);
      addToast({
        type: 'success',
        title: 'Room Code Copied',
        message: `Share code "${activeRoom.roomCode}" with friends.`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCreateRoom = async () => {
    if (!isAuthenticated) {
      addToast({
        type: 'warning',
        title: 'Sign In Required',
        message: 'Link your SyncD account in Settings to host social listening rooms.',
      });
      setCurrentView('settings');
      return;
    }

    try {
      const code = await createAndJoinRoom();
      addToast({
        type: 'success',
        title: 'Room Created',
        message: `Created room ${code} as host.`,
      });
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Failed to Create Room',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;

    const success = await joinRoom(roomCodeInput);
    if (success) {
      setIsJoinModalOpen(false);
      setRoomCodeInput('');
      addToast({
        type: 'success',
        title: 'Joined Room',
        message: 'Connected to listening room session.',
      });
    } else {
      addToast({
        type: 'error',
        title: 'Could Not Join Room',
        message: error || 'Invalid room code.',
      });
    }
  };

  const handleYouTubeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await apiClient.searchYouTube(searchQuery.trim());
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePlayNow = async (track: { videoId: string; title: string; thumbnailUrl: string; duration: string }) => {
    await setTrack(track);
    addToast({
      type: 'success',
      title: 'Playing in Room',
      message: `Now playing "${track.title}" for all members.`,
    });
  };

  const handleAddQueue = async (track: { videoId: string; title: string; thumbnailUrl: string; duration: string }) => {
    await addToQueue({
      videoId: track.videoId,
      title: track.title,
      thumbnailUrl: track.thumbnailUrl,
      duration: track.duration,
      addedBy: user?.username || 'Host',
    });
    addToast({
      type: 'info',
      title: 'Added to Room Queue',
      message: `"${track.title}" queued.`,
    });
  };

  // Inside Active Listening Room
  if (activeRoom) {
    return (
      <div className="flex-1 overflow-y-auto w-full select-none scrollbar-thin">
        <div
          className={`w-full max-w-6xl mx-auto ${
            isTopbar ? 'pt-20 px-6 sm:px-10 lg:px-12' : 'p-8'
          } pb-28 flex flex-col gap-6 transition-all duration-200`}
        >
          {/* Active Room Top Bar */}
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 p-3.5 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/80 rounded-2xl relative z-40 shadow-md">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Users className="w-4 h-4" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
                  Listening Room
                </span>
                <Badge variant="amber" className="font-mono text-xs tracking-wider px-2 py-0.5 font-bold">
                  {activeRoom.roomCode}
                </Badge>
                <button
                  onClick={handleCopyCode}
                  className="p-1 text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer"
                  title="Copy room code"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {members.filter((m) => m.online).length} {members.filter((m) => m.online).length === 1 ? 'listener' : 'listeners'} active in room
              </p>
            </div>
          </div>

          {/* YouTube Track Finder Search Pill (Embedded in Listening Room Panel) */}
          {isHost ? (
            <div className="relative z-50 flex-1 min-w-[200px] max-w-md mx-2 order-3 lg:order-2 w-full lg:w-auto" ref={searchDropdownRef}>
              <form onSubmit={handleYouTubeSearch} className="flex items-center">
                <div className="w-full flex items-center gap-2 bg-zinc-950/90 border border-zinc-800 hover:border-zinc-700 focus-within:border-amber-500/80 focus-within:ring-2 focus-within:ring-amber-500/20 rounded-full pl-3.5 pr-1.5 py-1 transition-all shadow-inner">
                  <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search songs or paste YouTube link..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden selection:bg-amber-500/30 min-w-0"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                      className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!searchQuery.trim() || isSearching}
                    className="px-3 py-1 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-zinc-950 font-bold text-[11px] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-sm flex items-center gap-1"
                  >
                    {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>Search</span>}
                  </button>
                </div>
              </form>

              {/* Floating Results Popover Dropdown (Clean, borderless glass design) */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 p-1.5 bg-zinc-950/95 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl z-50 flex flex-col gap-1 max-h-80 overflow-y-auto">
                  <div className="flex items-center justify-between px-2.5 py-1.5 text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                    <span>Search Results ({searchResults.length})</span>
                    <button
                      type="button"
                      onClick={() => setSearchResults([])}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer text-xs"
                    >
                      Close
                    </button>
                  </div>
                  {searchResults.map((res) => (
                    <div
                      key={res.videoId}
                      className="p-2 rounded-xl bg-zinc-900/40 hover:bg-zinc-900 flex items-center justify-between gap-3 group transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={res.thumbnailUrl}
                          alt={res.title}
                          className="w-12 h-8 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs text-zinc-200 font-medium truncate group-hover:text-amber-300 transition-colors">{res.title}</p>
                          <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{res.duration}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            handlePlayNow(res);
                            setSearchResults([]);
                          }}
                          className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-400 hover:text-zinc-950 transition-colors cursor-pointer"
                          title="Play Now in Room"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddQueue(res)}
                          className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer"
                          title="Add to Queue"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Drawer trigger buttons: Listeners & Chat */}
            <button
              type="button"
              onClick={() => toggleDrawer('listeners')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                isDrawerOpen && drawerTab === 'listeners'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : 'bg-zinc-900/60 hover:bg-zinc-850 border-zinc-800/80 text-zinc-300 hover:text-zinc-100'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Listeners</span>
              <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[10px] font-mono font-bold text-zinc-300">
                {members.filter((m) => m.online).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => toggleDrawer('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                isDrawerOpen && drawerTab === 'chat'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : 'bg-zinc-900/60 hover:bg-zinc-850 border-zinc-800/80 text-zinc-300 hover:text-zinc-100'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Chat</span>
              {chatMessages.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono font-bold text-amber-300">
                  {chatMessages.length}
                </span>
              )}
            </button>

            {isHost && (
              <Badge variant="warning" className="flex items-center gap-1.5 py-1 px-3 text-xs font-semibold">
                <Crown className="w-3.5 h-3.5" />
                Room Host
              </Badge>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLeaveConfirmOpen(true)}
              className="text-xs text-red-400 hover:text-red-300 hover:border-red-500/40"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Leave
            </Button>
          </div>
        </div>

        {/* 30-Second Host Grace Period Warning Banner */}
        {hostPendingDeadline && (
          <div className="p-4 bg-amber-950/30 border border-amber-500/40 rounded-xl flex items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-300">Room Host Disconnected</p>
                <p className="text-[11px] text-zinc-400">
                  30-second grace period active. Host authority will automatically transfer if host does not return.
                </p>
              </div>
            </div>
            <div className="text-xs font-mono font-bold text-amber-400 shrink-0 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>30s GRACE</span>
            </div>
          </div>
        )}

        {/* Main Room Experience: Theater Player */}
        <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto relative z-10">
          <YouTubeRoomPlayer onFocusSearch={() => searchInputRef.current?.focus()} />
        </div>
        </div>

        {/* Leave Room Confirmation Dialog */}
        <ConfirmDialog
          isOpen={isLeaveConfirmOpen}
          onClose={() => setIsLeaveConfirmOpen(false)}
          onConfirm={() => {
            setIsLeaveConfirmOpen(false);
            leaveRoom();
            addToast({
              type: 'info',
              title: 'Left Room',
              message: `You exited room ${activeRoom.roomCode}.`,
            });
          }}
          title={`Leave room ${activeRoom.roomCode}?`}
          description={
            isHost
              ? "You are the host. If you're the last person in the room, the room will close. If other listeners are present, host authority passes to the next listener."
              : "You can rejoin at any time with the 6-character room code."
          }
          confirmLabel="Leave Room"
          isDestructive
        />
      </div>
    );
  }

  // Not in a room: Clean Consumer-Grade Lobby
  return (
    <div className="flex-1 overflow-y-auto select-none w-full pb-28">
      {/* Account requirement banner only inside Social Rooms */}
      {!isAuthenticated && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <p className="text-xs text-amber-200">
              Account required for live social listening with friends. Local library playback does not require signing in.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCurrentView('settings')}
            className="px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-[11px] cursor-pointer transition-colors shrink-0"
          >
            Connect Account
          </button>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-transparent border-b border-zinc-800/60">
        <div
          className={`relative z-10 flex flex-col items-center justify-center text-center px-8 ${
            isTopbar ? 'pt-24 pb-16' : 'py-16'
          } gap-6 transition-all duration-200`}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-semibold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Live Social Rooms
          </div>

          <div>
            <h1 className="text-4xl font-black tracking-tight text-zinc-50 leading-none">
              Listen <span className="text-amber-400">Together</span>
            </h1>
            <p className="text-sm text-zinc-400 mt-3 max-w-sm leading-relaxed">
              Real-time synchronized playback with friends across Desktop and Web — same beat, same moment.
            </p>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-bold transition-colors shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              Create Room
            </button>
            <button
              type="button"
              onClick={() => setIsJoinModalOpen(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-transparent border border-zinc-700 hover:border-amber-500/50 text-zinc-200 hover:text-amber-400 text-sm font-semibold transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              Join with Code
            </button>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className={`max-w-6xl mx-auto w-full ${isTopbar ? 'p-8 sm:px-10 lg:px-12' : 'p-8'}`}>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-5">What you get</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: <Music2 className="w-5 h-5" />,
              title: 'Synchronized Playback',
              desc: 'Everyone hears the same audio at the same moment. Sub-second sync drift correction keeps the room in perfect step.',
              color: 'amber',
            },
            {
              icon: <ListOrdered className="w-5 h-5" />,
              title: 'Shared Queue',
              desc: 'The host queues tracks from YouTube or the local library. Members see the upcoming list and vote on what plays next.',
              color: 'emerald',
            },
            {
              icon: <MessageCircle className="w-5 h-5" />,
              title: 'Real-time Chat',
              desc: 'Reactions and messages fly in live alongside the music. No lag, no polling — pure WebSocket presence.',
              color: 'zinc',
            },
          ].map((card) => (
            <div
              key={card.title}
              className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex flex-col gap-3 hover:border-zinc-700 hover:bg-zinc-900 transition-all"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  card.color === 'amber'
                    ? 'bg-amber-500/10 text-amber-400'
                    : card.color === 'emerald'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {card.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">{card.title}</h3>
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick start hint */}
        <div className="mt-8 flex items-center gap-3 p-4 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
          <Zap className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs text-zinc-400">
            <span className="text-zinc-200 font-medium">Quick start:</span> Create a room and share the 6-character code with friends. They can join from Desktop or the SyncD Web app — no account required.
          </p>
        </div>
      </div>

      {/* Join Room Modal with React Bits CodeSlots */}
      <Modal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        title="Join Listening Room"
        description="Enter the 6-character room code from your host."
        maxWidth="sm"
      >
        <form onSubmit={handleJoinSubmit} className="flex flex-col items-center gap-5 pt-3 pb-1">
          <div className="flex flex-col items-center gap-3">
            <CodeSlots
              length={6}
              value={roomCodeInput}
              onChange={setRoomCodeInput}
              onComplete={async (code) => {
                setRoomCodeInput(code);
                try {
                  await joinRoom(code);
                  setIsJoinModalOpen(false);
                  addToast({
                    type: 'success',
                    title: 'Joined Room',
                    message: `Connected to room session ${code}.`,
                  });
                } catch (err: unknown) {
                  addToast({
                    type: 'error',
                    title: 'Failed to Join Room',
                    message: err instanceof Error ? err.message : String(err),
                  });
                }
              }}
              autoFocus
            />
            <p className="text-[11px] text-zinc-500">
              Type or paste the 6-character code shared by the room creator
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 w-full pt-2 border-t border-zinc-800/80">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsJoinModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isLoading}
              disabled={roomCodeInput.trim().length !== 6}
              className="text-xs"
            >
              Join Session
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
