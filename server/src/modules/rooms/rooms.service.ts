import { prisma } from "../../config/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { PublicUser } from "../users/users.types.js";
import { findUserByClerkId } from "../users/users.service.js";
import { generateRoomCode, ROOM_CODE_MAX_RETRIES_OUT } from "./rooms.validation.js";
import type {
  LeaveRoomResult,
  RoomDTO,
  RoomMemberDTO,
  RoomPresenceData,
} from "./rooms.types.js";
import { AppError } from "../../utils/apiResponse.js";

type RoomWithRelations = Prisma.RoomGetPayload<{
  include: {
    host: { select: { id: true; clerkUserId: true; username: true } };
    members: {
      include: {
        user: { select: { id: true; clerkUserId: true; username: true } };
      };
      orderBy: { joinedAt: "asc" };
    };
  };
}>;

function toPublicUser(user: {
  id: string;
  clerkUserId: string;
  username: string;
}): PublicUser {
  return {
    id: user.id,
    clerkUserId: user.clerkUserId,
    username: user.username,
  };
}

function toRoomDTO(room: RoomWithRelations): RoomDTO {
  const members: RoomMemberDTO[] = room.members.map((m) => ({
    user: toPublicUser(m.user),
    joinedAt: m.joinedAt.toISOString(),
  }));

  return {
    id: room.id,
    roomCode: room.roomCode,
    host: toPublicUser(room.host),
    members,
    currentVideoId: room.currentVideoId,
    currentTitle: room.currentTitle,
    currentThumbnailUrl: room.currentThumbnailUrl,
    currentDuration: room.currentDuration,
    isPlaying: room.isPlaying,
    playbackPosition: room.playbackPosition,
    playbackUpdatedAt: room.playbackUpdatedAt
      ? room.playbackUpdatedAt.toISOString()
      : null,
  };
}

const roomInclude = {
  host: { select: { id: true, clerkUserId: true, username: true } },
  members: {
    include: {
      user: { select: { id: true, clerkUserId: true, username: true } },
    },
    orderBy: { joinedAt: "asc" },
  },
} as const;

export async function createRoomWithHost(
  clerkUserId: string,
): Promise<RoomDTO> {
  const host = await findUserByClerkId(clerkUserId);
  if (!host) {
    throw new AppError("User profile not found", 404);
  }

  let code = "";
  let retries = 0;
  while (retries < ROOM_CODE_MAX_RETRIES_OUT) {
    code = generateRoomCode();
    try {
      const { roomId, joinedAt } = await prisma.$transaction(async (tx) => {
        const created = await tx.room.create({
          data: {
            roomCode: code,
            hostUserId: host.id,
          },
          select: { id: true },
        });

        const member = await tx.roomMember.create({
          data: {
            roomId: created.id,
            userId: host.id,
          },
          select: { joinedAt: true },
        });

        return { roomId: created.id, joinedAt: member.joinedAt };
      });

      // Build the DTO from already-known data — no extra DB round-trip needed.
      const hostPublic = toPublicUser(host);
      const dto: RoomDTO = {
        id: roomId,
        roomCode: code,
        host: hostPublic,
        members: [{ user: hostPublic, joinedAt: joinedAt.toISOString() }],
        currentVideoId: null,
        currentTitle: null,
        currentThumbnailUrl: null,
        currentDuration: null,
        isPlaying: false,
        playbackPosition: 0,
        playbackUpdatedAt: null,
      };

      return dto;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        retries++;
        continue;
      }
      throw err;
    }
  }

  throw new AppError("Could not generate a unique room code, try again", 500);
}

export async function joinRoom(
  clerkUserId: string,
  roomCode: string,
): Promise<RoomDTO> {
  const user = await findUserByClerkId(clerkUserId);
  if (!user) {
    throw new AppError("User profile not found", 404);
  }

  const room = await prisma.room.findUnique({
    where: { roomCode },
    include: roomInclude,
  });

  if (!room) {
    throw new AppError("Room not found", 404);
  }

  const isMember = room.members.some((m) => m.userId === user.id);
  if (!isMember) {
    try {
      await prisma.roomMember.create({
        data: {
          roomId: room.id,
          userId: user.id,
        },
      });
    } catch (err) {
      // Concurrent request may have created the membership; idempotent
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // already a member — treat as success
      } else {
        throw err;
      }
    }

    // Re-fetch to include the new membership
    const refreshed = await prisma.room.findUnique({
      where: { id: room.id },
      include: roomInclude,
    });
    if (!refreshed) {
      throw new AppError("Room not found", 404);
    }
    return toRoomDTO(refreshed);
  }

  return toRoomDTO(room);
}

