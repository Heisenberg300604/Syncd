import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../services/types";
import type { ConnectionStatus } from "../hooks/useRoomSocket";
import { Card } from "./ui/Card";
import { Avatar } from "./ui/Avatar";
import { EmojiPicker } from "./ui/EmojiPicker";

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

/** Emoji, variation selectors, ZWJ and skin-tone modifiers — nothing else. */
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|️|‍)+$/u;

/**
 * A message of nothing but a few emoji reads better rendered large, the way
 * most chat clients do it.
 */
function isJumboEmoji(content: string): boolean {
  if (!EMOJI_ONLY.test(content)) return false;
  const graphemes = [...new Intl.Segmenter().segment(content)];
  return graphemes.length > 0 && graphemes.length <= 3;
}

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
  const inputRef = useRef<HTMLInputElement>(null);
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

  /** Insert at the caret (or replace the selection) rather than appending. */
  function handleEmojiSelect(emoji: string) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);

    if (next.length > MESSAGE_MAX_LENGTH) return;

    setDraft(next);

    // Restore the caret after React has committed the new value.
    requestAnimationFrame(() => {
      if (!input) return;
      const caret = start + emoji.length;
      input.focus();
      input.setSelectionRange(caret, caret);
    });
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
    <Card className="flex h-[28rem] flex-col">
      <div className="shrink-0 border-b border-line px-5 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Chat
        </h2>
        <p className="mt-0.5 text-xs text-ink-faint">
          {memberCount} {memberCount === 1 ? "person" : "people"} here
        </p>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="h-full space-y-3 overflow-y-auto px-5 py-4"
        >
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-ink-faint">No messages yet.</p>
              <p className="mt-1 text-sm text-ink-faint">
                Start the conversation 👋
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.userId === currentUserId;
              const jumbo = isJumboEmoji(msg.content);
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${
                    isMine ? "flex-row-reverse" : ""
                  }`}
                >
                  {!isMine && <Avatar name={msg.username} size={26} />}
                  <div
                    className={`flex max-w-[80%] flex-col ${
                      isMine ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`rounded-lg text-sm ${
                        jumbo
                          ? "px-1 py-0.5 text-ink"
                          : isMine
                            ? "bg-accent px-3.5 py-2 text-accent-ink"
                            : "bg-white/5 px-3.5 py-2 text-ink"
                      }`}
                    >
                      {!isMine && (
                        <p className="mb-0.5 text-xs font-medium text-accent">
                          {msg.username}
                        </p>
                      )}
                      <p
                        className={`whitespace-pre-wrap break-words ${
                          jumbo ? "text-3xl leading-tight" : ""
                        }`}
                      >
                        {msg.content}
                      </p>
                    </div>
                    <span className="mt-1 px-1 text-[10px] text-ink-faint">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {hasNewBelow && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink shadow-md transition-colors hover:bg-accent-hi"
          >
            ↓ New messages
          </button>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-line px-5 py-4">
        {disconnected && (
          <p className="text-xs text-warning">
            {connectionStatus === "reconnecting"
              ? "Reconnecting…"
              : "Disconnected — trying to reconnect…"}
          </p>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <EmojiPicker
            onSelect={handleEmojiSelect}
            disabled={connectionStatus !== "connected"}
          />
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message…"
            maxLength={MESSAGE_MAX_LENGTH}
            autoComplete="off"
            disabled={connectionStatus !== "connected"}
            className="h-10 flex-1 rounded-md border border-line bg-white/3 px-3.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={
              connectionStatus !== "connected" || draft.trim().length === 0
            }
            className="rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hi disabled:opacity-50 disabled:pointer-events-none"
          >
            Send
          </button>
        </form>
      </div>
    </Card>
  );
}
