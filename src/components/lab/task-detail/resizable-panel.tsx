"use client";

/**
 * ResizablePanel — Hybrid C side panel with drag handle.
 *
 * DIVERGENCE NOTE: The production PanelShell (detail-panel/panel-shell.tsx)
 * uses a fixed 480px width with a full-screen overlay at <md. This component
 * adds:
 *   1. A drag handle on the LEFT edge for resizing (min 420px, max 720px)
 *   2. Width persisted in localStorage under key lab.taskdetail.width
 *   3. No layout shift on the board — panel overlays with elevation, not push
 *   4. The same motion grammar (x/opacity slide, spring easing, prefers-reduced-motion)
 *
 * These are the EXACT production motion values from panel-shell.tsx:
 *   x: { duration: 0.48, ease: [0.16, 1, 0.3, 1] }
 *   opacity: { duration: 0.36, ease: [0.16, 1, 0.3, 1] }
 *   boxShadow: "-28px 0 60px -20px rgba(20,21,26,0.28), -8px 0 16px -8px rgba(20,21,26,0.10)"
 */

import { useCallback, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

const LS_KEY = "lab.taskdetail.width";
const MIN_WIDTH = 420;
const MAX_WIDTH = 720;
const DEFAULT_WIDTH = 520;

function readStoredWidth(): number {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
    }
  } catch {
    // ignore
  }
  return DEFAULT_WIDTH;
}

export function ResizablePanel({
  open,
  children,
}: {
  open: boolean;
  /** Close is handled by the shell (Esc / close control); kept off the
   *  panel itself so the scrim-less overlay never steals clicks. */
  onClose?: () => void;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  // Lazy init reads localStorage on the client; SSR falls back to the
  // default and React patches the style attribute on hydration.
  const [width, setWidth] = useState(() => readStoredWidth());
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(DEFAULT_WIDTH);

  // Pointer events for drag handle
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [width]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = startX.current - e.clientX;
    const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW.current + delta));
    setWidth(next);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const delta = startX.current - e.clientX;
    const final = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW.current + delta));
    try {
      localStorage.setItem(LS_KEY, String(final));
    } catch {
      // ignore
    }
  }, []);

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="lab-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-detail-title"
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
          className="fixed right-0 top-0 z-[81] flex h-screen flex-col overflow-hidden border-l border-line-soft bg-bg-elevated"
          style={{
            width,
            boxShadow:
              "-28px 0 60px -20px rgba(20,21,26,0.28), -8px 0 16px -8px rgba(20,21,26,0.10)",
          }}
        >
          {/* Drag handle */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 6,
              cursor: "col-resize",
              zIndex: 10,
              touchAction: "none",
            }}
            role="separator"
            aria-label="Drag to resize panel"
            aria-orientation="vertical"
            title={`Panel width: ${width}px (drag to resize, min ${MIN_WIDTH}px, max ${MAX_WIDTH}px)`}
          >
            {/* Visible indicator on hover */}
            <div
              style={{
                position: "absolute",
                left: 2,
                top: "50%",
                transform: "translateY(-50%)",
                width: 2,
                height: 48,
                borderRadius: 1,
                background: "var(--hairline)",
                transition: "background 0.15s",
              }}
              className="group-hover:bg-ink-ghost"
            />
          </div>

          {children}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
