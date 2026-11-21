import crypto from "crypto";
import type { PublicUser } from "../users/users.types.js";
import { mintDesktopToken } from "./desktopToken.js";

export type CodeStatus = "pending" | "claimed" | "expired" | "invalid";

export interface DesktopCodeEntry {
  code: string;
  token: string;
  clerkUserId: string;
  user: PublicUser | null;
  expiresAt: number;
  failedAttempts: number;
  status: "pending" | "claimed";
  claimedAt?: number;
}

interface UserGenerationSession {
  generationsCount: number;
  windowExpiresAt: number;
}

const CODE_TTL_MS = 120_000; // 2 minutes (120 seconds)
const SWEEP_INTERVAL_MS = 15_000;
const MAX_STRIKES = 3;
const MAX_GENERATION_TRIES = 3; // Max 3 code generations per session

// Characters: unambiguous letters (A-Z excluding confusing 0/O, 1/I), digits (2-9), and safe symbols
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*?";

class DesktopCodeStore {
  private readonly codes = new Map<string, DesktopCodeEntry>();
  private readonly userToCode = new Map<string, string>();
  private readonly userSessions = new Map<string, UserGenerationSession>();

  constructor() {
    const timer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    timer.unref?.();
  }

  /**
   * Generates a secure 9-character code mixing letters, numbers & symbols for an authenticated user.
   * Users get a maximum of 3 code generation attempts during their active session.
   */
  generateCode(
    clerkUserId: string,
    token: string,
    user: PublicUser | null,
  ): {
    ok: boolean;
    code?: string;
    expiresInSeconds?: number;
    attemptsRemaining?: number;
    generationCount?: number;
    error?: string;
    status?: number;
  } {
    const now = Date.now();
    let session = this.userSessions.get(clerkUserId);

    if (!session || session.windowExpiresAt <= now) {
      session = {
        generationsCount: 1,
        windowExpiresAt: now + CODE_TTL_MS,
      };
      this.userSessions.set(clerkUserId, session);
    } else {
      if (session.generationsCount >= MAX_GENERATION_TRIES) {
        return {
          ok: false,
          error: "Maximum 3 code generation attempts reached for this session. Please wait for the timer to expire or sign in again.",
          status: 429,
          attemptsRemaining: 0,
          generationCount: session.generationsCount,
        };
      }
      session.generationsCount += 1;
    }

    const attemptsRemaining = MAX_GENERATION_TRIES - session.generationsCount;

    // 1. Invalidate any previous code for this user
    const existingCode = this.userToCode.get(clerkUserId);
    if (existingCode) {
      this.codes.delete(existingCode);
      this.userToCode.delete(clerkUserId);
    }

    // 2. Generate cryptographically strong 9-character code mixing letters, digits & symbols
    let rawCode = "";
    const randomBytes = crypto.randomBytes(9);
    for (let i = 0; i < 9; i++) {
      rawCode += CHARSET[randomBytes[i] % CHARSET.length];
    }

    const expiresAt = now + CODE_TTL_MS;

    const entry: DesktopCodeEntry = {
      code: rawCode,
      token,
      clerkUserId,
      user,
      expiresAt,
      failedAttempts: 0,
      status: "pending",
    };

    this.codes.set(rawCode, entry);
    this.userToCode.set(clerkUserId, rawCode);

    return {
      ok: true,
      code: rawCode,
      expiresInSeconds: Math.floor(CODE_TTL_MS / 1000),
      attemptsRemaining,
      generationCount: session.generationsCount,
    };
  }

  /**
   * Exchanges a 9-character code for the cached auth session token and user profile.
   * On success, marks the code as claimed and purges the token so it cannot be reused.
   */
  exchangeCode(rawCodeInput: string): {
    ok: boolean;
    token?: string;
    user?: PublicUser | null;
    error?: string;
    status: number;
  } {
    const cleanCode = rawCodeInput.replace(/[^a-zA-Z0-9!@#$%&*?]/g, "").toUpperCase();
    if (cleanCode.length !== 9) {
      return {
        ok: false,
        error: "Code must be exactly 9 characters (letters, numbers and symbols).",
        status: 400,
      };
    }

    const entry = this.codes.get(cleanCode);
    const now = Date.now();

    if (!entry || entry.status === "claimed" || entry.expiresAt <= now) {
      if (entry && entry.status !== "claimed") {
        this.burn(cleanCode);
      }
      return {
        ok: false,
        error: "Invalid or expired linking code.",
        status: 400,
      };
    }

    // Check strike limit
    if (entry.failedAttempts >= MAX_STRIKES) {
      this.burn(cleanCode);
      return {
        ok: false,
        error: "Code invalidated due to too many failed attempts.",
        status: 400,
      };
    }

    // Valid exchange: retrieve credentials, mark claimed, and generate a long-lived 30-day desktop session token
    const { clerkUserId, user } = entry;
    const desktopSessionToken = mintDesktopToken(clerkUserId);
    entry.status = "claimed";
    entry.claimedAt = Date.now();
    entry.token = "";

    return {
      ok: true,
      token: desktopSessionToken,
      user,
      status: 200,
    };
  }

  /**
   * Queries the lifecycle status of a 9-character linking code.
   */
  checkStatus(rawCodeInput: string): CodeStatus {
    const cleanCode = rawCodeInput.replace(/[^a-zA-Z0-9!@#$%&*?]/g, "").toUpperCase();
    if (cleanCode.length !== 9) return "invalid";
    const entry = this.codes.get(cleanCode);
    if (!entry) return "invalid";
    if (entry.status === "claimed") return "claimed";
    if (entry.expiresAt <= Date.now()) return "expired";
    return "pending";
  }

  /**
   * Records a strike against a code if present.
   */
  recordStrike(rawCodeInput: string): void {
    const cleanCode = rawCodeInput.replace(/[^a-zA-Z0-9!@#$%&*?]/g, "").toUpperCase();
    const entry = this.codes.get(cleanCode);
    if (entry) {
      entry.failedAttempts += 1;
      if (entry.failedAttempts >= MAX_STRIKES) {
        this.burn(cleanCode);
      }
    }
  }

  private burn(code: string): void {
    const entry = this.codes.get(code);
    if (entry) {
      this.userToCode.delete(entry.clerkUserId);
    }
    this.codes.delete(code);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [code, entry] of this.codes.entries()) {
      if (entry.status === "claimed" && entry.claimedAt && now - entry.claimedAt > 30_000) {
        this.burn(code);
      } else if (entry.expiresAt <= now) {
        this.burn(code);
      }
    }

    for (const [userId, session] of this.userSessions.entries()) {
      if (session.windowExpiresAt <= now) {
        this.userSessions.delete(userId);
      }
    }
  }

  /** Reset all codes and sessions (used in test suites) */
  resetAll(): void {
    this.codes.clear();
    this.userToCode.clear();
    this.userSessions.clear();
  }
}

export const desktopCodeStore = new DesktopCodeStore();
