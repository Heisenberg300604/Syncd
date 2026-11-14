import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateSeekPosition } from "../src/modules/playback/playback.validation.js";

describe("validateSeekPosition", () => {
  // 1. Valid seek within known duration → accepted at given position
  test("accepts a valid seek within known duration", () => {
    const result = validateSeekPosition(42, 180);
    assert.deepEqual(result, { ok: true, value: 42 });
  });

  // 2. Seek exactly at duration → clamped to duration (stays at duration)
  test("accepts a seek exactly at duration", () => {
    const result = validateSeekPosition(180, 180);
    assert.deepEqual(result, { ok: true, value: 180 });
  });

  // 3. Seek beyond duration → clamped to duration
  test("clamps a seek beyond the known duration", () => {
    const result = validateSeekPosition(999, 180);
    assert.deepEqual(result, { ok: true, value: 180 });
  });

  // 4. Negative seek → error
  test("rejects a negative seek position", () => {
    const result = validateSeekPosition(-5, 180);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, "Seek position cannot be negative");
    }
  });

  // 5. NaN seek → error
  test("rejects NaN seek position", () => {
    const result = validateSeekPosition(NaN, 180);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, "Invalid seek position");
    }
  });

  // 6. Infinity seek → clamped to duration when duration is known
  test("rejects Infinity seek position", () => {
    const result = validateSeekPosition(Infinity, 180);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, "Invalid seek position");
    }
  });

  // 7. Unknown-duration media (null duration) → any finite non-negative value accepted
  test("accepts any finite non-negative seek when duration is null", () => {
    const r1 = validateSeekPosition(0, null);
    assert.deepEqual(r1, { ok: true, value: 0 });

    const r2 = validateSeekPosition(99999, null);
    assert.deepEqual(r2, { ok: true, value: 99999 });
  });

  // Extra edge: non-number type
  test("rejects a non-number seek position", () => {
    const result = validateSeekPosition("30", 180);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, "Invalid seek position");
    }
  });

  // Extra edge: zero duration → no clamping applied (duration must be > 0)
  test("does not clamp when durationSeconds is 0", () => {
    const result = validateSeekPosition(50, 0);
    assert.deepEqual(result, { ok: true, value: 50 });
  });

  // Extra edge: seek of 0 is valid
  test("accepts zero seek position", () => {
    const result = validateSeekPosition(0, 180);
    assert.deepEqual(result, { ok: true, value: 0 });
  });
});

