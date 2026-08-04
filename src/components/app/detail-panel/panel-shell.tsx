"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { hasOpenLayer } from "@/components/primitives/open-layer";

const LS_KEY = "tasks.taskdetail.width";
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
    // ignore storage errors
  }
  return DEFAULT_WIDTH;
}

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

  // Lazy init: reads localStorage on client; SSR falls back to DEFAULT_WIDTH.
  const [width, setWidth] = useState(() => readStoredWidth());
  const [resizing, setResizing] = useState(false);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(DEFAULT_WIDTH);
  const panelRef = useRef<HTMLElement>(null);

  const persistWidth = useCallback((value: number) => {
    try {
      localStorage.setItem(LS_KEY, String(value));
    } catch {
      // ignore storage errors
    }
  }, []);

  // aria-modal is a promise, not a behaviour: focus must actually move into
  // the dialog on open and stay there. Focus lands on the panel container
  // (not a control — j/k task navigation keeps open=true, so this runs once
  // per opening, never while the reader is mid-panel); use-task-panel owns
  // the exact return to the opening card on close.
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) {
        panel.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  // Keep Tab inside the dialog. The dim overlay already owns the pointer;
  // without this, keyboard users tab out into dimmed controls behind it.
  const trapTab = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = [
      ...panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((element) => element.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  // Pointer-capture drag on the left edge handle
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      setResizing(true);
      startX.current = e.clientX;
      startW.current = width;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [width],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = startX.current - e.clientX;
    const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW.current + delta));
    setWidth(next);
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      setResizing(false);
      const delta = startX.current - e.clientX;
      const final = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW.current + delta));
      persistWidth(final);
    },
    [persistWidth],
  );

  // Keyboard path for the splitter (ARIA window-splitter pattern): the
  // panel is right-anchored, so Left widens and Right narrows.
  const onHandleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = 16;
      let next: number | null = null;
      if (e.key === "ArrowLeft") next = Math.min(MAX_WIDTH, width + step);
      else if (e.key === "ArrowRight") next = Math.max(MIN_WIDTH, width - step);
      else if (e.key === "Home") next = MAX_WIDTH;
      else if (e.key === "End") next = MIN_WIDTH;
      if (next === null) return;
      e.preventDefault();
      setWidth(next);
      persistWidth(next);
    },
    [persistWidth, width],
  );

  // Escape closes (PanelShell owns it; TaskDetail focus shell handles its own).
  // Skipped while a layered surface (Radix menu, field popover) is open — that
  // keypress belongs to the layer. Capture phase is required: Radix dismisses
  // its menu with a synchronously-flushed discrete event, so by the bubble
  // phase the layer is already out of the DOM and the check would pass.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (hasOpenLayer()) return;
      onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  // Modal focus management. aria-modal alone tells screen readers the
  // outside is inert; it does nothing for the keyboard. On open: remember
  // the opener and move focus into the dialog (77 Tab presses used to
  // stand between the opened card and the panel's first control). While
  // open: Tab cycles inside the panel. On close: focus returns to the
  // opener when it still exists.
  const panelRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (first ?? panel).focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      const opener = openerRef.current;
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  const trapTab = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || hasOpenLayer()) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* Overlay, dim only, no blur */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reduce
                ? { duration: 0.12 }
                : { duration: 0.16, ease: [0.23, 1, 0.32, 1] }
            }
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-ink/12"
            aria-hidden
          />

          {/* Panel. A section, not an aside: role="dialog" is not an
              allowed role on aside (axe: aria-allowed-role), and section
              is sectioning content, so the panel's inner <header> stops
              reading as a second page banner (axe: landmark-unique). */}
          <motion.section
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-panel-title"
            ref={panelRef}
            tabIndex={-1}
            onKeyDown={trapTab}
            // A real entrance: the sheet travels in from the right edge and
            // settles on the glide spring. The previous 24px opacity-drift
            // was so subtle it read as the panel simply appearing. Exit is
            // faster than enter — leaving should feel lighter than arriving.
            initial={reduce ? { opacity: 0 } : { transform: "translateX(100%)" }}
            animate={reduce ? { opacity: 1 } : { transform: "translateX(0)" }}
            data-resizing={resizing || undefined}
            data-task-detail-panel=""
            exit={{
              ...(reduce ? { opacity: 0 } : { transform: "translateX(100%)" }),
              transition: reduce
                ? { duration: 0.1 }
                : { duration: 0.2, ease: [0.23, 1, 0.32, 1] },
            }}
            transition={
              reduce
                ? { duration: 0.12 }
                : { transform: { duration: 0.32, ease: [0.23, 1, 0.32, 1] } }
            }
            className="fixed right-0 top-0 z-[81] flex h-screen w-full flex-col overflow-hidden border-l border-line-soft bg-bg-elevated md:w-auto"
            style={{
              // min(100vw, Npx): below md the resizable width (≥420px)
              // exceeds most viewports, so the panel stays full-screen;
              // at md+ the stored width applies.
              width: `min(100vw, ${width}px)`,
              boxShadow:
                "-28px 0 60px -20px rgba(20,21,26,0.28), -8px 0 16px -8px rgba(20,21,26,0.10)",
            }}
          >
            {/* Resize handle on the left edge: pointer drag, or focus it and
                use Left/Right (Home/End for the extremes). */}
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onKeyDown={onHandleKeyDown}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 8,
                cursor: "col-resize",
                zIndex: 10,
                touchAction: "none",
              }}
              role="separator"
              tabIndex={0}
              aria-label="Resize panel"
              aria-orientation="vertical"
              aria-valuemin={MIN_WIDTH}
              aria-valuemax={MAX_WIDTH}
              aria-valuenow={width}
              title={`Panel width: ${width}px (drag or use arrow keys, min ${MIN_WIDTH}px, max ${MAX_WIDTH}px)`}
            >
              {/* Visible indicator bar */}
              <div
                style={{
                  position: "absolute",
                  left: 2,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 2,
                  height: 48,
                  borderRadius: 1,
                  background: "var(--hairline, rgba(0,0,0,0.08))",
                  transition: "background 0.15s",
                }}
              />
            </div>

            {children}
          </motion.section>
        </>
      ) : null}
    </AnimatePresence>
  );
}
