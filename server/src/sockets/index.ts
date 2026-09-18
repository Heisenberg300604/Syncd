import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { verifyToken } from "@clerk/backend";
import { config } from "../config/env.js";
import { findUserByClerkId } from "../modules/users/users.service.js";
import { validateRoomCode } from "../modules/rooms/rooms.validation.js";
import {
  getRoomHostId,
  getRoomIdIfMember,
  getRoomMembersForPresence,
  transferRoomHost,
} from "../modules/rooms/rooms.service.js";
import { presenceStore } from "./presenceStore.js";
import {
  applyPlaybackControl,
  clearRoomTrack,
  getRoomPlayback,
  setRoomTrack,
} from "../modules/playback/playback.service.js";
import {
  isPlaybackAction,
  validateTrackInput,
} from "../modules/playback/playback.validation.js";
import type {
  PlaybackAck,
  PlaybackClearPayload,
  PlaybackControlPayload,
  PlaybackSetPayload,
  PlaybackSnapshot,
} from "../modules/playback/playback.types.js";
import {
  createMessage,
  getRecentMessages,
} from "../modules/messages/messages.service.js";
import { validateMessageContent } from "../modules/messages/messages.validation.js";
import type {
  ChatMessageDTO,
  ChatSendAck,
  ChatSendPayload,
} from "../modules/messages/messages.types.js";
import type { RoomJoinPayload, RoomJoinResponse } from "./presence.types.js";
import type {
  HostTransferAck,
  HostTransferPayload,
} from "./host.types.js";
import {
  announceHostChange,
  cancelPendingTransferOnReturn,
  clearPendingTransfer,
  scheduleHostTransferIfHostLeft,
} from "./hostTransfer.js";
import {
  broadcastPresence,
  roomName,
  setRoomBroadcaster,
} from "./roomBroadcast.js";
import { reply } from "./ack.js";
import { queueStore } from "./queueStore.js";
import type {
  QueueAck,
  QueueAddPayload,
  QueueAdvancePayload,
  QueueClearPayload,
  QueueItem,
  QueueRemovePayload,
  QueueReorderPayload,
  QueueSnapshot,
} from "./queue.types.js";
import { enforceSocketRateLimit } from "../middleware/rateLimit.js";
import { SOCKET_RATE_LIMITS } from "../config/rateLimits.js";
import { logger } from "../utils/logger.js";

