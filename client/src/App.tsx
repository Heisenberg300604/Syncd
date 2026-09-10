import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SignIn, SignUp } from "@clerk/react";
import { Analytics } from "@vercel/analytics/react";
import { Landing } from "./pages/Landing";
import { RootGuard } from "./pages/RootGuard";
import { Onboarding } from "./pages/Onboarding";
import { Home } from "./pages/Home";
import { Room } from "./pages/Room";
import { ProtectedRoute, RequireAuth } from "./components/ProtectedRoute";
import { CurrentUserProvider } from "./providers/CurrentUserProvider";
import { AuthShell } from "./components/ui/AuthShell";

const clerkAppearance = {
  variables: {
    colorPrimary: "#f7a23b",
    colorText: "#f5f3f0",
    colorTextSecondary: "#b0a79c",
    colorBackground: "#181512",
    colorInputBackground: "#201b16",
    colorInputText: "#f5f3f0",
    colorDanger: "#f87171",
    colorSuccess: "#34d399",
    borderRadius: "12px",
    fontFamily: '"Manrope", ui-sans-serif, system-ui, sans-serif',
  },
};

function App() {
  return (
    <BrowserRouter>
      <Analytics />
      <CurrentUserProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/enter" element={<RootGuard />} />

          <Route
            path="/signin"
            element={
              <AuthShell wide>
                <div className="syncd-clerk">
                  <SignIn
                    appearance={clerkAppearance}
                    fallbackRedirectUrl="/enter"
                    forceRedirectUrl="/enter"
                    signUpUrl="/signup"
                  />
                </div>
              </AuthShell>
            }
          />
          <Route
            path="/signup"
            element={
              <AuthShell wide>
                <div className="syncd-clerk">
                  <SignUp
                    appearance={clerkAppearance}
                    fallbackRedirectUrl="/enter"
                    forceRedirectUrl="/enter"
                    signInUrl="/signin"
                  />
                </div>
              </AuthShell>
            }
          />

          <Route
            path="/onboarding"
            element={
              <RequireAuth>
                <Onboarding />
              </RequireAuth>
            }
          />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />

          <Route
            path="/room/:roomCode"
            element={
              <ProtectedRoute>
                <Room />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CurrentUserProvider>
    </BrowserRouter>
  );
}

export default App;
