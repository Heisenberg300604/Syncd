import "dotenv/config";

const clientOrigins = (process.env["CORS_ORIGIN"] || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Origins allowed to mint the session tokens the socket layer accepts (the
 * `azp` claim). Defaults to the CORS allowlist, since those are exactly the
 * frontends this API serves; `CLERK_AUTHORIZED_PARTIES` overrides it when a
 * deployment's page origin differs from its CORS origin.
 */
const authorizedParties = (process.env["CLERK_AUTHORIZED_PARTIES"] || "")
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
  clerkAuthorizedParties:
    authorizedParties.length > 0 ? authorizedParties : clientOrigins,
  youtubeApiKey: process.env["YOUTUBE_API_KEY"] || "",
} as const;

export type Config = typeof config;
