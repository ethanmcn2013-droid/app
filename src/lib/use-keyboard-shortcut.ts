"use client";

import { useEffect } from "react";

function targetIsEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement) return true;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el.isContentEditable) return true;
  return false;
}

/**
 * Bind a keydown shortcut to the document. Skips when the user is
 * typing in an editable element, when modifier keys are held, and
 * when `enabled` is false.
 *
 * Pass an unmemoized handler, the effect closes over the latest
 * via a stable ref pattern so the listener doesn't churn.
 */
export function useKeyboardShortcut(
  key: string,
  handler: (e: KeyboardEvent) => void,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (targetIsEditable(e.target)) return;
      if (e.key !== key) return;
      handler(e);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [key, handler, enabled]);
}
