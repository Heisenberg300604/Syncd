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
}

export interface RoomJoinErrorAck {
  ok: false;
  message: string;
}

export type RoomJoinResponse = RoomJoinAck | RoomJoinErrorAck;