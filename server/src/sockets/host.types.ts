/** Why the room's host changed. Surfaced to clients for the notice copy. */
export type HostChangeReason = "manual" | "disconnect" | "left";

export interface HostTransferPayload {
  roomCode: string;
  /** Application user id of the member being promoted. */
  userId: string;
}

export interface HostUpdatePayload {
  hostUserId: string;
  hostUsername: string;
  previousHostUserId: string;
  previousHostUsername: string;
  reason: HostChangeReason;
}

/**
 * Broadcast when the host's last socket drops (`pending: true`, with the
 * deadline the transfer will fire at) and again if they reconnect inside the
 * grace window (`pending: false`).
 */
export interface HostPendingPayload {
  pending: boolean;
  hostUserId: string;
  hostUsername: string;
  /** Only present while pending. */
  successorUsername?: string;
  /** ISO timestamp the automatic transfer fires at. Only present while pending. */
  deadline?: string;
}

export interface HostTransferAck {
  ok: boolean;
  message?: string;
}
