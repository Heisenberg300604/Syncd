import type { Request, Response, NextFunction } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../utils/apiResponse.js";
import { logger } from "../utils/logger.js";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: "Not found" });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "field";
      res.status(409).json({ message: `A record with this ${target} already exists` });
      return;
    }
    logger.error("Prisma known error", { code: err.code, message: err.message });
    res.status(500).json({ message: "Internal server error" });
    return;
  }

  if (err instanceof Error) {
    logger.error("Unhandled error", err.message);
  } else {
    logger.error("Unhandled error", String(err));
  }

  res.status(500).json({ message: "Internal server error" });
}