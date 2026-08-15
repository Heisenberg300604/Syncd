import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { asyncHandler } from "./asyncHandler.js";

export const requireAuth = asyncHandler((req: Request, res: Response, next: NextFunction) => {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ authenticated: false, message: "Unauthorized" });
    return;
  }

  next();
});