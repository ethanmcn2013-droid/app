"use client";

// Board view preferences that live on this device, like folded lanes and
// the planning drawer: an external-store read so the server render never
// disagrees with hydration, and the storage event keeps two tabs agreeing.

import { useCallback, useSyncExternalStore } from "react";

const DESCRIPTIONS_KEY = "signal-tasks.board.show-status-descriptions";

let descriptionsCache: { raw: string | null; value: boolean } = { raw: null, value: true };

function readShowDescriptions(): boolean {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(DESCRIPTIONS_KEY);
  } catch {
    /* private mode — descriptions simply stay visible */
  }
  if (raw !== descriptionsCache.raw) descriptionsCache = { raw, value: raw !== "hidden" };
  return descriptionsCache.value;
}

const descriptionListeners = new Set<() => void>();

function subscribeShowDescriptions(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === DESCRIPTIONS_KEY) listener();
  };
  descriptionListeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    descriptionListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Whether column headers show their authored description line.
 *  Defaults to shown — the plain-language lane purposes are part of the
 *  first-contact experience; experienced owners can quiet them from the
 *  View menu. */
export function useShowStatusDescriptions(): readonly [boolean, () => void] {
  const shown = useSyncExternalStore(subscribeShowDescriptions, readShowDescriptions, () => true);
  const toggle = useCallback(() => {
    const next = !readShowDescriptions();
    try {
      window.localStorage.setItem(DESCRIPTIONS_KEY, next ? "shown" : "hidden");
    } catch {
      descriptionsCache = { raw: descriptionsCache.raw, value: next };
    }
    descriptionListeners.forEach((notify) => notify());
  }, []);
  return [shown, toggle] as const;
}
