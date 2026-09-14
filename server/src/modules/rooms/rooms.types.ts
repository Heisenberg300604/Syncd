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

/**
 * Members oldest-first plus the room's current host — the shape the socket
 * layer needs for every presence broadcast and for host succession.
 */
export interface RoomPresenceData {
  roomId: string;
  hostUserId: string;
  members: { userId: string; username: string }[];
}

export interface LeaveRoomResult {
  roomDeleted: boolean;
  /**
   * Present only when a departing host handed the room to someone else. The
   * socket layer uses it to announce the change to the members who stayed.
   */
  hostHandover?: {
    previousHostUserId: string;
    previousHostUsername: string;
    newHostUserId: string;
  };
}