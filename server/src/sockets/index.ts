import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { verifyToken } from "@clerk/backend";
import { config } from "../config/env.js";
import { findUserByClerkId } from "../modules/users/users.service.js";
import { validateRoomCode } from "../modules/rooms/rooms.validation.js";
import {
  getRoomHostId,
  getRoomIdByCode,
  getRoomMembersForPresence,
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
import { createMessage, getRecentMessages } from "../modules/messages/messages.service.js";
import { validateMessageContent } from "../modules/messages/messages.validation.js";
import type {
  ChatMessageDTO,
  ChatSendAck,
  ChatSendPayload,
} from "../modules/messages/messages.types.js";
import type {
  PresenceSnapshot,
  RoomJoinPayload,
  RoomJoinResponse,
} from "./presence.types.js";
import { logger } from "../utils/logger.js";

const ROOM_PREFIX = "room:";
const roomName = (roomCode: string) => `${ROOM_PREFIX}${roomCode}`;

export function createSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.corsOrigins,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth["token"] as string | undefined;
    if (!token) {
      next(new Error("Missing auth token"));
      return;
    }

    try {
      const payload = await verifyToken(token, {
        secretKey: config.clerkSecretKey,
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
      next(new Error(message));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as {
      id: string;
      clerkUserId: string;
      username: string;
    } | undefined;

    if (!user) {
      socket.disconnect(true);
      return;
    }

    logger.info(`Socket connected: ${user.username} (${socket.id})`);

    const joinedRooms = new Map<string, string>(); // roomCode -> socketRoomName

    socket.on("room:join", (payload: RoomJoinPayload, ack: (res: RoomJoinResponse) => void) => {
      handleRoomJoin(io, socket, user, payload, ack, joinedRooms).catch((err) => {
        const message = err instanceof Error ? err.message : "Join failed";
        ack({ ok: false, message });
      });
    });

    socket.on(
      "playback:set",
      (payload: PlaybackSetPayload, ack?: (res: PlaybackAck) => void) => {
        handlePlaybackSet(io, user, payload, joinedRooms)
          .then((playback) => ack?.({ ok: true, playback }))
          .catch((err) => ack?.({ ok: false, message: messageOf(err) }));
      },
    );

    socket.on(
      "playback:control",
      (payload: PlaybackControlPayload, ack?: (res: PlaybackAck) => void) => {
        handlePlaybackControl(io, user, payload, joinedRooms)
          .then((playback) => ack?.({ ok: true, playback }))
          .catch((err) => ack?.({ ok: false, message: messageOf(err) }));
      },
    );

    socket.on(
      "playback:clear",
      (payload: PlaybackClearPayload, ack?: (res: PlaybackAck) => void) => {
        handlePlaybackClear(io, user, payload, joinedRooms)
          .then((playback) => ack?.({ ok: true, playback }))
          .catch((err) => ack?.({ ok: false, message: messageOf(err) }));
      },
    );

    socket.on(
      "chat:send",
      (payload: ChatSendPayload, ack?: (res: ChatSendAck) => void) => {
        handleChatSend(io, user, payload, joinedRooms)
          .then(() => ack?.({ ok: true }))
          .catch((err) =>
            ack?.({ ok: false, message: messageOf(err, "Could not send message") }),
          );
      },
    );

    socket.on("room:leave", (payload: RoomJoinPayload, ack?: () => void) => {
      handleRoomLeave(io, socket, user, payload.roomCode, joinedRooms);
      ack?.();
    });

    socket.on("disconnect", (reason) => {
      logger.info(`Socket disconnected: ${user.username} (${socket.id}) — ${reason}`);

      for (const [roomCode, socketRoomName] of joinedRooms) {
        socket.leave(socketRoomName);
        const nowOffline = presenceStore.removeSocket(roomCode, user.id, socket.id);
        if (nowOffline) {
          broadcastPresence(io, roomCode);
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
  ack: (res: RoomJoinResponse) => void,
  joinedRooms: Map<string, string>,
): Promise<void> {
  const validation = validateRoomCode(payload.roomCode);
  if (!validation.ok) {
    ack({ ok: false, message: validation.message });
    return;
  }

  const roomCode = validation.value;

  const roomData = await getRoomMembersForPresence(roomCode);
  if (!roomData) {
    ack({ ok: false, message: "Room not found" });
    return;
  }

  const isMember = roomData.members.some((m) => m.userId === user.id);
  if (!isMember) {
    ack({ ok: false, message: "Not a member of this room" });
    return;
  }

  const socketRoomName = roomName(roomCode);

  for (const [prevRoomCode, prevRoomName] of joinedRooms) {
    if (prevRoomCode !== roomCode) {
      socket.leave(prevRoomName);
      presenceStore.removeSocket(prevRoomCode, user.id, socket.id);
      broadcastPresence(io, prevRoomCode);
    }
  }

  joinedRooms.forEach((_, code) => {
    if (code !== roomCode) joinedRooms.delete(code);
  });

  const wasNewUser = presenceStore.addSocket(roomCode, user.id, user.username, socket.id);
  socket.join(socketRoomName);
  joinedRooms.set(roomCode, socketRoomName);

  const presence = presenceStore.getSnapshot(roomCode, roomData.members);
  const playback = await getRoomPlayback(roomCode);
  const messages = await getRecentMessages(roomData.roomId);

  ack({ ok: true, presence, messages, ...(playback ? { playback } : {}) });

  if (wasNewUser) {
    broadcastPresence(io, roomCode);
  }
}

function handleRoomLeave(
  io: SocketIOServer,
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
    broadcastPresence(io, roomCode);
  }
}

function broadcastPresence(io: SocketIOServer, roomCode: string): void {
  getRoomMembersForPresence(roomCode)
    .then((roomData) => {
      if (!roomData) return;
      const snapshot: PresenceSnapshot = presenceStore.getSnapshot(
        roomCode,
        roomData.members,
      );
      io.to(roomName(roomCode)).emit("presence:update", snapshot);
    })
    .catch((err) => {
      logger.error(`broadcastPresence failed for ${roomCode}`, err);
    });
}

function messageOf(err: unknown, fallback = "Playback update failed"): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * `joinedRooms` is only populated by `handleRoomJoin`, which verifies
 * membership against the database. Reusing it keeps every playback event
 * authorized without a query per play/pause.
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
async function assertHost(roomCode: string, userId: string): Promise<void> {
  const hostUserId = await getRoomHostId(roomCode);
  if (!hostUserId) {
    throw new Error("Room not found");
  }
  if (hostUserId !== userId) {
    throw new Error("Only the host can control playback");
  }
}

async function handlePlaybackSet(
  io: SocketIOServer,
  user: { id: string; username: string },
  payload: PlaybackSetPayload,
  joinedRooms: Map<string, string>,
): Promise<PlaybackSnapshot> {
  const roomCode = assertJoined(payload?.roomCode, joinedRooms);
  await assertHost(roomCode, user.id);

  const validation = validateTrackInput(payload?.track);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const playback = await setRoomTrack(roomCode, user.id, validation.value);
  logger.info(`${user.username} set ${validation.value.videoId} in ${roomCode}`);
  broadcastPlayback(io, roomCode, playback);
  return playback;
}

async function handlePlaybackControl(
  io: SocketIOServer,
  user: { id: string; username: string },
  payload: PlaybackControlPayload,
  joinedRooms: Map<string, string>,
): Promise<PlaybackSnapshot> {
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
  const roomCode = assertJoined(payload?.roomCode, joinedRooms);
  await assertHost(roomCode, user.id);
  const playback = await clearRoomTrack(roomCode, user.id);
  broadcastPlayback(io, roomCode, playback);
  return playback;
}

function broadcastPlayback(
  io: SocketIOServer,
  roomCode: string,
  playback: PlaybackSnapshot,
): void {
  io.to(roomName(roomCode)).emit("playback:update", playback);
}

/**
 * Any room member may chat — unlike playback, this only needs `assertJoined`,
 * not `assertHost`. The message is persisted before it is broadcast, so a
 * failed write never reaches other clients.
 */
async function handleChatSend(
  io: SocketIOServer,
  user: { id: string; username: string },
  payload: ChatSendPayload,
  joinedRooms: Map<string, string>,
): Promise<void> {
  const roomCode = assertJoined(payload?.roomCode, joinedRooms);

  const validation = validateMessageContent(payload?.content);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const roomId = await getRoomIdByCode(roomCode);
  if (!roomId) {
    throw new Error("Room not found");
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
