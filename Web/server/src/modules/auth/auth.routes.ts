import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { REST_RATE_LIMITS } from "../../config/rateLimits.js";
import {
  generateDesktopCode,
  exchangeDesktopCode,
  getDesktopCodeStatus,
} from "./auth.controller.js";

const router = Router();

// Endpoint for Web to generate a 9-digit linking code (requires auth, rate-limited)
router.post(
  "/auth/desktop-code",
  requireAuth,
  rateLimit("desktopAuthGenerate", REST_RATE_LIMITS.desktopAuthGenerate),
  generateDesktopCode,
);

// Endpoint for Web to poll the claimed / verification status of a code
router.get("/auth/desktop-code/status", getDesktopCodeStatus);

// Endpoint for Desktop to exchange the 9-digit code (public, rate-limited by IP)
router.post(
  "/auth/desktop-exchange",
  rateLimit("desktopAuthExchange", REST_RATE_LIMITS.desktopAuthExchange),
  exchangeDesktopCode,
);

export default router;
