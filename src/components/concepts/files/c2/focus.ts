"use client";

import { type RefObject, useEffect } from "react";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Moves focus into a dialog when it opens, optionally keeps Tab inside it,
 * and hands focus back to whatever opened it when it closes.
 * `initial` picks the first element to focus; it falls back to the first control.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, { initial, trap }: { initial?: string; trap: boolean }) {
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // If the opener is replaced while the dialog is open (Pack becomes Packed), fall back to its kit's footer.
    const home = opener?.closest<HTMLElement>("[data-kit]") ?? null;
    const target = (initial && box.querySelector<HTMLElement>(initial)) || box.querySelector<HTMLElement>(FOCUSABLE) || box;
    target.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (!trap || e.key !== "Tab") return;
      const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !box.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !box.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
      else (home?.querySelector<HTMLElement>("footer button") ?? home)?.focus({ preventScroll: true });
    };
    // Runs once per open: the dialog's identity is its mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
