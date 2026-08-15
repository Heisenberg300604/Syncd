import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SignIn, SignUp, Show, UserButton } from "@clerk/react";
import { Landing } from "./pages/Landing";
import { RootGuard } from "./pages/RootGuard";
import { Onboarding } from "./pages/Onboarding";
import { Home } from "./pages/Home";
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
          path="/room/*"
          element={
            <Show when="signed-in" fallback={<Navigate to="/signin" replace />}>
              <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
                <div className="bg-zinc-950/50 border border-white/10 rounded-2xl p-8 backdrop-blur-xl text-center">
                  <h1 className="mb-2 text-2xl font-bold text-white">Room</h1>
                  <p className="text-zinc-400">Room interface coming soon...</p>
                  <div className="mt-6 flex justify-center">
                    <UserButton />
                  </div>
                </div>
              </div>
            </Show>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;