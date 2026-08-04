"use client";

import { useEffect, useState } from "react";

/**
 * FirstCompletionMoment, the once-ever beat the first time a task is ever
 * finished. The per-card flourish marks *every* completion; this marks the
 * emotional turn of the very first one: the brand check draws inside a
 * blooming ring and a single warm line settles, "First one done.", then it
 * fades. Non-blocking, reduced-motion aware, fires once and never again.
 *
 * Decoupled by a window event so any board card's done-transition can trigger
 * it while the moment itself renders just once at the app-layout level.
 *
 * Operator switch: NEXT_PUBLIC_TASKS_FIRST_COMPLETION=off.
 * Reviewable on a seeded demo via any /app route + ?firstcompletion=preview.
 */

const STORAGE_KEY = "signal-tasks.first-completion-seen";
const STORAGE_KEY_OLD = "tasks-first-completion-seen";
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
    // Migration: old key present → treat as seen, write new key, remove old.
    if (window.localStorage.getItem(STORAGE_KEY_OLD) === "1") {
      window.localStorage.setItem(STORAGE_KEY, "1");
      window.localStorage.removeItem(STORAGE_KEY_OLD);
      return;
    }
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
    const previewTimer =
      params.get("firstcompletion") === "preview"
        ? window.setTimeout(onFire, 0)
        : undefined;
    return () => {
      window.removeEventListener(EVENT, onFire);
      if (previewTimer) window.clearTimeout(previewTimer);
    };
  }, []);

  useEffect(() => {
    if (!show) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const t = window.setTimeout(() => setShow(false), reduced ? 2200 : 2400);
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
  left: 50%;
  bottom: 28px;
  z-index: 240;
  pointer-events: none;
  transform: translateX(-50%);
  animation: fcm2-root 2400ms var(--ease-out) both;
}
.fcm2-cluster {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 7px 14px 7px 8px;
  border: 1px solid var(--hairline, rgba(17,17,17,.1));
  border-radius: 999px;
  background: color-mix(in srgb, var(--paper) 94%, transparent);
  box-shadow: var(--shadow-float, 0 6px 16px rgba(17,17,17,.08));
  backdrop-filter: blur(14px) saturate(125%);
}
.fcm2-mark {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: var(--brand);
  animation: fcm2-mark 280ms var(--ease-out) both;
}
.fcm2-ring {
  position: absolute;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--brand) 64%, transparent);
  animation: fcm2-ring 520ms var(--ease-out) 80ms both;
}
.fcm2-check {
  stroke-dasharray: 30;
  stroke-dashoffset: 30;
  animation: fcm2-check 260ms var(--ease-out) 120ms both;
}
.fcm2-line {
  margin: 0;
  font-family: var(--font-geist-sans), "Geist", system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ink);
  opacity: 0;
  animation: fcm2-line 280ms var(--ease-out) 180ms both;
}

@keyframes fcm2-root {
  0% { opacity: 0; transform: translate(-50%, 6px); }
  10% { opacity: 1; transform: translate(-50%, 0); }
  82% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, 0); }
}
@keyframes fcm2-mark {
  0% { opacity: 0; transform: scale(0.92); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes fcm2-ring {
  0% { transform: scale(0.92); opacity: 0.65; }
  100% { transform: scale(1.45); opacity: 0; }
}
@keyframes fcm2-check {
  to { stroke-dashoffset: 0; }
}
@keyframes fcm2-line {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .fcm2-root { animation: fcm2-root-reduced 2200ms linear both; }
  .fcm2-mark, .fcm2-line { animation: none; opacity: 1; }
  .fcm2-ring { display: none; }
  .fcm2-check { stroke-dashoffset: 0; animation: none; }
  @keyframes fcm2-root-reduced {
    0% { opacity: 0; } 6% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; }
  }
}
@media (prefers-reduced-transparency: reduce) {
  .fcm2-cluster { background: var(--paper); backdrop-filter: none; }
}
@media print { .fcm2-root { display: none; } }
`;
