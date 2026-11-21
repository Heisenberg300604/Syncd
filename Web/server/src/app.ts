import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { clerkMiddleware } from "@clerk/express";
import { config } from "./config/env.js";
import apiRouter from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();

// Disable ETags for JSON API to avoid 304 empty-body issues on authenticated fetch requests
app.set("etag", false);

const allowedOrigins = new Set([
  ...config.corsOrigins,
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://tauri.localhost",
  "https://tauri.localhost",
  "tauri://localhost",
]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile native apps, curl, electron/tauri plugins)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.has(origin) ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:") ||
        origin.startsWith("tauri://") ||
        origin.endsWith(".localhost")
      ) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma", "X-Requested-With"],
  }),
);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(morgan("dev"));

app.use(clerkMiddleware());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
  });
});

app.use("/api", apiRouter);

app.use(notFoundHandler);

app.use(errorHandler);

export default app;
