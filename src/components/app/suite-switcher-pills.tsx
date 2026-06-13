"use client";

import { useEffect } from "react";

/**
 * SuiteSwitcher — canonical always-visible 4-product pill switcher.
 *
 * CANONICAL SOURCE for all five repos (DESIGN.md §14, amended 2026-05-19).
 * Copy byte-identical into each repo at the path that repo's app chrome
 * imports. The ONLY value that differs per repo is the `current` prop the
 * parent passes. No per-product CSS, colours, or gestural differences.
 *
 * Why pills, not the SuiteLauncher popover:
 * - SuiteLauncher is the click-to-open popover behind the faint
 *   "signal studio." text trigger. Correct for the *unauthed* marketing
 *   nav (low chrome, one product in view) — it stays there.
 * - In the authed app the operator switches products constantly. A hidden
 *   text trigger is poor discoverability. This makes all four destinations
 *   visible and one click away. (Resolves the §14/D6 discoverability cost.)
 *
 * Restraint contract (BRAND "Everything important. Nothing distracting."):
 * an always-on bar is more chrome than the brand's minimalism prefers, so
 * the pills are deliberately quiet — text-only at rest, no boxes/borders,
 * ink-faint. Hover lifts to ink with a faint sunken wash. The current
 * product is the only one carrying the indigo gesture dot + active wash.
 *
 * Machinery (carried verbatim from suite-launcher.tsx):
 * - prefetch on hover/focus (instant-jump)
 * - preconnect every sibling origin on mount (warm TLS before first hop)
 * - dot-morph transition on click, same-tab navigation
 * - reduced-motion + modifier-click escape hatch → normal same-tab nav
 *
 * Portable by design: inline styles + CSS vars (hex fallbacks) + one
 * scoped <style> for :hover. No Tailwind/token dependency, so the byte
 * for byte copy works in every repo regardless of its CSS config.
 *
 * Product order (operator-directed 2026-05-18): notes → tasks → roadmap
 * → analytics. Authed deep-links land on each product's /app entry.
 */

const STUDIO_URL =
  process.env.NEXT_PUBLIC_STUDIO_URL ?? "https://signalstudio.ie";
const NOTES_URL =
  process.env.NEXT_PUBLIC_NOTES_URL ?? "https://notes.signalstudio.ie";
const TASKS_URL =
  process.env.NEXT_PUBLIC_TASKS_URL ?? "https://tasks.signalstudio.ie";
const TIMELINE_URL =
  process.env.NEXT_PUBLIC_TIMELINE_URL ?? "https://timeline.signalstudio.ie";
const SIGNAL_URL =
  process.env.NEXT_PUBLIC_SIGNAL_URL ?? "https://signal.signalstudio.ie";

const INDIGO = "#4f46e5";

type ProductSlug = "tasks" | "roadmap" | "notes" | "analytics";

const PRODUCTS: { slug: ProductSlug; word: string; appUrl: string }[] = [
  { slug: "notes", word: "notes", appUrl: `${NOTES_URL}/app` },
  { slug: "tasks", word: "tasks", appUrl: `${TASKS_URL}/app` },
  { slug: "roadmap", word: "timeline", appUrl: `${TIMELINE_URL}/app` },
  { slug: "analytics", word: "signal", appUrl: `${SIGNAL_URL}/app` },
];

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

const SCOPED_CSS = `
.suitesw-row{display:flex;align-items:center;gap:2px;min-width:0;
 overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;
 margin:0 -4px;padding:0 4px}
.suitesw-row::-webkit-scrollbar{display:none}
.suitesw-anchor{flex-shrink:0;font-size:12px;font-weight:400;
 letter-spacing:-0.01em;color:var(--ink-faint,#71717a);text-decoration:none;
 transition:color 140ms ease}
.suitesw-anchor:hover{color:var(--ink,#111111)}
.suitesw-sep{flex-shrink:0;width:1px;height:14px;
 background:var(--ink-ghost,#d4d4d8)}
.suitesw-pill{flex-shrink:0;border-radius:9999px;padding:4px 10px;
 font-size:13px;letter-spacing:-0.01em;text-decoration:none;
 transition:color 140ms ease,background-color 140ms ease;white-space:nowrap}
.suitesw-pill--link{font-weight:400;color:var(--ink-faint,#71717a)}
.suitesw-pill--link:hover{color:var(--ink,#111111);
 background:color-mix(in srgb,var(--ink,#111111) 5%,transparent)}
.suitesw-pill--current{font-weight:600;color:var(--ink,#111111);
 background:color-mix(in srgb,${INDIGO} 9%,transparent);cursor:default}
`;

export function SuiteSwitcher({
  current,
  /** Show the quiet "signal studio." umbrella anchor + divider before the
   *  pills. The chrome keeps it to exactly one instance (D6). Pass false
   *  on signalstudio.ie itself — you are already on the umbrella. */
  showUmbrella = true,
}: {
  /** The product the user is in. Omit on the umbrella launcher (no
   *  product is "current" there — every pill is an equal jump target). */
  current?: ProductSlug;
  showUmbrella?: boolean;
}) {
  // Phase 3 (instant-jump): preconnect every sibling origin on mount so
  // the first cross-product hop has a warm TLS connection ready. The
  // pills are always visible — warm eagerly, there is no "on open".
  useEffect(() => {
    if (typeof document === "undefined") return;
    for (const origin of PRODUCT_ORIGINS) {
      if (document.head.querySelector(`link[data-suite-preconnect="${origin}"]`))
        continue;
      const l = document.createElement("link");
      l.rel = "preconnect";
      l.href = origin;
      l.crossOrigin = "";
      l.setAttribute("data-suite-preconnect", origin);
      document.head.appendChild(l);
    }
  }, []);

  return (
    <nav aria-label="Signal Studio products" className="suitesw-row">
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />

      {showUmbrella ? (
        <>
          <a
            href={STUDIO_URL}
            aria-label="Signal Studio"
            className="suitesw-anchor"
            style={{ marginRight: 8 }}
          >
            signal studio
            <span aria-hidden style={{ color: INDIGO }}>
              .
            </span>
          </a>
          <span aria-hidden className="suitesw-sep" style={{ marginRight: 8 }} />
        </>
      ) : null}

      {PRODUCTS.map((p) => {
        const isCurrent = p.slug === current;
        if (isCurrent) {
          return (
            <span
              key={p.slug}
              aria-current="page"
              className="suitesw-pill suitesw-pill--current"
            >
              {p.word}
              <span aria-hidden style={{ color: INDIGO }}>
                ·
              </span>
            </span>
          );
        }
        return (
          <a
            key={p.slug}
            href={p.appUrl}
            onMouseEnter={() => prefetchProduct(p.appUrl)}
            onFocus={() => prefetchProduct(p.appUrl)}
            onClick={(e) => {
              if (
                e.metaKey ||
                e.ctrlKey ||
                e.shiftKey ||
                e.altKey ||
                window.matchMedia("(prefers-reduced-motion: reduce)").matches
              )
                return;
              e.preventDefault();
              suiteJump(p.appUrl);
            }}
            className="suitesw-pill suitesw-pill--link"
          >
            {p.word}
          </a>
        );
      })}
    </nav>
  );
}
