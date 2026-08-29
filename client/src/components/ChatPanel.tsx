import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../services/types";
import type { ConnectionStatus } from "../hooks/useRoomSocket";

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string | undefined;
  connectionStatus: ConnectionStatus;
  memberCount: number;
  sending: boolean;
  error: string | null;
  onSend: (content: string) => void;
}

const MESSAGE_MAX_LENGTH = 500;
/** How close to the bottom (px) counts as "already at the bottom". */
const NEAR_BOTTOM_THRESHOLD = 80;

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ChatPanel({
  messages,
  currentUserId,
  connectionStatus,
  memberCount,
  sending,
  error,
  onSend,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const wasNearBottom = useRef(true);
  const messageCount = messages.length;

  // Keep the view pinned to the bottom only if the reader was already there —
  // someone scrolled up to read history shouldn't get yanked back down.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    if (wasNearBottom.current) {
      list.scrollTop = list.scrollHeight;
      setHasNewBelow(false);
    } else {
      setHasNewBelow(true);
    }
  }, [messageCount]);

  function handleScroll() {
    const list = listRef.current;
    if (!list) return;
    const distanceFromBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight;
    wasNearBottom.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
    if (wasNearBottom.current) setHasNewBelow(false);
  }

  function scrollToBottom() {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
    wasNearBottom.current = true;
    setHasNewBelow(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (trimmed.length === 0 || sending) return;
    onSend(trimmed);
    setDraft("");
  }

  const disconnected =
    connectionStatus === "disconnected" || connectionStatus === "reconnecting";

  return (
    <div className="bg-zinc-950/50 border border-white/10 rounded-2xl backdrop-blur-xl flex flex-col h-[28rem]">
      <div className="px-6 py-4 border-b border-white/5 flex-shrink-0">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          Live Chat
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          {memberCount} {memberCount === 1 ? "person" : "people"} here
        </p>
      </div>

      <div className="relative flex-1 min-h-0">
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto px-6 py-4 space-y-3"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
              <p className="text-sm text-zinc-500">No messages yet.</p>
              <p className="text-sm text-zinc-500 mt-1">
                Start the conversation 👋
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.userId === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                      isMine
                        ? "bg-violet-500 text-white"
                        : "bg-white/5 text-zinc-100"
                    }`}
                  >
                    {!isMine && (
                      <p className="text-xs font-medium text-violet-300 mb-0.5">
                        {msg.username}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 px-1">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {hasNewBelow && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-500 text-white text-xs font-medium px-3 py-1.5 shadow-lg hover:bg-violet-600 transition-colors"
          >
            ↓ New messages
          </button>
        )}
      </div>

      <div className="px-6 py-4 border-t border-white/5 flex-shrink-0 space-y-2">
        {disconnected && (
          <p className="text-xs text-amber-400">
            {connectionStatus === "reconnecting"
              ? "Reconnecting…"
              : "Disconnected — trying to reconnect…"}
          </p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message..."
            maxLength={MESSAGE_MAX_LENGTH}
            autoComplete="off"
            disabled={connectionStatus !== "connected"}
            className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={
              connectionStatus !== "connected" || draft.trim().length === 0
            }
            className="rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
