"use client";

/**
 * The unsaved-work signal's React seam — WP6 lane C.
 *
 * The logic lives in `src/lib/projects/unsaved-work.ts` (pure, tested there);
 * this file is only the wiring that lets a surface reach the one store the
 * Active Project provider consults. Three parties, three hooks:
 *
 *  - an OWNING surface (Notes today, Tasks editors next) publishes and clears
 *    claims from its own state with `useUnsavedWork()`;
 *  - a RENDERING surface (the Active Project chrome) reads the live claims
 *    with `useUnsavedWorkClaims()` — reactively, via the store's own
 *    subscription, so it needs no knowledge of who published;
 *  - the PROVIDER consults the store synchronously inside `selectProject`,
 *    which is why the store instance itself — not React state — is what this
 *    context carries.
 *
 * Mounted by `ActiveProjectProvider`, so it exists exactly when the guarded
 * transition exists. Flag off, there is no provider, the context is null, and
 * every hook here degrades to a no-op: Notes publishes into nothing, nothing
 * consults, and today's behaviour — the same-tab `beforeunload` warning — is
 * the whole story, unchanged.
 */

import { createContext, useContext, useSyncExternalStore } from "react";
import type {
  UnsavedWorkClaim,
  UnsavedWorkSource,
  UnsavedWorkStore,
} from "@/lib/projects/unsaved-work";

export type { UnsavedWorkClaim, UnsavedWorkSource, UnsavedWorkStore };

const UnsavedWorkContext = createContext<UnsavedWorkStore | null>(null);

export function UnsavedWorkProvider({
  store,
  children,
}: {
  store: UnsavedWorkStore;
  children: React.ReactNode;
}) {
  return (
    <UnsavedWorkContext.Provider value={store}>
      {children}
    </UnsavedWorkContext.Provider>
  );
}

/** What an owning surface needs: publish and clear, nothing else. */
export type UnsavedWorkPublisher = Pick<UnsavedWorkStore, "publish" | "clear">;

/**
 * For the surface that owns the dirty state. `null` when no guarded
 * transition is mounted (flag off) — publish into the void by guarding on it,
 * and change nothing else about how the surface tracks its own work.
 */
export function useUnsavedWork(): UnsavedWorkPublisher | null {
  return useContext(UnsavedWorkContext);
}

const NO_CLAIMS: readonly UnsavedWorkClaim[] = Object.freeze([]);
const subscribeNever = () => () => {};
const emptyClaims = () => NO_CLAIMS;

/**
 * For a surface that renders dirty state — the refusal panel, a dot on the
 * Project trigger. Reactive; empty when nothing is registered or no store is
 * mounted.
 */
export function useUnsavedWorkClaims(): readonly UnsavedWorkClaim[] {
  const store = useContext(UnsavedWorkContext);
  return useSyncExternalStore(
    store ? store.subscribe : subscribeNever,
    store ? store.claims : emptyClaims,
    emptyClaims,
  );
}
