"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * DevBanner, a subtle, premium "in development" marker.
 *
 * Renders only outside production (access-mode demo / review / development),
 * decided client-side from NEXT_PUBLIC_SIGNAL_ACCESS_MODE so it never ships to
 * a production build. Deliberately not a warning bar: a single low-contrast
 * pill, bottom-centre, dismissible for the session. Reads as designed, not
 * bolted on.
 *
 * Copy is configurable via NEXT_PUBLIC_DEV_BANNER_TEXT; the default says the
 * same thing the old suite line said ("private preview with staged access")
 * in the words the reader would use. It is the first copy every preview user
 * meets and it sits on every screenshot, so it speaks like the product.
 *
 * At mobile widths the app docks a product rail at the foot of the viewport,
 * so the pill measures that rail (marked `data-signal-bottom-nav`) and lifts
 * clear of it. Where no rail is docked it keeps its bottom-centre resting
 * position, offset by the safe area.
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

const DISMISS_KEY = "signal-tasks.devbanner_dismissed";

/** Marker set by the mobile rails that own the foot of the viewport. */
const BOTTOM_NAV_SELECTOR = "[data-signal-bottom-nav]";

/**
 * How far the pill must rise to clear whatever sits at the foot of the
 * viewport. Returns the height of the bottom rail's overlap with the viewport
 * bottom (safe-area padding included, since it is inside the rail's own box),
 * or 0 when nothing is docked there — desktop and marketing routes.
 */
function measureBottomRail(): number {
  const rail = document.querySelector(BOTTOM_NAV_SELECTOR);
  if (!rail) return 0;
  const rect = rail.getBoundingClientRect();
  if (rect.height === 0) return 0;
  const overlap = window.innerHeight - rect.top;
  return overlap > 0 ? Math.round(overlap) : 0;
}

export function DevBanner() {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const [hidden, setHidden] = useState(() => {
    if (!bannerEnabled() || typeof sessionStorage === "undefined") return true;
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  // The pill is fixed to the viewport, but below md the app docks a product
  // rail at the foot of it. Measure that rail (it is a sibling subtree, so CSS
  // alone cannot see it) and lift the pill clear rather than sitting on top of
  // the Notes/Tasks/Timeline/Signal tabs. Re-measures on navigation, because
  // which rail renders — or whether one renders at all — is route-dependent.
  const [railHeight, setRailHeight] = useState(0);
  const measuring = hydrated && !hidden;

  useEffect(() => {
    if (!measuring) return undefined;

    const sync = () => setRailHeight(measureBottomRail());
    sync();
    // The rail can mount a frame after this effect runs (route transitions,
    // suspense boundaries resolving), so take a second reading next frame.
    const frame = requestAnimationFrame(sync);

    const rail = document.querySelector(BOTTOM_NAV_SELECTOR);
    const observer = new ResizeObserver(sync);
    if (rail) observer.observe(rail);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [measuring, pathname]);

  if (!hydrated || hidden) return null;

  const text =
    process.env.NEXT_PUBLIC_DEV_BANNER_TEXT ??
    "In development. You’re seeing it early.";

  return (
    <div
      className="signal-devbanner"
      role="status"
      aria-live="polite"
      data-lifted={railHeight > 0 ? "true" : undefined}
      style={
        railHeight > 0
          ? ({ "--signal-devbanner-lift": `${railHeight}px` } as React.CSSProperties)
          : undefined
      }
    >
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
        &times;
      </button>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.signal-devbanner {
  position: fixed;
  left: 50%;
  bottom: calc(18px + env(safe-area-inset-bottom));
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
  pointer-events: none;
  color: var(--ink-soft, #52525b);
  background: color-mix(in srgb, var(--bg, #fff) 86%, transparent);
  border: 1px solid color-mix(in srgb, var(--ink, #14110b) 12%, transparent);
  box-shadow: 0 6px 24px rgba(20, 17, 11, 0.10), 0 1px 2px rgba(20, 17, 11, 0.05);
  backdrop-filter: blur(10px) saturate(1.1);
  -webkit-backdrop-filter: blur(10px) saturate(1.1);
  animation: signal-devbanner-in 420ms cubic-bezier(.22,.7,.2,1) both;
}
/* A product rail is docked at the foot of the viewport (mobile widths). Sit
   above it instead of over the tabs. The measured lift already contains the
   rail's own safe-area padding, so it is not added again here. */
.signal-devbanner[data-lifted="true"] {
  bottom: calc(var(--signal-devbanner-lift, 0px) + 12px);
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
  pointer-events: auto;
  font-size: 16px;
  line-height: 1;
  padding: 2px 4px;
  margin-left: 2px;
  border-radius: 6px;
  color: var(--ink-faint, #71717a);
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
/* Below md the app shows a bottom navigation bar; the pill sits above
   it instead of covering the tabs. */
@media (max-width: 767px) {
  .signal-devbanner {
    bottom: calc(76px + env(safe-area-inset-bottom));
  }
}
@media print { .signal-devbanner { display: none; } }
`;
