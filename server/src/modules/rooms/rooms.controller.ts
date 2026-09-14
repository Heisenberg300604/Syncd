import type { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { AppError } from "../../utils/apiResponse.js";
import { validateRoomCode } from "./rooms.validation.js";
import {
  createRoomWithHost,
  getRoomByCode,
  joinRoom,
  leaveRoom,
} from "./rooms.service.js";
import {
  announceHostChange,
  clearPendingTransfer,
} from "../../sockets/hostTransfer.js";
import { logger } from "../../utils/logger.js";
import type {
  CreateRoomResponse,
  JoinRoomResponse,
  LeaveRoomResponse,
  RoomResponse,
} from "./rooms.types.js";

export const createRoom = asyncHandler(async (_req: Request, res: Response) => {
  const { userId } = getAuth(_req);

  if (!userId) {
    res.status(401).json({ authenticated: false, message: "Unauthorized" });
    return;
  }

  const room = await createRoomWithHost(userId);

  res.status(201).json({ room } satisfies CreateRoomResponse);
});

export const joinRoomHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = getAuth(req);

    if (!userId) {
      res.status(401).json({ authenticated: false, message: "Unauthorized" });
      return;
    }

    const { roomCode } = req.params;
    const validation = validateRoomCode(roomCode);
    if (!validation.ok) {
      throw new AppError(validation.message, 400);
    }

    const room = await joinRoom(userId, validation.value);

    res.status(200).json({ room } satisfies JoinRoomResponse);
  },
);

export const getRoom = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ authenticated: false, message: "Unauthorized" });
    return;
  }

  const { roomCode } = req.params;
  const validation = validateRoomCode(roomCode);
  if (!validation.ok) {
    throw new AppError(validation.message, 400);
  }

  const room = await getRoomByCode(validation.value);

  if (!room) {
    throw new AppError("Room not found", 404);
  }

  res.status(200).json({ room } satisfies RoomResponse);
});

export const leaveRoomHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = getAuth(req);

    if (!userId) {
      res.status(401).json({ authenticated: false, message: "Unauthorized" });
      return;
    }

    const { roomCode } = req.params;
    const validation = validateRoomCode(roomCode);
    if (!validation.ok) {
      throw new AppError(validation.message, 400);
    }

    const result = await leaveRoom(userId, validation.value);

    // A host leaving deliberately hands the room over inside `leaveRoom`; the
    // members who stayed learn about it here, since the REST layer has no
    // socket of its own.
    if (result.hostHandover) {
      clearPendingTransfer(validation.value);
      announceHostChange(
        validation.value,
        {
          userId: result.hostHandover.previousHostUserId,
          username: result.hostHandover.previousHostUsername,
        },
        "left",
      ).catch((err) =>
        logger.error(
          `Host handover broadcast failed for ${validation.value}`,
          err,
        ),
      );
    }

    const body: LeaveRoomResponse = { left: true };
    res.status(200).json({ ...body, roomDeleted: result.roomDeleted });
  },
);