import type { PlaybackSnapshot } from "../modules/playback/playback.types.js";
import type { ChatMessageDTO } from "../modules/messages/messages.types.js";

export interface PresenceMember {
  userId: string;
  username: string;
  online: boolean;
}

export interface PresenceSnapshot {
  members: PresenceMember[];
}

export interface RoomJoinPayload {
  roomCode: string;
}

export interface RoomJoinAck {
  ok: true;
  presence: PresenceSnapshot;
  /** Absent only when the room has no playback row (should not happen). */
  playback?: PlaybackSnapshot;
  /** Most recent messages, oldest first. Sent on every join, including reconnects. */
  messages: ChatMessageDTO[];
}

export interface RoomJoinErrorAck {
  ok: false;
  message: string;
}

export type RoomJoinResponse = RoomJoinAck | RoomJoinErrorAck;