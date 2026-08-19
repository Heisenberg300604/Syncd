import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { searchMusic } from "./music.controller.js";

const router = Router();

router.get("/music/search", requireAuth, searchMusic);

export default router;