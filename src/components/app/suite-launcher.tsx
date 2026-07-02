"use client";

import { useEffect, useRef, useState } from "react";
import {
  SIGNAL_URL,
  NOTES_URL,
  TIMELINE_URL,
  STUDIO_URL,
  TASKS_URL,
} from "@/lib/product-urls";

type ProductSlug = "tasks" | "roadmap" | "notes" | "analytics";
type ProductGesture = "caret" | "pulse" | "sweep" | "tick";

interface SuiteProduct {
  slug: ProductSlug;
  word: string;
  objectLabel: string;
  clarityLine: string;
  marketingUrl: string;
  appUrl: string;
  gesture: ProductGesture;
}

const PRODUCTS: SuiteProduct[] = [
  {
    slug: "notes",
    word: "notes",
    objectLabel: "Notebook",
    clarityLine: "Capture clarity",
    marketingUrl: NOTES_URL,
    appUrl: `${NOTES_URL}/app`,
    gesture: "caret",
  },
  {
    slug: "tasks",
    word: "tasks",
    objectLabel: "Workspace",
    clarityLine: "Execution clarity",
    marketingUrl: TASKS_URL,
    appUrl: `${TASKS_URL}/app`,
    gesture: "pulse",
  },
  {
    slug: "roadmap",
    word: "timeline",
    objectLabel: "Timeline",
    clarityLine: "Direction clarity",
    marketingUrl: TIMELINE_URL,
    appUrl: `${TIMELINE_URL}/app`,
    gesture: "sweep",
  },
  {
    slug: "analytics",
    word: "signal",
    objectLabel: "Briefing",
    clarityLine: "Attention clarity",
    marketingUrl: SIGNAL_URL,
    appUrl: `${SIGNAL_URL}/app`,
    gesture: "tick",
  },
];

const INDIGO = "var(--indigo-600, var(--brand))";
const PRODUCT_ORIGINS = [NOTES_URL, TASKS_URL, TIMELINE_URL, SIGNAL_URL];

