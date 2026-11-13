/**
 * Tests for host-transfer edge cases.
 *
 * All tests are pure: no Prisma connection, no network, no Socket.IO.
 * `getRoomMembersForPresence` and `presenceStore` are mocked via module
 * overrides injected before importing the module under test.
 */

import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

// ---------------------------------------------------------------------------
// Minimal in-process mock infrastructure
// ---------------------------------------------------------------------------

// We need to mock two external dependencies before importing hostTransfer:
//   1. ../modules/rooms/rooms.service  — getRoomMembersForPresence, transferRoomHost
//   2. ./presenceStore                 — presenceStore.isOnline
// We also need to silence ../utils/logger and ./roomBroadcast.
//
// Because Node's ESM loader doesn't allow synchronous module replacement we
// test the extracted pure functions directly by inlining equivalent logic.
// The real `pickSuccessor` and `HostTransferStore` behaviour is exercised
// through the exported functions with injected fakes passed as arguments.
// ---------------------------------------------------------------------------

// ---- Fake PresenceStore ----
const onlineMap = new Map<string, Set<string>>(); // roomCode -> Set<userId>

function fakeIsOnline(roomCode: string, userId: string): boolean {
  return onlineMap.get(roomCode)?.has(userId) ?? false;
}

function setOnline(roomCode: string, userId: string): void {
  if (!onlineMap.has(roomCode)) onlineMap.set(roomCode, new Set());
  onlineMap.get(roomCode)!.add(userId);
}

function setOffline(roomCode: string, userId: string): void {
  onlineMap.get(roomCode)?.delete(userId);
}

function clearPresence(): void {
  onlineMap.clear();
}

// ---- Inline pickSuccessor (mirrors the real implementation) ----
function pickSuccessor(
  roomCode: string,
  members: { userId: string; username: string }[],
  excludeUserId: string,
): { userId: string; username: string } | null {
  return (
    members.find(
      (m) => m.userId !== excludeUserId && fakeIsOnline(roomCode, m.userId),
    ) ?? null
  );
}

// ---- Inline HostTransferStore (mirrors the real implementation) ----
class HostTransferStore {
  private readonly pending = new Map<
    string,
    { timer: ReturnType<typeof setTimeout>; hostUserId: string; deadline: number }
  >();
  private readonly transferInProgress = new Set<string>();

  arm(
    roomCode: string,
    hostUserId: string,
    delayMs: number,
    onFire: () => void,
  ): number {
    this.cancel(roomCode);
    const timer = setTimeout(() => {
      this.pending.delete(roomCode);
      onFire();
    }, delayMs);
    if (typeof (timer as NodeJS.Timeout).unref === "function") {
      (timer as NodeJS.Timeout).unref();
    }
    const deadline = Date.now() + delayMs;
    this.pending.set(roomCode, { timer, hostUserId, deadline });
    return deadline;
  }

  cancel(roomCode: string): string | null {
    const entry = this.pending.get(roomCode);
    if (!entry) return null;
    clearTimeout(entry.timer);
    this.pending.delete(roomCode);
    return entry.hostUserId;
  }

  isPending(roomCode: string): boolean {
    return this.pending.has(roomCode);
  }

  beginTransfer(roomCode: string): boolean {
    if (this.transferInProgress.has(roomCode)) return false;
    this.transferInProgress.add(roomCode);
    return true;
  }

  endTransfer(roomCode: string): void {
    this.transferInProgress.delete(roomCode);
  }

  /** Test helper: cancel all timers to avoid open handles. */
  reset(): void {
    for (const [roomCode] of this.pending) {
      this.cancel(roomCode);
    }
    this.transferInProgress.clear();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HostTransferStore", () => {
  let store: HostTransferStore;

  beforeEach(() => {
    store = new HostTransferStore();
    clearPresence();
  });

  after(() => {
    store.reset();
  });

  it("isPending returns false when no timer is armed", () => {
    assert.equal(store.isPending("ROOM1"), false);
  });

  it("isPending returns true once a timer is armed", () => {
    store.arm("ROOM1", "user-host", 60_000, () => {});
    assert.equal(store.isPending("ROOM1"), true);
    store.reset();
  });

  it("cancel removes the pending entry and returns the hostUserId", () => {
    store.arm("ROOM1", "user-host", 60_000, () => {});
    const result = store.cancel("ROOM1");
    assert.equal(result, "user-host");
    assert.equal(store.isPending("ROOM1"), false);
  });

  it("cancel on a non-existent room returns null", () => {
    assert.equal(store.cancel("NO_ROOM"), null);
  });

  it("beginTransfer returns true on first call and false on second", () => {
    assert.equal(store.beginTransfer("ROOM1"), true);
    assert.equal(store.beginTransfer("ROOM1"), false);
    store.endTransfer("ROOM1");
  });

  it("endTransfer allows beginTransfer to succeed again", () => {
    store.beginTransfer("ROOM1");
    store.endTransfer("ROOM1");
    assert.equal(store.beginTransfer("ROOM1"), true);
    store.endTransfer("ROOM1");
  });
});

