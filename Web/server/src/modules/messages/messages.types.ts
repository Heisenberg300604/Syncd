export interface ChatMessageDTO {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
}

export interface ChatSendPayload {
  roomCode: string;
  content: string;
}

export type ChatSendAck =
  | { ok: true }
  | { ok: false; message: string };