const SUITE_LAUNCHER_CSS = `
.suite-launcher-root {
  --sl-indigo: var(--color-indigo-600, var(--indigo-600, var(--brand)));
  --sl-ink: var(--color-ink, var(--ink));
  --sl-ink-soft: var(--color-ink-soft, var(--ink-soft));
  --sl-ink-quiet: var(--color-ink-quiet, var(--color-ink-faint, var(--ink-quiet)));
  --sl-ink-faint: var(--color-ink-faint, var(--ink-faint));
  --sl-paper: var(--color-paper, var(--paper, var(--bg)));
  --sl-paper-elevated: var(--color-paper, var(--paper, var(--bg-elevated, var(--bg))));
  --sl-border: var(--color-line, var(--color-line-soft, var(--border, var(--line-soft))));
  --sl-ease-out: var(--ease-out);
  --sl-ease-in-out: var(--ease-in-out, var(--ease-out));
  position: relative;
  display: inline-flex;
}
.sl-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--sl-ink-quiet);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: -0.01em;
  line-height: 1;
  padding: 5px 7px;
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
}
.sl-trigger:hover,
.sl-trigger[data-open="true"] {
  border-color: color-mix(in srgb, var(--sl-ink) 8%, transparent);
  background: color-mix(in srgb, var(--sl-indigo) 5%, transparent);
  color: var(--sl-ink);
}
.sl-trigger:active { transform: translateY(1px); }
.sl-trigger:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--sl-indigo) 42%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--sl-indigo) 14%, transparent);
}
.sl-brand-dot { color: var(--sl-indigo); }
.sl-chevron {
  color: var(--sl-ink-faint);
  transition: transform 180ms var(--sl-ease-out), color 160ms var(--sl-ease-out);
}
.sl-trigger[data-open="true"] .sl-chevron {
  color: var(--sl-indigo);
  transform: rotate(180deg);
}
.sl-pop {
  position: absolute;
  left: 0;
  top: 100%;
  z-index: 80;
  width: min(340px, calc(100vw - 32px));
  margin-top: 10px;
  overflow: hidden;
  border: 1px solid var(--sl-border);
  border-radius: 14px;
  background: var(--sl-paper);
  box-shadow:
    0 28px 70px -34px rgba(17, 17, 17, 0.38),
    0 1px 0 rgba(255, 255, 255, 0.8) inset;
  color: var(--sl-ink);
  animation: sl-pop-in 170ms var(--sl-ease-out) both;
  transform-origin: top left;
}
@keyframes sl-pop-in {
  from { opacity: 0; transform: translateY(-5px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.sl-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--sl-border) 78%, transparent);
  padding: 14px 14px 11px;
}
.sl-kicker {
  margin-bottom: 3px;
  color: var(--sl-ink-faint);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.09em;
  line-height: 1;
  text-transform: uppercase;
}
.sl-title {
  color: var(--sl-ink);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.25;
}
.sl-system-line {
  margin-top: 3px;
  color: var(--sl-ink-quiet);
  font-size: 11px;
  line-height: 1.25;
}
.sl-system-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid color-mix(in srgb, var(--sl-indigo) 18%, transparent);
  border-radius: 8px;
  color: var(--sl-indigo);
}
.sl-list {
  display: grid;
  gap: 2px;
  list-style: none;
  margin: 0;
  padding: 6px;
}
.sl-row {
  position: relative;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 64px;
  border: 1px solid transparent;
  border-radius: 10px;
  color: var(--sl-ink);
  padding: 9px 10px 9px 9px;
  text-decoration: none;
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
}
.sl-row::before {
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 2px;
  border-radius: 999px;
  background: transparent;
  content: "";
}
.sl-row:hover {
  border-color: color-mix(in srgb, var(--sl-indigo) 14%, transparent);
  background: color-mix(in srgb, var(--sl-indigo) 5%, transparent);
}
.sl-row:active { transform: translateY(1px); }
.sl-row:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--sl-indigo) 45%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--sl-indigo) 13%, transparent);
}
.sl-row[data-current="true"] {
  border-color: color-mix(in srgb, var(--sl-indigo) 18%, transparent);
  background: color-mix(in srgb, var(--sl-indigo) 7%, transparent);
}
.sl-row[data-current="true"]::before { background: var(--sl-indigo); }
.sl-gesture {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid color-mix(in srgb, var(--sl-border) 80%, transparent);
  border-radius: 9px;
  background: color-mix(in srgb, var(--sl-paper-elevated) 82%, var(--sl-paper));
  color: var(--sl-indigo);
  transition: border-color 160ms ease, background 160ms ease;
}
.sl-row:hover .sl-gesture,
.sl-row[data-current="true"] .sl-gesture {
  border-color: color-mix(in srgb, var(--sl-indigo) 20%, transparent);
  background: color-mix(in srgb, var(--sl-indigo) 6%, var(--sl-paper));
}
.sl-wordline {
  display: flex;
  align-items: baseline;
  gap: 7px;
  min-width: 0;
}
.sl-word {
  color: var(--sl-ink);
  font-size: 13.5px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.1;
}
.sl-object {
  color: var(--sl-ink-quiet);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.1;
}
.sl-clarity {
  margin-top: 4px;
  color: var(--sl-ink-quiet);
  font-size: 11px;
  line-height: 1.25;
}
.sl-status {
  color: var(--sl-ink-faint);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.13em;
  line-height: 1;
  text-transform: uppercase;
  transition: color 160ms ease, opacity 160ms ease;
}
.sl-row:not([data-current="true"]) .sl-status { opacity: 0.44; }
.sl-row:not([data-current="true"]):hover .sl-status {
  color: var(--sl-indigo);
  opacity: 1;
}
.sl-row[data-current="true"] .sl-status { color: var(--sl-indigo); }
.sl-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid color-mix(in srgb, var(--sl-border) 78%, transparent);
  color: var(--sl-ink-quiet);
  font-size: 11px;
  padding: 11px 14px;
  text-decoration: none;
  transition: background 160ms ease, color 160ms ease;
}
.sl-footer:hover {
  background: color-mix(in srgb, var(--sl-ink) 4%, transparent);
  color: var(--sl-ink);
}
.sl-footer:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--sl-indigo) 13%, transparent) inset;
}
.sl-caret { animation: sl-caret-blink 1.15s steps(1, end) infinite; }
@keyframes sl-caret-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
.sl-pulse-dot { transform-box: fill-box; transform-origin: center; }
.sl-pulse-dot-1 { animation: sl-pulse 2.8s ease-in-out infinite 0s; }
.sl-pulse-dot-2 { animation: sl-pulse 2.8s ease-in-out infinite .38s; }
.sl-pulse-dot-3 { animation: sl-pulse 2.8s ease-in-out infinite .76s; }
@keyframes sl-pulse {
  0%, 32%, 100% { transform: scale(1); }
  12% { transform: scale(1.24); }
  22% { transform: scale(1); }
}
.sl-sweep-dot {
  transform-box: fill-box;
  transform-origin: center;
  animation: sl-sweep 4.8s var(--sl-ease-in-out) infinite;
}
@keyframes sl-sweep {
  0% { opacity: 1; transform: translateX(0); }
  58% { opacity: 1; transform: translateX(23px); }
  62% { opacity: 0; transform: translateX(23px); }
  72% { opacity: 0; transform: translateX(0); }
  82%, 100% { opacity: 1; transform: translateX(0); }
}
.sl-bar { transform-box: fill-box; transform-origin: bottom; }
.sl-bar-1 { animation: sl-bar-one 3.4s steps(1, end) infinite; }
.sl-bar-2 { animation: sl-bar-two 3.4s steps(1, end) infinite .45s; }
.sl-bar-3 { animation: sl-bar-three 3.4s steps(1, end) infinite .9s; }
@keyframes sl-bar-one {
  0% { transform: scaleY(.55); } 33% { transform: scaleY(.9); } 66% { transform: scaleY(.42); }
}
@keyframes sl-bar-two {
  0% { transform: scaleY(.88); } 33% { transform: scaleY(.5); } 66% { transform: scaleY(1); }
}
@keyframes sl-bar-three {
  0% { transform: scaleY(.45); } 33% { transform: scaleY(.78); } 66% { transform: scaleY(.58); }
}
@media (prefers-reduced-motion: reduce) {
  .sl-trigger,
  .sl-chevron,
  .sl-pop,
  .sl-row,
  .sl-status,
  .sl-footer,
  .sl-gesture {
    animation: none !important;
    transition: none !important;
  }
  .sl-caret,
  .sl-pulse-dot,
  .sl-sweep-dot,
  .sl-bar {
    animation: none !important;
  }
  .sl-caret { opacity: 1; }
  .sl-sweep-dot { transform: none; }
  .sl-bar { transform: scaleY(.7); }
}
`;

