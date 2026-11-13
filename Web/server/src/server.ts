import "dotenv/config";
import http from "node:http";
import app from "./app.js";
import { createSocketServer } from "./sockets/index.js";

const PORT = Number(process.env.PORT) || 5000;
const HOST = "0.0.0.0";

const server = http.createServer(app);

createSocketServer(server);

server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
});