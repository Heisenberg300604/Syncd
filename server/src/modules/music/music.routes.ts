import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { REST_RATE_LIMITS } from "../../config/rateLimits.js";
import { resolveVideo, searchMusic } from "./music.controller.js";

const router = Router();

router.get(
  "/music/search",
  requireAuth,
  rateLimit("musicSearch", REST_RATE_LIMITS.musicSearch),
  searchMusic,
);
router.get(
  "/music/video",
  requireAuth,
  rateLimit("musicVideo", REST_RATE_LIMITS.musicVideo),
  resolveVideo,
);

export default router;
