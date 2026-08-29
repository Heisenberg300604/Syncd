import { useCallback, useEffect, useRef, useState } from "react";
import { io as ioClient, type Socket } from "socket.io-client";
import { useAuth } from "@clerk/react";
import type {
  PlaybackAction,
  PlaybackSnapshot,
  PresenceSnapshot,
  PresenceMember,
  YouTubeSearchResult,
} from "../services/types";

const SOCKET_URL =
  import.meta.env["VITE_API_BASE_URL"]?.replace(/\/api$/, "") ||
  "http://localhost:5000";

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

interface RoomJoinAck {
  ok: boolean;
  presence?: PresenceSnapshot;
  playback?: PlaybackSnapshot;
  message?: string;
}

interface PlaybackAck {
  ok: boolean;
  playback?: PlaybackSnapshot;
  message?: string;
}

export interface RoomSocket {
  presence: PresenceMember[];
  connectionStatus: ConnectionStatus;
  playback: PlaybackSnapshot | null;
  playbackError: string | null;
  setTrack: (track: YouTubeSearchResult) => void;
  sendControl: (action: PlaybackAction, position: number) => void;
  clearTrack: () => void;
}

/**
 * Owns the room's Socket.IO connection: live presence plus the shared playback
 * state. Both ride the same socket so a room needs exactly one connection.
 */
export function useRoomSocket(
  roomCode: string | null,
  initialMembers: { user: { id: string; username: string } }[],
): RoomSocket {
  const { getToken } = useAuth();
  const [presence, setPresence] = useState<PresenceMember[]>(
    initialMembers.map((m) => ({
      userId: m.user.id,
      username: m.user.username,
      online: false,
    })),
  );
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [playback, setPlayback] = useState<PlaybackSnapshot | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Clerk re-creates `getToken` on every token refresh; keeping it in a ref
  // stops that from tearing down and rebuilding the socket.
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  });

  useEffect(() => {
    if (!roomCode) return;

    let cancelled = false;

    const applyJoinAck = (res: RoomJoinAck) => {
      if (cancelled) return;
      if (!res.ok) {
        setPlaybackError(res.message ?? "Could not join the room");
        return;
      }
      if (res.presence) setPresence(res.presence.members);
      if (res.playback) setPlayback(res.playback);
    };

    (async () => {
      const token = await getTokenRef.current();
      if (cancelled || !token) return;

      const socket = ioClient(SOCKET_URL, {
        auth: { token },
        transports: ["websocket"],
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        setConnectionStatus("connected");
        socket.emit("room:join", { roomCode }, applyJoinAck);
      });

      socket.on("disconnect", () => {
        setConnectionStatus("disconnected");
      });

      socket.on("connect_error", (err: Error) => {
        setPlaybackError(err.message);
      });

      socket.io.on("reconnect_attempt", () => {
        setConnectionStatus("reconnecting");
      });

      socket.io.on("reconnect", () => {
        setConnectionStatus("connected");
        socket.emit("room:join", { roomCode }, applyJoinAck);
      });

      socket.on("presence:update", (snapshot: PresenceSnapshot) => {
        setPresence(snapshot.members);
      });

      socket.on("playback:update", (snapshot: PlaybackSnapshot) => {
        setPlayback(snapshot);
        setPlaybackError(null);
      });
    })();

    return () => {
      cancelled = true;
      const socket = socketRef.current;
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [roomCode]);

  const emitPlayback = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        setPlaybackError("Not connected to the room yet");
        return;
      }
      socket.emit(event, payload, (res: PlaybackAck) => {
        if (res?.ok) {
          setPlaybackError(null);
          if (res.playback) setPlayback(res.playback);
        } else {
          setPlaybackError(res?.message ?? "Playback update failed");
        }
      });
    },
    [],
  );

  const setTrack = useCallback(
    (track: YouTubeSearchResult) => {
      if (!roomCode) return;
      emitPlayback("playback:set", { roomCode, track });
    },
    [emitPlayback, roomCode],
  );

  const sendControl = useCallback(
    (action: PlaybackAction, position: number) => {
      if (!roomCode) return;
      emitPlayback("playback:control", { roomCode, action, position });
    },
    [emitPlayback, roomCode],
  );

  const clearTrack = useCallback(() => {
    if (!roomCode) return;
    emitPlayback("playback:clear", { roomCode });
  }, [emitPlayback, roomCode]);

  return {
    presence,
    connectionStatus,
    playback,
    playbackError,
    setTrack,
    sendControl,
    clearTrack,
  };
}
