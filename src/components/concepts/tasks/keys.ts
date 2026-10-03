"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Modifier names for this machine: ⌘ and ⌥ on a Mac, Ctrl and Alt elsewhere. */
export function useModKeys() {
  const mac = useSyncExternalStore(noop, isMac, () => false);
  return mac ? { mod: "⌘", alt: "⌥" } : { mod: "Ctrl", alt: "Alt" };
}
