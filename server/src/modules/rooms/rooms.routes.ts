import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  createRoom,
  getRoom,
  joinRoomHandler,
  leaveRoomHandler,
} from "./rooms.controller.js";

const router = Router();

router.post("/rooms", requireAuth, createRoom);
router.post("/rooms/:roomCode/join", requireAuth, joinRoomHandler);
router.get("/rooms/:roomCode", requireAuth, getRoom);
router.post("/rooms/:roomCode/leave", requireAuth, leaveRoomHandler);

export default router;