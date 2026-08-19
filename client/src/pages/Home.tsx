import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, UserButton } from "@clerk/react";
import { createRoom, joinRoom } from "../services/api";

export function Home() {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [roomCode, setRoomCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateRoom() {
    setError(null);
    setCreating(true);
    try {
      const { room } = await createRoom(getToken);
      navigate(`/room/${room.roomCode}`, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create room";
      setError(message);
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = roomCode.trim().toUpperCase();
    if (trimmed.length === 0) {
      setError("Enter a room code");
      return;
    }

    setJoining(true);
    try {
      const { room } = await joinRoom(getToken, trimmed);
      navigate(`/room/${room.roomCode}`, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to join room";
      setError(message);
    } finally {
      setJoining(false);
    }
  }

  const busy = creating || joining;

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

      <main className="flex flex-col items-center justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="mb-2 text-3xl font-bold tracking-tight">
              Listen together.
            </h1>
            <p className="text-zinc-400">
              Create a room or join one with a code.
            </p>
          </div>

          <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
            <button
              onClick={handleCreateRoom}
              disabled={busy}
              className="w-full rounded-lg bg-violet-500 px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "Creating..." : "Create Room"}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-sm text-zinc-500">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form
            onSubmit={handleJoinRoom}
            className="bg-zinc-950/50 border border-white/10 rounded-2xl p-6 backdrop-blur-xl space-y-4"
          >
            <div>
              <label
                htmlFor="roomCode"
                className="block mb-2 text-sm font-medium text-zinc-300"
              >
                Join a room
              </label>
              <input
                id="roomCode"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="AB72KD"
                autoComplete="off"
                maxLength={6}
                disabled={busy}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 font-mono tracking-widest text-center uppercase focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joining ? "Joining..." : "Join Room"}
            </button>
          </form>

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}
        </div>
      </main>
    </div>
  );
}