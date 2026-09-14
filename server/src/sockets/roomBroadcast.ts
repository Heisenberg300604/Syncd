import type { Server as SocketIOServer } from "socket.io";
import { getRoomMembersForPresence } from "../modules/rooms/rooms.service.js";
import type { RoomPresenceData } from "../modules/rooms/rooms.types.js";
import { presenceStore } from "./presenceStore.js";
import type { PresenceSnapshot } from "./presence.types.js";
import { logger } from "../utils/logger.js";

const ROOM_PREFIX = "room:";

export const roomName = (roomCode: string): string =>
  `${ROOM_PREFIX}${roomCode}`;

/**
 * Module-level handle to the Socket.IO server.
 *
 * Room events are not raised only from socket handlers: a departing host hands
 * the room over through the REST `/leave` endpoint, and the remaining clients
 * still need the resulting presence broadcast. Holding the server here lets
 * those call sites emit without threading `io` through the Express layer.
 */
let io: SocketIOServer | null = null;

export function setRoomBroadcaster(server: SocketIOServer): void {
  io = server;
}

export function emitToRoom(
  roomCode: string,
  event: string,
  payload: unknown,
): void {
  io?.to(roomName(roomCode)).emit(event, payload);
}

/** Emits a presence snapshot built from data the caller already fetched. */
export function emitPresence(
  roomCode: string,
  roomData: RoomPresenceData,
): void {
  const snapshot: PresenceSnapshot = presenceStore.getSnapshot(
    roomCode,
    roomData.members,
    roomData.hostUserId,
  );
  emitToRoom(roomCode, "presence:update", snapshot);
}

/** Fetches the room's members and host, then broadcasts the snapshot. */
export function broadcastPresence(roomCode: string): void {
  getRoomMembersForPresence(roomCode)
    .then((roomData) => {
      if (!roomData) return;
      emitPresence(roomCode, roomData);
    })
    .catch((err) => {
      logger.error(`broadcastPresence failed for ${roomCode}`, err);
    });
}
