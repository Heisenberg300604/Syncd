import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { getMe } from "../services/api";
import type { MeResponse } from "../services/types";

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "needs-onboarding" }
  | { status: "authenticated"; me: MeResponse };

export function useCurrentUser():
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "needs-onboarding" }
  | { status: "authenticated"; me: MeResponse } {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [fetch, setFetch] = useState<FetchState>({ status: "idle" });

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;

    (async () => {
      setFetch({ status: "loading" });
      try {
        const me = await getMe(getToken);
        if (cancelled) return;
        setFetch(
          me.onboardingComplete && me.user
            ? { status: "authenticated", me }
            : { status: "needs-onboarding" },
        );
      } catch {
        if (!cancelled) setFetch({ status: "needs-onboarding" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  if (!isLoaded) return { status: "loading" };
  if (!isSignedIn) return { status: "unauthenticated" };
  if (fetch.status === "idle" || fetch.status === "loading") {
    return { status: "loading" };
  }
  return fetch;
}