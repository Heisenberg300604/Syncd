import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SignIn, SignUp } from "@clerk/react";
import { Analytics } from "@vercel/analytics/react";
import { Landing } from "./pages/Landing";
import { RootGuard } from "./pages/RootGuard";
import { Onboarding } from "./pages/Onboarding";
import { Home } from "./pages/Home";
import { Room } from "./pages/Room";
import { ProtectedRoute, RequireAuth } from "./components/ProtectedRoute";

const clerkAppearance = {
  elements: {
    formButtonPrimary: "bg-violet-500 hover:bg-violet-600 text-white",
    card: "bg-zinc-950 border-zinc-800",
    headerTitle: "text-white",
    headerSubtitle: "text-zinc-400",
    socialButtonsBlockButton: "bg-zinc-900 border-zinc-700 hover:bg-zinc-800",
  },
};

function App() {
  return (
    <BrowserRouter>
      <Analytics />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/enter" element={<RootGuard />} />

        <Route
          path="/signin"
          element={
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
              <SignIn
                appearance={clerkAppearance}
                fallbackRedirectUrl="/enter"
                forceRedirectUrl="/enter"
              />
            </div>
          }
        />
        <Route
          path="/signup"
          element={
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
              <SignUp
                appearance={clerkAppearance}
                fallbackRedirectUrl="/enter"
                forceRedirectUrl="/enter"
              />
            </div>
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
    </BrowserRouter>
  );
}

export default App;
