"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True only after React has hydrated the client tree. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
