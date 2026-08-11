import "dotenv/config";

export const config = {
  port: Number(process.env["PORT"]) || 5000,
  nodeEnv: process.env["NODE_ENV"] || "development",
  corsOrigin: process.env["CORS_ORIGIN"] || "*",
  databaseUrl: process.env["DATABASE_URL"] || "",
} as const;

export type Config = typeof config;
