import { Navigate } from "react-router-dom";
import { useCurrentUserContext } from "../hooks/useCurrentUser";
import { AuthErrorScreen, AuthLoadingScreen } from "./AuthStatusScreen";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { state, refresh } = useCurrentUserContext();

  if (state.status === "loading") {
    return <AuthLoadingScreen />;
  }

  if (state.status === "error") {
    return <AuthErrorScreen message={state.message} onRetry={refresh} />;
  }

  if (state.status === "unauthenticated") {
    return <Navigate to="/signin" replace />;
  }

  if (state.status === "needs-onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state, refresh } = useCurrentUserContext();

  if (state.status === "loading") {
    return <AuthLoadingScreen />;
  }

  if (state.status === "error") {
    return <AuthErrorScreen message={state.message} onRetry={refresh} />;
  }

  if (state.status === "unauthenticated") {
    return <Navigate to="/signin" replace />;
  }

  if (state.status === "authenticated") {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}
