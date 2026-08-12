"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { EASE_OUT_TOKEN } from "@/components/primitives/anchored-layer";
import { hasOpenLayer } from "@/components/primitives/open-layer";

/**
 * The Task Focus Window.
 *
 * A task used to open as a 520px sheet welded to the right edge of the
 * screen — a filing cabinet drawer, narrow enough that a description and
 * its properties could never be read side by side, and visually secondary
 * to the board it covered. Opening a task is not a glance; it is where
 * the work happens. So it opens as a centred window over a dimmed board:
 * substantial, floating clear of all four edges, with the board still
 * recognisable behind it so nobody loses their place.
 *
 * What survives from the drawer, deliberately: Escape that yields to any
 * layer above it, focus moved in on open, Tab cycled inside, focus
 * returned to the card on close, and `aria-labelledby` pointing at the
 * task's own title. The framing changed; the accessibility contract did
 * not.
 *
 * What went: the resize handle. A drawer had to be resizable because it
 * was too narrow at every width; a window sized to the viewport does not.
 */
export function TaskFocusWindow({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();

  // Escape closes, unless a layered surface (Radix menu, field popover)
  // owns the keypress. Capture phase is required: Radix dismisses its menu
  // with a synchronously-flushed discrete event, so by the bubble phase the
  // layer is already gone and the check would wrongly pass.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (hasOpenLayer()) return;
      onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  // Modal focus management. aria-modal alone tells a screen reader the
  // outside is inert; it does nothing for the keyboard. Remember the card
  // that opened this, move focus inside, and give it back on close.
  const windowRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      const node = windowRef.current;
      if (!node) return;
      node.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const restoreOpener = useCallback(() => {
    const opener = openerRef.current;
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  }, []);

  const trapTab = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== "Tab" || hasOpenLayer()) return;
    const node = windowRef.current;
    if (!node) return;
    const focusables = Array.from(
      node.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
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

  return (
    <AnimatePresence onExitComplete={restoreOpener}>
      {open ? (
        <>
          {/* The scrim covers the whole application — rail, header, board
              and any open Planning state — so the window is the only lit
              surface. Two pixels of blur is enough to push the board back
              a plane while leaving it legible; more would erase the
              context the centred window exists to preserve. */}
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0.12 } : { duration: 0.18, ease: EASE_OUT_TOKEN }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-ink/[0.28] backdrop-blur-[2px]"
            aria-hidden
          />

          {/* The centring frame is inert; only the window itself takes
              pointer events, so a click anywhere around it reaches the
              scrim and closes. */}
          <div className="pointer-events-none fixed inset-0 z-[81] flex items-stretch justify-center md:items-center md:p-8 lg:p-12">
            {/* A section, not an aside: role="dialog" is not an allowed
                role on aside (axe: aria-allowed-role), and section is
                sectioning content, so the window's inner <header> stops
                reading as a second page banner (axe: landmark-unique). */}
            <motion.section
              key="focus-window"
              ref={windowRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="task-panel-title"
              tabIndex={-1}
              onKeyDown={trapTab}
              data-task-detail-panel=""
              data-task-focus-window=""
              // Arriving: the window fades up from 0.985 with eight pixels
              // of lift — enough to read as "this came forward", short of
              // anything that could be called an expansion. Leaving is
              // faster than arriving, because a closed task should feel
              // dismissed rather than withdrawn.
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px) scale(0.985)" }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0) scale(1)" }}
              exit={{
                ...(reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(4px) scale(0.99)" }),
                transition: reduce ? { duration: 0.1 } : { duration: 0.16, ease: EASE_OUT_TOKEN },
              }}
              transition={reduce ? { duration: 0.12 } : { duration: 0.2, ease: EASE_OUT_TOKEN }}
              // The panel's base leading. Everything inside inherited 1.5
              // from the document before this, so an uppercase label that
              // can never wrap breathed like a paragraph. `ui` is the
              // floor; prose opts up to `read`, headings down to `tight`.
              // Full-screen on a phone, where a floating window would be a
              // postage stamp; a centred 1120px window from md up, capped
              // so it never touches an edge.
              className="pointer-events-auto flex h-dvh w-full flex-col overflow-hidden border-line-soft bg-bg-elevated leading-[var(--x-lead-ui)] md:h-auto md:max-h-[min(84dvh,calc(100dvh_-_64px))] md:w-[1120px] md:max-w-[calc(100vw_-_96px)] md:rounded-[20px] md:border"
              style={{
                boxShadow: "0 32px 80px -24px rgba(20,21,26,0.30), 0 8px 24px -12px rgba(20,21,26,0.14)",
              }}
            >
              {children}
            </motion.section>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
