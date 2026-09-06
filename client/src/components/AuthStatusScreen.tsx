import { AuthShell } from "./ui/AuthShell";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

interface AuthErrorScreenProps {
  message: string;
  onRetry: () => void;
}

export function AuthLoadingScreen() {
  return (
    <AuthShell>
      <Card className="flex items-center justify-center gap-3 p-8">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        <p className="text-sm text-ink-muted">Checking your session…</p>
      </Card>
    </AuthShell>
  );
}

export function AuthErrorScreen({ message, onRetry }: AuthErrorScreenProps) {
  return (
    <AuthShell title="Could not load your profile">
      <Card className="space-y-4 p-8 text-center">
        <p className="text-sm text-danger">{message}</p>
        <p className="text-sm text-ink-faint">
          You are still signed in — this is a connection problem, not a missing
          account.
        </p>
        <Button onClick={onRetry} className="w-full">
          Try again
        </Button>
      </Card>
    </AuthShell>
  );
}
