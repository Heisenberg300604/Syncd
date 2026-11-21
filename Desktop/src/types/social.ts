export interface UserProfile {
  id: string;
  clerkUserId: string;
  username: string;
}

export interface RoomMember {
  userId: string;
  username: string;
  online: boolean;
  joinedAt?: string;
}

export interface RoomDTO {
  id: string;
  roomCode: string;
  host: {
    id: string;
    username: string;
  };
  members: Array<{
    user: {
      id: string;
      username: string;
    };
    joinedAt: string;
  }>;
  currentVideoId: string | null;
  currentTitle: string | null;
  currentThumbnailUrl: string | null;
  currentDuration: number | null;
  isPlaying: boolean;
  playbackPosition: number;
  playbackUpdatedAt: string | null;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
}

export interface QueueItem {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  duration: number | string;
  addedBy?: string;
}

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

export interface PresenceSnapshot {
  members: RoomMember[];
  hostUserId: string;
}

export interface HostPendingPayload {
  deadline: string; // ISO 8601
  message: string;
}

export interface HostUpdatePayload {
  hostUserId: string;
  reason: 'manual' | 'disconnect' | 'left';
}