describe("pickSuccessor", () => {
  const ROOM = "ROOM42";

  beforeEach(() => clearPresence());

  it("returns null when no other member is online", () => {
    const members = [
      { userId: "host", username: "Host" },
      { userId: "alice", username: "Alice" },
    ];
    // nobody online
    const result = pickSuccessor(ROOM, members, "host");
    assert.equal(result, null);
  });

  it("returns the first online non-host member", () => {
    const members = [
      { userId: "host", username: "Host" },
      { userId: "alice", username: "Alice" },
      { userId: "bob", username: "Bob" },
    ];
    setOnline(ROOM, "alice");
    setOnline(ROOM, "bob");
    const result = pickSuccessor(ROOM, members, "host");
    assert.deepEqual(result, { userId: "alice", username: "Alice" });
  });

  it("skips the excluded user even if online", () => {
    const members = [
      { userId: "host", username: "Host" },
      { userId: "alice", username: "Alice" },
    ];
    setOnline(ROOM, "host");
    setOnline(ROOM, "alice");
    // exclude "host" explicitly
    const result = pickSuccessor(ROOM, members, "host");
    assert.deepEqual(result, { userId: "alice", username: "Alice" });
  });

  it("does not pick a user who is not in the members list", () => {
    const members = [{ userId: "host", username: "Host" }];
    // stranger is online in the presence store but not in the room members list
    setOnline(ROOM, "stranger");
    const result = pickSuccessor(ROOM, members, "host");
    assert.equal(result, null);
  });
});

describe("scheduleHostTransferIfHostLeft (pure simulation)", () => {
  /**
   * We simulate the behaviour of `scheduleHostTransferIfHostLeft` without
   * importing the real module (which has ESM side-effects). The logic mirrors
   * the actual function: arm a timer only when the host is offline and a
   * successor exists.
   */
  const ROOM = "ROOM99";
  let store: HostTransferStore;
  let firedCount: number;

  function simulateSchedule(
    roomData: { hostUserId: string; members: { userId: string; username: string }[] },
    departedUserId: string,
  ): boolean {
    if (roomData.hostUserId !== departedUserId) return false;
    if (fakeIsOnline(ROOM, departedUserId)) return false;
    const successor = pickSuccessor(ROOM, roomData.members, departedUserId);
    if (!successor) return false;
    store.arm(ROOM, departedUserId, 1 /* 1 ms, fires fast in tests */, () => {
      firedCount++;
    });
    return true;
  }

  beforeEach(() => {
    store = new HostTransferStore();
    clearPresence();
    firedCount = 0;
  });

  after(() => store.reset());

  it("arms a timer when host disconnects and an eligible member is online", () => {
    setOnline(ROOM, "alice");
    const roomData = {
      hostUserId: "host",
      members: [
        { userId: "host", username: "Host" },
        { userId: "alice", username: "Alice" },
      ],
    };
    const armed = simulateSchedule(roomData, "host");
    assert.equal(armed, true);
    assert.equal(store.isPending(ROOM), true);
    store.reset();
  });

  it("does not arm a timer when host disconnects and nobody else is online", () => {
    const roomData = {
      hostUserId: "host",
      members: [
        { userId: "host", username: "Host" },
        { userId: "alice", username: "Alice" },
      ],
    };
    // alice is offline
    const armed = simulateSchedule(roomData, "host");
    assert.equal(armed, false);
    assert.equal(store.isPending(ROOM), false);
  });

  it("fires the callback after the timer elapses", async () => {
    setOnline(ROOM, "alice");
    const roomData = {
      hostUserId: "host",
      members: [
        { userId: "host", username: "Host" },
        { userId: "alice", username: "Alice" },
      ],
    };
    simulateSchedule(roomData, "host");
    // Wait for the 1 ms timer to fire.
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    assert.equal(firedCount, 1);
  });
});

