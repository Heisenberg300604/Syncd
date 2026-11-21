import type { Request } from "express";
import { getAuth } from "@clerk/express";
import { verifyDesktopToken } from "../modules/auth/desktopToken.js";

/**
 * Returns the authenticated user's Clerk ID regardless of whether the request
 * comes from the Desktop app (syncd_dt_ HMAC token) or a web browser session
 * (Clerk JWT managed by clerkMiddleware).
 */
export function getEffectiveUserId(req: Request): string | null {
  // Desktop session token takes precedence
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const payload = verifyDesktopToken(token);
    if (payload?.sub) return payload.sub;
  }

  // Fall back to Clerk web session
  try {
    const { userId } = getAuth(req);
    return userId ?? null;
  } catch {
    return null;
  }
}
