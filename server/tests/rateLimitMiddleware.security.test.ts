import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { rateLimit, rateLimiter } from "../src/middleware/rateLimit.js";

interface Captured {
  status?: number;
  body?: unknown;
  headers: Record<string, string>;
}

/** Minimal Express doubles — enough to observe what the middleware sends. */
function run(
  middleware: ReturnType<typeof rateLimit>,
  req: Partial<Request>,
): { captured: Captured; passedThrough: boolean } {
  const captured: Captured = { headers: {} };
  let passedThrough = false;

  const res = {
    setHeader(name: string, value: string) {
      captured.headers[name] = value;
    },
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  } as unknown as Response;

  middleware(req as Request, res, () => {
    passedThrough = true;
  });

  return { captured, passedThrough };
}

describe("rateLimit middleware", () => {
  beforeEach(() => rateLimiter.resetAll());

  test("passes requests through until the ceiling, then answers 429", () => {
    const middleware = rateLimit("test", { limit: 2, windowMs: 60_000 });
    // No Clerk middleware has run for these doubles, so the limiter falls back
    // to the request address — which is exactly the path that must not throw.
    const req = { ip: "203.0.113.7", method: "GET" };

    assert.equal(run(middleware, req).passedThrough, true);
    assert.equal(run(middleware, req).passedThrough, true);

    const third = run(middleware, req);
    assert.equal(third.passedThrough, false);
    assert.equal(third.captured.status, 429);
    assert.ok(third.captured.headers["Retry-After"]);
    assert.match(String((third.captured.body as { message: string }).message), /Too many requests/);
  });

  test("does not leak one caller's budget into another's", () => {
    const middleware = rateLimit("test", { limit: 1, windowMs: 60_000 });

    assert.equal(run(middleware, { ip: "203.0.113.7" }).passedThrough, true);
    assert.equal(run(middleware, { ip: "203.0.113.7" }).passedThrough, false);
    assert.equal(run(middleware, { ip: "198.51.100.4" }).passedThrough, true);
  });
});
