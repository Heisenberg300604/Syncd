import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { REST_RATE_LIMITS } from "../../config/rateLimits.js";
import {
  createRoom,
  getRoom,
  joinRoomHandler,
  leaveRoomHandler,
} from "./rooms.controller.js";

const router = Router();

router.post(
  "/rooms",
  requireAuth,
  rateLimit("createRoom", REST_RATE_LIMITS.createRoom),
  createRoom,
);
router.post(
  "/rooms/:roomCode/join",
  requireAuth,
  rateLimit("joinRoom", REST_RATE_LIMITS.joinRoom),
  joinRoomHandler,
);
router.get(
  "/rooms/:roomCode",
  requireAuth,
  rateLimit("getRoom", REST_RATE_LIMITS.getRoom),
  getRoom,
);
router.post(
  "/rooms/:roomCode/leave",
  requireAuth,
  rateLimit("leaveRoom", REST_RATE_LIMITS.leaveRoom),
  leaveRoomHandler,
);

export default router;
