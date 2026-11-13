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
  /**
   * Optional idempotency guard.  When provided the advance is a no-op if the
   * current front of the queue does not match, preventing duplicate advances
   * from double-clicks or concurrent requests.  Clients should always send it;
   * omitting it preserves backward compatibility with older clients.
   */
  expectedFrontVideoId?: string;
}

export interface QueueClearPayload {
  roomCode: string;
}

// ---------------------------------------------------------------------------
// Store result types
// ---------------------------------------------------------------------------

/** Discriminated union returned by enqueue / prepend to surface capacity errors. */
export type EnqueueResult =
  | { ok: true; queue: QueueItem[] }
  | { ok: false; code: "QUEUE_FULL"; queue: QueueItem[] };

// ---------------------------------------------------------------------------
// Ack shapes
// ---------------------------------------------------------------------------

export type QueueAck =
  | { ok: true; queue: QueueSnapshot }
  | { ok: false; message: string; code?: "QUEUE_FULL" };
