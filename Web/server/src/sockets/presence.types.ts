import type { PlaybackSnapshot } from "../modules/playback/playback.types.js";
import type { ChatMessageDTO } from "../modules/messages/messages.types.js";
import type { QueueSnapshot } from "./queue.types.js";

export interface PresenceMember {
  userId: string;
  username: string;
  online: boolean;
}

export interface PresenceSnapshot {
  members: PresenceMember[];
  /**
   * Authoritative host at the moment of the broadcast. Rides on presence so
   * every existing presence emit (join ack, connect, disconnect) keeps clients
   * in sync with `Room.hostUserId` without a second event.
   */
  hostUserId: string;
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
  /** Current queue snapshot. */
  queue: QueueSnapshot;
}

export interface RoomJoinErrorAck {
  ok: false;
  message: string;
}

export type RoomJoinResponse = RoomJoinAck | RoomJoinErrorAck;