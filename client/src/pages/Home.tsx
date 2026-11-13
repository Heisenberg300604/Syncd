import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, UserButton } from "@clerk/react";
import { createRoom, joinRoom } from "../services/api";
import { AppHeader } from "../components/ui/AppHeader";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { ReactiveDashedPill } from "../components/ui/ReactiveDashedPill";
import Topography from "../components/Topography/Topography";

export function Home() {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [roomCode, setRoomCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-warm the Clerk token so it's already cached when the user clicks
  // "Create room" — removes the cold getToken() round-trip from perceived latency.
  useEffect(() => {
    void getToken();
  }, [getToken]);

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
    <div className="relative min-h-screen bg-canvas text-ink antialiased overflow-hidden">
      {/* Topography dynamic contour background */}
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <Topography
          lowColor="#f97316"
          midColor="#f7a23b"
          highColor="#fbbf24"
          speed={0.35}
          morphAmount={3.0}
          morphSpeed={0.05}
          bands={2.5}
          thickness={0.012}
          scale={1.0}
          glow={0.65}
          colorMode="elevation"
          contrast={2.8}
          brightness={0.8}
          opacity={0.7}
          grain={true}
          grainIntensity={0.04}
          mouseInteraction={true}
          mouseRadius={0.35}
          mouseStrength={0.45}
          className="h-full w-full"
        />
        {/* Soft edge fades and atmosphere to preserve card and text contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-canvas/50 via-transparent to-canvas/80" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_50%,rgba(10,9,8,0.65)_0%,transparent_100%)]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <AppHeader actions={<UserButton />} />

        <main className="relative flex flex-1 flex-col items-center px-5 py-16 sm:py-24">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_50%_100%_at_50%_0%,var(--color-accent-lo),transparent_70%)]"
            aria-hidden="true"
          />

          <div className="relative w-full max-w-[520px] space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight">Listen together.</h1>
              <p className="mt-2 text-ink-muted">
                Start a new room or join one with a code.
              </p>
            </div>

            {/* Top row: Create room and Join room cards side by side with vertical "or" divider */}
            <div className="flex flex-col sm:flex-row items-center sm:items-stretch justify-center gap-4 sm:gap-5">
              {/* Create room card */}
              <div className="glass-card flex flex-col justify-between p-6">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-white/10 text-accent border border-white/20 shadow-inner">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint border border-white/15 px-2.5 py-0.5 rounded-full bg-white/5">
                      Host
                    </span>
                  </div>
                  <h2 className="mt-5 text-lg font-bold text-ink">Create a room</h2>
                  <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">
                    You'll be the host. Share the code with friends to listen together in sync.
                  </p>
                </div>

                <Button
                  onClick={handleCreateRoom}
                  disabled={busy}
                  size="lg"
                  glow
                  className="w-full"
                >
                  {creating ? "Creating…" : "Create room"}
                </Button>
              </div>

              {/* Vertical "OR" divider (desktop) */}
              <div className="hidden sm:flex flex-col items-center justify-center self-stretch py-4">
                <div className="w-px flex-1 bg-gradient-to-b from-transparent via-white/20 to-white/10" />
                <span className="my-3 text-[11px] font-mono uppercase tracking-widest text-ink-faint">
                  or
                </span>
                <div className="w-px flex-1 bg-gradient-to-b from-white/10 via-white/20 to-transparent" />
              </div>

              {/* Horizontal "OR" divider (mobile) */}
              <div className="flex sm:hidden w-[240px] items-center gap-3 my-1">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-white/15" />
                <span className="text-[11px] font-mono uppercase tracking-widest text-ink-faint">
                  or
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/15 to-white/15" />
              </div>

              {/* Join room card */}
              <div className="glass-card flex flex-col justify-between p-6">
                <form onSubmit={handleJoinRoom} className="flex h-full flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-white/10 text-accent border border-white/20 shadow-inner">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                          />
                        </svg>
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint border border-white/15 px-2.5 py-0.5 rounded-full bg-white/5">
                        Code
                      </span>
                    </div>
                    <label
                      htmlFor="roomCode"
                      className="mt-5 block text-lg font-bold text-ink"
                    >
                      Join a room
                    </label>
                    <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">
                      Enter a 6-character room code to jump straight in.
                    </p>
                    <div className="mt-3">
                      <Input
                        id="roomCode"
                        type="text"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value)}
                        placeholder="AB72KD"
                        autoComplete="off"
                        maxLength={6}
                        disabled={busy}
                        className="text-center font-mono text-base uppercase tracking-[0.3em] bg-white/10 border-white/20 text-ink placeholder:text-ink-faint/60 focus:bg-white/15"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={busy}
                    variant="secondary"
                    size="lg"
                    className="w-full mt-4"
                  >
                    {joining ? "Joining…" : "Join room"}
                  </Button>
                </form>
              </div>
            </div>

            {/* Public rooms card */}
            <div className="flex justify-center">
              <div className="glass-card glass-card-banner flex flex-col justify-between p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-white/10 text-accent border border-white/20 shadow-inner shrink-0">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-ink">Public rooms</h2>
                    <p className="text-xs text-ink-muted leading-tight">
                      Discover and tune into open community listening sessions.
                    </p>
                  </div>
                </div>

                <ReactiveDashedPill />
              </div>
            </div>

            {error && (
              <p className="text-center text-sm text-danger">{error}</p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
