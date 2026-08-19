import type { PresenceMember, PresenceSnapshot } from "./presence.types.js";

interface RoomPresence {
  // userId -> set of socket ids currently connected for that user
  socketsByUserId: Map<string, Set<string>>;
  // userId -> username (cached from DB at join time)
  usernameByUserId: Map<string, string>;
}

export class PresenceStore {
  private rooms = new Map<string, RoomPresence>();

  private getRoom(roomCode: string): RoomPresence {
    let room = this.rooms.get(roomCode);
    if (!room) {
      room = {
        socketsByUserId: new Map(),
        usernameByUserId: new Map(),
      };
      this.rooms.set(roomCode, room);
    }
    return room;
  }

  addSocket(roomCode: string, userId: string, username: string, socketId: string): boolean {
    const room = this.getRoom(roomCode);
    let sockets = room.socketsByUserId.get(userId);
    if (!sockets) {
      sockets = new Set();
      room.socketsByUserId.set(userId, sockets);
    }
    const isNew = sockets.size === 0;
    sockets.add(socketId);
    room.usernameByUserId.set(userId, username);
    return isNew;
  }

  removeSocket(roomCode: string, userId: string, socketId: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    const sockets = room.socketsByUserId.get(userId);
    if (!sockets) return false;

    sockets.delete(socketId);
    const nowOffline = sockets.size === 0;
    if (nowOffline) {
      room.socketsByUserId.delete(userId);
      room.usernameByUserId.delete(userId);
    }

    if (room.socketsByUserId.size === 0) {
      this.rooms.delete(roomCode);
    }

    return nowOffline;
  }

  isOnline(roomCode: string, userId: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    const sockets = room.socketsByUserId.get(userId);
    return sockets !== undefined && sockets.size > 0;
  }

  getSnapshot(roomCode: string, allMembers: { userId: string; username: string }[]): PresenceSnapshot {
    const room = this.rooms.get(roomCode);
    const members: PresenceMember[] = allMembers.map((m) => ({
      userId: m.userId,
      username: m.username,
      online: room
        ? (room.socketsByUserId.get(m.userId)?.size ?? 0) > 0
        : false,
    }));
    return { members };
  }

  removeUserFromAllRooms(userId: string, socketId: string): string[] {
    const affectedRooms: string[] = [];
    for (const [roomCode, room] of this.rooms) {
      const sockets = room.socketsByUserId.get(userId);
      if (sockets && sockets.has(socketId)) {
        sockets.delete(socketId);
        if (sockets.size === 0) {
          room.socketsByUserId.delete(userId);
          room.usernameByUserId.delete(userId);
        }
        affectedRooms.push(roomCode);
      }
      if (room.socketsByUserId.size === 0) {
        this.rooms.delete(roomCode);
      }
    }
    return affectedRooms;
  }
}

export const presenceStore = new PresenceStore();