"use client";

import { useEffect, useState } from "react";

/**
 * DevBanner — a subtle, premium "in development" marker.
 *
 * Renders only outside production (access-mode demo / review / development),
 * decided client-side from NEXT_PUBLIC_SIGNAL_ACCESS_MODE so it never ships to
 * a production build. Deliberately not a warning bar: a single low-contrast
 * pill, bottom-centre, dismissible for the session. Reads as designed, not
 * bolted on.
 *
 * Copy is configurable via NEXT_PUBLIC_DEV_BANNER_TEXT; default mirrors the
 * suite line "In development — expected launch September 1st."
 */

function bannerEnabled(): boolean {
  const mode = (process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE ?? "").toLowerCase();
  if (mode === "demo" || mode === "review" || mode === "development") {
    return true;
  }
  if (mode === "production") return false;
  // No explicit mode set: opt-in only, via the legacy demo flag.
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

const DISMISS_KEY = "signal_devbanner_dismissed";

export function DevBanner() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (!bannerEnabled()) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* sessionStorage unavailable — show anyway */
    }
    setHidden(false);
  }, []);

  if (hidden) return null;

  const text =
    process.env.NEXT_PUBLIC_DEV_BANNER_TEXT ??
    "In development — expected launch September 1st.";

  return (
    <div className="signal-devbanner" role="status" aria-live="polite">
      <span className="signal-devbanner__dot" aria-hidden />
      <span className="signal-devbanner__text">{text}</span>
      <button
        type="button"
        className="signal-devbanner__close"
        aria-label="Hide development notice"
        onClick={() => {
          try {
            sessionStorage.setItem(DISMISS_KEY, "1");
          } catch {
            /* ignore */
          }
          setHidden(true);
        }}
      >
        ×
      </button>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.signal-devbanner {
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 60;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  max-width: calc(100vw - 24px);
  padding: 7px 10px 7px 14px;
  border-radius: 999px;
  font-family: var(--font-geist), "Geist", system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.01em;
  line-height: 1;
  color: color-mix(in srgb, var(--ink, #14110b) 78%, transparent);
  background: color-mix(in srgb, var(--bg, #fff) 86%, transparent);
  border: 1px solid color-mix(in srgb, var(--ink, #14110b) 12%, transparent);
  box-shadow: 0 6px 24px rgba(20, 17, 11, 0.10), 0 1px 2px rgba(20, 17, 11, 0.05);
  backdrop-filter: blur(10px) saturate(1.1);
  -webkit-backdrop-filter: blur(10px) saturate(1.1);
  animation: signal-devbanner-in 420ms cubic-bezier(.22,.7,.2,1) both;
}
.signal-devbanner__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
  background: var(--accent, #b8923a);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent, #b8923a) 60%, transparent);
  animation: signal-devbanner-pulse 2.6s ease-in-out infinite;
}
.signal-devbanner__text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.signal-devbanner__close {
  appearance: none;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 2px 4px;
  margin-left: 2px;
  border-radius: 6px;
  color: color-mix(in srgb, var(--ink, #14110b) 45%, transparent);
  transition: color 160ms ease, background 160ms ease;
}
.signal-devbanner__close:hover {
  color: var(--ink, #14110b);
  background: color-mix(in srgb, var(--ink, #14110b) 7%, transparent);
}
@keyframes signal-devbanner-in {
  from { opacity: 0; transform: translate(-50%, 8px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}
@keyframes signal-devbanner-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent, #b8923a) 55%, transparent); }
  50%      { box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent, #b8923a) 0%, transparent); }
}
@media (prefers-reduced-motion: reduce) {
  .signal-devbanner { animation: none; }
  .signal-devbanner__dot { animation: none; }
}
@media print { .signal-devbanner { display: none; } }
`;
