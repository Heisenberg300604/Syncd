import type { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { AppError } from "../../utils/apiResponse.js";
import { findUserByClerkId, findUserByUsername, createUser } from "../users/users.service.js";
import { desktopCodeStore } from "./desktopCodeStore.js";

export const generateDesktopCode = asyncHandler(async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");

  const { userId } = getAuth(req);

  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }

  // Extract bearer token from header or body
  const authHeader = req.headers.authorization;
  let token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token && typeof req.body?.token === "string" && req.body.token.trim()) {
    token = req.body.token.trim();
  }

  if (!token) {
    throw new AppError("Active authentication session token required.", 400);
  }

  let user = await findUserByClerkId(userId);

  // If user profile does not yet exist in PostgreSQL, auto-provision using their Clerk username
  if (!user && typeof req.body?.username === "string" && req.body.username.trim()) {
    const rawUsername = req.body.username.trim().replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
    const candidateUsername = rawUsername || `user_${userId.slice(-6)}`;
    try {
      const existing = await findUserByUsername(candidateUsername);
      const finalUsername = existing
        ? `${candidateUsername.slice(0, 15)}_${Math.floor(100 + Math.random() * 900)}`
        : candidateUsername;
      user = await createUser(userId, finalUsername);
    } catch (err) {
      console.warn("Auto-provision profile notice:", err);
    }
  }

  const result = desktopCodeStore.generateCode(userId, token, user);

  if (!result.ok) {
    throw new AppError(result.error ?? "Maximum code generations reached.", result.status || 429);
  }

  res.status(200).json({
    ok: true,
    code: result.code,
    expiresInSeconds: result.expiresInSeconds,
    attemptsRemaining: result.attemptsRemaining,
    generationCount: result.generationCount,
  });
});

export const exchangeDesktopCode = asyncHandler(async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");

  const { code } = req.body ?? {};

  if (!code || typeof code !== "string") {
    throw new AppError("A 9-digit code string is required.", 400);
  }

  const result = desktopCodeStore.exchangeCode(code);

  if (!result.ok) {
    throw new AppError(result.error ?? "Failed to exchange code.", result.status);
  }

  res.status(200).json({
    ok: true,
    token: result.token,
    user: result.user,
  });
});

export const getDesktopCodeStatus = asyncHandler(async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const status = desktopCodeStore.checkStatus(code);

  res.status(200).json({
    ok: true,
    status,
  });
});
