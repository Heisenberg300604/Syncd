import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { REST_RATE_LIMITS } from "../../config/rateLimits.js";
import { createProfile, getMe } from "./users.controller.js";

const router = Router();

router.get("/me", requireAuth, rateLimit("me", REST_RATE_LIMITS.me), getMe);
router.post(
  "/users/profile",
  requireAuth,
  rateLimit("createProfile", REST_RATE_LIMITS.createProfile),
  createProfile,
);

export default router;
