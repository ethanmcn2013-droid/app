"use client";

import { useSyncExternalStore } from "react";

const PHONE_QUERY = "(max-width: 700px)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** True at phone widths: token edits open as bottom sheets there. */
export function useIsPhone() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

const noop = () => () => {};
/** False during server render and hydration, true after: portals wait for it. */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}
