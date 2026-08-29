import { createContext } from "react";
import type { MeResponse, PublicUser } from "../services/types";

export type CurrentUserState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "needs-onboarding" }
  | { status: "authenticated"; me: MeResponse }
  | { status: "error"; message: string };

export interface CurrentUserContextValue {
  state: CurrentUserState;
  /** Re-fetch `/me`. Used by the error screen's retry button. */
  refresh: () => void;
  /** Adopt a freshly created profile without a second round trip. */
  applyProfile: (user: PublicUser) => void;
}

export const CurrentUserContext =
  createContext<CurrentUserContextValue | null>(null);
