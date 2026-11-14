import { prisma } from "../../config/prisma.js";
import type { ChatMessageDTO } from "./messages.types.js";

const RECENT_MESSAGES_LIMIT = 50;

function toChatMessageDTO(message: {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  createdAt: Date;
  user: { username: string };
}): ChatMessageDTO {
  return {
    id: message.id,
    roomId: message.roomId,
    userId: message.userId,
    username: message.user.username,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function createMessage(
  roomId: string,
  userId: string,
  content: string,
): Promise<ChatMessageDTO> {
  const message = await prisma.message.create({
    data: { roomId, userId, content },
    select: {
      id: true,
      roomId: true,
      userId: true,
      content: true,
      createdAt: true,
      user: { select: { username: true } },
    },
  });

  return toChatMessageDTO(message);
}

/** Most recent messages in a room, oldest first — ready to render top-to-bottom. */
export async function getRecentMessages(roomId: string): Promise<ChatMessageDTO[]> {
  const messages = await prisma.message.findMany({
    where: { roomId },
    orderBy: { createdAt: "desc" },
    take: RECENT_MESSAGES_LIMIT,
    select: {
      id: true,
      roomId: true,
      userId: true,
      content: true,
      createdAt: true,
      user: { select: { username: true } },
    },
  });

  return messages.reverse().map(toChatMessageDTO);
}
