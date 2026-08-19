import "dotenv/config";
import http from "node:http";
import app from "./app.js";
import { createSocketServer } from "./sockets/index.js";

const PORT = Number(process.env.PORT) || 5000;

const server = http.createServer(app);

createSocketServer(server);

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});