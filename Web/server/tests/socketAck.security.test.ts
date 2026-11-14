import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { reply } from "../src/sockets/ack.js";

/**
 * A throw inside a Socket.IO listener is dispatched from a `process.nextTick`
 * that has no handler of its own, so it ends the process — for every room, not
 * just the socket that caused it. Any authenticated client controls the
 * argument list of the events it emits, which is what makes these regressions
 * worth pinning.
 */
describe("socket ack replies", () => {
  test("delivers the response when the client asked for an acknowledgement", () => {
    const received: unknown[] = [];
    reply((res: unknown) => received.push(res), { ok: true });
    assert.deepEqual(received, [{ ok: true }]);
  });

  test("stays silent instead of throwing when the ack is absent or forged", () => {
    // Emitting without an ack leaves the parameter undefined; emitting an
    // extra positional argument can make it any value the client likes.
    for (const forged of [
      undefined,
      null,
      "not-a-function",
      42,
      {},
      [],
      true,
      Symbol("nope"),
    ]) {
      assert.doesNotThrow(() => reply(forged, { ok: false, message: "nope" }));
    }
  });
});
