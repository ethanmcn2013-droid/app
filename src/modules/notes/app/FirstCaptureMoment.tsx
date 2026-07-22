"use client";

import { useEffect } from "react";

/**
 * FirstCaptureMoment, the one signature moment in Notes.
 *
 * Fires exactly once, ever: the first note a brand-new notebook receives.
 * The indigo pip (the wordmark/loader gesture) blooms at centre and a single
 * warm line settles beneath it, "Your notebook starts here.", then the whole
 * thing fades. It is non-blocking (pointer-events: none), never repeats, and
 * extends the existing caret-dot signature rather than inventing a gimmick.
 *
 * Silence-by-default (PRODUCT.md §9) is preserved for every *subsequent*
 * capture, this is the single sanctioned exception, gated to once-ever and
 * operator-disable-able via NEXT_PUBLIC_NOTES_FIRST_CAPTURE=off.
 *
 * Reduced motion: no bloom/scale; the line simply appears and holds.
 *
 * Storage: key renamed from "notes-first-capture-seen" to
 * "signal-notes.first-capture-seen" per unified-app storage audit (§5).
 * hasSeenFirstCapture() reads both keys so existing users aren't re-shown
 * the moment after the migration.
 */

const STORAGE_KEY = "signal-notes.first-capture-seen";
const LEGACY_STORAGE_KEY = "notes-first-capture-seen";

/** Master switch. Default on; set NEXT_PUBLIC_NOTES_FIRST_CAPTURE=off to disable. */
export const FIRST_CAPTURE_ENABLED =
  process.env.NEXT_PUBLIC_NOTES_FIRST_CAPTURE !== "off";

export function hasSeenFirstCapture(): boolean {
  if (typeof window === "undefined") return true;
  try {
    // Read both keys: legacy users already have the old key set.
    return (
      window.localStorage.getItem(STORAGE_KEY) === "1" ||
      window.localStorage.getItem(LEGACY_STORAGE_KEY) === "1"
    );
  } catch {
    // localStorage unavailable (private mode / blocked): treat as seen so we
    // never risk firing on every capture.
    return true;
  }
}

export function markFirstCaptureSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
    // Migrate: remove the old key so localStorage stays clean.
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function FirstCaptureMoment({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const total = reduced ? 2400 : 2900;
    const t = window.setTimeout(onDone, total);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fcm-root">
      <div className="fcm-cluster">
        <span className="fcm-pip" aria-hidden />
        <p className="fcm-line" role="status" aria-live="polite">
          Your notebook starts here.
        </p>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.fcm-root {
  position: fixed;
  inset: 0;
  z-index: 240;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  /* Whole-moment fade: in fast, long hold, gentle out. */
  animation: fcm-root 2900ms cubic-bezier(.22,.7,.2,1) both; /* ds-allow — Notes first-capture signature choreography. */
}
.fcm-cluster {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  text-align: center;
  transform: translateY(-4%);
}
.fcm-pip {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 42%, transparent);
  animation:
    fcm-pip-bloom 620ms cubic-bezier(.34,1.56,.64,1) both, /* ds-allow — Notes first-capture pip bloom. */
    fcm-pip-ring 1500ms cubic-bezier(.22,.7,.2,1) 360ms both; /* ds-allow — Notes first-capture ring settle. */
}
.fcm-line {
  margin: 0;
  font-family: var(--font-sans), system-ui, sans-serif;
  font-size: clamp(17px, 1rem + 0.6vw, 21px);
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--ink);
  opacity: 0;
  animation: fcm-line 700ms cubic-bezier(.22,.7,.2,1) 460ms both; /* ds-allow — Notes first-capture line settle. */
}

@keyframes fcm-root {
  0%   { opacity: 0; }
  9%   { opacity: 1; }
  74%  { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes fcm-pip-bloom {
  0%   { opacity: 0; transform: scale(0.2); }
  60%  { opacity: 1; transform: scale(1.18); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes fcm-pip-ring {
  0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 42%, transparent); }
  100% { box-shadow: 0 0 0 22px color-mix(in srgb, var(--accent) 0%, transparent); }
}
@keyframes fcm-line {
  0%   { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .fcm-root { animation: fcm-root-reduced 2400ms linear both; }
  .fcm-pip {
    animation: none;
    opacity: 1;
    box-shadow: none;
  }
  .fcm-line { animation: none; opacity: 1; }
  @keyframes fcm-root-reduced {
    0% { opacity: 0; } 6% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; }
  }
}
@media print { .fcm-root { display: none; } }
`;