export function createSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.corsOrigins,
      credentials: true,
    },
    // The largest legitimate payload is a track object of a few hundred bytes;
    // the 1 MB default is a free memory-amplification primitive.
    maxHttpBufferSize: 100_000,
  });

  setRoomBroadcaster(io);

  io.use(async (socket, next) => {
    const token = socket.handshake.auth["token"] as string | undefined;
    if (!token) {
      next(new Error("Missing auth token"));
      return;
    }

    try {
      // `authorizedParties` pins the token to a frontend this API actually
      // serves, so a session token minted for a different origin on the same
      // Clerk instance cannot be replayed here.
      const payload = await verifyToken(token, {
        secretKey: config.clerkSecretKey,
        authorizedParties: config.clerkAuthorizedParties,
      });
      const clerkUserId = payload.sub;
      if (!clerkUserId) {
        next(new Error("Invalid token: missing subject"));
        return;
      }

      const user = await findUserByClerkId(clerkUserId);
      if (!user) {
        next(new Error("User profile not found"));
        return;
      }

      socket.data.user = user;
      next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Auth failed";
      logger.warn("Socket authentication rejected", { reason: message });
      next(new Error(message));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as
      | {
          id: string;
          clerkUserId: string;
          username: string;
        }
      | undefined;

    if (!user) {
      socket.disconnect(true);
      return;
    }

    logger.info(`Socket connected: ${user.username} (${socket.id})`);

    const joinedRooms = new Map<string, string>(); // roomCode -> socketRoomName

    socket.on(
      "room:join",
      (payload: RoomJoinPayload, ack?: (res: RoomJoinResponse) => void) => {
        handleRoomJoin(io, socket, user, payload, ack, joinedRooms).catch(
          (err) => {
            const message = err instanceof Error ? err.message : "Join failed";
            reply(ack, { ok: false, message });
          },
        );
      },
    );

    socket.on(
      "playback:set",
      (payload: PlaybackSetPayload, ack?: (res: PlaybackAck) => void) => {
        handlePlaybackSet(io, user, payload, joinedRooms)
          .then((playback) => reply(ack, { ok: true, playback }))
          .catch((err) => reply(ack, { ok: false, message: messageOf(err) }));
      },
    );

    socket.on(
      "playback:control",
      (payload: PlaybackControlPayload, ack?: (res: PlaybackAck) => void) => {
        handlePlaybackControl(io, user, payload, joinedRooms)
          .then((playback) => reply(ack, { ok: true, playback }))
          .catch((err) => reply(ack, { ok: false, message: messageOf(err) }));
      },
    );

    socket.on(
      "playback:clear",
      (payload: PlaybackClearPayload, ack?: (res: PlaybackAck) => void) => {
        handlePlaybackClear(io, user, payload, joinedRooms)
          .then((playback) => reply(ack, { ok: true, playback }))
          .catch((err) => reply(ack, { ok: false, message: messageOf(err) }));
      },
    );

    // -----------------------------------------------------------------------
    // Queue events — host-only mutations, all members receive queue:update
    // -----------------------------------------------------------------------

    socket.on(
      "queue:add",
      (payload: QueueAddPayload, ack?: (res: QueueAck) => void) => {
        handleQueueAdd(io, user, payload, joinedRooms)
          .then((queue) => reply(ack, { ok: true, queue }))
          .catch((err) => reply(ack, { ok: false, message: messageOf(err) }));
      },
    );

    socket.on(
      "queue:prepend",
      (payload: QueueAddPayload, ack?: (res: QueueAck) => void) => {
        handleQueuePrepend(io, user, payload, joinedRooms)
          .then((queue) => reply(ack, { ok: true, queue }))
          .catch((err) => reply(ack, { ok: false, message: messageOf(err) }));
      },
    );

    socket.on(
      "queue:remove",
      (payload: QueueRemovePayload, ack?: (res: QueueAck) => void) => {
        handleQueueRemove(io, user, payload, joinedRooms)
          .then((queue) => reply(ack, { ok: true, queue }))
          .catch((err) => reply(ack, { ok: false, message: messageOf(err) }));
      },
    );

    socket.on(
      "queue:reorder",
      (payload: QueueReorderPayload, ack?: (res: QueueAck) => void) => {
        handleQueueReorder(io, user, payload, joinedRooms)
          .then((queue) => reply(ack, { ok: true, queue }))
          .catch((err) => reply(ack, { ok: false, message: messageOf(err) }));
      },
    );

    socket.on(
      "queue:advance",
      (payload: QueueAdvancePayload, ack?: (res: QueueAck) => void) => {
        handleQueueAdvance(io, user, payload, joinedRooms)
          .then((queue) => reply(ack, { ok: true, queue }))
          .catch((err) => reply(ack, { ok: false, message: messageOf(err) }));
      },
    );

    socket.on(
      "queue:clear",
      (payload: QueueClearPayload, ack?: (res: QueueAck) => void) => {
        handleQueueClear(io, user, payload, joinedRooms)
          .then((queue) => reply(ack, { ok: true, queue }))
          .catch((err) => reply(ack, { ok: false, message: messageOf(err) }));
      },
    );

    socket.on(
      "chat:send",
      (payload: ChatSendPayload, ack?: (res: ChatSendAck) => void) => {
        handleChatSend(io, user, payload, joinedRooms)
          .then(() => reply(ack, { ok: true }))
          .catch((err) =>
            reply(ack, {
              ok: false,
              message: messageOf(err, "Could not send message"),
            }),
          );
      },
    );

    socket.on(
      "host:transfer",
      (payload: HostTransferPayload, ack?: (res: HostTransferAck) => void) => {
        handleHostTransfer(user, payload, joinedRooms)
          .then(() => reply(ack, { ok: true }))
          .catch((err) =>
            reply(ack, {
              ok: false,
              message: messageOf(err, "Could not transfer host"),
            }),
          );
      },
    );

    // The only listener whose body runs synchronously, so it carries its own
    // guard: Socket.IO emits listeners from a `process.nextTick` with no
    // try/catch of its own, and an escaping throw ends the process for every
    // connected room, not just this socket.
    socket.on("room:leave", (payload: RoomJoinPayload, ack?: () => void) => {
      try {
        const validation = validateRoomCode(payload?.roomCode);
        if (validation.ok) {
          handleRoomLeave(socket, user, validation.value, joinedRooms);
        }
      } catch (err) {
        logger.error("room:leave failed", err);
      }
      reply(ack, undefined);
    });

    socket.on("disconnect", (reason) => {
      logger.info(
        `Socket disconnected: ${user.username} (${socket.id}) — ${reason}`,
      );

      for (const [roomCode, socketRoomName] of joinedRooms) {
        socket.leave(socketRoomName);
        const nowOffline = presenceStore.removeSocket(
          roomCode,
          user.id,
          socket.id,
        );
        if (nowOffline) {
          broadcastPresence(roomCode);
          scheduleHostTransferIfHostLeft(roomCode, user.id, user.username).catch(
            (err) =>
              logger.error(`Host transfer scheduling failed for ${roomCode}`, err),
          );
        }
      }
      joinedRooms.clear();
    });
  });

  return io;
}

