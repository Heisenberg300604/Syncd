import type { EnqueueResult, QueueItem } from "./queue.types.js";

const MAX_QUEUE_SIZE = 50;

// ---------------------------------------------------------------------------
// RoomMutex — per-room promise queue that serialises async operations.
//
// Each room gets its own chain of promises.  Operations for the *same* room
// are queued behind each other, while operations for *different* rooms run
// concurrently.  The chain is cleaned up once the last queued operation
// resolves so we do not hold a stale entry for every room the process has
// ever seen.
//
// Guarantees:
//   • A throwing `fn` releases the lock (the next operation is not stuck).
//   • `withLock` returns whatever `fn()` returns (or re-throws its error).
// ---------------------------------------------------------------------------

export class RoomMutex {
  /**
   * Tail of the promise chain for each room. An absent entry means no work is
   * queued for that room (equivalent to a resolved promise).
   */
  private readonly tails = new Map<string, Promise<void>>();

  /**
   * Run `fn` exclusively for `roomCode`, waiting for any in-flight operation
   * to finish first. Different rooms run concurrently.
   */
  withLock<T>(roomCode: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(roomCode) ?? Promise.resolve();

    let resolveGate!: () => void;
    const gate = new Promise<void>((res) => {
      resolveGate = res;
    });

    const nextTail = previous.then(
      () => gate,
      () => gate,
    );
    this.tails.set(roomCode, nextTail);

    const result = previous.catch(() => {}).then(() => fn());

    result
      .finally(() => {
        resolveGate();
        if (this.tails.get(roomCode) === nextTail) {
          this.tails.delete(roomCode);
        }
      })
      .catch(() => {});

    return result;
  }

  /** True if there is pending work for the given room (useful in tests). */
  isLocked(roomCode: string): boolean {
    return this.tails.has(roomCode);
  }
}

// ---------------------------------------------------------------------------
// QueueStore
// ---------------------------------------------------------------------------

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

  /**
   * Append an item to the back of the queue.
   *
   * Returns `{ ok: true, queue }` on success or `{ ok: false, code: 'QUEUE_FULL', queue }`
   * when the room has already reached `MAX_QUEUE_SIZE` items.  The queue is
   * never silently mutated without a signal to the caller.
   */
  enqueue(roomCode: string, item: QueueItem): EnqueueResult {
    const q = this.getOrCreate(roomCode);
    if (q.length >= MAX_QUEUE_SIZE) {
      return { ok: false, code: "QUEUE_FULL", queue: [...q] };
    }
    q.push(item);
    return { ok: true, queue: [...q] };
  }

  /**
   * Prepend an item to the front of the queue.
   *
   * Returns `{ ok: true, queue }` on success or `{ ok: false, code: 'QUEUE_FULL', queue }`
   * when the room has already reached `MAX_QUEUE_SIZE` items.
   */
  prepend(roomCode: string, item: QueueItem): EnqueueResult {
    const q = this.getOrCreate(roomCode);
    if (q.length >= MAX_QUEUE_SIZE) {
      return { ok: false, code: "QUEUE_FULL", queue: [...q] };
    }
    q.unshift(item);
    return { ok: true, queue: [...q] };
  }

  /**
   * Peek at the first item in the queue without removing it.
   * Returns `undefined` when the queue is empty.
   */
  peek(roomCode: string): QueueItem | undefined {
    const q = this.queues.get(roomCode);
    return q && q.length > 0 ? q[0] : undefined;
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

  /**
   * Empty the queue for a room. Returns an empty array for convenience.
   *
   * Drops the entry rather than storing an empty array — `getQueue` answers
   * the same either way, and holding the key would keep a slot alive for every
   * room the process has ever seen.
   */
  clearQueue(roomCode: string): QueueItem[] {
    this.queues.delete(roomCode);
    return [];
  }
}

export const queueStore = new QueueStore();
export const roomMutex = new RoomMutex();
