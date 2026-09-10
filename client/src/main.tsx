import { ClerkProvider } from "@clerk/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { clientConfig } from "./config/env";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={clientConfig.clerkPublishableKey}
      afterSignOutUrl="/"
    >
      <App />
    </ClerkProvider>
  </StrictMode>,
);
