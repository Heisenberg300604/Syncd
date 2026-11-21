import { Router } from "express";
import usersRouter from "../modules/users/users.routes.js";
import roomsRouter from "../modules/rooms/rooms.routes.js";
import musicRouter from "../modules/music/music.routes.js";
import authRouter from "../modules/auth/auth.routes.js";

const router = Router();

router.use("/", authRouter);
router.use("/", usersRouter);
router.use("/", roomsRouter);
router.use("/", musicRouter);

export default router;