import "dotenv/config";
import http from "node:http";
import app from "./app.js";

const PORT = Number(process.env.PORT) || 5000;

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});