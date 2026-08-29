import { useContext } from "react";
import {
  CurrentUserContext,
  type CurrentUserContextValue,
  type CurrentUserState,
} from "../providers/currentUserContext";

export type { CurrentUserState };

export function useCurrentUserContext(): CurrentUserContextValue {
  const value = useContext(CurrentUserContext);
  if (!value) {
    throw new Error("useCurrentUser must be used inside <CurrentUserProvider>");
  }
  return value;
}

export function useCurrentUser(): CurrentUserState {
  return useCurrentUserContext().state;
}
