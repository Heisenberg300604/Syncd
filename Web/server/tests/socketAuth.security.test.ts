/**
 * socketAuth.security.test.ts
 *
 * The socket handshake's authorized-party (`azp`) rule:
 *  - browser tokens must come from a frontend this API serves
 *  - native-app tokens (no `azp`) are accepted
 *
 * No network, no Clerk calls — the rule is a pure function.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isAuthorizedParty } from "../src/sockets/socketAuth.js";

const allowed = ["http://localhost:5173", "https://syncd.example"] as const;

describe("isAuthorizedParty", () => {
  test("accepts a browser token from an allowed frontend", () => {
    assert.equal(isAuthorizedParty("http://localhost:5173", allowed), true);
    assert.equal(isAuthorizedParty("https://syncd.example", allowed), true);
  });

  test("rejects a browser token minted for another origin", () => {
    assert.equal(isAuthorizedParty("https://evil.example", allowed), false);
  });

  test("is exact-match, not prefix or case-insensitive", () => {
    assert.equal(isAuthorizedParty("http://localhost:5173/", allowed), false);
    assert.equal(isAuthorizedParty("http://localhost:51730", allowed), false);
    assert.equal(isAuthorizedParty("HTTPS://SYNCD.EXAMPLE", allowed), false);
  });

  test("rejects an empty-string azp (present but meaningless)", () => {
    assert.equal(isAuthorizedParty("", allowed), false);
  });

  test("accepts a native-app token with no azp claim", () => {
    assert.equal(isAuthorizedParty(undefined, allowed), true);
    assert.equal(isAuthorizedParty(null, allowed), true);
  });

  test("rejects a non-string azp", () => {
    assert.equal(isAuthorizedParty(42, allowed), false);
    assert.equal(isAuthorizedParty(["http://localhost:5173"], allowed), false);
    assert.equal(isAuthorizedParty({}, allowed), false);
  });

  test("with an empty allow-list only native tokens pass", () => {
    assert.equal(isAuthorizedParty("http://localhost:5173", []), false);
    assert.equal(isAuthorizedParty(undefined, []), true);
  });
});