async function handleRoomJoin(
  io: SocketIOServer,
  socket: Socket,
  user: { id: string; clerkUserId: string; username: string },
  payload: RoomJoinPayload,
  /**
   * Socket.IO only supplies this when the client sends one. Every call site
   * has to tolerate its absence: an ack invoked as a plain value throws, and a
   * throw inside a socket listener takes the whole process down with it.
   */
  ack: ((res: RoomJoinResponse) => void) | undefined,
  joinedRooms: Map<string, string>,
): Promise<void> {
  enforceSocketRateLimit("socket:join", user.id, SOCKET_RATE_LIMITS.roomJoin);

  const validation = validateRoomCode(payload?.roomCode);
  if (!validation.ok) {
    reply(ack, { ok: false, message: validation.message });
    return;
  }

  const roomCode = validation.value;

  const roomData = await getRoomMembersForPresence(roomCode);
  if (!roomData) {
    reply(ack, { ok: false, message: "Room not found" });
    return;
  }

  const isMember = roomData.members.some((m) => m.userId === user.id);
  if (!isMember) {
    reply(ack, { ok: false, message: "Not a member of this room" });
    return;
  }

  const socketRoomName = roomName(roomCode);

  for (const [prevRoomCode, prevRoomName] of joinedRooms) {
    if (prevRoomCode !== roomCode) {
      socket.leave(prevRoomName);
      presenceStore.removeSocket(prevRoomCode, user.id, socket.id);
      broadcastPresence(prevRoomCode);
    }
  }

  joinedRooms.forEach((_, code) => {
    if (code !== roomCode) joinedRooms.delete(code);
  });

  const wasNewUser = presenceStore.addSocket(
    roomCode,
    user.id,
    user.username,
    socket.id,
  );
  socket.join(socketRoomName);
  joinedRooms.set(roomCode, socketRoomName);

  // A host who reconnects inside the grace window keeps the room.
  cancelPendingTransferOnReturn(
    roomCode,
    user.id,
    user.username,
    roomData.hostUserId,
  );

  const presence = presenceStore.getSnapshot(
    roomCode,
    roomData.members,
    roomData.hostUserId,
  );
  const playback = await getRoomPlayback(roomCode);
  const messages = await getRecentMessages(roomData.roomId);
  const queue = queueStore.getQueue(roomCode);

  reply(ack, { ok: true, presence, messages, queue, ...(playback ? { playback } : {}) });

  if (wasNewUser) {
    broadcastPresence(roomCode);
  }
}

