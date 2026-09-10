import "dotenv/config";

const clientOrigins = (process.env["CORS_ORIGIN"] || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const config = {
  port: Number(process.env["PORT"]) || 5000,
  nodeEnv: process.env["NODE_ENV"] || "development",
  corsOrigins: clientOrigins,
  databaseUrl: process.env["DATABASE_URL"] || "",
  clerkPublishableKey: process.env["CLERK_PUBLISHABLE_KEY"] || "",
  clerkSecretKey: process.env["CLERK_SECRET_KEY"] || "",
  youtubeApiKey: process.env["YOUTUBE_API_KEY"] || "",
} as const;

export type Config = typeof config;