function prefetchProduct(url: string) {
  if (typeof document === "undefined") return;
  if (document.head.querySelector(`link[data-suite-prefetch="${url}"]`)) return;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = url;
  link.as = "document";
  link.setAttribute("data-suite-prefetch", url);
  document.head.appendChild(link);
}

function suiteJump(url: string) {
  if (typeof window === "undefined") return;
  if (typeof document === "undefined") {
    window.location.href = url;
    return;
  }
  const overlay = document.createElement("div");
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:var(--paper,var(--bg));opacity:0;" +
    "transition:opacity 260ms var(--ease-in-out,var(--ease-out));display:flex;" +
    "align-items:center;justify-content:center;pointer-events:none";
  const dot = document.createElement("div");
  dot.style.cssText =
    `width:9px;height:9px;border-radius:50%;background:${INDIGO};` +
    "transform:scale(1);transition:transform 360ms var(--ease-in-out,var(--ease-out))";
  overlay.appendChild(dot);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    dot.style.transform = "scale(28)";
  });
  // <=120ms: the press acknowledges, the destination owns the wait.
  window.setTimeout(() => {
    window.location.href = url;
  }, 120);
}

function shouldUsePlainNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}

function GestureMark({ gesture }: { gesture: ProductGesture }) {
  if (gesture === "caret") {
    return (
      <svg width="28" height="22" viewBox="0 0 28 22" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="1.5" rx="0.75" fill="currentColor" opacity="0.22" />
        <rect x="3" y="10" width="22" height="1.5" rx="0.75" fill="currentColor" opacity="0.16" />
        <rect x="3" y="15" width="13" height="1.5" rx="0.75" fill="currentColor" opacity="0.16" />
        <rect className="sl-caret" x="17" y="13" width="1.4" height="6" rx="0.7" fill="currentColor" />
      </svg>
    );
  }

  if (gesture === "pulse") {
    return (
      <svg width="28" height="22" viewBox="0 0 28 22" fill="none" aria-hidden>
        <circle className="sl-pulse-dot sl-pulse-dot-1" cx="5" cy="6" r="2.5" fill="currentColor" />
        <rect x="11" y="5.25" width="13" height="1.5" rx="0.75" fill="currentColor" opacity="0.18" />
        <circle className="sl-pulse-dot sl-pulse-dot-2" cx="5" cy="11" r="2.5" fill="currentColor" />
        <rect x="11" y="10.25" width="10" height="1.5" rx="0.75" fill="currentColor" opacity="0.18" />
        <circle className="sl-pulse-dot sl-pulse-dot-3" cx="5" cy="16" r="2.5" fill="currentColor" />
        <rect x="11" y="15.25" width="15" height="1.5" rx="0.75" fill="currentColor" opacity="0.18" />
      </svg>
    );
  }

  if (gesture === "sweep") {
    return (
      <svg width="28" height="22" viewBox="0 0 28 22" fill="none" aria-hidden>
        <rect x="3" y="11" width="22" height="1.4" rx="0.7" fill="currentColor" opacity="0.16" />
        <rect x="3" y="7" width="1.4" height="8" rx="0.7" fill="currentColor" opacity="0.24" />
        <rect x="13" y="7" width="1.4" height="8" rx="0.7" fill="currentColor" opacity="0.24" />
        <rect x="24" y="7" width="1.4" height="8" rx="0.7" fill="currentColor" opacity="0.24" />
        <circle className="sl-sweep-dot" cx="3.8" cy="11.7" r="3" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg width="28" height="22" viewBox="0 0 28 22" fill="none" aria-hidden>
      <rect className="sl-bar sl-bar-1" x="5" y="7" width="3" height="10" rx="1.5" fill="currentColor" opacity="0.34" />
      <rect className="sl-bar sl-bar-2" x="12" y="4" width="3" height="13" rx="1.5" fill="currentColor" opacity="0.72" />
      <rect className="sl-bar sl-bar-3" x="19" y="9" width="3" height="8" rx="1.5" fill="currentColor" opacity="0.48" />
    </svg>
  );
}

export function SuiteLauncher({
  current,
  isAuthed,
}: {
  current: ProductSlug;
  isAuthed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isSignedIn = Boolean(isAuthed);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    for (const origin of PRODUCT_ORIGINS) {
      if (document.head.querySelector(`link[data-suite-preconnect="${origin}"]`)) {
        continue;
      }
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = origin;
      link.crossOrigin = "";
      link.setAttribute("data-suite-preconnect", origin);
      document.head.appendChild(link);
    }
  }, [open]);

  return (
    <div ref={wrapRef} className="suite-launcher-root">
      <style>{SUITE_LAUNCHER_CSS}</style>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open Signal Studio launcher"
        className="sl-trigger"
        data-open={open ? "true" : undefined}
      >
        <span>
          signal studio<span className="sl-brand-dot">.</span>
        </span>
        <svg className="sl-chevron" width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M3.25 4.75 6 7.5l2.75-2.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div role="menu" className="sl-pop">
          <div className="sl-header">
            <div>
              <div className="sl-kicker">Switch product</div>
              <div className="sl-title">Signal Studio</div>
              <div className="sl-system-line">Four products, one system.</div>
            </div>
            <div className="sl-system-mark" aria-hidden>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="2.5" fill="currentColor" />
                <path d="M6.5 1.5v1.7M6.5 9.8v1.7M1.5 6.5h1.7M9.8 6.5h1.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
              </svg>
            </div>
          </div>
          <ul className="sl-list">
            {PRODUCTS.map((product) => {
              const isCurrent = product.slug === current;
              const href = isSignedIn ? product.appUrl : product.marketingUrl;
              return (
                <li key={product.slug}>
                  <a
                    href={href}
                    onMouseEnter={isCurrent ? undefined : () => prefetchProduct(href)}
                    onFocus={isCurrent ? undefined : () => prefetchProduct(href)}
                    aria-current={isCurrent ? "page" : undefined}
                    role="menuitem"
                    className="sl-row"
                    data-current={isCurrent ? "true" : undefined}
                    onClick={(event) => {
                      setOpen(false);
                      if (isCurrent || shouldUsePlainNavigation(event)) return;
                      event.preventDefault();
                      suiteJump(href);
                    }}
                  >
                    <span className="sl-gesture">
                      <GestureMark gesture={product.gesture} />
                    </span>
                    <span>
                      <span className="sl-wordline">
                        <span className="sl-word">
                          {product.word}
                          <span className="sl-brand-dot">.</span>
                        </span>
                        <span className="sl-object">{product.objectLabel}</span>
                      </span>
                      <span className="sl-clarity">{product.clarityLine}</span>
                    </span>
                    <span className="sl-status">{isCurrent ? "Here" : "Open"}</span>
                  </a>
                </li>
              );
            })}
          </ul>
          <a
            href={STUDIO_URL}
            target={isSignedIn ? undefined : "_blank"}
            rel={isSignedIn ? undefined : "noopener noreferrer"}
            onClick={() => setOpen(false)}
            className="sl-footer"
          >
            <span>{isSignedIn ? "Back to Signal Studio" : "Visit signalstudio.ie"}</span>
          </a>
        </div>
      ) : null}
    </div>
  );
}
