import type { PublicUser } from "../users/users.types.js";

export interface RoomMemberDTO {
  user: PublicUser;
  joinedAt: string;
}

export interface RoomDTO {
  id: string;
  roomCode: string;
  host: PublicUser;
  members: RoomMemberDTO[];
  currentVideoId: string | null;
  currentTitle: string | null;
  currentThumbnailUrl: string | null;
  currentDuration: number | null;
  isPlaying: boolean;
  playbackPosition: number;
  playbackUpdatedAt: string | null;
}

export interface CreateRoomResponse {
  room: RoomDTO;
}

export interface JoinRoomResponse {
  room: RoomDTO;
}

export interface RoomResponse {
  room: RoomDTO;
}

export interface LeaveRoomResponse {
  left: true;
}