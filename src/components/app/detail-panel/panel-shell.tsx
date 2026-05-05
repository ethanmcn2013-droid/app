"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useEffect, type ReactNode } from "react";

export function PanelShell({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();

  // ⎋ closes
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* Overlay — dim only, no blur */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }
            }
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-ink/12"
            aria-hidden
          />

          {/* Panel */}
          <motion.aside
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-panel-title"
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : {
                    x: { duration: 0.48, ease: [0.16, 1, 0.3, 1] },
                    opacity: { duration: 0.36, ease: [0.16, 1, 0.3, 1] },
                  }
            }
            className="fixed right-0 top-0 z-[81] flex h-screen w-full flex-col overflow-hidden border-l border-line-soft bg-bg-elevated md:w-[480px]"
            style={{
              boxShadow:
                "-28px 0 60px -20px rgba(20,21,26,0.28), -8px 0 16px -8px rgba(20,21,26,0.10)",
            }}
          >
            {children}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
