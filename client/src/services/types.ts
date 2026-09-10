export interface PublicUser {
  id: string;
  clerkUserId: string;
  username: string;
}

export interface MeResponse {
  authenticated: true;
  user: PublicUser | null;
  onboardingComplete: boolean;
}

export interface ProfileResponse {
  user: PublicUser;
}

export interface ApiError {
  message: string;
  authenticated?: boolean;
}

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
  roomDeleted: boolean;
}

export interface PresenceMember {
  userId: string;
  username: string;
  online: boolean;
}

export interface PresenceSnapshot {
  members: PresenceMember[];
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: string;
}

export interface YouTubeSearchResponse {
  results: YouTubeSearchResult[];
}

export interface YouTubeVideoResponse {
  result: YouTubeSearchResult;
}

/**
 * The room's shared playback state, broadcast over Socket.IO.
 *
 * `position` is the playhead in seconds as of `updatedAt`. Both timestamps come
 * from the server, so elapsed time must be computed as
 * `serverTime - updatedAt` — never against the local clock.
 */
export interface PlaybackSnapshot {
  videoId: string | null;
  title: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  isPlaying: boolean;
  position: number;
  updatedAt: string | null;
  serverTime: string;
}

export type PlaybackAction = "play" | "pause" | "seek";

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
}
