import { Router } from "express";
import usersRouter from "../modules/users/users.routes.js";

const router = Router();

router.use("/", usersRouter);

export default router;