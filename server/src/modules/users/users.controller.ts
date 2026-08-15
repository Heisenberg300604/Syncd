import type { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { AppError } from "../../utils/apiResponse.js";
import { createUser, findUserByClerkId, findUserByUsername } from "./users.service.js";
import { validateUsername } from "./users.validation.js";
import type { CreateProfileBody, MeResponse, ProfileResponse } from "./users.types.js";

export const getMe = asyncHandler(async (_req: Request, res: Response) => {
  const { userId } = getAuth(_req);

  if (!userId) {
    res.status(401).json({ authenticated: false, message: "Unauthorized" });
    return;
  }

  const user = await findUserByClerkId(userId);

  const body: MeResponse = {
    authenticated: true,
    user,
    onboardingComplete: user !== null,
  };

  res.status(200).json(body);
});

export const createProfile = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ authenticated: false, message: "Unauthorized" });
    return;
  }

  const { username } = req.body as CreateProfileBody;

  const validation = validateUsername(username);
  if (!validation.ok) {
    throw new AppError(validation.message, 400);
  }

  const existingByClerkId = await findUserByClerkId(userId);
  if (existingByClerkId) {
    res.status(200).json({ user: existingByClerkId } satisfies ProfileResponse);
    return;
  }

  const existingByUsername = await findUserByUsername(validation.value);
  if (existingByUsername) {
    throw new AppError("Username is already taken", 409);
  }

  const user = await createUser(userId, validation.value);

  res.status(201).json({ user } satisfies ProfileResponse);
});