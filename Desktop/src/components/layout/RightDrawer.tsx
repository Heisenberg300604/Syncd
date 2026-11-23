import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ListMusic,
  MessageSquare,
  Users,
  Trash2,
  Send,
  Crown,
  Play,
  Music,
} from 'lucide-react';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useRoomStore } from '../../stores/useRoomStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAppStore } from '../../stores/useAppStore';
import { useToastStore } from '../../stores/useToastStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { Badge } from '../ui/Badge';
import { CodecBadge } from '../ui/CodecBadge';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export interface RightDrawerProps {
  isOpen?: boolean;
  onClose: () => void;
  width?: number;
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

const QueueItemThumbnail: React.FC<{ artworkUrl?: string }> = ({ artworkUrl }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [artworkUrl]);

  if (artworkUrl && !hasError) {
    return (
      <img
        src={artworkUrl}
        alt=""
        onError={() => setHasError(true)}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    );
  }
  return <Music className="w-3.5 h-3.5 text-zinc-500" />;
};

export const RightDrawer: React.FC<RightDrawerProps> = ({
  onClose,
  width = 340,
}) => {
  const { drawerTab, setDrawerTab } = useAppStore();
  const activeTab = drawerTab;
  const setActiveTab = setDrawerTab;

  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [memberToTransfer, setMemberToTransfer] = useState<{ id: string; name: string } | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  const {
    currentTrack,
    status,
    queue: localQueue,
    playQueuedTrack,
    removeFromQueue: removeLocalFromQueue,
    clearQueue: clearLocalQueue,
  } = usePlayerStore();
  const {
    activeRoom,
    members,
    queue: roomQueue,
    chatMessages,
    isHost,
    hostUserId,
    sendChat,
    transferHost,
    removeFromQueue: removeRoomFromQueue,
  } = useRoomStore();
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const { autoQueue, setAutoQueue } = useSettingsStore();

  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom when messages update
  useEffect(() => {
    if (activeTab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeTab]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSending) return;

    try {
      setIsSending(true);
      await sendChat(chatInput.trim());
      setChatInput('');
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!memberToTransfer) return;
    try {
      setIsTransferring(true);
      await transferHost(memberToTransfer.id);
      addToast({
        type: 'info',
        title: 'Host Authority Transferred',
        message: `${memberToTransfer.name} is now the room host.`,
      });
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Transfer Failed',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsTransferring(false);
      setMemberToTransfer(null);
    }
  };

  return (
    <aside
      style={{ width: `${width}px` }}
      className="bg-zinc-950/85 backdrop-blur-2xl flex flex-col shrink-0 select-none overflow-hidden h-full w-full"
    >
      {/* Drawer Header & Tab Selector (Compact height with single-line tabs) */}
      <div className="h-10 border-b border-zinc-800/80 px-2.5 flex items-center justify-between shrink-0 bg-zinc-950/50 backdrop-blur-md">
        <div className="flex items-center gap-0.5 bg-zinc-900/70 p-0.5 rounded-lg border border-zinc-800/70">
          {activeRoom && (
            <button
              type="button"
              onClick={() => setActiveTab('listeners')}
              className={`h-7 px-2 rounded-md text-[11px] font-medium flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'listeners'
                  ? 'bg-zinc-800 text-amber-400 font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/40'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>Listeners</span>
              <span className="text-[10px] font-mono text-zinc-500 font-bold">({members.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`h-7 px-2 rounded-md text-[11px] font-medium flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-zinc-800 text-amber-400 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/40'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span>Chat</span>
            {activeRoom && (
              <span className="text-[10px] font-mono text-zinc-500 font-bold">({chatMessages.length})</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`h-7 px-2 rounded-md text-[11px] font-medium flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-zinc-800 text-amber-400 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/40'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5 shrink-0" />
            <span>Queue</span>
            {(activeRoom ? roomQueue.length : localQueue.length) > 0 && (
              <span className="text-[10px] font-mono text-zinc-500 font-bold">
                ({activeRoom ? roomQueue.length : localQueue.length})
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850/60 transition-colors cursor-pointer shrink-0"
          title="Close drawer (Esc or Ctrl+Q)"
          aria-label="Close drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <AnimatePresence mode="wait" initial={false}>
        {activeTab === 'listeners' ? (
          <motion.div
            key="tab-listeners"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="flex-1 overflow-y-auto p-4 pb-6 flex flex-col gap-3 select-none"
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                Active Listeners ({members.length})
              </span>
              {activeRoom && (
                <span className="font-mono text-[11px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  {activeRoom.roomCode}
                </span>
              )}
            </div>

            {members.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center text-zinc-500 gap-2">
                <Users className="w-8 h-8 opacity-40 text-amber-500" />
                <p className="text-xs font-medium text-zinc-300">No Listeners Yet</p>
                <p className="text-[11px] text-zinc-500 max-w-xs">
                  Share code {activeRoom?.roomCode} with friends to listen together!
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {members.map((member) => {
                  const isMemberHost = member.userId === hostUserId;
                  const isMe = user?.id === member.userId;

                  return (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-xs hover:border-zinc-700/80 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative">
                          <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-[10px] text-amber-400 shrink-0 uppercase">
                            {member.username.slice(0, 2)}
                          </div>
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-zinc-950 ${
                              member.online ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-zinc-600'
                            }`}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-zinc-200 truncate">{member.username}</span>
                            {isMe && <span className="text-[10px] text-zinc-500 font-mono">(You)</span>}
                          </div>
                          <p className="text-[10px] text-zinc-500">
                            {isMemberHost ? 'Room Host' : member.online ? 'Listening' : 'Offline'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isMemberHost ? (
                          <span title="Host">
                            <Crown className="w-4 h-4 text-amber-400" />
                          </span>
                        ) : (
                          isHost && !isMemberHost && member.online && (
                            <button
                              type="button"
                              onClick={() => setMemberToTransfer({ id: member.userId, name: member.username })}
                              className="text-[10px] px-2 py-0.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded border border-zinc-700/60 transition-colors cursor-pointer"
                            >
                              Make Host
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : activeTab === 'queue' ? (
          <motion.div
            key="tab-queue"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="flex-1 overflow-y-auto p-4 pb-6 flex flex-col gap-4"
          >
          {/* Now Playing Header */}
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
              Now Playing
            </span>
            {currentTrack ? (
              <div className="mt-1.5 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-100 truncate">
                    {currentTrack.title}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                    {currentTrack.artist}
                  </p>
                </div>
                <Badge variant="amber" className="text-[9px] uppercase tracking-wider shrink-0">
                  {status}
                </Badge>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic mt-1">Nothing currently playing</p>
            )}
          </div>

          {/* Queue Section Header */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-850">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
              {activeRoom
                ? `Room Queue (${activeRoom.roomCode})`
                : `Up Next (${localQueue.length})`}
            </span>
            {!activeRoom && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoQueue(!autoQueue)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-all cursor-pointer flex items-center gap-1 font-medium ${
                    autoQueue
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                  title={
                    autoQueue
                      ? 'Auto Queue is ON: tracks from library are automatically queued when playing'
                      : 'Auto Queue is OFF: only explicitly queued tracks appear in Up Next'
                  }
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      autoQueue ? 'bg-amber-400' : 'bg-zinc-600'
                    }`}
                  />
                  <span>Auto Queue: {autoQueue ? 'ON' : 'OFF'}</span>
                </button>

                {localQueue.length > 0 && (
                  <button
                    type="button"
                    onClick={clearLocalQueue}
                    className="text-[10px] text-zinc-500 hover:text-amber-400 transition-colors cursor-pointer font-medium"
                  >
                    Clear Queue
                  </button>
                )}
              </div>
            )}
          </div>

          {activeRoom ? (
            roomQueue.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center text-zinc-500 gap-2">
                <ListMusic className="w-8 h-8 opacity-40 text-amber-500" />
                <p className="text-xs font-medium text-zinc-300">Room Queue is Empty</p>
                <p className="text-[11px] text-zinc-500 max-w-xs">
                  {isHost
                    ? 'Search for tracks or playlists and add them to the shared queue.'
                    : 'The host has not queued any upcoming tracks yet.'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {roomQueue.map((item, idx) => (
                  <div
                    key={`${item.videoId}_${idx}`}
                    className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between gap-2.5 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-mono text-zinc-500 w-4 text-center">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-200 truncate">{item.title}</p>
                        <p className="text-[10px] text-zinc-500 truncate">
                          {item.addedBy ? `Queued by ${item.addedBy}` : 'Shared track'}
                        </p>
                      </div>
                    </div>

                    {isHost && (
                      <button
                        onClick={() => removeRoomFromQueue(idx)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 rounded transition-all"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : localQueue.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-zinc-500 gap-2">
              <ListMusic className="w-8 h-8 opacity-40 text-zinc-600" />
              <p className="text-xs font-medium text-zinc-300">No Tracks Queued</p>
              <p className="text-[11px] text-zinc-600 max-w-xs">
                Right-click any track in your library to add it to your personal playback queue.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {localQueue.map((item, idx) => {
                const isItemCurrent =
                  item.id === currentTrack?.id ||
                  (currentTrack?.trackId && item.trackId === currentTrack.trackId) ||
                  (currentTrack?.id && item.trackId === currentTrack.id);

                return (
                  <div
                    key={`${item.id}_${idx}`}
                    onClick={() => playQueuedTrack(idx)}
                    className={`group p-2 rounded-xl flex items-center justify-between gap-2.5 transition-all cursor-pointer border ${
                      isItemCurrent
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-xs'
                        : 'bg-zinc-900/60 hover:bg-zinc-850/80 border-zinc-800/80 hover:border-zinc-700/80 text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Artwork or Music Icon with Play indicator */}
                      <div className="relative w-8 h-8 rounded-lg bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center border border-zinc-800/80">
                        <QueueItemThumbnail artworkUrl={item.artworkUrl} />
                        {isItemCurrent && status === 'playing' ? (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Play className="w-3.5 h-3.5 text-amber-400 fill-current ml-0.5" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p
                            className={`text-xs font-medium truncate ${
                              isItemCurrent
                                ? 'text-amber-300 font-semibold'
                                : 'text-zinc-200 group-hover:text-zinc-100'
                            }`}
                          >
                            {item.title}
                          </p>
                          {item.format && <CodecBadge format={item.format} size="xs" />}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 truncate mt-0.5">
                          <span className="truncate">{item.artist || 'Unknown Artist'}</span>
                          {item.durationSeconds > 0 && (
                            <>
                              <span>•</span>
                              <span>{formatDuration(item.durationSeconds)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLocalFromQueue(item.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition-all cursor-pointer shrink-0"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      ) : (
        /* Real-Time Room Chat Tab */
        <motion.div
          key="tab-chat"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
          className="flex-1 flex flex-col overflow-hidden"
        >
          {activeRoom ? (
            <>
              {/* Chat Message Stream */}
              <div
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto p-4 flex flex-col gap-3"
              >
                {chatMessages.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center text-zinc-500 gap-2">
                    <MessageSquare className="w-8 h-8 opacity-40 text-amber-500" />
                    <p className="text-xs font-medium text-zinc-300">Room Chat Started</p>
                    <p className="text-[11px] text-zinc-500 max-w-xs">
                      Say hello to other listeners in room {activeRoom.roomCode}!
                    </p>
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isMsgHost = msg.userId === hostUserId;
                    const isMe = user?.id === msg.userId;

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col gap-1 text-xs ${
                          isMe ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 px-1 text-[10px] text-zinc-400">
                          {isMsgHost && (
                            <span title="Host">
                              <Crown className="w-3 h-3 text-amber-400 inline-block mr-0.5" />
                            </span>
                          )}
                          <span className={`font-semibold ${isMe ? 'text-amber-400' : 'text-zinc-300'}`}>
                            {msg.username}
                          </span>
                          <span className="text-zinc-600 font-mono">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div
                          className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed break-words ${
                            isMe
                              ? 'bg-amber-500 text-zinc-950 font-medium'
                              : 'bg-zinc-900 border border-zinc-800 text-zinc-200'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Send Form (Pill) */}
              <form
                onSubmit={handleSendChat}
                className="p-3 border-t border-zinc-850/80 bg-zinc-950/70 backdrop-blur-md"
              >
                <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 hover:border-zinc-750 focus-within:border-amber-500/80 focus-within:ring-2 focus-within:ring-amber-500/20 rounded-full pl-4 pr-1.5 py-1.5 transition-all shadow-inner">
                  <input
                    type="text"
                    maxLength={500}
                    placeholder="Send a message... (Enter)"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 bg-transparent border-none text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden selection:bg-amber-500/30 min-w-0"
                  />

                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isSending}
                    className="w-7 h-7 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-90 text-zinc-950 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-sm"
                    title="Send message"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-500 gap-2 p-6">
              <MessageSquare className="w-10 h-10 opacity-40 text-amber-500 mb-1" />
              <p className="text-xs text-zinc-200 font-semibold">Not in a Social Room</p>
              <p className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
                Join or create a social room from the Social Rooms tab to chat in real-time with other listeners.
              </p>
            </div>
          )}
        </motion.div>
      )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={Boolean(memberToTransfer)}
        onClose={() => setMemberToTransfer(null)}
        onConfirm={handleConfirmTransfer}
        title="Transfer Room Host Authority"
        description={`Are you sure you want to transfer host authority to ${memberToTransfer?.name}? You will become a regular listener.`}
        confirmLabel="Transfer Host"
        isLoading={isTransferring}
      />
    </aside>
  );
};
