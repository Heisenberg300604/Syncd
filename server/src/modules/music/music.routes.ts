import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { resolveVideo, searchMusic } from "./music.controller.js";

const router = Router();

router.get("/music/search", requireAuth, searchMusic);
router.get("/music/video", requireAuth, resolveVideo);

export default router;