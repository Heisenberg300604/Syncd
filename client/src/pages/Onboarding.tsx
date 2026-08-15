import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import { createProfile } from "../services/api";

export function Onboarding() {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (trimmed.length > 20) {
      setError("Username must be at most 20 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }

    setSubmitting(true);
    try {
      await createProfile(getToken, trimmed);
      navigate("/home", { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-8 backdrop-blur-xl">
          <h1 className="mb-2 text-2xl font-bold text-white text-center">
            Choose your username
          </h1>
          <p className="mb-6 text-zinc-400 text-center">
            This is how others will find you on SyncD
          </p>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="username"
                className="block mb-2 text-sm font-medium text-zinc-300"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="john123"
                autoComplete="off"
                disabled={submitting}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-violet-500 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Creating..." : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}