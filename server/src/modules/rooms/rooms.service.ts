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
      const roomId = await prisma.$transaction(async (tx) => {
        const created = await tx.room.create({
          data: {
            roomCode: code,
            hostUserId: host.id,
          },
          select: { id: true },
        });

        await tx.roomMember.create({
          data: {
            roomId: created.id,
            userId: host.id,
          },
        });

        return created.id;
      });

      // Fetch with relations after the transaction commits
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: roomInclude,
      });

      if (!room) {
        throw new AppError("Failed to create room", 500);
      }

      return toRoomDTO(room);
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

  const room = await prisma.room.findUnique({
    where: { roomCode },
    include: roomInclude,
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

  await prisma.$transaction(async (tx) => {
    if (isHost) {
      // Deleting the room cascades to all room_members and messages
      await tx.room.delete({ where: { id: room.id } });
    } else {
      await tx.roomMember.delete({
        where: {
          roomId_userId: {
            roomId: room.id,
            userId: user.id,
          },
        },
      });
    }
  });

  return { roomDeleted: isHost };
}