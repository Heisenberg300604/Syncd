import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth, UserButton } from "@clerk/react";
import { getRoom, leaveRoom } from "../services/api";
import { useRoomSocket, type ConnectionStatus } from "../hooks/useRoomSocket";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { MusicSearch } from "../components/MusicSearch";
import { YouTubePlayer } from "../components/YouTubePlayer";
import { ChatPanel } from "../components/ChatPanel";
import { AppHeader } from "../components/ui/AppHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Avatar } from "../components/ui/Avatar";
import type { RoomDTO } from "../services/types";

const panelLabel = "text-xs font-semibold uppercase tracking-wider text-ink-faint";

export function Room() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();

  const [room, setRoom] = useState<RoomDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!roomCode) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { room: data } = await getRoom(getToken, roomCode.toUpperCase());
        if (!cancelled) setRoom(data);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load room";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomCode, getToken]);

  const {
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
  } = useRoomSocket(room ? room.roomCode : null, room ? room.members : []);

  const socketReady = connectionStatus === "connected";

  // Room mounts inside ProtectedRoute, so by the time it renders the guard has
  // already confirmed the viewer is authenticated and onboarded — this is
  // only for UX (hiding controls); the server enforces the real boundary.
  const myUserId =
    currentUser.status === "authenticated" ? currentUser.me.user?.id : undefined;
  const isHost = Boolean(room && myUserId && room.host.id === myUserId);
  const canControlPlayback = socketReady && isHost;

  async function handleCopyCode() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access denied or unavailable — not worth surfacing an error for.
    }
  }

  async function handleLeave() {
    if (!roomCode) return;
    setLeaving(true);
    setError(null);
    try {
      await leaveRoom(getToken, roomCode.toUpperCase());
      navigate("/home", { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to leave room";
      setError(message);
    } finally {
      setLeaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas text-ink antialiased">
        <AppHeader actions={<UserButton />} />
        <div className="flex items-center justify-center gap-3 px-4 py-32">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <p className="text-sm text-ink-muted">Loading room…</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-canvas text-ink antialiased">
        <AppHeader actions={<UserButton />} />
        <main className="flex flex-col items-center px-5 py-24">
          <Card className="w-full max-w-md space-y-4 p-8 text-center">
            <p className="text-danger">{error ?? "Room not found"}</p>
            <Button
              variant="secondary"
              onClick={() => navigate("/home", { replace: true })}
              className="w-full"
            >
              Back to home
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink antialiased">
      <AppHeader
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleLeave}
              disabled={leaving}
            >
              {leaving ? "Leaving…" : "Leave"}
            </Button>
            <UserButton />
          </div>
        }
      />

      <main className="mx-auto max-w-6xl space-y-5 px-5 py-6 sm:px-8 sm:py-8">
        {/* Room code — the thing you share */}
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className={panelLabel}>Room code</p>
            <div className="mt-1 flex items-center gap-3">
              <span className="font-mono text-2xl font-medium tracking-[0.3em] text-accent">
                {room.roomCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
                aria-label="Copy room code"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
          <ConnectionBadge status={connectionStatus} />
        </Card>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
          <div className="min-w-0 space-y-5 lg:col-span-2">
            <YouTubePlayer
              playback={playback}
              onControl={canControlPlayback ? sendControl : null}
              onClear={clearTrack}
              syncError={playbackError}
            />

            <MusicSearch
              onSelect={setTrack}
              disabled={!canControlPlayback}
              disabledMessage={
                !socketReady
                  ? "Connecting to the room — playback controls will be available in a moment."
                  : "Only the host can add music to this room."
              }
            />
          </div>

          <div className="min-w-0 space-y-5">
            <Card className="p-5">
              <h2 className={panelLabel}>
                People{" "}
                <span className="ml-1 font-mono text-accent">
                  {presence.length}
                </span>
              </h2>
              <ul className="mt-4 space-y-1">
                {presence.map((member) => {
                  const memberIsHost = member.userId === room.host.id;
                  return (
                    <li
                      key={member.userId}
                      className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-white/5"
                    >
                      <Avatar
                        name={member.username}
                        size={36}
                        online={member.online}
                      />
                      <span className="flex-1 truncate text-sm font-medium">
                        {member.username}
                      </span>
                      {memberIsHost && (
                        <span className="rounded-full bg-accent-lo px-2 py-0.5 text-[10px] font-semibold text-accent">
                          HOST
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>

            <ChatPanel
              messages={messages}
              currentUserId={myUserId}
              connectionStatus={connectionStatus}
              memberCount={presence.length}
              sending={chatSending}
              error={chatError}
              onSend={sendChatMessage}
            />
          </div>
        </div>

        {error && <p className="text-center text-sm text-danger">{error}</p>}
      </main>
    </div>
  );
}

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const styles: Record<
    ConnectionStatus,
    { color: string; label: string }
  > = {
    connecting: { color: "bg-warning", label: "Connecting…" },
    connected: { color: "bg-online", label: "Live · in sync" },
    reconnecting: { color: "bg-warning", label: "Reconnecting…" },
    disconnected: { color: "bg-danger", label: "Disconnected" },
  };
  const { color, label } = styles[status];
  return (
    <span className="flex items-center gap-2 rounded-full border border-line bg-white/3 px-3 py-1.5 text-xs text-ink-muted">
      <span
        className={`h-1.5 w-1.5 rounded-full ${color} ${
          status === "connected" ? "animate-pulse" : ""
        }`}
      />
      {label}
    </span>
  );
}
