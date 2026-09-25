"use client";

/**
 * The launcher on a phone or a touch screen: a modal bottom sheet.
 *
 * Portalled to the body so no ancestor can clip or transform it. While it is
 * open the shell behind it is `inert` and the page does not scroll; Tab stays
 * inside. It closes on Done, a tap on the scrim, Escape, or a drag down on
 * the handle or the title past 30% of its height (or a quick flick).
 */

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./launcher.module.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function LauncherSheet({
  phase,
  onClose,
  children,
}: {
  phase: "open" | "closing";
  onClose: () => void;
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startT: number; dy: number; id: number } | null>(null);
  const open = phase === "open";

  // The shell goes inert and still while the sheet is up.
  useEffect(() => {
    if (!open) return;
    const shell = document.querySelector<HTMLElement>('[data-shell="v3"]');
    const overflow = document.body.style.overflow;
    if (shell) shell.inert = true;
    document.body.style.overflow = "hidden";
    return () => {
      if (shell) shell.inert = false;
      document.body.style.overflow = overflow;
    };
  }, [open]);

  // Escape and a Tab loop inside the sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // The panel's field clears a query first and stops the event itself.
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !sheetRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  const setOffset = (dy: number, animate: boolean) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.transition = animate ? "" : "none";
    sheet.style.transform = dy > 0 ? `translateY(${dy}px)` : "";
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className={`${styles.sheetLayer} v3-focus`} data-phase={phase}>
      <div className={styles.sheetScrim} aria-hidden="true" onClick={onClose} />
      <div
        ref={sheetRef}
        id="apps-launcher"
        role="dialog"
        aria-modal="true"
        aria-label="Apps and tools"
        className={styles.sheet}
        data-phase={phase}
        onPointerDown={(event) => {
          const target = event.target as HTMLElement;
          if (!target.closest("[data-sheet-drag]") || target.closest("button, a, input")) return;
          drag.current = { startY: event.clientY, startT: event.timeStamp, dy: 0, id: event.pointerId };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          if (!state || state.id !== event.pointerId) return;
          state.dy = Math.max(0, event.clientY - state.startY);
          setOffset(state.dy, false);
        }}
        onPointerUp={(event) => {
          const state = drag.current;
          drag.current = null;
          if (!state || state.id !== event.pointerId) return;
          const height = sheetRef.current?.offsetHeight ?? 1;
          const velocity = state.dy / Math.max(1, event.timeStamp - state.startT);
          if (state.dy > height * 0.3 || (state.dy > 24 && velocity > 0.5)) {
            onClose();
            return;
          }
          setOffset(0, true);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setOffset(0, true);
        }}
      >
        <div className={styles.handleZone} data-sheet-drag="" aria-hidden="true">
          <span className={styles.handle} />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
