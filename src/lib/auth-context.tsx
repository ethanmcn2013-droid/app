"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_USER, type UserId } from "@/lib/data";

const CurrentUserContext = createContext<UserId>(DEFAULT_USER);

export function CurrentUserProvider({
  user,
  children,
}: {
  user: UserId;
  children: ReactNode;
}) {
  return (
    <CurrentUserContext.Provider value={user}>
      {children}
    </CurrentUserContext.Provider>
  );
}

/**
 * Read-only accessor for the active user inside client components.
 * Server components import `getCurrentUser` from `@/server/auth`
 * directly instead.
 */
export function useCurrentUser(): UserId {
  return useContext(CurrentUserContext);
}
