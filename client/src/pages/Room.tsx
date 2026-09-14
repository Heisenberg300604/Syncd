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
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Avatar } from "../components/ui/Avatar";
import type { RoomDTO } from "../services/types";

export function Room() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();

  const [room, setRoom] = useState<RoomDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);

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
  } = useRoomSocket(
    room ? room.roomCode : null,
    room ? room.members : [],
    currentUser.status === "authenticated" ? currentUser.me.user ?? undefined : undefined,
  );

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
    // Navigate immediately — the server leave runs in the background.
    // The user should never have to wait for a DB round-trip to exit a room.
    navigate("/home", { replace: true });
    leaveRoom(getToken, roomCode.toUpperCase()).catch((err) => {
      // The user is already on /home so we can't surface the error in this UI.
      // Log it so it's not silently swallowed in development.
      console.error("leaveRoom failed:", err);
    });
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
            >
              Leave
            </Button>
            <UserButton />
          </div>
        }
      />

      <main className="w-full px-4 py-6 sm:px-6 sm:py-8">
        {/* Main grid: player left, sidebar right */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
          <div className="min-w-0 space-y-5 lg:col-span-2">
            <YouTubePlayer
              playback={playback}
              onControl={canControlPlayback ? sendControl : null}
              onClear={clearTrack}
              syncError={playbackError}
            />
          </div>

          <div className="min-w-0 space-y-5">
            {/* Top pill row: connection badge | avatar cluster | code pill */}
            <div className="relative flex items-center justify-between gap-2">
              <ConnectionBadge status={connectionStatus} />

              {/* Avatar cluster — click to open people dropdown */}
              <button
                onClick={() => setPeopleOpen((o) => !o)}
                className="flex items-center transition-opacity hover:opacity-80"
                aria-label={`${presence.length} people in room — click to view`}
              >
                <div className="flex -space-x-2.5">
                  {presence.slice(0, 5).map((member) => {
                    const memberIsHost = member.userId === room.host.id;
                    return (
                      <div
                        key={member.userId}
                        className={`rounded-full ring-2 ring-canvas ${
                          memberIsHost
                            ? "shadow-[0_0_0_2px_theme(colors.amber.400),0_0_10px_4px_theme(colors.amber.400/35%)]"
                            : ""
                        }`}
                      >
                        <Avatar name={member.username} size={30} online={member.online} />
                      </div>
                    );
                  })}
                  {presence.length > 5 && (
                    <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-ink ring-2 ring-canvas">
                      +{presence.length - 5}
                    </div>
                  )}
                </div>
              </button>

              {/* Code pill */}
              <div className="flex items-center gap-2 rounded-full border border-line bg-white/3 px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                  Code
                </span>
                <span className="font-mono text-sm font-semibold tracking-[0.2em] text-accent">
                  {room.roomCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium text-ink-muted transition-colors hover:bg-white/10 hover:text-ink"
                  aria-label="Copy room code"
                >
                  {copied ? "✓" : "Copy"}
                </button>
              </div>

              {/* People dropdown */}
              {peopleOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setPeopleOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-line bg-surface p-3 shadow-2xl backdrop-blur-sm">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                      People · {presence.length}
                    </p>
                    <ul className="space-y-0.5">
                      {presence.map((member) => {
                        const memberIsHost = member.userId === room.host.id;
                        return (
                          <li
                            key={member.userId}
                            className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-white/5"
                          >
                            <div
                              className={`rounded-full ${
                                memberIsHost
                                  ? "shadow-[0_0_0_2px_theme(colors.amber.400),0_0_8px_3px_theme(colors.amber.400/35%)]"
                                  : ""
                              }`}
                            >
                              <Avatar name={member.username} size={28} online={member.online} />
                            </div>
                            <span className="flex-1 truncate text-sm font-medium">
                              {member.username}
                            </span>
                            {memberIsHost && (
                              <span className="rounded-full bg-accent-lo px-1.5 py-0.5 text-[9px] font-semibold text-accent">
                                HOST
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </>
              )}
            </div>

            <ChatPanel
              messages={messages}
              currentUserId={myUserId}
              connectionStatus={connectionStatus}
              memberCount={presence.length}
              sending={chatSending}
              error={chatError}
              onSend={sendChatMessage}
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
        </div>

        {error && <p className="mt-5 text-center text-sm text-danger">{error}</p>}
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
