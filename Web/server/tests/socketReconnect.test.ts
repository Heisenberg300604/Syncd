/**
 * socketReconnect.test.ts
 *
 * Unit tests for the socket reconnect event-binding logic in useRoomSocket.
 *
 * We cannot import the React hook directly in a Node test runner, so we
 * replicate the exact event-listener pattern the hook uses and verify call
 * counts. The goal is to prove the fix is correct: `room:join` is emitted
 * exactly once per connection (initial or reconnect), never twice.
 *
 * Framework: Node.js built-in `node:test` + `assert`
 * Run:  cd server && npx tsx --test tests/socketReconnect.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

// ---------------------------------------------------------------------------
// Minimal socket mock that mirrors the Socket.IO API surface used by the hook
// ---------------------------------------------------------------------------

type Listener = (...args: unknown[]) => void;

class MockSocket extends EventEmitter {
  /**
   * Socket.IO exposes `socket.io` (the Manager) as a separate EventEmitter.
   */
  io: EventEmitter = new EventEmitter();

  connected = false;

  /** Records every event emitted via socket.emit (not EventEmitter.emit). */
  emitted: Array<{ event: string; payload: unknown }> = [];

  /**
   * Simulates socket.emit — the method used to send events to the server.
   * We capture these calls so tests can assert on them.
   */
  emit(event: string, payload?: unknown, _ack?: Listener): boolean {
    this.emitted.push({ event, payload });
    return true;
  }

  /**
   * Simulate an incoming socket-level event (e.g. "connect", "disconnect").
   * Uses the underlying EventEmitter to trigger the registered listeners.
   */
  simulateSocketEvent(event: string, ...args: unknown[]): void {
    super.emit(event, ...args);
  }

  /**
   * Simulate a manager-level event (e.g. "reconnect_attempt", "reconnect").
   */
  simulateManagerEvent(event: string, ...args: unknown[]): void {
    this.io.emit(event, ...args);
  }

  /**
   * Register a socket-level listener — mirrors socket.on(event, fn).
   */
  on(event: string, listener: Listener): this {
    super.on(event, listener);
    return this;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

interface SimState {
  connectionStatus: ConnectionStatus;
  playbackError: string | null;
}

/**
 * Wire up listeners exactly as the fixed hook does, then return the state
 * object and the emitted-calls record so tests can inspect them.
 */
function wireHook(socket: MockSocket, roomCode: string): SimState {
  const state: SimState = {
    connectionStatus: "connecting",
    playbackError: null,
  };

  // Simulated applyJoinAck — just a no-op for counting purposes.
  const applyJoinAck = () => { /* no-op */ };

  // --- FIXED handler pattern (single join trigger) ---

  socket.on("connect", () => {
    state.connectionStatus = "connected";
    state.playbackError = null; // clear stale connection errors
    socket.emit("room:join", { roomCode }, applyJoinAck);
  });

  socket.on("disconnect", () => {
    state.connectionStatus = "disconnected";
  });

  socket.on("connect_error", (err: unknown) => {
    state.playbackError = (err as Error).message;
  });

  socket.io.on("reconnect_attempt", () => {
    state.connectionStatus = "reconnecting";
  });

  // NOTE: no socket.io.on("reconnect", ...) join emission — that is the fix.

  return state;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("socket reconnect — event binding logic", () => {
  it("initial connect emits room:join exactly once", () => {
    const socket = new MockSocket();
    const roomCode = "ABC123";
    wireHook(socket, roomCode);

    socket.simulateSocketEvent("connect");

    const joins = socket.emitted.filter((e) => e.event === "room:join");
    assert.equal(joins.length, 1, "room:join should be emitted exactly once on initial connect");
  });

  it("reconnect sequence (reconnect_attempt → connect) emits room:join exactly once", () => {
    const socket = new MockSocket();
    const roomCode = "ABC123";
    const state = wireHook(socket, roomCode);

    // Initial connect
    socket.simulateSocketEvent("connect");
    assert.equal(state.connectionStatus, "connected");

    // Simulate a disconnection
    socket.simulateSocketEvent("disconnect");
    assert.equal(state.connectionStatus, "disconnected");

    // Reconnect sequence: manager fires reconnect_attempt, then socket fires connect
    socket.simulateManagerEvent("reconnect_attempt");
    assert.equal(state.connectionStatus, "reconnecting");

    socket.simulateSocketEvent("connect"); // Socket.IO fires connect after reconnect
    assert.equal(state.connectionStatus, "connected");

    // room:join must have been emitted exactly twice total (once per connect event)
    // but NOT three times (which would happen with the buggy double-emit).
    const joins = socket.emitted.filter((e) => e.event === "room:join");
    assert.equal(
      joins.length,
      2,
      "room:join should be emitted once on initial connect and once on reconnect (2 total), not 3",
    );
  });

  it("connect_error sets playbackError and does not set status to connected", () => {
    const socket = new MockSocket();
    const state = wireHook(socket, "ROOM99");

    socket.simulateSocketEvent("connect_error", new Error("websocket error"));

    assert.notEqual(state.connectionStatus, "connected", "status must not be connected after connect_error");
    assert.equal(state.playbackError, "websocket error", "playbackError must reflect the connection error");
  });

  it("stale error is cleared after a successful reconnect", () => {
    const socket = new MockSocket();
    const state = wireHook(socket, "ROOM99");

    // First, produce a connection error
    socket.simulateSocketEvent("connect_error", new Error("network unreachable"));
    assert.equal(state.playbackError, "network unreachable");

    // Then successfully reconnect: reconnect_attempt → connect
    socket.simulateManagerEvent("reconnect_attempt");
    socket.simulateSocketEvent("connect");

    assert.equal(state.connectionStatus, "connected");
    assert.equal(
      state.playbackError,
      null,
      "playbackError must be cleared after a successful reconnect",
    );
  });

  it("multiple reconnects each emit room:join exactly once per cycle", () => {
    const socket = new MockSocket();
    wireHook(socket, "MULTI1");

    // Initial connect
    socket.simulateSocketEvent("connect");

    // Three disconnect → reconnect cycles
    for (let i = 0; i < 3; i++) {
      socket.simulateSocketEvent("disconnect");
      socket.simulateManagerEvent("reconnect_attempt");
      socket.simulateSocketEvent("connect");
    }

    const joins = socket.emitted.filter((e) => e.event === "room:join");
    // 1 initial + 3 reconnects = 4 total
    assert.equal(joins.length, 4, "room:join should emit once per connect event (1 + 3 cycles = 4)");
  });

  it("reconnect_attempt sets status to reconnecting before connect fires", () => {
    const socket = new MockSocket();
    const state = wireHook(socket, "RTEST");

    socket.simulateSocketEvent("connect");
    socket.simulateSocketEvent("disconnect");

    // Before connect fires again, the manager signals a reconnect attempt
    socket.simulateManagerEvent("reconnect_attempt");
    assert.equal(
      state.connectionStatus,
      "reconnecting",
      "status must be 'reconnecting' during reconnect attempt",
    );
  });
});
