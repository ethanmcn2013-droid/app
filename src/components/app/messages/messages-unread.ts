"use client";

/**
 * The sidebar's Messages badge. The server renders a count with the shell;
 * an open Messages view publishes the live count here as you read, so the
 * badge follows without a reload. Memory only, per tab.
 */

import { useSyncExternalStore } from "react";

let live: number | null = null;
const listeners = new Set<() => void>();

export function publishMessagesUnread(count: number): void {
  const next = Math.max(0, Math.floor(count));
  if (live === next) return;
  live = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The live count once Messages has published one, otherwise the server's. */
export function useMessagesUnread(serverCount: number): number {
  const value = useSyncExternalStore(subscribe, () => live, () => null);
  return value ?? serverCount;
}
