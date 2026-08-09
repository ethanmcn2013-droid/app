"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onClose,
  children,
  labelledBy,
  ariaLabel,
  width = 480,
  motionMode = "standard",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  /** Fixed accessible name. Prefer this when the only labelling candidate
   *  is an input whose VALUE would otherwise become the dialog's name. */
  ariaLabel?: string;
  width?: number;
  motionMode?: "standard" | "instant";
}) {
  const reduce = useReducedMotion();
  const instant = motionMode === "instant";
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    lastFocusedRef.current = (document.activeElement as HTMLElement) ?? null;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);

    // Focus first input/textarea/button inside the dialog, and the dialog
    // itself when it holds nothing focusable — the Tab trap below has to have
    // somewhere to start, or focus is still standing in the inert page.
    requestAnimationFrame(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(
        "input, textarea, [tabindex]:not([tabindex='-1']), button:not([data-dialog-skip-focus])",
      );
      (focusable ?? dialogRef.current)?.focus({ preventScroll: true });
    });

    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const restoreFocus = useCallback(() => {
    const target = lastFocusedRef.current;
    if (target?.isConnected) target.focus({ preventScroll: true });
  }, []);

  /**
   * The keyboard half of `aria-modal`.
   *
   * `aria-modal="true"` tells a screen reader that everything behind this
   * dialog is inert. It does nothing at all to the Tab order, so focus walked
   * straight out of the dialog and into the page the same attribute had just
   * declared unreachable — the two channels contradicting each other on every
   * dialog in the app. This is the trap the task focus window has always had
   * (`components/app/detail-panel/focus-window.tsx`), lifted into the
   * primitive so every dialog gets it rather than one surface.
   */
  const trapTab = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== "Tab") return;
    const node = dialogRef.current;
    if (!node) return;
    const focusables = Array.from(
      node.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter((element) => element.offsetParent !== null || element === document.activeElement);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  // SSR safety
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence onExitComplete={restoreFocus}>
      {open ? (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reduce || instant
                ? { duration: 0 }
                : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
            }
            onClick={onClose}
            className="fixed inset-0 z-[90]"
            style={{ background: "rgba(20, 21, 26, 0.32)" }}
            aria-hidden
          />
          <div
            className="fixed inset-0 z-[91] flex items-start justify-center pt-[18vh] sm:pt-[22vh]"
            onClick={onClose}
          >
            <motion.div
              key="dialog"
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel}
              aria-labelledby={ariaLabel ? undefined : labelledBy}
              initial={instant ? false : reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.97)" }}
              animate={{ opacity: 1, transform: "scale(1)" }}
              exit={instant ? { opacity: 1 } : reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.99)" }}
              transition={
                reduce || instant
                  ? { duration: instant ? 0 : 0.12 }
                  : {
                      duration: 0.2,
                      ease: [0.23, 1, 0.32, 1],
                    }
              }
              onClick={(e) => e.stopPropagation()}
              onKeyDown={trapTab}
              tabIndex={-1}
              className="overflow-hidden rounded-[14px] border border-line bg-bg-elevated"
              style={{
                width,
                boxShadow:
                  "0 28px 60px -20px rgba(20,21,26,0.28), 0 10px 20px -8px rgba(20,21,26,0.10)",
              }}
            >
              {children}
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
