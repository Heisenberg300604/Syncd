import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ROOM_CODE_LENGTH,
  generateRoomCode,
  validateRoomCode,
} from "../src/modules/rooms/rooms.validation.js";

/**
 * A room code is the only credential guarding a room, so these are the
 * regression tests for it: it must come from the CSPRNG, and the parser must
 * not widen what counts as a code.
 */
describe("room code generation", () => {
  test("produces codes of the expected shape", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      assert.equal(code.length, ROOM_CODE_LENGTH);
      assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
    }
  });

  test("does not draw from Math.random", () => {
    // Pinning Math.random would make any Math.random-derived generator emit the
    // same code every time. Distinct codes prove the CSPRNG is the source.
    const original = Math.random;
    Math.random = () => 0.42;
    try {
      const codes = new Set(
        Array.from({ length: 50 }, () => generateRoomCode()),
      );
      assert.ok(
        codes.size > 1,
        "room codes are derived from Math.random — predictable by an attacker who can observe a few of them",
      );
    } finally {
      Math.random = original;
    }
  });

  test("does not repeat across a large sample", () => {
    const codes = new Set(Array.from({ length: 5000 }, generateRoomCode));
    // 31^6 ≈ 887M: a collision inside 5000 draws would mean far less entropy
    // than the alphabet implies.
    assert.equal(codes.size, 5000);
  });
});

describe("room code validation", () => {
  test("accepts a well-formed code, case-insensitively", () => {
    const result = validateRoomCode("ab72kd");
    assert.deepEqual(result, { ok: true, value: "AB72KD" });
  });

  test("rejects wrong lengths, symbols and non-strings", () => {
    for (const bad of [
      "ABC12",
      "ABC1234",
      "AB-2KD",
      "AB 2KD",
      "../../etc",
      "%2e%2e",
      "",
      "   ",
      null,
      undefined,
      42,
      { roomCode: "ABC123" },
      ["ABC123"],
    ]) {
      assert.equal(
        validateRoomCode(bad).ok,
        false,
        `expected ${JSON.stringify(bad)} to be rejected`,
      );
    }
  });
});
