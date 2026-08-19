import { Router } from "express";
import usersRouter from "../modules/users/users.routes.js";
import roomsRouter from "../modules/rooms/rooms.routes.js";

const router = Router();

router.use("/", usersRouter);
router.use("/", roomsRouter);

export default router;