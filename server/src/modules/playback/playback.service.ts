import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/apiResponse.js";
import { parseIso8601DurationToSeconds } from "../music/music.validation.js";
import type {
  PlaybackAction,
  PlaybackSnapshot,
  PlaybackTrackInput,
} from "./playback.types.js";

type RoomPlaybackRow = {
  currentVideoId: string | null;
  currentTitle: string | null;
  currentThumbnailUrl: string | null;
  currentDuration: number | null;
  isPlaying: boolean;
  playbackPosition: number;
  playbackUpdatedAt: Date | null;
};

const playbackSelect = {
  currentVideoId: true,
  currentTitle: true,
  currentThumbnailUrl: true,
  currentDuration: true,
  isPlaying: true,
  playbackPosition: true,
  playbackUpdatedAt: true,
} as const;

export function toPlaybackSnapshot(room: RoomPlaybackRow): PlaybackSnapshot {
  return {
    videoId: room.currentVideoId,
    title: room.currentTitle,
    thumbnailUrl: room.currentThumbnailUrl,
    duration: room.currentDuration,
    isPlaying: room.isPlaying,
    position: room.playbackPosition,
    updatedAt: room.playbackUpdatedAt
      ? room.playbackUpdatedAt.toISOString()
      : null,
    serverTime: new Date().toISOString(),
  };
}

export async function getRoomPlayback(
  roomCode: string,
): Promise<PlaybackSnapshot | null> {
  const room = await prisma.room.findUnique({
    where: { roomCode },
    select: playbackSelect,
  });

  return room ? toPlaybackSnapshot(room) : null;
}

/** Replaces the room's current track and restarts it from the beginning. */
export async function setRoomTrack(
  roomCode: string,
  userId: string,
  track: PlaybackTrackInput,
): Promise<PlaybackSnapshot> {
  const room = await prisma.room.update({
    where: { roomCode },
    data: {
      currentVideoId: track.videoId,
      currentTitle: track.title,
      currentThumbnailUrl: track.thumbnailUrl,
      currentDuration: parseIso8601DurationToSeconds(track.duration),
      isPlaying: true,
      playbackPosition: 0,
      playbackUpdatedAt: new Date(),
      playbackUpdatedById: userId,
    },
    select: playbackSelect,
  });

  return toPlaybackSnapshot(room);
}

export async function applyPlaybackControl(
  roomCode: string,
  userId: string,
  action: PlaybackAction,
  position: number,
): Promise<PlaybackSnapshot> {
  const existing = await prisma.room.findUnique({
    where: { roomCode },
    select: { currentVideoId: true, isPlaying: true },
  });

  if (!existing) {
    throw new AppError("Room not found", 404);
  }

  if (!existing.currentVideoId) {
    throw new AppError("Nothing is loaded in this room", 409);
  }

  const safePosition =
    Number.isFinite(position) && position >= 0 ? position : 0;

  const room = await prisma.room.update({
    where: { roomCode },
    data: {
      isPlaying: action === "pause" ? false : action === "play" ? true : existing.isPlaying,
      playbackPosition: safePosition,
      playbackUpdatedAt: new Date(),
      playbackUpdatedById: userId,
    },
    select: playbackSelect,
  });

  return toPlaybackSnapshot(room);
}

export async function clearRoomTrack(
  roomCode: string,
  userId: string,
): Promise<PlaybackSnapshot> {
  const room = await prisma.room.update({
    where: { roomCode },
    data: {
      currentVideoId: null,
      currentTitle: null,
      currentThumbnailUrl: null,
      currentDuration: null,
      isPlaying: false,
      playbackPosition: 0,
      playbackUpdatedAt: new Date(),
      playbackUpdatedById: userId,
    },
    select: playbackSelect,
  });

  return toPlaybackSnapshot(room);
}
