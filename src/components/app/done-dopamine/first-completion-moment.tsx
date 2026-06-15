"use client";

import { useEffect, useState } from "react";

/**
 * FirstCompletionMoment — the once-ever beat the first time a task is ever
 * finished. The per-card flourish marks *every* completion; this marks the
 * emotional turn of the very first one: the brand check draws inside a
 * blooming ring and a single warm line settles — "First one done." — then it
 * fades. Non-blocking, reduced-motion aware, fires once and never again.
 *
 * Decoupled by a window event so any board card's done-transition can trigger
 * it while the moment itself renders just once at the app-layout level.
 *
 * Operator switch: NEXT_PUBLIC_TASKS_FIRST_COMPLETION=off.
 * Reviewable on a seeded demo via any /app route + ?firstcompletion=preview.
 */

const STORAGE_KEY = "tasks-first-completion-seen";
const EVENT = "tasks:first-completion";

export const FIRST_COMPLETION_ENABLED =
  process.env.NEXT_PUBLIC_TASKS_FIRST_COMPLETION !== "off";

/**
 * Fire the moment if it has never fired. Once-ever via localStorage; safe to
 * call on every completion. No-op when disabled or storage is unavailable.
 */
export function maybeFireFirstCompletion(): void {
  if (!FIRST_COMPLETION_ENABLED || typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function FirstCompletionMoment() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onFire = () => setShow(true);
    window.addEventListener(EVENT, onFire);
    // Preview hook so the once-ever moment is reviewable on a seeded demo.
    const params = new URLSearchParams(window.location.search);
    if (params.get("firstcompletion") === "preview") setShow(true);
    return () => window.removeEventListener(EVENT, onFire);
  }, []);

  useEffect(() => {
    if (!show) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const t = window.setTimeout(() => setShow(false), reduced ? 2600 : 3200);
    return () => window.clearTimeout(t);
  }, [show]);

  if (!show) return null;

  return (
    <div className="fcm2-root">
      <div className="fcm2-cluster">
        <span className="fcm2-mark" aria-hidden>
          <span className="fcm2-ring" />
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path className="fcm2-check" d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <p className="fcm2-line" role="status" aria-live="polite">
          First one done.
        </p>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.fcm2-root {
  position: fixed;
  inset: 0;
  z-index: 240;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  animation: fcm2-root 3200ms cubic-bezier(.22,.7,.2,1) both;
}
.fcm2-cluster {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  transform: translateY(-4%);
}
.fcm2-mark {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  color: var(--brand, #4f46e5);
  animation: fcm2-mark 520ms cubic-bezier(.34,1.56,.64,1) both;
}
.fcm2-ring {
  position: absolute;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid var(--brand, #4f46e5);
  animation: fcm2-ring 760ms cubic-bezier(.22,.7,.2,1) 120ms both;
}
.fcm2-check {
  stroke-dasharray: 30;
  stroke-dashoffset: 30;
  animation: fcm2-check 360ms ease-out 260ms both;
}
.fcm2-line {
  margin: 0;
  font-family: var(--font-geist-sans), "Geist", system-ui, sans-serif;
  font-size: clamp(17px, 1rem + 0.6vw, 21px);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--ink, #111111);
  opacity: 0;
  animation: fcm2-line 640ms cubic-bezier(.22,.7,.2,1) 520ms both;
}

@keyframes fcm2-root {
  0% { opacity: 0; } 8% { opacity: 1; } 76% { opacity: 1; } 100% { opacity: 0; }
}
@keyframes fcm2-mark {
  0% { opacity: 0; transform: scale(0.3); }
  60% { opacity: 1; transform: scale(1.12); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes fcm2-ring {
  0% { transform: scale(0.7); opacity: 0.55; }
  100% { transform: scale(1.9); opacity: 0; }
}
@keyframes fcm2-check {
  to { stroke-dashoffset: 0; }
}
@keyframes fcm2-line {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .fcm2-root { animation: fcm2-root-reduced 2600ms linear both; }
  .fcm2-mark, .fcm2-line { animation: none; opacity: 1; }
  .fcm2-ring { display: none; }
  .fcm2-check { stroke-dashoffset: 0; animation: none; }
  @keyframes fcm2-root-reduced {
    0% { opacity: 0; } 6% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; }
  }
}
@media print { .fcm2-root { display: none; } }
`;
