import { useEffect, useRef, useState } from "react";
import { Card } from "./Card";

/**
 * Curated emoji set — deliberately small and hand-picked for a shared
 * listening room rather than a full Unicode dump, so it stays dependency-free
 * and scannable.
 */
const CATEGORIES = [
  {
    id: "vibes",
    label: "Vibes",
    emojis: [
      "🎵", "🎶", "🎧", "🎤", "🎸", "🥁", "🎹", "🎷",
      "🔥", "✨", "💫", "⚡", "🌙", "☀️", "🌊", "🪩",
    ],
  },
  {
    id: "smileys",
    label: "Smileys",
    emojis: [
      "😀", "😄", "😁", "😂", "🤣", "😊", "😍", "🥰",
      "😎", "🤩", "🥳", "🤔", "😴", "😭", "😱", "🙃",
      "😏", "😅", "🫠", "🤯", "🥺", "😤", "😇", "🤫",
    ],
  },
  {
    id: "gestures",
    label: "Gestures",
    emojis: [
      "👋", "👍", "👎", "👏", "🙌", "🤝", "✌️", "🤘",
      "🫶", "💪", "🙏", "👀", "💃", "🕺", "🫡", "🤌",
    ],
  },
  {
    id: "hearts",
    label: "Hearts",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "💖", "💯", "⭐", "🌟", "🏆", "🎉", "🎊", "🥂",
    ],
  },
] as const;

const RECENTS_KEY = "syncd:recent-emojis";
const RECENTS_LIMIT = 16;

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is string => typeof e === "string");
  } catch {
    return [];
  }
}

function writeRecents(emojis: string[]): void {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(emojis));
  } catch {
    // Storage unavailable (private mode, blocked cookies) — recents are a
    // convenience, so silently carry on without them.
  }
}

interface EmojiPickerProps {
  /** Called with the chosen emoji; the panel stays open for multi-picking. */
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function EmojiPicker({ onSelect, disabled = false }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] =
    useState<(typeof CATEGORIES)[number]["id"]>("vibes");
  const [recents, setRecents] = useState<string[]>(readRecents);
  const containerRef = useRef<HTMLDivElement>(null);

  // A disconnected composer closes the panel without needing its own effect.
  const isOpen = open && !disabled;

  // Dismiss on outside click or Escape.
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleToggle() {
    // Recents can change in another tab/room — re-read them on each open.
    if (!isOpen) setRecents(readRecents());
    setOpen(!isOpen);
  }

  function handlePick(emoji: string) {
    const next = [emoji, ...recents.filter((e) => e !== emoji)].slice(
      0,
      RECENTS_LIMIT,
    );
    setRecents(next);
    writeRecents(next);
    onSelect(emoji);
  }

  const category =
    CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        aria-label="Insert emoji"
        aria-expanded={isOpen}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line text-lg transition-colors hover:border-accent/60 hover:bg-white/5 disabled:opacity-50 disabled:pointer-events-none ${
          isOpen ? "border-accent/60 bg-white/5" : "bg-white/3"
        }`}
      >
        <span aria-hidden="true">🙂</span>
      </button>

      {isOpen && (
        <Card
          level="overlay"
          className="absolute bottom-12 left-0 z-20 w-72 p-3"
        >
          {recents.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                Recent
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {recents.map((emoji) => (
                  <EmojiButton
                    key={`recent-${emoji}`}
                    emoji={emoji}
                    onPick={handlePick}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mb-2 flex gap-1 border-b border-line pb-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                  c.id === categoryId
                    ? "bg-accent-lo text-accent"
                    : "text-ink-faint hover:text-ink-muted"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="grid max-h-44 grid-cols-8 gap-0.5 overflow-y-auto">
            {category.emojis.map((emoji) => (
              <EmojiButton key={emoji} emoji={emoji} onPick={handlePick} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function EmojiButton({
  emoji,
  onPick,
}: {
  emoji: string;
  onPick: (emoji: string) => void;
}) {
  return (
    <button
      type="button"
      // Keep focus in the message input so the caret position survives a pick.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(emoji)}
      aria-label={`Insert ${emoji}`}
      className="flex h-8 w-8 items-center justify-center rounded text-lg transition-colors hover:bg-white/8"
    >
      <span aria-hidden="true">{emoji}</span>
    </button>
  );
}
