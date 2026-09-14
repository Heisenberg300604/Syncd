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

/**
 * A person as the room API exposes them. Narrower than `PublicUser`: the server
 * does not hand out other people's Clerk identifiers.
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
  roomDeleted: boolean;
}

export interface PresenceMember {
  userId: string;
  username: string;
  online: boolean;
}

export interface PresenceSnapshot {
  members: PresenceMember[];
  /** Authoritative host at the time of the broadcast. */
  hostUserId: string;
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

/** A single item in the room's shared playback queue. */
export interface QueueItem {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  /** ISO 8601 duration string, e.g. "PT3M45S". */
  duration: string;
}

/** The full ordered queue as broadcast over Socket.IO. */
export type QueueSnapshot = QueueItem[];

/** Why the room's host changed. */
export type HostChangeReason = "manual" | "disconnect" | "left";

export interface HostUpdatePayload {
  hostUserId: string;
  hostUsername: string;
  previousHostUserId: string;
  previousHostUsername: string;
  reason: HostChangeReason;
}

/**
 * Sent when the host's connection drops (`pending: true`, with the deadline
 * the automatic transfer fires at) and again if they return in time.
 */
export interface HostPendingPayload {
  pending: boolean;
  hostUserId: string;
  hostUsername: string;
  successorUsername?: string;
  deadline?: string;
}
