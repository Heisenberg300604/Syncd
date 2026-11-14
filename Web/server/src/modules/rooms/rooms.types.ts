/**
 * A person as seen by the rest of a room.
 *
 * Deliberately narrower than `PublicUser`: the Clerk identifier is an
 * authentication-provider handle and only the account's own owner has any use
 * for it, so it is not broadcast to everyone who holds a room code.
 */
export interface RoomUser {
  id: string;
  username: string;
}

export interface RoomMemberDTO {
  user: RoomUser;
  joinedAt: string;
}

export interface RoomDTO {
  id: string;
  roomCode: string;
  host: RoomUser;
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
   * Set when a membership row was actually removed. The socket layer uses it
   * to drop that user's connections out of the room's broadcast channel.
   */
  leftUserId?: string;
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