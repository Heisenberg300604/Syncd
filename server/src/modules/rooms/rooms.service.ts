import { prisma } from "../../config/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { PublicUser } from "../users/users.types.js";
import { findUserByClerkId } from "../users/users.service.js";
import { generateRoomCode, ROOM_CODE_MAX_RETRIES_OUT } from "./rooms.validation.js";
import type { RoomDTO, RoomMemberDTO } from "./rooms.types.js";
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

export async function getRoomMembersForPresence(
  roomCode: string,
): Promise<{ roomId: string; members: { userId: string; username: string }[] } | null> {
  const room = await prisma.room.findUnique({
    where: { roomCode },
    select: {
      id: true,
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
    members: room.members.map((m) => ({
      userId: m.user.id,
      username: m.user.username,
    })),
  };
}

export async function leaveRoom(
  clerkUserId: string,
  roomCode: string,
): Promise<{ roomDeleted: boolean }> {
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

  // If host leaves and others remain, the host must transfer ownership or
  // the room closes. MVP decision: if the host leaves, the room is deleted
  // (all remaining memberships cascade away). This avoids an invalid state
  // where hostUserId points to a non-member. Host transfer is a future feature.
  const isHost = room.hostUserId === user.id;

  if (isHost) {
    // Deleting the room cascades to all room_members and messages
    await prisma.room.delete({ where: { id: room.id } });
  } else {
    await prisma.roomMember.delete({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: user.id,
        },
      },
    });
  }

  return { roomDeleted: isHost };
}