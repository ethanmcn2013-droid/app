"use client";

/* Modal focus: Tab and Shift+Tab stay inside, focus goes back where it came from. */

import { useEffect, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* Opening a dialog makes the page behind it inert, which drops focus to <body>.
   Remember the last real focus so it can go back there. */
let lastFocused: HTMLElement | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "focusin",
    (e) => {
      if (e.target instanceof HTMLElement && e.target !== document.body) lastFocused = e.target;
    },
    true,
  );
}

const openers = new WeakMap<HTMLElement, HTMLElement>();

function focusables(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest("[inert]") && el.getClientRects().length > 0);
}

/**
 * Keeps keyboard focus inside `ref` while it is mounted. `initial` picks the first
 * thing to focus; `restore` is where focus goes when it closes (defaults to whatever
 * had focus when it opened).
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, opts: { initial?: () => HTMLElement | null | undefined; restore?: (opener: HTMLElement | null) => HTMLElement | null | undefined } = {}) {
  const { initial, restore } = opts;
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const active = document.activeElement as HTMLElement | null;
    /* In development React mounts twice; keep the first opener, not our own button. */
    const opener = openers.get(root) ?? (active && active !== document.body && !root.contains(active) ? active : lastFocused);
    if (opener) openers.set(root, opener);
    const first = initial?.() ?? focusables(root)[0];
    first?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = focusables(root);
      if (!list.length) {
        e.preventDefault();
        return;
      }
      const i = list.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : i === -1 || i === list.length - 1 ? 0 : i + 1;
      e.preventDefault();
      list[next].focus();
    };
    /* If focus lands outside by any other route, bring it back. */
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as Node;
      if (root.contains(t)) return;
      if ((t as HTMLElement).closest?.('[aria-modal="true"]')) return;
      focusables(root)[0]?.focus({ preventScroll: true });
    };
    root.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      root.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);
      requestAnimationFrame(() => {
        if (root.isConnected) return;
        const back = restore ? restore(opener) : opener;
        back?.focus({ preventScroll: true });
      });
    };
    // Mount-only: the trap lives as long as the dialog does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
