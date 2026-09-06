import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, UserButton } from "@clerk/react";
import { createRoom, joinRoom } from "../services/api";
import { AppHeader } from "../components/ui/AppHeader";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

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
      setError(err instanceof Error ? err.message : "Failed to create room");
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
      setError(err instanceof Error ? err.message : "Failed to join room");
    } finally {
      setJoining(false);
    }
  }

  const busy = creating || joining;

  return (
    <div className="min-h-screen bg-canvas text-ink antialiased">
      <AppHeader actions={<UserButton />} />

      <main className="relative flex flex-col items-center px-5 py-16 sm:py-24">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_50%_100%_at_50%_0%,var(--color-accent-lo),transparent_70%)]"
          aria-hidden="true"
        />

        <div className="relative w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Listen together.</h1>
            <p className="mt-2 text-ink-muted">
              Start a new room or join one with a code.
            </p>
          </div>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-ink">Create a room</h2>
            <p className="mt-1 text-sm text-ink-muted">
              You'll be the host. Share the code to invite others.
            </p>
            <Button
              onClick={handleCreateRoom}
              disabled={busy}
              size="lg"
              glow
              className="mt-4 w-full"
            >
              {creating ? "Creating…" : "Create room"}
            </Button>
          </Card>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs uppercase tracking-wider text-ink-faint">
              or
            </span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <Card className="p-6">
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <label
                  htmlFor="roomCode"
                  className="mb-2 block text-sm font-semibold text-ink"
                >
                  Join a room
                </label>
                <Input
                  id="roomCode"
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="AB72KD"
                  autoComplete="off"
                  maxLength={6}
                  disabled={busy}
                  className="text-center font-mono text-lg uppercase tracking-[0.35em]"
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                variant="secondary"
                size="lg"
                className="w-full"
              >
                {joining ? "Joining…" : "Join room"}
              </Button>
            </form>
          </Card>

          {error && (
            <p className="text-center text-sm text-danger">{error}</p>
          )}
        </div>
      </main>
    </div>
  );
}
