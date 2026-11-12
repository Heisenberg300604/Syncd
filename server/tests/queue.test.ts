import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { queueStore, roomMutex, RoomMutex } from "../src/sockets/queueStore.js";
import type { QueueItem } from "../src/sockets/queue.types.js";

function makeTrack(id: string, title = `Track ${id}`): QueueItem {
  return {
    videoId: id,
    title,
    thumbnailUrl: `https://img.youtube.com/vi/${id}/default.jpg`,
    duration: "PT3M30S",
  };
}

/**
 * Pure simulation of the queue advancement flow under `roomMutex.withLock`,
 * exactly matching the logic in `server/src/sockets/index.ts` `handleQueueAdvance`.
 */
async function advanceQueueUnderLock(
  roomCode: string,
  options: {
    expectedFrontVideoId?: string;
    onSetTrack?: (track: QueueItem) => Promise<void>;
    onClearTrack?: () => Promise<void>;
  } = {},
): Promise<{ queue: QueueItem[]; currentTrack: QueueItem | null | undefined }> {
  return roomMutex.withLock(roomCode, async () => {
    // 1. Peek front item
    const front = queueStore.peek(roomCode);

    // 2. Idempotency check
    if (
      options.expectedFrontVideoId !== undefined &&
      front?.videoId !== options.expectedFrontVideoId
    ) {
      return {
        queue: queueStore.getQueue(roomCode),
        currentTrack: undefined, // no-op, did not advance
      };
    }

    if (front) {
      // 3. Persist to DB first
      if (options.onSetTrack) {
        await options.onSetTrack(front);
      }
      // 4. Dequeue only after DB succeeds
      queueStore.dequeue(roomCode);
      return {
        queue: queueStore.getQueue(roomCode),
        currentTrack: front,
      };
    } else {
      // Queue exhausted — clear playback
      if (options.onClearTrack) {
        await options.onClearTrack();
      }
      return {
        queue: queueStore.getQueue(roomCode),
        currentTrack: null,
      };
    }
  });
}

