import {
  getRoomMembersForPresence,
  transferRoomHost,
} from "../modules/rooms/rooms.service.js";
import type { RoomPresenceData } from "../modules/rooms/rooms.types.js";
import { presenceStore } from "./presenceStore.js";
import { emitPresence, emitToRoom } from "./roomBroadcast.js";
import type {
  HostChangeReason,
  HostPendingPayload,
  HostUpdatePayload,
} from "./host.types.js";
import { logger } from "../utils/logger.js";

/**
 * How long a disconnected host keeps the room before it is handed to someone
 * else. Long enough to survive a page refresh (token fetch + socket
 * reconnect), short enough that a room is not left uncontrollable.
 */
export const HOST_TRANSFER_GRACE_MS = 30_000;

interface PendingTransfer {
  timer: NodeJS.Timeout;
  /** Host the timer was armed for — a later transfer must not fire for anyone else. */
  hostUserId: string;
  deadline: number;
}

/**
 * Ephemeral per-room grace timers, keyed by roomCode — the same in-memory
 * pattern as `presenceStore` and `queueStore`. A server restart drops pending
 * transfers, which is harmless: the host column in PostgreSQL stays valid and
 * the next disconnect re-arms.
 */
class HostTransferStore {
  private readonly pending = new Map<string, PendingTransfer>();

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
    // Never hold the process open for a pending transfer.
    timer.unref?.();
    const deadline = Date.now() + delayMs;
    this.pending.set(roomCode, { timer, hostUserId, deadline });
    return deadline;
  }

  /** Returns the host the cancelled timer was armed for, if one was pending. */
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
}

const hostTransferStore = new HostTransferStore();

/**
 * The longest-standing member who is currently online and is not the departing
 * host. `roomData.members` is already ordered oldest-first by `joinedAt`, so
 * the first match is the correct successor.
 */
function pickSuccessor(
  roomCode: string,
  roomData: RoomPresenceData,
  excludeUserId: string,
): { userId: string; username: string } | null {
  return (
    roomData.members.find(
      (m) =>
        m.userId !== excludeUserId && presenceStore.isOnline(roomCode, m.userId),
    ) ?? null
  );
}

/**
 * Broadcasts the room's new host and a fresh presence snapshot. Shared by all
 * three transfer paths (grace-period expiry, manual promotion, host leaving)
 * so clients see one consistent event regardless of cause.
 */
export async function announceHostChange(
  roomCode: string,
  previousHost: { userId: string; username: string },
  reason: HostChangeReason,
): Promise<void> {
  const roomData = await getRoomMembersForPresence(roomCode);
  if (!roomData) return;

  const newHost = roomData.members.find(
    (m) => m.userId === roomData.hostUserId,
  );

  const payload: HostUpdatePayload = {
    hostUserId: roomData.hostUserId,
    hostUsername: newHost?.username ?? "",
    previousHostUserId: previousHost.userId,
    previousHostUsername: previousHost.username,
    reason,
  };

  emitToRoom(roomCode, "host:update", payload);
  emitPresence(roomCode, roomData);
}

function emitPending(
  roomCode: string,
  payload: HostPendingPayload,
): void {
  emitToRoom(roomCode, "host:pending", payload);
}

/**
 * Called when a user's last socket for a room drops. Arms the grace timer only
 * if that user was the host and someone else is online to take over; otherwise
 * the room simply keeps its current (frozen) state, as it did before Phase 9.
 */
export async function scheduleHostTransferIfHostLeft(
  roomCode: string,
  departedUserId: string,
  departedUsername: string,
): Promise<void> {
  const roomData = await getRoomMembersForPresence(roomCode);
  if (!roomData) return;
  if (roomData.hostUserId !== departedUserId) return;
  // Another tab of the host's is still connected.
  if (presenceStore.isOnline(roomCode, departedUserId)) return;

  const successor = pickSuccessor(roomCode, roomData, departedUserId);
  if (!successor) return;

  const deadline = hostTransferStore.arm(
    roomCode,
    departedUserId,
    HOST_TRANSFER_GRACE_MS,
    () => {
      void runScheduledTransfer(roomCode, departedUserId, departedUsername);
    },
  );

  logger.info(
    `Host ${departedUsername} dropped in ${roomCode} — transfer to ${successor.username} in ${HOST_TRANSFER_GRACE_MS / 1000}s`,
  );

  emitPending(roomCode, {
    pending: true,
    hostUserId: departedUserId,
    hostUsername: departedUsername,
    successorUsername: successor.username,
    deadline: new Date(deadline).toISOString(),
  });
}

/**
 * Grace period expired. Everything is re-validated here rather than trusting
 * the state captured when the timer was armed — 30 seconds is long enough for
 * the host to return, the successor to leave, or another transfer to land.
 */
async function runScheduledTransfer(
  roomCode: string,
  expectedHostUserId: string,
  expectedHostUsername: string,
): Promise<void> {
  let transferred = false;
  try {
    const roomData = await getRoomMembersForPresence(roomCode);
    if (!roomData) return;
    if (roomData.hostUserId !== expectedHostUserId) return;
    if (presenceStore.isOnline(roomCode, expectedHostUserId)) return;

    const successor = pickSuccessor(roomCode, roomData, expectedHostUserId);
    if (!successor) return;

    const applied = await transferRoomHost(
      roomData.roomId,
      expectedHostUserId,
      successor.userId,
    );
    if (!applied) return;

    transferred = true;

    logger.info(
      `Host transferred in ${roomCode}: ${expectedHostUsername} → ${successor.username} (disconnect)`,
    );

    await announceHostChange(
      roomCode,
      { userId: expectedHostUserId, username: expectedHostUsername },
      "disconnect",
    );
  } catch (err) {
    logger.error(`Scheduled host transfer failed for ${roomCode}`, err);
  } finally {
    // Every path that did not transfer (successor went offline, the host
    // changed underneath us, an error) still has to retire the countdown
    // banner; a successful transfer retires it via `host:update`.
    if (!transferred) {
      emitPending(roomCode, {
        pending: false,
        hostUserId: expectedHostUserId,
        hostUsername: expectedHostUsername,
      });
    }
  }
}

/**
 * Called on every `room:join`. If the returning user is the host a pending
 * transfer was armed for, the countdown is cancelled and the room is told.
 */
export function cancelPendingTransferOnReturn(
  roomCode: string,
  userId: string,
  username: string,
  currentHostUserId: string,
): void {
  if (!hostTransferStore.isPending(roomCode)) return;
  if (currentHostUserId !== userId) return;

  const cancelledFor = hostTransferStore.cancel(roomCode);
  if (cancelledFor !== userId) return;

  logger.info(`Host ${username} returned to ${roomCode} — transfer cancelled`);

  emitPending(roomCode, {
    pending: false,
    hostUserId: userId,
    hostUsername: username,
  });
}

/** Drops any pending countdown, e.g. once the host role has moved anyway. */
export function clearPendingTransfer(roomCode: string): void {
  hostTransferStore.cancel(roomCode);
}
