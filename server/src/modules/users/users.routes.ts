import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { createProfile, getMe } from "./users.controller.js";

const router = Router();

router.get("/me", requireAuth, getMe);
router.post("/users/profile", requireAuth, createProfile);

export default router;