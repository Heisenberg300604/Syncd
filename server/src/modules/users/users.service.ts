import { prisma } from "../../config/prisma.js";
import type { PublicUser } from "./users.types.js";

function toPublicUser(
  user: { id: string; clerkUserId: string; username: string },
): PublicUser {
  return {
    id: user.id,
    clerkUserId: user.clerkUserId,
    username: user.username,
  };
}

export async function findUserByClerkId(clerkUserId: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, clerkUserId: true, username: true },
  });
  return user ? toPublicUser(user) : null;
}

export async function findUserByUsername(username: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, clerkUserId: true, username: true },
  });
  return user ? toPublicUser(user) : null;
}

export async function createUser(clerkUserId: string, username: string): Promise<PublicUser> {
  const user = await prisma.user.create({
    data: { clerkUserId, username },
    select: { id: true, clerkUserId: true, username: true },
  });
  return toPublicUser(user);
}