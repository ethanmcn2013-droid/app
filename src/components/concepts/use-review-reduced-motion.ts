"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
function subscribe(notify: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}
const readPreference = () => window.matchMedia(QUERY).matches;
const serverPreference = () => false;

/** Keep SSR and the first hydration render identical, then honour the preference. */
export function useReviewReducedMotion() {
  return useSyncExternalStore(subscribe, readPreference, serverPreference);
}
