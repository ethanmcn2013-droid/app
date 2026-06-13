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

/**
 * Product order (operator-directed 2026-05-18): notes → tasks → roadmap → analytics.
 *
 * Authed labels (§1C canon): "Open timeline" / "Open tasks" / "Open notes" /
 * "Open signal" — lowercase product noun, no article form, no Title Case.
 *
 * Footer: authed → "Back to Signal Studio →" same-tab (§1F).
 *         unauthed → "Visit signalstudio.ie →" new-tab (§1F).
 */
const PRODUCTS: {
  slug: ProductSlug;
  word: string;
  tagline: string;
  url: string;
  /** App entry deep-link (authed mode). DESIGN.md §14 */
  appUrl: string;
  /** App-context label (authed mode) — IA_COHERENCE.md §1C canon. */
  appLabel: string;
}[] = [
  // Product order (operator-directed 2026-05-18): notes → tasks → roadmap → analytics
  { slug: "notes",     word: "notes",     tagline: "Capture clarity",    url: NOTES_URL,     appUrl: `${NOTES_URL}/app`,     appLabel: "Open notes" },
  { slug: "tasks",     word: "tasks",     tagline: "Execution clarity",  url: TASKS_URL,     appUrl: `${TASKS_URL}/app`,     appLabel: "Open tasks" },
  { slug: "roadmap",   word: "timeline",   tagline: "Direction clarity",  url: TIMELINE_URL,   appUrl: `${TIMELINE_URL}/app`,   appLabel: "Open timeline" },
  { slug: "analytics", word: "signal", tagline: "Attention clarity",  url: SIGNAL_URL, appUrl: `${SIGNAL_URL}/app`, appLabel: "Open signal" },
];

const INDIGO = "#4f46e5";

const PRODUCT_ORIGINS = [NOTES_URL, TASKS_URL, TIMELINE_URL, SIGNAL_URL];

/**
 * Phase 3 (instant-jump): warm a sibling product on hover/focus so the
 * same-tab jump lands already-resolved. One <link rel="prefetch"> per
 * URL, deduped. Cross-origin prefetch warms DNS/TLS + the document.
 */
function prefetchProduct(url: string) {
  if (typeof document === "undefined") return;
  if (document.head.querySelector(`link[data-suite-prefetch="${url}"]`)) return;
  const l = document.createElement("link");
  l.rel = "prefetch";
  l.href = url;
  l.as = "document";
  l.setAttribute("data-suite-prefetch", url);
  document.head.appendChild(l);
}

/**
 * Phase 3 dot-morph: the brand transition between products. The indigo
 * dot blooms over a paper field, then we navigate same-tab — the suite
 * feels like one surface re-skinning, not four apps. Pure DOM so it is
 * style-system agnostic. Reduced-motion + modifier clicks skip this at
 * the call site (normal same-tab nav). ~380ms, then location.href.
 */
function suiteJump(url: string) {
  if (typeof document === "undefined") {
    window.location.href = url;
    return;
  }
  const overlay = document.createElement("div");
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:#ffffff;opacity:0;" +
    "transition:opacity 260ms cubic-bezier(.32,0,.67,1);display:flex;" +
    "align-items:center;justify-content:center;pointer-events:none";
  const dot = document.createElement("div");
  dot.style.cssText =
    `width:9px;height:9px;border-radius:50%;background:${INDIGO};` +
    "transform:scale(1);transition:transform 360ms cubic-bezier(.32,0,.67,1)";
  overlay.appendChild(dot);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    dot.style.transform = "scale(28)";
  });
  window.setTimeout(() => {
    window.location.href = url;
  }, 380);
}

/**
 * Suite launcher — the "signal studio." trigger that opens a product
 * switcher panel. This IS the left-slot umbrella breadcrumb in SuiteChrome
 * (P2-4 fix, IA_COHERENCE.md §3B). The static anchor that previously lived
 * in the left slot has been retired; this component replaces it.
 *
 * L3 auth-aware mode (DESIGN.md §14):
 * - isAuthed=true: deep-links to product /app entries; app-context labels.
 * - isAuthed=false (default): marketing homepage URLs + marketing taglines.
 */
