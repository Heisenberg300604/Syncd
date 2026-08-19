import { useEffect, useRef, useState } from "react";
import { io as ioClient, type Socket } from "socket.io-client";
import { useAuth } from "@clerk/react";
import type { PresenceSnapshot, PresenceMember } from "../services/types";

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
  message?: string;
}

export function useRoomPresence(
  roomCode: string | null,
  initialMembers: { user: { id: string; username: string } }[],
): {
  presence: PresenceMember[];
  connectionStatus: ConnectionStatus;
} {
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
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!roomCode) return;

    let cancelled = false;

    (async () => {
      const token = await getToken();
      if (cancelled || !token) return;

      const socket = ioClient(SOCKET_URL, {
        auth: { token },
        transports: ["websocket"],
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        setConnectionStatus("connected");
        socket.emit("room:join", { roomCode }, (res: RoomJoinAck) => {
          if (res.ok && res.presence) {
            setPresence(res.presence.members);
          }
        });
      });

      socket.on("disconnect", () => {
        setConnectionStatus("disconnected");
      });

      socket.io.on("reconnect_attempt", () => {
        setConnectionStatus("reconnecting");
      });

      socket.io.on("reconnect", () => {
        setConnectionStatus("connected");
        socket.emit("room:join", { roomCode }, (res: RoomJoinAck) => {
          if (res.ok && res.presence) {
            setPresence(res.presence.members);
          }
        });
      });

      socket.on("presence:update", (snapshot: PresenceSnapshot) => {
        setPresence(snapshot.members);
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
  }, [roomCode, getToken]);

  return { presence, connectionStatus };
}