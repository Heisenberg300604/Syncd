import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { verifyToken } from "@clerk/backend";
import { config } from "../config/env.js";
import { findUserByClerkId } from "../modules/users/users.service.js";
import { validateRoomCode } from "../modules/rooms/rooms.validation.js";
import { getRoomMembersForPresence } from "../modules/rooms/rooms.service.js";
import { presenceStore } from "./presenceStore.js";
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
      origin: config.corsOrigin,
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

  ack({ ok: true, presence });

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