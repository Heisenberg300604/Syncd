import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { getMe } from "../services/api";
import type { MeResponse, PublicUser } from "../services/types";
import {
  CurrentUserContext,
  type CurrentUserState,
} from "./currentUserContext";

/** The outcome of one `/me` attempt. Never derived from a failed request. */
type FetchOutcome =
  | { status: "unauthenticated" }
  | { status: "needs-onboarding" }
  | { status: "authenticated"; me: MeResponse }
  | { status: "error"; message: string };

interface FetchRecord {
  /** Clerk user the outcome belongs to, so a re-login cannot show stale data. */
  forUserId: string;
  reloadKey: number;
  outcome: FetchOutcome;
}

const TOKEN_WAIT_ATTEMPTS = 5;
const TOKEN_WAIT_DELAY_MS = 150;
const UNAUTHORIZED_RETRY_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusOf(err: unknown): number | null {
  if (err instanceof Error && "status" in err) {
    const status = (err as Error & { status?: unknown }).status;
    return typeof status === "number" ? status : null;
  }
  return null;
}

/**
 * Fetches `/me` once per signed-in session and shares the result with every
 * route.
 *
 * Only a successful response with `onboardingComplete: false` means the user
 * needs onboarding. A failed request never does — mapping errors onto
 * "needs-onboarding" is what made sign-in bounce back to the username form.
 */
export function CurrentUserProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const [record, setRecord] = useState<FetchRecord | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Clerk re-creates `getToken` on every token refresh. Reading it from a ref
  // keeps that churn out of the effect deps so `/me` is fetched once.
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  });

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;

    let cancelled = false;
    const commit = (outcome: FetchOutcome) => {
      if (cancelled) return;
      setRecord({ forUserId: userId, reloadKey, outcome });
    };

    (async () => {
      // Right after the Clerk redirect the session token can lag behind
      // `isSignedIn`. Sending the request without it yields a 401 that has
      // nothing to do with onboarding, so wait for the token first.
      let token: string | null = null;
      for (let attempt = 0; attempt < TOKEN_WAIT_ATTEMPTS; attempt++) {
        token = await getTokenRef.current();
        if (cancelled) return;
        if (token) break;
        await delay(TOKEN_WAIT_DELAY_MS);
        if (cancelled) return;
      }

      if (!token) {
        commit({ status: "unauthenticated" });
        return;
      }

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const me = await getMe(getTokenRef.current);
          commit(
            me.onboardingComplete && me.user
              ? { status: "authenticated", me }
              : { status: "needs-onboarding" },
          );
          return;
        } catch (err) {
          if (cancelled) return;

          // A single 401 is usually a stale token; give Clerk one chance to
          // mint a fresh one before treating the session as gone.
          if (statusOf(err) === 401 && attempt === 0) {
            await delay(UNAUTHORIZED_RETRY_DELAY_MS);
            if (cancelled) return;
            continue;
          }

          if (statusOf(err) === 401) {
            commit({ status: "unauthenticated" });
            return;
          }

          commit({
            status: "error",
            message:
              err instanceof Error
                ? err.message
                : "Could not reach SyncD. Check your connection.",
          });
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, reloadKey]);

  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const applyProfile = useCallback(
    (user: PublicUser) => {
      if (!userId) return;
      setRecord({
        forUserId: userId,
        reloadKey,
        outcome: {
          status: "authenticated",
          me: { authenticated: true, user, onboardingComplete: true },
        },
      });
    },
    [userId, reloadKey],
  );

  let state: CurrentUserState;
  if (!isLoaded) {
    state = { status: "loading" };
  } else if (!isSignedIn || !userId) {
    state = { status: "unauthenticated" };
  } else if (
    !record ||
    record.forUserId !== userId ||
    record.reloadKey !== reloadKey
  ) {
    state = { status: "loading" };
  } else {
    state = record.outcome;
  }

  return (
    <CurrentUserContext.Provider value={{ state, refresh, applyProfile }}>
      {children}
    </CurrentUserContext.Provider>
  );
}
