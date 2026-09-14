import type { QueueItem } from "./queue.types.js";

const MAX_QUEUE_SIZE = 50;

/**
 * Ephemeral per-room queue, keyed by roomCode.
 *
 * Follows the same in-memory pattern as `presenceStore` — no database
 * involvement, no crash-recovery guarantee; acceptable for a social listening
 * MVP.  The queue is implicitly cleared when the room is fully vacated or the
 * server restarts.
 */
class QueueStore {
  private readonly queues = new Map<string, QueueItem[]>();

  private getOrCreate(roomCode: string): QueueItem[] {
    let q = this.queues.get(roomCode);
    if (!q) {
      q = [];
      this.queues.set(roomCode, q);
    }
    return q;
  }

  /** Append an item to the back of the queue. Returns the updated snapshot. */
  enqueue(roomCode: string, item: QueueItem): QueueItem[] {
    const q = this.getOrCreate(roomCode);
    if (q.length < MAX_QUEUE_SIZE) {
      q.push(item);
    }
    return [...q];
  }

  /**
   * Pop the first item from the queue and return it.
   * Returns `undefined` when the queue is already empty.
   */
  dequeue(roomCode: string): QueueItem | undefined {
    const q = this.queues.get(roomCode);
    if (!q || q.length === 0) return undefined;
    return q.shift();
  }

  /** Remove the item at `index`. Returns the updated snapshot. */
  remove(roomCode: string, index: number): QueueItem[] {
    const q = this.getOrCreate(roomCode);
    if (index >= 0 && index < q.length) {
      q.splice(index, 1);
    }
    return [...q];
  }

  /** Move the item at `fromIndex` to `toIndex`. Returns the updated snapshot. */
  reorder(roomCode: string, fromIndex: number, toIndex: number): QueueItem[] {
    const q = this.getOrCreate(roomCode);
    const len = q.length;
    if (
      fromIndex < 0 ||
      fromIndex >= len ||
      toIndex < 0 ||
      toIndex >= len ||
      fromIndex === toIndex
    ) {
      return [...q];
    }
    const removed = q.splice(fromIndex, 1);
    const item = removed[0];
    if (item === undefined) return [...q];
    q.splice(toIndex, 0, item);
    return [...q];
  }

  /** Returns a shallow copy of the current queue. */
  getQueue(roomCode: string): QueueItem[] {
    return [...(this.queues.get(roomCode) ?? [])];
  }

  /** Empty the queue for a room. Returns an empty array for convenience. */
  clearQueue(roomCode: string): QueueItem[] {
    this.queues.set(roomCode, []);
    return [];
  }
}

export const queueStore = new QueueStore();
