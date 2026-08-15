import "dotenv/config";

const CLIENT_ORIGIN = process.env["CORS_ORIGIN"] || "http://localhost:5173";

export const config = {
  port: Number(process.env["PORT"]) || 5000,
  nodeEnv: process.env["NODE_ENV"] || "development",
  corsOrigin: CLIENT_ORIGIN,
  databaseUrl: process.env["DATABASE_URL"] || "",
  clerkPublishableKey: process.env["CLERK_PUBLISHABLE_KEY"] || "",
  clerkSecretKey: process.env["CLERK_SECRET_KEY"] || "",
} as const;

export type Config = typeof config;