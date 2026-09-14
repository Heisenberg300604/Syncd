import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateUsername } from "../src/modules/users/users.validation.js";
import { validateMessageContent } from "../src/modules/messages/messages.validation.js";

describe("username validation", () => {
  test("accepts ordinary usernames and trims them", () => {
    assert.deepEqual(validateUsername("  john123 "), {
      ok: true,
      value: "john123",
    });
    assert.deepEqual(validateUsername("a_b_C_9"), { ok: true, value: "a_b_C_9" });
  });

  test("rejects anything outside the documented character set", () => {
    // Usernames are rendered next to other people's messages, so the charset
    // is the guarantee that a name cannot be dressed up as UI copy.
    for (const bad of [
      "ab",
      "a".repeat(21),
      "<script>",
      "john doe",
      `john${String.fromCharCode(0)}`,
      `jo${String.fromCharCode(10)}hn`,
      "üser",
      "__proto__!",
      "",
      "   ",
      null,
      undefined,
      123,
      { username: "john" },
    ]) {
      assert.equal(
        validateUsername(bad).ok,
        false,
        `expected ${JSON.stringify(bad)} to be rejected`,
      );
    }
  });

  test("normalises surrounding whitespace rather than storing it", () => {
    // Trailing control characters are trimmed away, so the stored name is the
    // clean one — no two accounts can differ only by invisible padding.
    const result = validateUsername(`john${String.fromCharCode(10)} `);
    assert.deepEqual(result, { ok: true, value: "john" });
  });

  test("allows the reserved-looking but harmless __proto__ spelling", () => {
    // It matches the charset, and nothing merges usernames into an object, so
    // there is no reason to reject it — this pins that decision.
    assert.equal(validateUsername("__proto__").ok, true);
  });
});

describe("chat message validation", () => {
  test("accepts a normal message", () => {
    assert.deepEqual(validateMessageContent("  hello  "), {
      ok: true,
      value: "hello",
    });
  });

  test("rejects empty, whitespace-only, oversized and non-string content", () => {
    for (const bad of [
      "",
      "   ",
      `${String.fromCharCode(32, 9, 10, 32)}`,
      "x".repeat(501),
      null,
      undefined,
      7,
      {},
      [],
    ]) {
      assert.equal(
        validateMessageContent(bad).ok,
        false,
        `expected ${JSON.stringify(bad)} to be rejected`,
      );
    }
  });

  test("accepts a message at exactly the maximum length", () => {
    assert.equal(validateMessageContent("x".repeat(500)).ok, true);
  });
});