export function SuiteLauncher({
  current,
  isAuthed = false,
}: {
  current: ProductSlug;
  isAuthed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
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

  // Phase 3 (instant-jump): on open, preconnect every sibling origin so
  // the first cross-product hop has a warm TLS connection ready.
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    for (const origin of PRODUCT_ORIGINS) {
      if (
        document.head.querySelector(`link[data-suite-preconnect="${origin}"]`)
      )
        continue;
      const l = document.createElement("link");
      l.rel = "preconnect";
      l.href = origin;
      l.crossOrigin = "";
      l.setAttribute("data-suite-preconnect", origin);
      document.head.appendChild(l);
    }
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open Signal Studio launcher"
        className="flex-shrink-0 cursor-pointer text-[12px] font-normal tracking-[-0.01em] text-ink-quiet transition-colors hover:text-ink"
      >
        signal studio<span style={{ color: INDIGO }}>.</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 w-[280px] overflow-hidden rounded-xl border border-line-soft bg-white shadow-[0_24px_60px_-24px_rgba(20,21,26,0.22)]"
        >
          {/* Popover header — §1E canon: "Signal Studio" / "Four products, one studio." No auth-state branch. */}
          <div className="border-b border-line-soft/70 px-3.5 py-2.5">
            <div className="text-[11px] font-medium tracking-[-0.005em] text-ink-soft">
              Signal Studio
            </div>
            <div className="mt-0.5 text-[10.5px] text-ink-quiet">
              Four products, one studio.
            </div>
          </div>
          <ul className="p-1">
            {PRODUCTS.map((p) => {
              const isCurrent = p.slug === current;
              // L3 auth-aware: authed users get /app deep-links (DESIGN.md §14)
              const href = isAuthed ? p.appUrl : p.url;
              const sublabel = isAuthed ? p.appLabel : p.tagline;
              return (
                <li key={p.slug}>
                  <a
                    href={href}
                    onMouseEnter={
                      isCurrent ? undefined : () => prefetchProduct(href)
                    }
                    onFocus={
                      isCurrent ? undefined : () => prefetchProduct(href)
                    }
                    aria-current={isCurrent ? "true" : undefined}
                    role="menuitem"
                    onClick={(e) => {
                      setOpen(false);
                      if (isCurrent) return;
                      if (
                        e.metaKey ||
                        e.ctrlKey ||
                        e.shiftKey ||
                        e.altKey ||
                        window.matchMedia("(prefers-reduced-motion: reduce)")
                          .matches
                      )
                        return;
                      e.preventDefault();
                      suiteJump(href);
                    }}
                    className={
                      "group flex items-center justify-between gap-3 rounded-md px-2.5 py-2 no-underline transition-colors " +
                      (isCurrent
                        ? "bg-bg-sunken/40 text-ink-quiet"
                        : "text-ink hover:bg-bg-sunken/60")
                    }
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold tracking-[-0.01em]">
                        {p.word}
                        <span style={{ color: INDIGO }}>·</span>
                      </div>
                      <div className="text-[11px] font-normal text-ink-quiet">
                        {sublabel}
                      </div>
                    </div>
                    {isCurrent ? (
                      <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                        here
                      </span>
                    ) : (
                      <span className="text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M7 17L17 7M17 7H8M17 7v9" />
                        </svg>
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
          {/* Footer — §1F canon: authed same-tab, unauthed new-tab. */}
          <a
            href={STUDIO_URL}
            target={isAuthed ? undefined : "_blank"}
            rel={isAuthed ? undefined : "noopener noreferrer"}
            onClick={() => setOpen(false)}
            className="block border-t border-line-soft/70 px-3.5 py-2.5 text-[11px] text-ink-quiet no-underline transition-colors hover:bg-bg-sunken/40 hover:text-ink"
          >
            {isAuthed ? "Back to Signal Studio →" : "Visit signalstudio.ie →"}
          </a>
        </div>
      ) : null}
    </div>
  );
}
