import { Navigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { useCurrentUser } from "../hooks/useCurrentUser";

export function RootGuard() {
  const { isLoaded } = useAuth();
  const state = useCurrentUser();

  if (!isLoaded || state.status === "loading") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <p className="text-zinc-400">Checking authentication...</p>
      </div>
    );
  }

  if (state.status === "unauthenticated") {
    return <Navigate to="/signin" replace />;
  }

  if (state.status === "needs-onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to="/home" replace />;
}