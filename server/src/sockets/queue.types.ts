/** A single track sitting in the room queue. */
export interface QueueItem {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  /** ISO 8601 duration string, e.g. "PT3M45S". */
  duration: string;
}

/** The full queue as broadcast to all room members. */
export type QueueSnapshot = QueueItem[];

// ---------------------------------------------------------------------------
// Client → Server payloads
// ---------------------------------------------------------------------------

export interface QueueAddPayload {
  roomCode: string;
  track: QueueItem;
}

export interface QueueRemovePayload {
  roomCode: string;
  index: number;
}

export interface QueueReorderPayload {
  roomCode: string;
  fromIndex: number;
  toIndex: number;
}

export interface QueueAdvancePayload {
  roomCode: string;
}

export interface QueueClearPayload {
  roomCode: string;
}

// ---------------------------------------------------------------------------
// Ack shapes
// ---------------------------------------------------------------------------

export type QueueAck =
  | { ok: true; queue: QueueSnapshot }
  | { ok: false; message: string };
