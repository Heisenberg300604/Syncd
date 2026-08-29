import type { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { AppError } from "../../utils/apiResponse.js";
import {
  parseYouTubeVideoId,
  validateSearchQuery,
} from "./music.validation.js";
import {
  getYouTubeVideoById,
  searchYouTubeVideos,
} from "./music.service.js";
import type {
  YouTubeSearchResponse,
  YouTubeVideoResponse,
} from "./music.types.js";

export const searchMusic = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = getAuth(req);

    if (!userId) {
      res.status(401).json({ authenticated: false, message: "Unauthorized" });
      return;
    }

    const rawQuery = req.query["q"];
    const validation = validateSearchQuery(rawQuery);
    if (!validation.ok) {
      throw new AppError(validation.message, 400);
    }

    const results = await searchYouTubeVideos(validation.value);

    res.status(200).json({ results } satisfies YouTubeSearchResponse);
  },
);
export const resolveVideo = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = getAuth(req);

    if (!userId) {
      res.status(401).json({ authenticated: false, message: "Unauthorized" });
      return;
    }

    const validation = parseYouTubeVideoId(req.query["url"]);
    if (!validation.ok) {
      throw new AppError(validation.message, 400);
    }

    const result = await getYouTubeVideoById(validation.value);

    res.status(200).json({ result } satisfies YouTubeVideoResponse);
  },
);