function handleRoomLeave(
  socket: Socket,
  user: { id: string; clerkUserId: string; username: string },
  roomCode: string,
  joinedRooms: Map<string, string>,
): void {
  const socketRoomName = roomName(roomCode);
  socket.leave(socketRoomName);
  const nowOffline = presenceStore.removeSocket(roomCode, user.id, socket.id);
  joinedRooms.delete(roomCode);
  if (nowOffline) {
    broadcastPresence(roomCode);
    scheduleHostTransferIfHostLeft(roomCode, user.id, user.username).catch(
      (err) => logger.error(`Host transfer scheduling failed for ${roomCode}`, err),
    );
  }
}

function messageOf(err: unknown, fallback = "Playback update failed"): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * `joinedRooms` is only populated by `handleRoomJoin`, which verifies
 * membership against the database. Reusing it keeps every playback event
 * authorized without a query per play/pause.
 *
 * It is a cache of what was true at join time, not the authority: a user can
 * leave the room while holding the connection. Every event that writes
 * re-reads the current state — `assertHost` for the host-only ones, and a
 * membership lookup for chat.
 */
function assertJoined(
  roomCode: unknown,
  joinedRooms: Map<string, string>,
): string {
  const validation = validateRoomCode(roomCode);
  if (!validation.ok) {
    throw new Error(validation.message);
  }
  if (!joinedRooms.has(validation.value)) {
    throw new Error("Not a member of this room");
  }
  return validation.value;
}

/**
 * Only the host may mutate playback. The frontend hides the controls for
 * everyone else, but that is a UX nicety — this is the actual boundary, since
 * the socket payload is otherwise just a room code any member could send.
 */
async function assertHost(
  roomCode: string,
  userId: string,
  action = "control playback",
): Promise<void> {
  const hostUserId = await getRoomHostId(roomCode);
  if (!hostUserId) {
    throw new Error("Room not found");
  }
  if (hostUserId !== userId) {
    throw new Error(`Only the host can ${action}`);
  }
}

/**
 * Manual promotion. The target is verified against `RoomMember` rather than
 * trusted from the payload, and the write is conditional on the caller still
 * being the host, so a promotion racing an automatic transfer cannot produce
 * two hosts.
 */
async function handleHostTransfer(
  user: { id: string; username: string },
  payload: HostTransferPayload,
  joinedRooms: Map<string, string>,
): Promise<void> {
  enforceSocketRateLimit(
    "socket:hostTransfer",
    user.id,
    SOCKET_RATE_LIMITS.hostTransfer,
  );

  const roomCode = assertJoined(payload?.roomCode, joinedRooms);
  await assertHost(roomCode, user.id, "hand over the room");

  const targetUserId =
    typeof payload?.userId === "string" ? payload.userId.trim() : "";
  if (!targetUserId) {
    throw new Error("No member selected");
  }
  if (targetUserId === user.id) {
    throw new Error("You are already the host");
  }

  const roomData = await getRoomMembersForPresence(roomCode);
  if (!roomData) {
    throw new Error("Room not found");
  }

  const target = roomData.members.find((m) => m.userId === targetUserId);
  if (!target) {
    throw new Error("That person is not a member of this room");
  }

  const applied = await transferRoomHost(
    roomData.roomId,
    user.id,
    targetUserId,
  );
  if (!applied) {
    throw new Error("The host changed — try again");
  }

  // The room has a live host again; any countdown is moot.
  clearPendingTransfer(roomCode);

  logger.info(
    `Host transferred in ${roomCode}: ${user.username} → ${target.username} (manual)`,
  );

  await announceHostChange(
    roomCode,
    { userId: user.id, username: user.username },
    "manual",
  );
}

async function handlePlaybackSet(
  io: SocketIOServer,
  user: { id: string; username: string },
  payload: PlaybackSetPayload,
  joinedRooms: Map<string, string>,
): Promise<PlaybackSnapshot> {
  enforceSocketRateLimit("socket:playback", user.id, SOCKET_RATE_LIMITS.playback);

  const roomCode = assertJoined(payload?.roomCode, joinedRooms);
  await assertHost(roomCode, user.id);

  const validation = validateTrackInput(payload?.track);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const playback = await setRoomTrack(roomCode, user.id, validation.value);
  logger.info(
    `${user.username} set ${validation.value.videoId} in ${roomCode}`,
  );
  broadcastPlayback(io, roomCode, playback);
  return playback;
}

