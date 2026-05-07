"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

/**
 * Focus Mode — a full-screen calm-down overlay with a 25-minute
 * Pomodoro-style countdown.
 *
 * Mounted once at the app layout level so the global keyboard
 * listener for `f` (open) / `space` (pause) / `esc` (close) is live
 * across every /app/* page.
 *
 * Trigger paths:
 *   1. User presses `f` while a board card is keyboard-focused — we
 *      read `[data-task-focused="true"]` to find the card and pull
 *      `data-task-id` + `data-task-title` off it.
 *   2. The detail panel dispatches `focus-mode:open` with the task's
 *      id + title in event detail, so the button in the panel footer
 *      can open the overlay without sharing React state.
 *
 * Strict no-pretense rules:
 *   - No notification sound, no system alert when the timer hits 0.
 *   - No streak counter, no analytics, no persistence.
 *   - Background is solid white — not the brand glow, not a gradient.
 *   - The colon in 25:00 does NOT blink.
 */
const TOTAL_SECONDS = 25 * 60;

type FocusTask = { id: string; title: string };

export type FocusModeOpenDetail = FocusTask;

declare global {
  interface WindowEventMap {
    "focus-mode:open": CustomEvent<FocusModeOpenDetail>;
  }
}

export function FocusMode() {
  const [isOpen, setIsOpen] = useState(false);
  const [task, setTask] = useState<FocusTask | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(TOTAL_SECONDS);
  const [isPaused, setIsPaused] = useState(false);
  const reduce = useReducedMotion();

  // Refs so the keyboard handler stays stable but reads fresh state.
  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const open = useCallback((next: FocusTask) => {
    setTask(next);
    setSecondsRemaining(TOTAL_SECONDS);
    setIsPaused(false);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Imperative open via custom event — used by the detail-panel
  // footer button. Keeps the panel decoupled from this component's
  // React state.
  useEffect(() => {
    function onOpen(e: CustomEvent<FocusModeOpenDetail>) {
      if (!e.detail) return;
      open(e.detail);
    }
    window.addEventListener("focus-mode:open", onOpen);
    return () => window.removeEventListener("focus-mode:open", onOpen);
  }, [open]);

  // Global keyboard listener — `f` opens, `space` pauses, `esc`
  // closes. Skips when the user is typing in an editable surface
  // (matches the cycle 16 / 22 board-app pattern).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as Element | null;
      if (
        target &&
        target instanceof HTMLElement &&
        (target.matches(
          "input, textarea, [contenteditable], [contenteditable=\"true\"]",
        ) ||
          target.isContentEditable)
      ) {
        return;
      }

      if (isOpenRef.current) {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
          return;
        }
        if (e.key === " " || e.code === "Space") {
          e.preventDefault();
          setIsPaused((p) => !p);
          return;
        }
        // Idempotent: while open, swallow the trigger key.
        if (e.key === "f" || e.key === "F") {
          e.preventDefault();
          return;
        }
        return;
      }

      if (e.key !== "f" && e.key !== "F") return;
      // Modifier-stripped binding only — Cmd/Ctrl+F is the browser's
      // find-in-page and we don't fight it.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const card = findFocusedCard();
      if (!card) return;
      const id = card.getAttribute("data-task-id");
      const title = card.getAttribute("data-task-title");
      if (!id || !title) return;
      e.preventDefault();
      open({ id, title });
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close, open]);

  // Tick every second while open + not paused. setInterval, vanilla
  // cleanup, no rAF gymnastics.
  useEffect(() => {
    if (!isOpen || isPaused) return;
    if (secondsRemaining <= 0) return;
    const id = window.setInterval(() => {
      setSecondsRemaining((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isOpen, isPaused, secondsRemaining]);

  // SSR safety — portal target only exists in the browser.
  if (typeof document === "undefined") return null;

  const done = secondsRemaining <= 0;
  const timeLabel = formatTime(secondsRemaining);

  return createPortal(
    <AnimatePresence>
      {isOpen && task ? (
        <motion.div
          key="focus-mode"
          role="dialog"
          aria-modal="true"
          aria-label="Focus mode"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: reduce
              ? { duration: 0 }
              : { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
          }}
          exit={{
            opacity: 0,
            transition: reduce
              ? { duration: 0 }
              : { duration: 0.16, ease: [0.16, 1, 0.3, 1] },
          }}
          style={{ background: "#ffffff" }}
          className="fixed inset-0 z-[120] flex items-center justify-center"
        >
          <div className="flex w-full max-w-[600px] flex-col items-center px-8 text-center">
            <div
              className="text-[11px] font-semibold uppercase"
              style={{
                color: "var(--brand)",
                letterSpacing: "0.18em",
              }}
            >
              FOCUS
            </div>

            <h1
              className="mt-10 line-clamp-2 text-[64px] font-semibold leading-[1.04] tracking-tight text-ink"
            >
              {task.title}
            </h1>

            <div
              className="mt-14 text-[144px] font-semibold leading-none tabular-nums tracking-tight"
              style={{
                color: done ? "var(--brand)" : "var(--ink, #14151a)",
              }}
              aria-live="polite"
            >
              {done ? (
                <span className="text-[40px] font-semibold lowercase tracking-tight">
                  0:00 · done — close out the work
                </span>
              ) : (
                timeLabel
              )}
            </div>

            <div className="mt-12 text-[12px] text-ink-quiet">
              {isPaused && !done ? "paused · " : ""}space pauses · esc closes
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Locate the keyboard-focused board card. Prefers the explicit
 * `data-task-focused="true"` flag the board sets on its keyboard
 * focus state; falls back to whatever card the document's
 * activeElement happens to be inside (covers list/timeline views
 * adopting the same data-* contract later).
 */
function findFocusedCard(): HTMLElement | null {
  const explicit = document.querySelector<HTMLElement>(
    "[data-task-focused=\"true\"][data-task-id]",
  );
  if (explicit) return explicit;
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    if (active.hasAttribute("data-task-id")) return active;
    const closest = active.closest<HTMLElement>("[data-task-id]");
    if (closest) return closest;
  }
  return null;
}

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
