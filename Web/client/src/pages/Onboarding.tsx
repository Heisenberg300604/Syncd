import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import { createProfile } from "../services/api";
import { useCurrentUserContext } from "../hooks/useCurrentUser";
import { AuthShell } from "../components/ui/AuthShell";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

export function Onboarding() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { applyProfile } = useCurrentUserContext();

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
      const { user } = await createProfile(getToken, trimmed);
      // Seed the shared cache before navigating, otherwise the guard on /home
      // still sees "needs-onboarding" and sends us straight back here.
      applyProfile(user);
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
    <AuthShell
      title="Choose your username"
      subtitle="This is how others will find you on SyncD"
    >
      <Card className="p-8">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm font-medium text-ink-muted"
            >
              Username
            </label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="john123"
              autoComplete="off"
              disabled={submitting}
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Creating…" : "Continue"}
          </Button>
        </form>
      </Card>
    </AuthShell>
  );
}
