// Minimal Socket.IO v4 server that mirrors the SyncD gateway's *transport*
// contract (handshake `auth.token`, acks, broadcasts) for the opt-in Android
// integration test. It is NOT the backend: no Clerk, no database.
//
//   node android/tools/socketio-contract-mock.mjs 5055
//
// Resolves socket.io from server/node_modules so the version matches production.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../server/package.json"));
const { Server } = require("socket.io");

const port = Number(process.argv[2] ?? 5055);
const http = createServer();
const io = new Server(http, { maxHttpBufferSize: 100_000 });

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Missing auth token"));
  // Same failure the real server produces for a token without an accepted `azp`.
  if (token.startsWith("bad")) return next(new Error('Invalid JWT Authorized party claim (azp) undefined.'));
  socket.data.token = token;
  next();
});

const now = () => new Date().toISOString();
io.on("connection", (socket) => {
  socket.on("whoami", (_p, ack) => typeof ack === "function" && ack({ ok: true, token: socket.data.token }));
  socket.on("room:join", (payload, ack) => {
    socket.join("room:" + payload.roomCode);
    ack({
      ok: true,
      presence: { members: [{ userId: "u1", username: "ana", online: true }], hostUserId: "u1" },
      playback: { videoId: "dQw4w9WgXcQ", title: "Song", thumbnailUrl: "", duration: 212, isPlaying: true,
                  position: 3, updatedAt: now(), serverTime: now() },
      messages: [], queue: [],
    });
    io.to("room:" + payload.roomCode).emit("presence:update",
      { members: [{ userId: "u1", username: "ana", online: true }], hostUserId: "u1" });
  });
  socket.on("chat:send", (p, ack) => {
    io.to("room:" + p.roomCode).emit("chat:new",
      { id: "m-" + Date.now(), roomId: "r", userId: "u1", username: "ana", content: p.content, createdAt: now() });
    ack({ ok: true });
  });
  socket.on("room:leave", (_p, ack) => typeof ack === "function" && ack());
  socket.on("test:kick", () => socket.disconnect(true));
});

http.listen(port, "127.0.0.1", () => console.log(`socketio-contract-mock listening on ${port}`));