export async function getRoomByCode(roomCode: string): Promise<RoomDTO | null> {
  const room = await prisma.room.findUnique({
    where: { roomCode },
    include: roomInclude,
  });

  return room ? toRoomDTO(room) : null;
}

export async function getRoomHostId(roomCode: string): Promise<string | null> {
  const room = await prisma.room.findUnique({
    where: { roomCode },
    select: { hostUserId: true },
  });
  return room?.hostUserId ?? null;
}

export async function getRoomIdByCode(roomCode: string): Promise<string | null> {
  const room = await prisma.room.findUnique({
    where: { roomCode },
    select: { id: true },
  });
  return room?.id ?? null;
}

/**
 * Members ordered oldest-first by `joinedAt`, alongside the room's current
 * host. The ordering is load-bearing: host succession picks the
 * longest-standing online member, so callers can walk this list in order.
 */
export async function getRoomMembersForPresence(
  roomCode: string,
): Promise<RoomPresenceData | null> {
  const room = await prisma.room.findUnique({
    where: { roomCode },
    select: {
      id: true,
      hostUserId: true,
      members: {
        select: {
          user: { select: { id: true, username: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!room) return null;

  return {
    roomId: room.id,
    hostUserId: room.hostUserId,
    members: room.members.map((m) => ({
      userId: m.user.id,
      username: m.user.username,
    })),
  };
}

/**
 * Moves the host role, but only if the room is still hosted by
 * `expectedHostUserId`. The `where` clause is the concurrency guard: an
 * automatic transfer firing after the grace period can race a manual transfer
 * or a host leaving, and exactly one of them must win. Returns whether this
 * caller was the one that applied the change.
 */
export async function transferRoomHost(
  roomId: string,
  expectedHostUserId: string,
  newHostUserId: string,
): Promise<boolean> {
  const result = await prisma.room.updateMany({
    where: { id: roomId, hostUserId: expectedHostUserId },
    data: { hostUserId: newHostUserId },
  });
  return result.count === 1;
}

export async function leaveRoom(
  clerkUserId: string,
  roomCode: string,
): Promise<LeaveRoomResult> {
  const user = await findUserByClerkId(clerkUserId);
  if (!user) {
    throw new AppError("User profile not found", 404);
  }

  // Single query: get the room's id + hostUserId alongside the membership row.
  // Avoids fetching the full member list (roomInclude) — we only need these two
  // fields to decide whether the user is a member and whether they are the host.
  const room = await prisma.room.findUnique({
    where: { roomCode },
    select: { id: true, hostUserId: true },
  });

  if (!room) {
    throw new AppError("Room not found", 404);
  }

  const membership = await prisma.roomMember.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId: user.id,
      },
    },
    select: { roomId: true },
  });

  if (!membership) {
    // Not a member — idempotent
    return { roomDeleted: false };
  }

  const isHost = room.hostUserId === user.id;

  if (!isHost) {
    await prisma.roomMember.delete({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: user.id,
        },
      },
    });
    return { roomDeleted: false };
  }

  // The host is leaving deliberately, so there is no grace period to wait on:
  // hand the room to the longest-standing remaining member immediately. Only
  // when nobody is left does the room close — `hostUserId` must never point at
  // a non-member.
  const successor = await prisma.roomMember.findFirst({
    where: { roomId: room.id, userId: { not: user.id } },
    orderBy: { joinedAt: "asc" },
    select: { userId: true },
  });

  if (!successor) {
    // Deleting the room cascades to all room_members and messages
    await prisma.room.delete({ where: { id: room.id } });
    return { roomDeleted: true };
  }

  // Promote before removing the membership so the room is never, even
  // momentarily, hosted by someone who is no longer a member.
  await prisma.$transaction([
    prisma.room.update({
      where: { id: room.id },
      data: { hostUserId: successor.userId },
    }),
    prisma.roomMember.delete({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: user.id,
        },
      },
    }),
  ]);

  return {
    roomDeleted: false,
    hostHandover: {
      previousHostUserId: user.id,
      previousHostUsername: user.username,
      newHostUserId: successor.userId,
    },
  };
}