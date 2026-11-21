import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { desktopCodeStore } from "../src/modules/auth/desktopCodeStore.js";
import { verifyDesktopToken } from "../src/modules/auth/desktopToken.js";

describe("desktop auth linking code store", () => {
  beforeEach(() => {
    desktopCodeStore.resetAll();
  });

  test("generates cryptographically secure 9-character alphanumeric and symbol codes", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const res = desktopCodeStore.generateCode(
        `user_${i}`,
        `token_${i}`,
        { id: `id_${i}`, clerkUserId: `user_${i}`, username: `user_${i}` },
      );
      assert.equal(res.ok, true);
      assert.ok(res.code);
      assert.equal(res.code.length, 9);
      assert.match(res.code, /^[A-Z0-9!@#$%&*?]{9}$/);
      assert.equal(res.expiresInSeconds, 120);
      codes.add(res.code);
    }
    // High entropy across 100 iterations
    assert.equal(codes.size, 100);
  });

  test("enforces maximum 3 code generations per session window", () => {
    const clerkId = "user_rate_limit";
    const dummyToken = "jwt_token";

    // Attempt 1: allowed (2 attempts remaining)
    const gen1 = desktopCodeStore.generateCode(clerkId, dummyToken, null);
    assert.equal(gen1.ok, true);
    assert.equal(gen1.attemptsRemaining, 2);
    assert.equal(gen1.generationCount, 1);

    // Attempt 2: allowed (1 attempt remaining)
    const gen2 = desktopCodeStore.generateCode(clerkId, dummyToken, null);
    assert.equal(gen2.ok, true);
    assert.equal(gen2.attemptsRemaining, 1);
    assert.equal(gen2.generationCount, 2);

    // Attempt 3: allowed (0 attempts remaining)
    const gen3 = desktopCodeStore.generateCode(clerkId, dummyToken, null);
    assert.equal(gen3.ok, true);
    assert.equal(gen3.attemptsRemaining, 0);
    assert.equal(gen3.generationCount, 3);

    // Attempt 4: rejected with 429
    const gen4 = desktopCodeStore.generateCode(clerkId, dummyToken, null);
    assert.equal(gen4.ok, false);
    assert.equal(gen4.status, 429);
    assert.equal(gen4.attemptsRemaining, 0);
  });

  test("tracks code lifecycle status: pending -> claimed", () => {
    const clerkId = "user_lifecycle";
    const { code } = desktopCodeStore.generateCode(clerkId, "token_123", null);
    assert.ok(code);

    // Initial status is pending
    assert.equal(desktopCodeStore.checkStatus(code), "pending");

    // Exchange code
    const exchange = desktopCodeStore.exchangeCode(code);
    assert.equal(exchange.ok, true);

    // After exchange, status is claimed
    assert.equal(desktopCodeStore.checkStatus(code), "claimed");

    // Unknown code is invalid
    assert.equal(desktopCodeStore.checkStatus("NONEXIST1"), "invalid");
  });

  test("successfully exchanges code and immediately burns it (single use)", () => {
    const clerkId = "user_abc";
    const dummyToken = "jwt_session_token_12345";
    const userProfile = { id: "u1", clerkUserId: clerkId, username: "testuser" };

    const { code } = desktopCodeStore.generateCode(clerkId, dummyToken, userProfile);

    // First exchange succeeds
    const exchange1 = desktopCodeStore.exchangeCode(code);
    assert.equal(exchange1.ok, true);
    assert.ok(exchange1.token);
    assert.match(exchange1.token, /^syncd_dt_/);
    const decoded1 = verifyDesktopToken(exchange1.token);
    assert.equal(decoded1?.sub, clerkId);
    assert.equal(exchange1.user?.username, "testuser");

    // Second exchange fails (already burned)
    const exchange2 = desktopCodeStore.exchangeCode(code);
    assert.equal(exchange2.ok, false);
    assert.equal(exchange2.status, 400);
  });

  test("burns code when 3 strikes / failed attempts are reached", () => {
    const clerkId = "user_xyz";
    const dummyToken = "jwt_token";
    const userProfile = { id: "u2", clerkUserId: clerkId, username: "striker" };

    const { code } = desktopCodeStore.generateCode(clerkId, dummyToken, userProfile);

    // Record 2 strikes
    desktopCodeStore.recordStrike(code);
    desktopCodeStore.recordStrike(code);

    // Third strike burns it
    desktopCodeStore.recordStrike(code);

    // Exchange fails because code is invalidated
    const exchange = desktopCodeStore.exchangeCode(code);
    assert.equal(exchange.ok, false);
  });

  test("generates new code replaces previous code for same user", () => {
    const clerkId = "user_same";
    const { code: code1 } = desktopCodeStore.generateCode(clerkId, "token1", null);
    const { code: code2 } = desktopCodeStore.generateCode(clerkId, "token2", null);

    assert.notEqual(code1, code2);

    // Old code is invalid
    const ex1 = desktopCodeStore.exchangeCode(code1);
    assert.equal(ex1.ok, false);

    // New code is valid
    const ex2 = desktopCodeStore.exchangeCode(code2);
    assert.equal(ex2.ok, true);
    assert.ok(ex2.token);
    assert.match(ex2.token, /^syncd_dt_/);
    const decoded2 = verifyDesktopToken(ex2.token);
    assert.equal(decoded2?.sub, clerkId);
  });
});
