"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Dialog({
  open,
  onClose,
  children,
  labelledBy,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  width?: number;
}) {
  const reduce = useReducedMotion();
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

    // Focus first input/textarea/button inside the dialog.
    requestAnimationFrame(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(
        "input, textarea, [tabindex]:not([tabindex='-1']), button:not([data-dialog-skip-focus])",
      );
      focusable?.focus({ preventScroll: true });
    });

    return () => {
      document.removeEventListener("keydown", onKey);
      lastFocusedRef.current?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  // SSR safety
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reduce
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
              aria-labelledby={labelledBy}
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : {
                      duration: 0.26,
                      ease: [0.16, 1, 0.3, 1],
                    }
              }
              onClick={(e) => e.stopPropagation()}
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
