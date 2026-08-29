import { useCallback, useEffect, useRef, useState } from "react";
import { io as ioClient, type Socket } from "socket.io-client";
import { useAuth } from "@clerk/react";
import type {
  ChatMessage,
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
  messages?: ChatMessage[];
  message?: string;
}

interface PlaybackAck {
  ok: boolean;
  playback?: PlaybackSnapshot;
  message?: string;
}

interface ChatSendAck {
  ok: boolean;
  message?: string;
}

/**
 * Combines two message lists into one, deduped by id and sorted by server
 * timestamp. ISO 8601 strings sort correctly with a plain string compare, so
 * no date parsing is needed. Used both for the join-ack history (which can
 * overlap with messages already appended live) and for a single incoming
 * `chat:new`.
 */
function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return Array.from(byId.values()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

export interface RoomSocket {
  presence: PresenceMember[];
  connectionStatus: ConnectionStatus;
  playback: PlaybackSnapshot | null;
  playbackError: string | null;
  setTrack: (track: YouTubeSearchResult) => void;
  sendControl: (action: PlaybackAction, position: number) => void;
  clearTrack: () => void;
  messages: ChatMessage[];
  chatError: string | null;
  chatSending: boolean;
  sendChatMessage: (content: string) => void;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatSending, setChatSending] = useState(false);
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
      // Merge rather than replace: a reconnect's history snapshot can race
      // with a `chat:new` for a message already appended live.
      if (res.messages) setMessages((prev) => mergeMessages(prev, res.messages!));
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

      socket.on("chat:new", (incoming: ChatMessage) => {
        setMessages((prev) => mergeMessages(prev, [incoming]));
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

  const sendChatMessage = useCallback(
    (content: string) => {
      const socket = socketRef.current;
      if (!roomCode) return;
      if (!socket || !socket.connected) {
        setChatError("Not connected to the room yet");
        return;
      }

      setChatSending(true);
      socket.emit("chat:send", { roomCode, content }, (res: ChatSendAck) => {
        setChatSending(false);
        setChatError(res?.ok ? null : (res?.message ?? "Could not send message"));
      });
    },
    [roomCode],
  );

  return {
    presence,
    connectionStatus,
    playback,
    playbackError,
    setTrack,
    sendControl,
    clearTrack,
    messages,
    chatError,
    chatSending,
    sendChatMessage,
  };
}
