import crypto from "crypto";
import { config } from "../../config/env.js";

const TOKEN_PREFIX = "syncd_dt_";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface DesktopTokenPayload {
  sub: string; // clerkUserId
  iat: number;
  exp: number;
  v: number;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf8").toString("base64url");
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

/**
 * Mints a cryptographically signed, long-lived (30-day) token for SyncD Desktop.
 * Uses HMAC-SHA256 with the server's Clerk secret key.
 */
export function mintDesktopToken(clerkUserId: string, expiresInMs = THIRTY_DAYS_MS): string {
  const now = Date.now();
  const payload: DesktopTokenPayload = {
    sub: clerkUserId,
    iat: now,
    exp: now + expiresInMs,
    v: 1,
  };

  const payloadStr = base64UrlEncode(JSON.stringify(payload));
  const secret = config.clerkSecretKey || "syncd_fallback_secret_key_desktop";
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadStr)
    .digest("base64url");

  return `${TOKEN_PREFIX}${payloadStr}.${signature}`;
}

/**
 * Verifies a SyncD Desktop session token in constant-time.
 * Returns the decoded payload if valid and unexpired; otherwise null.
 */
export function verifyDesktopToken(token: string): DesktopTokenPayload | null {
  if (!token || typeof token !== "string" || !token.startsWith(TOKEN_PREFIX)) {
    return null;
  }

  const tokenBody = token.slice(TOKEN_PREFIX.length);
  const parts = tokenBody.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const payloadStr = parts[0];
  const signature = parts[1];
  if (!payloadStr || !signature) {
    return null;
  }
  const secret = config.clerkSecretKey || "syncd_fallback_secret_key_desktop";
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payloadStr)
    .digest("base64url");

  if (signature.length !== expectedSig.length) {
    return null;
  }

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSig);

  if (!crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
    return null;
  }

  try {
    const payload: DesktopTokenPayload = JSON.parse(base64UrlDecode(payloadStr));
    if (!payload.sub || typeof payload.exp !== "number") {
      return null;
    }

    if (Date.now() > payload.exp) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}