async function handlePlaybackControl(
  io: SocketIOServer,
  user: { id: string; username: string },
  payload: PlaybackControlPayload,
  joinedRooms: Map<string, string>,
): Promise<PlaybackSnapshot> {
  enforceSocketRateLimit("socket:playback", user.id, SOCKET_RATE_LIMITS.playback);

  const roomCode = assertJoined(payload?.roomCode, joinedRooms);
  await assertHost(roomCode, user.id);

  if (!isPlaybackAction(payload?.action)) {
    throw new Error("Unknown playback action");
  }

  const playback = await applyPlaybackControl(
    roomCode,
    user.id,
    payload.action,
    Number(payload?.position),
  );
  broadcastPlayback(io, roomCode, playback);
  return playback;
}

async function handlePlaybackClear(
  io: SocketIOServer,
  user: { id: string; username: string },
  payload: PlaybackClearPayload,
  joinedRooms: Map<string, string>,
): Promise<PlaybackSnapshot> {
  enforceSocketRateLimit("socket:playback", user.id, SOCKET_RATE_LIMITS.playback);

  const roomCode = assertJoined(payload?.roomCode, joinedRooms);
  await assertHost(roomCode, user.id);
  const playback = await clearRoomTrack(roomCode, user.id);
  // Clearing the track also empties the queue — no point keeping queued
  // items when the host explicitly stops playback.
  const emptyQueue = queueStore.clearQueue(roomCode);
  broadcastPlayback(io, roomCode, playback);
  broadcastQueue(io, roomCode, emptyQueue);
  return playback;
}

function broadcastPlayback(
  io: SocketIOServer,
  roomCode: string,
  playback: PlaybackSnapshot,
): void {
  io.to(roomName(roomCode)).emit("playback:update", playback);
}

function broadcastQueue(
  io: SocketIOServer,
  roomCode: string,
  queue: QueueSnapshot,
): void {
  io.to(roomName(roomCode)).emit("queue:update", queue);
}

// ---------------------------------------------------------------------------
// Queue handlers
// ---------------------------------------------------------------------------

async function handleQueueAdd(
  io: SocketIOServer,
  user: { id: string; username: string },
  payload: QueueAddPayload,
  joinedRooms: Map<string, string>,
): Promise<QueueSnapshot> {
  enforceSocketRateLimit("socket:queue", user.id, SOCKET_RATE_LIMITS.queue);

  const roomCode = assertJoined(payload?.roomCode, joinedRooms);
  await assertHost(roomCode, user.id);

  // A queued item is promoted to the room's current track verbatim by
  // `queue:advance`, so it goes through exactly the same validation as
  // `playback:set` rather than a looser clamp of its own.
  const validation = validateTrackInput(payload?.track);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const item: QueueItem = validation.value;

  const queue = queueStore.enqueue(roomCode, item);
  logger.info(`${user.username} queued ${item.videoId} in ${roomCode}`);
  broadcastQueue(io, roomCode, queue);
  return queue;
}

async function handleQueuePrepend(
  io: SocketIOServer,
  user: { id: string; username: string },
  payload: QueueAddPayload,
  joinedRooms: Map<string, string>,
): Promise<QueueSnapshot> {
  enforceSocketRateLimit("socket:queue", user.id, SOCKET_RATE_LIMITS.queue);

  const roomCode = assertJoined(payload?.roomCode, joinedRooms);
  await assertHost(roomCode, user.id);

  const validation = validateTrackInput(payload?.track);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const item: QueueItem = validation.value;

  const queue = queueStore.prepend(roomCode, item);
  logger.info(`${user.username} prepended ${item.videoId} in ${roomCode}`);
  broadcastQueue(io, roomCode, queue);
  return queue;
}

