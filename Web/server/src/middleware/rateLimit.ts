import type { Request, RequestHandler, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { logger } from "../utils/logger.js";

/**
 * Fixed-window rate limiting, in memory.
 *
 * Follows the same ephemeral-store pattern as `presenceStore` and `queueStore`:
 * state lives in this process only. That matches how SyncD is deployed today
 * (a single API instance) — behind more than one instance the effective limit
 * multiplies by the instance count, so a shared store would be needed then.
 *
 * Buckets are keyed by the authenticated application/Clerk user rather than by
 * IP: every route and socket event that is limited already requires
 * authentication, and the API sits behind a proxy whose `req.ip` is not the
 * caller's.
 */
export interface RateLimitRule {
  /** Maximum hits allowed inside one window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the current window resets. Zero when allowed. */
  retryAfterMs: number;
}

interface WindowState {
  count: number;
  resetAt: number;
}

const SWEEP_INTERVAL_MS = 60_000;
/** Safety valve: an early sweep rather than unbounded growth under key churn. */
const MAX_TRACKED_KEYS = 50_000;

class RateLimiter {
  private readonly windows = new Map<string, WindowState>();

  constructor() {
    const timer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    // Never hold the process open for the sweep.
    timer.unref?.();
  }

  consume(key: string, rule: RateLimitRule): RateLimitResult {
    const now = Date.now();
    const existing = this.windows.get(key);

    if (!existing || existing.resetAt <= now) {
      if (this.windows.size >= MAX_TRACKED_KEYS) this.sweep();
      this.windows.set(key, { count: 1, resetAt: now + rule.windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }

    if (existing.count >= rule.limit) {
      return { allowed: false, retryAfterMs: existing.resetAt - now };
    }

    existing.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }

  /** Test seam — drops all counters. */
  resetAll(): void {
    this.windows.clear();
  }
}

export const rateLimiter = new RateLimiter();

function requestKey(req: Request): string {
  try {
    const { userId } = getAuth(req);
    if (userId) return `user:${userId}`;
  } catch {
    // `clerkMiddleware` has not run for this request — fall through to the IP.
  }
  return `ip:${req.ip ?? "unknown"}`;
}

/**
 * Express middleware. Mount it after `requireAuth` so the counter is keyed by
 * the caller rather than by a shared proxy address.
 */
export function rateLimit(bucket: string, rule: RateLimitRule): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = rateLimiter.consume(`${bucket}:${requestKey(req)}`, rule);

    if (!result.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
      logger.warn("Rate limit exceeded", { bucket, method: req.method });
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        message: `Too many requests. Try again in ${retryAfterSeconds}s.`,
      });
      return;
    }

    next();
  };
}

/**
 * Socket-side counterpart. Throws the same way the socket handlers already
 * signal failure, so the error reaches the client through its existing ack.
 */
export function enforceSocketRateLimit(
  bucket: string,
  userId: string,
  rule: RateLimitRule,
): void {
  const result = rateLimiter.consume(`${bucket}:user:${userId}`, rule);
  if (result.allowed) return;

  const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  logger.warn("Socket rate limit exceeded", { bucket });
  throw new Error(`Slow down — try again in ${retryAfterSeconds}s.`);
}
