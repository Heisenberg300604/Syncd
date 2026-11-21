import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "./asyncHandler.js";
import { getEffectiveUserId } from "./getEffectiveUserId.js";

export const requireAuth = asyncHandler((req: Request, res: Response, next: NextFunction) => {
  const userId = getEffectiveUserId(req);

  if (!userId) {
    res.status(401).json({ authenticated: false, message: "Unauthorized" });
    return;
  }

  next();
});