async function handleQueueRemove(
  io: SocketIOServer,
  user: { id: string; username: string },
  payload: QueueRemovePayload,
  joinedRooms: Map<string, string>,
): Promise<QueueSnapshot> {
  enforceSocketRateLimit("socket:queue", user.id, SOCKET_RATE_LIMITS.queue);

  const roomCode = assertJoined(payload?.roomCode, joinedRooms);
  await assertHost(roomCode, user.id);

  const index = Number(payload?.index);
  const queue = queueStore.remove(roomCode, index);
  broadcastQueue(io, roomCode, queue);
  return queue;
}

async function handleQueueReorder(
  io: SocketIOServer,
  user: { id: string; username: string },
  payload: QueueReorderPayload,
  joinedRooms: Map<string, string>,
): Promise<QueueSnapshot> {
  enforceSocketRateLimit("socket:queue", user.id, SOCKET_RATE_LIMITS.queue);

  const roomCode = assertJoined(payload?.roomCode, joinedRooms);
  await assertHost(roomCode, user.id);

  const fromIndex = Number(payload?.fromIndex);
  const toIndex = Number(payload?.toIndex);
  const queue = queueStore.reorder(roomCode, fromIndex, toIndex);
  broadcastQueue(io, roomCode, queue);
  return queue;
}

/**
 * Host client detected that the current track ended (or explicitly skipped).
 * Pop the next item from the queue and set it as the room's current track.
 * If the queue is empty, clear playback.
 */
async function handleQueueAdvance(
  io: SocketIOServer,
  user: { id: string; username: string },
  payload: QueueAdvancePayload,
  joinedRooms: Map<string, string>,
): Promise<QueueSnapshot> {
  enforceSocketRateLimit("socket:queue", user.id, SOCKET_RATE_LIMITS.queue);

  const roomCode = assertJoined(payload?.roomCode, joinedRooms);
  await assertHost(roomCode, user.id);

  const next = queueStore.dequeue(roomCode);
  const queue = queueStore.getQueue(roomCode);

  if (next) {
    const playback = await setRoomTrack(roomCode, user.id, next);
    logger.info(
      `${user.username} advanced queue → ${next.videoId} in ${roomCode}`,
    );
    broadcastPlayback(io, roomCode, playback);
  } else {
    // Queue exhausted — stop playback.
    const playback = await clearRoomTrack(roomCode, user.id);
    logger.info(`${user.username} queue exhausted in ${roomCode}`);
    broadcastPlayback(io, roomCode, playback);
  }

  broadcastQueue(io, roomCode, queue);
  return queue;
}

async function handleQueueClear(
  io: SocketIOServer,
  user: { id: string; username: string },
  payload: QueueClearPayload,
  joinedRooms: Map<string, string>,
): Promise<QueueSnapshot> {
  enforceSocketRateLimit("socket:queue", user.id, SOCKET_RATE_LIMITS.queue);

  const roomCode = assertJoined(payload?.roomCode, joinedRooms);
  await assertHost(roomCode, user.id);

  const queue = queueStore.clearQueue(roomCode);
  broadcastQueue(io, roomCode, queue);
  return queue;
}

/**
 * Any room member may chat — unlike playback, this needs no `assertHost`, only
 * current membership. The message is persisted before it is broadcast, so a
 * failed write never reaches other clients.
 */
async function handleChatSend(
  io: SocketIOServer,
  user: { id: string; username: string },
  payload: ChatSendPayload,
  joinedRooms: Map<string, string>,
): Promise<void> {
  enforceSocketRateLimit("socket:chat", user.id, SOCKET_RATE_LIMITS.chatSend);

  const roomCode = assertJoined(payload?.roomCode, joinedRooms);

  const validation = validateMessageContent(payload?.content);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  // Membership is re-read here rather than taken from the connection's
  // join-time cache: a user who left the room through the REST endpoint still
  // holds the socket they joined with, and must not be able to post with it.
  const roomId = await getRoomIdIfMember(roomCode, user.id);
  if (!roomId) {
    throw new Error("Not a member of this room");
  }

  const message = await createMessage(roomId, user.id, validation.value);
  broadcastChatMessage(io, roomCode, message);
}

function broadcastChatMessage(
  io: SocketIOServer,
  roomCode: string,
  message: ChatMessageDTO,
): void {
  io.to(roomName(roomCode)).emit("chat:new", message);
}
