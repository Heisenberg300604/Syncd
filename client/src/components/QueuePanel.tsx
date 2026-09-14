import { useState } from "react";
import { formatIsoDuration } from "../utils/duration";
import type { QueueItem } from "../services/types";
import { Card } from "./ui/Card";

interface QueuePanelProps {
  queue: QueueItem[];
  isHost: boolean;
  onRemove: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onClear: () => void;
  /** Called when the host explicitly skips to the next item. */
  onSkip: () => void;
}

export function QueuePanel({
  queue,
  isHost,
  onRemove,
  onReorder,
  onClear,
  onSkip,
}: QueuePanelProps) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // -------------------------------------------------------------------------
  // Drag-to-reorder (host only, HTML5 drag-and-drop API)
  // -------------------------------------------------------------------------

  function handleDragStart(index: number) {
    setDragging(index);
  }

  function handleDragEnter(index: number) {
    if (dragging === null || dragging === index) return;
    setDragOver(index);
  }

  function handleDrop(index: number) {
    if (dragging === null || dragging === index) {
      setDragging(null);
      setDragOver(null);
      return;
    }
    onReorder(dragging, index);
    setDragging(null);
    setDragOver(null);
  }

  function handleDragEnd() {
    setDragging(null);
    setDragOver(null);
  }

  // -------------------------------------------------------------------------
  // Arrow-key reorder fallback (host only)
  // -------------------------------------------------------------------------

  function moveUp(index: number) {
    if (index <= 0) return;
    onReorder(index, index - 1);
  }

  function moveDown(index: number) {
    if (index >= queue.length - 1) return;
    onReorder(index, index + 1);
  }

  if (queue.length === 0) {
    return (
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Up next
          </h2>
        </div>
        <p className="py-4 text-center text-sm text-ink-faint">
          No tracks in queue.{" "}
          {isHost
            ? "Search for a song and click \u201cAdd to queue\u201d."
            : "Waiting for the host to add tracks."}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Up next · {queue.length}
        </h2>
        {isHost && (
          <div className="flex items-center gap-3">
            <button
              onClick={onSkip}
              className="flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
              aria-label="Skip to next track"
              title="Skip to next track"
            >
              {/* Skip-forward icon */}
              <svg
                className="h-3.5 w-3.5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z" />
              </svg>
              Skip
            </button>
            <button
              onClick={onClear}
              className="text-xs text-ink-muted transition-colors hover:text-danger"
              aria-label="Clear queue"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {queue.map((item, index) => {
          const length = formatIsoDuration(item.duration);
          const isFirst = index === 0;
          const isDraggingThis = dragging === index;
          const isDragTarget = dragOver === index;

          return (
            <li
              key={`${item.videoId}-${index}`}
              draggable={isHost}
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-all ${
                isDraggingThis ? "opacity-40" : ""
              } ${isDragTarget ? "ring-1 ring-accent/60 bg-accent/5" : "hover:bg-white/5"}`}
            >
              {/* Position number / drag handle */}
              <span
                className={`w-5 shrink-0 text-center font-mono text-xs ${
                  isFirst ? "text-accent font-semibold" : "text-ink-faint"
                } ${isHost ? "cursor-grab active:cursor-grabbing" : ""}`}
                aria-hidden="true"
              >
                {isFirst ? "▶" : index + 1}
              </span>

              {/* Thumbnail */}
              <img
                src={item.thumbnailUrl}
                alt=""
                className="h-9 w-12 shrink-0 rounded-md bg-white/5 object-cover"
                loading="lazy"
              />

              {/* Title + label */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {item.title}
                </p>
                {isFirst && (
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-accent/80">
                    Up next
                  </p>
                )}
              </div>

              {/* Duration */}
              {length && (
                <span className="shrink-0 font-mono text-xs text-ink-faint">
                  {length}
                </span>
              )}

              {/* Host controls */}
              {isHost && (
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="rounded p-0.5 text-ink-faint transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                    aria-label="Move up"
                    title="Move up"
                  >
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 14l5-5 5 5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === queue.length - 1}
                    className="rounded p-0.5 text-ink-faint transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                    aria-label="Move down"
                    title="Move down"
                  >
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 10l5 5 5-5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onRemove(index)}
                    className="rounded p-0.5 text-ink-faint transition-colors hover:text-danger"
                    aria-label={`Remove ${item.title} from queue`}
                    title="Remove"
                  >
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
