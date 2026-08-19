import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth, UserButton } from "@clerk/react";
import { getRoom, leaveRoom } from "../services/api";
import type { RoomDTO } from "../services/types";

export function Room() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState<RoomDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <p className="text-zinc-400">Loading room...</p>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white antialiased">
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <svg
              className="h-6 w-6 text-violet-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <span>SyncD</span>
          </div>
          <UserButton />
        </header>
        <main className="flex flex-col items-center justify-center px-4 py-16">
          <div className="w-full max-w-md text-center space-y-4">
            <p className="text-red-400">
              {error ?? "Room not found"}
            </p>
            <button
              onClick={() => navigate("/home", { replace: true })}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Back to Home
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white antialiased">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <svg
            className="h-6 w-6 text-violet-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span>SyncD</span>
        </div>
        <UserButton />
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12 space-y-6">
        <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-zinc-400 mb-1">Room</p>
              <p className="text-2xl font-bold font-mono tracking-widest text-violet-400">
                {room.roomCode}
              </p>
            </div>
            <button
              onClick={handleLeave}
              disabled={leaving}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              {leaving ? "Leaving..." : "Leave Room"}
            </button>
          </div>
        </div>

        <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
            Host
          </h2>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-violet-500 flex items-center justify-center text-white font-medium text-sm">
              {room.host.username.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium">{room.host.username}</span>
          </div>
        </div>

        <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
            Members <span className="text-violet-400 font-mono ml-2">{room.members.length}</span>
          </h2>
          <ul className="space-y-3">
            {room.members.map((member) => {
              const isHost = member.user.id === room.host.id;
              return (
                <li key={member.user.id} className="flex items-center gap-3">
                  <div className="relative h-10 w-10 flex-shrink-0">
                    <div className="h-full w-full rounded-full bg-zinc-700 flex items-center justify-center text-white font-medium text-sm">
                      {member.user.username.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-emerald-500 border-2 border-zinc-950"
                      aria-label={`${member.user.username} is in room`}
                    />
                  </div>
                  <span className="font-medium flex-1">{member.user.username}</span>
                  {isHost && (
                    <span className="text-xs font-medium text-violet-400 bg-violet-500/10 rounded-full px-2.5 py-1">
                      Host
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {error && (
          <p className="text-sm text-red-400 text-center">{error}</p>
        )}
      </main>
    </div>
  );
}