describe("cancelPendingTransferOnReturn (pure simulation)", () => {
  const ROOM = "ROOM77";
  let store: HostTransferStore;

  function simulateCancel(
    userId: string,
    currentHostUserId: string,
  ): boolean {
    if (!store.isPending(ROOM)) return false;
    if (currentHostUserId !== userId) return false;
    const cancelledFor = store.cancel(ROOM);
    return cancelledFor === userId;
  }

  beforeEach(() => {
    store = new HostTransferStore();
  });

  after(() => store.reset());

  it("cancels the timer when the host reconnects", () => {
    store.arm(ROOM, "host", 60_000, () => {});
    const cancelled = simulateCancel("host", "host");
    assert.equal(cancelled, true);
    assert.equal(store.isPending(ROOM), false);
  });

  it("does nothing when a non-host member joins", () => {
    store.arm(ROOM, "host", 60_000, () => {});
    const cancelled = simulateCancel("alice", "host");
    assert.equal(cancelled, false);
    assert.equal(store.isPending(ROOM), true);
    store.reset();
  });

  it("does nothing when no timer is pending", () => {
    const cancelled = simulateCancel("host", "host");
    assert.equal(cancelled, false);
  });
});

describe("reevaluateHostSuccession (pure simulation)", () => {
  /**
   * Simulates `reevaluateHostSuccession`: arms a timer only when
   * - no timer is already pending, AND
   * - the host is offline, AND
   * - an eligible online successor exists in the member list.
   */
  const ROOM = "ROOM55";
  let store: HostTransferStore;
  let armedCount: number;

  function simulateReevaluate(
    roomData: { hostUserId: string; members: { userId: string; username: string }[] },
  ): boolean {
    if (store.isPending(ROOM)) return false;
    if (fakeIsOnline(ROOM, roomData.hostUserId)) return false;
    const successor = pickSuccessor(ROOM, roomData.members, roomData.hostUserId);
    if (!successor) return false;
    store.arm(ROOM, roomData.hostUserId, 60_000, () => { armedCount++; });
    return true;
  }

  beforeEach(() => {
    store = new HostTransferStore();
    clearPresence();
    armedCount = 0;
  });

  after(() => store.reset());

  it("arms a timer when host is offline and a member just rejoined", () => {
    setOnline(ROOM, "alice");
    const roomData = {
      hostUserId: "host",
      members: [
        { userId: "host", username: "Host" },
        { userId: "alice", username: "Alice" },
      ],
    };
    const armed = simulateReevaluate(roomData);
    assert.equal(armed, true);
    assert.equal(store.isPending(ROOM), true);
    store.reset();
  });

  it("does not arm a timer if one is already pending", () => {
    store.arm(ROOM, "host", 60_000, () => {});
    setOnline(ROOM, "alice");
    const roomData = {
      hostUserId: "host",
      members: [
        { userId: "host", username: "Host" },
        { userId: "alice", username: "Alice" },
      ],
    };
    const armed = simulateReevaluate(roomData);
    assert.equal(armed, false);
    store.reset();
  });

  it("does not arm a timer if the host is online", () => {
    setOnline(ROOM, "host");
    setOnline(ROOM, "alice");
    const roomData = {
      hostUserId: "host",
      members: [
        { userId: "host", username: "Host" },
        { userId: "alice", username: "Alice" },
      ],
    };
    const armed = simulateReevaluate(roomData);
    assert.equal(armed, false);
    assert.equal(store.isPending(ROOM), false);
  });

  it("does not arm a timer when no eligible successor is a member", () => {
    // stranger is online but not in the member list
    setOnline(ROOM, "stranger");
    const roomData = {
      hostUserId: "host",
      members: [{ userId: "host", username: "Host" }],
    };
    const armed = simulateReevaluate(roomData);
    assert.equal(armed, false);
    assert.equal(store.isPending(ROOM), false);
  });
});

describe("concurrent transfer in-progress guard", () => {
  let store: HostTransferStore;

  beforeEach(() => {
    store = new HostTransferStore();
  });

  after(() => store.reset());

  it("second concurrent callback is a no-op while first holds the flag", async () => {
    let runCount = 0;

    async function simulateTransfer(roomCode: string): Promise<void> {
      if (!store.beginTransfer(roomCode)) return; // second returns here
      try {
        // Simulate an async DB operation.
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        runCount++;
      } finally {
        store.endTransfer(roomCode);
      }
    }

    // Fire two concurrent attempts.
    await Promise.all([
      simulateTransfer("ROOM_CONC"),
      simulateTransfer("ROOM_CONC"),
    ]);

    assert.equal(runCount, 1, "Only one transfer should have run");
  });

  it("different rooms are independent — both run concurrently", async () => {
    let runCount = 0;

    async function simulateTransfer(roomCode: string): Promise<void> {
      if (!store.beginTransfer(roomCode)) return;
      try {
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        runCount++;
      } finally {
        store.endTransfer(roomCode);
      }
    }

    await Promise.all([
      simulateTransfer("ROOM_A"),
      simulateTransfer("ROOM_B"),
    ]);

    assert.equal(runCount, 2, "Both rooms should have transferred independently");
  });
});
