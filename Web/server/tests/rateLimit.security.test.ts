import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  enforceSocketRateLimit,
  rateLimiter,
} from "../src/middleware/rateLimit.js";
import {
  REST_RATE_LIMITS,
  SOCKET_RATE_LIMITS,
} from "../src/config/rateLimits.js";

describe("rate limiter", () => {
  beforeEach(() => rateLimiter.resetAll());

  test("allows exactly `limit` hits inside a window, then blocks", () => {
    const rule = { limit: 3, windowMs: 60_000 };

    for (let i = 0; i < 3; i++) {
      assert.equal(rateLimiter.consume("bucket:user:a", rule).allowed, true);
    }

    const blocked = rateLimiter.consume("bucket:user:a", rule);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterMs > 0);
  });

  test("counts each caller separately", () => {
    const rule = { limit: 1, windowMs: 60_000 };

    assert.equal(rateLimiter.consume("bucket:user:a", rule).allowed, true);
    assert.equal(rateLimiter.consume("bucket:user:a", rule).allowed, false);
    // One user hitting their ceiling must not lock anybody else out.
    assert.equal(rateLimiter.consume("bucket:user:b", rule).allowed, true);
  });

  test("counts each bucket separately", () => {
    const rule = { limit: 1, windowMs: 60_000 };

    assert.equal(rateLimiter.consume("search:user:a", rule).allowed, true);
    assert.equal(rateLimiter.consume("chat:user:a", rule).allowed, true);
  });

  test("lets the caller through again once the window rolls over", async () => {
    const rule = { limit: 1, windowMs: 20 };

    assert.equal(rateLimiter.consume("bucket:user:a", rule).allowed, true);
    assert.equal(rateLimiter.consume("bucket:user:a", rule).allowed, false);

    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.equal(rateLimiter.consume("bucket:user:a", rule).allowed, true);
  });

  test("socket enforcement throws once the ceiling is reached", () => {
    const rule = { limit: 2, windowMs: 60_000 };

    enforceSocketRateLimit("chat", "user-1", rule);
    enforceSocketRateLimit("chat", "user-1", rule);

    assert.throws(
      () => enforceSocketRateLimit("chat", "user-1", rule),
      /Slow down/,
    );
    // A different member is unaffected.
    enforceSocketRateLimit("chat", "user-2", rule);
  });
});

describe("configured limits", () => {
  test("every limit is a positive count over a positive window", () => {
    for (const [name, rule] of [
      ...Object.entries(REST_RATE_LIMITS),
      ...Object.entries(SOCKET_RATE_LIMITS),
    ]) {
      assert.ok(rule.limit > 0, `${name} has a non-positive limit`);
      assert.ok(rule.windowMs > 0, `${name} has a non-positive window`);
    }
  });

  test("room-code guessing stays slower than one try per second", () => {
    // 31^6 room codes only protect a room while guessing is bounded.
    const { limit, windowMs } = REST_RATE_LIMITS.joinRoom;
    assert.ok(limit / (windowMs / 1000) < 1);
  });
});