describe("Queue Advancement Concurrency & Store (Tasks A & B)", () => {
  const ROOM = "test-room-1";
  const ROOM_B = "test-room-2";

  beforeEach(() => {
    queueStore.clearQueue(ROOM);
    queueStore.clearQueue(ROOM_B);
  });

  // 1. Normal queue advancement (mock DB success)
  test("1. Normal queue advancement: sets track in DB and pops front from queue", async () => {
    const t1 = makeTrack("vid-1", "Song 1");
    const t2 = makeTrack("vid-2", "Song 2");
    queueStore.enqueue(ROOM, t1);
    queueStore.enqueue(ROOM, t2);

    let dbSavedTrack: QueueItem | null = null;
    const result = await advanceQueueUnderLock(ROOM, {
      onSetTrack: async (track) => {
        dbSavedTrack = track;
      },
    });

    assert.equal((dbSavedTrack as QueueItem | null)?.videoId, "vid-1");
    assert.equal(result.currentTrack?.videoId, "vid-1");
    assert.equal(result.queue.length, 1);
    assert.equal(result.queue[0]?.videoId, "vid-2");
    assert.equal(queueStore.getQueue(ROOM).length, 1);
  });

  // 2. Two simultaneous advance requests (second must not double-advance)
  test("2. Two simultaneous advance requests: second does not double-advance when front has changed", async () => {
    const t1 = makeTrack("vid-1");
    const t2 = makeTrack("vid-2");
    const t3 = makeTrack("vid-3");
    queueStore.enqueue(ROOM, t1);
    queueStore.enqueue(ROOM, t2);
    queueStore.enqueue(ROOM, t3);

    const advancedTracks: string[] = [];

    // Both requests are fired simultaneously with the same expectedFrontVideoId
    // (simulating a double-click or two concurrent clients requesting advance of vid-1)
    const req1 = advanceQueueUnderLock(ROOM, {
      expectedFrontVideoId: "vid-1",
      onSetTrack: async (track) => {
        // Simulate async DB delay
        await new Promise((res) => setTimeout(res, 25));
        advancedTracks.push(track.videoId);
      },
    });

    const req2 = advanceQueueUnderLock(ROOM, {
      expectedFrontVideoId: "vid-1",
      onSetTrack: async (track) => {
        advancedTracks.push(track.videoId);
      },
    });

    const [res1, res2] = await Promise.all([req1, req2]);

    // req1 succeeded and advanced vid-1
    assert.equal(res1.currentTrack?.videoId, "vid-1");
    // req2 ran after req1 under the mutex, saw front was now vid-2 !== vid-1, and was a no-op
    assert.equal(res2.currentTrack, undefined);
    assert.deepEqual(advancedTracks, ["vid-1"]);

    // Queue still has vid-2 and vid-3 (not skipped)
    const remaining = queueStore.getQueue(ROOM);
    assert.equal(remaining.length, 2);
    assert.equal(remaining[0]?.videoId, "vid-2");
    assert.equal(remaining[1]?.videoId, "vid-3");
  });

  // 3. DB failure during advancement (item must stay in queue)
  test("3. DB failure during advancement: item stays in queue and mutex releases", async () => {
    const t1 = makeTrack("vid-1");
    const t2 = makeTrack("vid-2");
    queueStore.enqueue(ROOM, t1);
    queueStore.enqueue(ROOM, t2);

    await assert.rejects(
      async () => {
        await advanceQueueUnderLock(ROOM, {
          onSetTrack: async () => {
            throw new Error("DB write failed");
          },
        });
      },
      /DB write failed/,
    );

    // Item was not dequeued because DB write threw before dequeue
    const queue = queueStore.getQueue(ROOM);
    assert.equal(queue.length, 2);
    assert.equal(queue[0]?.videoId, "vid-1");
    assert.equal(queue[1]?.videoId, "vid-2");

    // Mutex lock is clean and allows subsequent operations
    assert.equal(roomMutex.isLocked(ROOM), false);

    // Next advance can succeed
    const retryResult = await advanceQueueUnderLock(ROOM, {
      onSetTrack: async () => {},
    });
    assert.equal(retryResult.currentTrack?.videoId, "vid-1");
    assert.equal(queueStore.getQueue(ROOM).length, 1);
  });

  // 4. Duplicate advance with same expectedFrontVideoId (second is a no-op)
  test("4. Duplicate advance with same expectedFrontVideoId is a no-op", async () => {
    const t1 = makeTrack("vid-1");
    const t2 = makeTrack("vid-2");
    queueStore.enqueue(ROOM, t1);
    queueStore.enqueue(ROOM, t2);

    // First advance succeeds
    const first = await advanceQueueUnderLock(ROOM, {
      expectedFrontVideoId: "vid-1",
      onSetTrack: async () => {},
    });
    assert.equal(first.currentTrack?.videoId, "vid-1");
    assert.equal(first.queue.length, 1);

    // Second advance sends the same expectedFrontVideoId ("vid-1")
    let dbCalled = false;
    const second = await advanceQueueUnderLock(ROOM, {
      expectedFrontVideoId: "vid-1",
      onSetTrack: async () => {
        dbCalled = true;
      },
    });

    assert.equal(dbCalled, false);
    assert.equal(second.currentTrack, undefined);
    assert.equal(second.queue.length, 1);
    assert.equal(second.queue[0]?.videoId, "vid-2");
  });

  // 5. Queue capacity reached on enqueue
  test("5. Queue capacity reached on enqueue returns QUEUE_FULL error", () => {
    // Fill to capacity (50)
    for (let i = 0; i < 50; i++) {
      const res = queueStore.enqueue(ROOM, makeTrack(`vid-${i}`));
      assert.equal(res.ok, true);
    }

    assert.equal(queueStore.getQueue(ROOM).length, 50);

    // 51st enqueue must fail
    const overflow = queueStore.enqueue(ROOM, makeTrack("vid-overflow"));
    assert.equal(overflow.ok, false);
    if (!overflow.ok) {
      assert.equal(overflow.code, "QUEUE_FULL");
      assert.equal(overflow.queue.length, 50);
    }

    // Queue length remains 50
    assert.equal(queueStore.getQueue(ROOM).length, 50);
    // Last item is vid-49, not vid-overflow
    const q = queueStore.getQueue(ROOM);
    assert.equal(q[49]?.videoId, "vid-49");
  });

  // 6. Queue capacity reached on prepend
  test("6. Queue capacity reached on prepend returns QUEUE_FULL error", () => {
    for (let i = 0; i < 50; i++) {
      const res = queueStore.enqueue(ROOM, makeTrack(`vid-${i}`));
      assert.equal(res.ok, true);
    }

    const overflow = queueStore.prepend(ROOM, makeTrack("vid-prepend-overflow"));
    assert.equal(overflow.ok, false);
    if (!overflow.ok) {
      assert.equal(overflow.code, "QUEUE_FULL");
      assert.equal(overflow.queue.length, 50);
    }

    // Queue unchanged
    const q = queueStore.getQueue(ROOM);
    assert.equal(q.length, 50);
    assert.equal(q[0]?.videoId, "vid-0");
  });

  // 7. Concurrent enqueue operations (all within capacity must succeed, over-capacity must fail)
  test("7. Concurrent enqueue operations: within capacity succeed, over-capacity fail", async () => {
    // Start with 48 items
    for (let i = 0; i < 48; i++) {
      queueStore.enqueue(ROOM, makeTrack(`vid-${i}`));
    }
    assert.equal(queueStore.getQueue(ROOM).length, 48);

    // Attempt 5 concurrent enqueues under the room mutex
    const enqueues = [1, 2, 3, 4, 5].map((n) =>
      roomMutex.withLock(ROOM, async () => {
        return queueStore.enqueue(ROOM, makeTrack(`concurrent-${n}`));
      }),
    );

    const results = await Promise.all(enqueues);

    const successes = results.filter((r) => r.ok);
    const failures = results.filter((r) => !r.ok);

    assert.equal(successes.length, 2);
    assert.equal(failures.length, 3);
    for (const f of failures) {
      if (!f.ok) {
        assert.equal(f.code, "QUEUE_FULL");
      }
    }

    assert.equal(queueStore.getQueue(ROOM).length, 50);
  });

  // 8. Empty queue advance (clears playback, queue stays empty)
  test("8. Empty queue advance clears playback and leaves queue empty", async () => {
    let clearPlaybackCalled = false;

    const result = await advanceQueueUnderLock(ROOM, {
      onClearTrack: async () => {
        clearPlaybackCalled = true;
      },
    });

    assert.equal(clearPlaybackCalled, true);
    assert.equal(result.currentTrack, null);
    assert.deepEqual(result.queue, []);
    assert.deepEqual(queueStore.getQueue(ROOM), []);
  });

  // 9. Independent rooms run concurrently and don't block each other
  test("9. RoomMutex allows different rooms to run concurrently without blocking", async () => {
    const executionOrder: string[] = [];

    // Room A starts a slow operation
    const opA = roomMutex.withLock(ROOM, async () => {
      executionOrder.push("A:start");
      await new Promise((res) => setTimeout(res, 40));
      executionOrder.push("A:end");
      return "roomA";
    });

    // Room B starts immediately after
    const opB = roomMutex.withLock(ROOM_B, async () => {
      executionOrder.push("B:start");
      await new Promise((res) => setTimeout(res, 10));
      executionOrder.push("B:end");
      return "roomB";
    });

    const [resA, resB] = await Promise.all([opA, opB]);

    assert.equal(resA, "roomA");
    assert.equal(resB, "roomB");

    // Room B started and ended before Room A finished because locks are per-room!
    assert.equal(executionOrder[0], "A:start");
    assert.equal(executionOrder[1], "B:start");
    assert.equal(executionOrder[2], "B:end");
    assert.equal(executionOrder[3], "A:end");
  });
});
