"use client";

import { useRouter } from "next/navigation";

/**
 * TemplatePills — audience filter for /templates surfaces.
 *
 * Canonical (DESIGN.md §15, 2026-05-22). Byte-portable: this file is the
 * source of truth for the same primitive in studio + tasks. Copy
 * byte-identical, swap only the pills/current/depthLabel the parent passes.
 *
 * What it is — a quiet text-pill row that filters templates by audience.
 * The active pill carries the indigo 9%-wash background, a leading indigo
 * dot, and font-weight 600. Inactive pills are ink-faint, hover to ink.
 *
 * What it is NOT — a "switch wedge" device. Wedding is the default and
 * the row sits BELOW the page hero on every surface. Strategy guardrail
 * (segment canon, 2026-05-16): pills are a templates filter, not an
 * audience-wedge switcher. Students stay out of the main pill row;
 * surfaces link to /for-students from below the grid.
 *
 * Order is wedge-canon when audience pills are used: Wedding → Trades →
 * Freelance → Marketing. Tasks may prepend an "all" pill (defaultId="all").
 * Studio uses defaultId="wedding".
 *
 * Motion contract — the canonical SuiteSwitcher uses fade-on-active, not
 * a sliding ink pill. We mirror that restraint here. The research had a
 * sliding-pill recommendation; we deliberately depart from it to stay
 * byte-portable + scoped-CSS + zero-library. The dot's opacity is the
 * one motion: 180ms fade. Background colour: 140ms fade. Reduced-motion
 * users get instant swap.
 *
 * Accessibility — `<nav aria-label>`, `aria-current="page"` on active,
 * real `<a>` hrefs so the row works without JS (deep-link
 * `/templates?audience=trades` renders correct active state SSR).
 *
 * URL contract — `?audience=<id>`. The pill matching `defaultId` is the
 * canonical default and omits the param when active. On click,
 * `router.replace(href, { scroll: false })` for shallow update —
 * preserves scroll position so the grid fade is the only perceptible
 * change.
 */

const INDIGO = "#4f46e5";

/** Convenience type for studio. Tasks defines its own broader set. */
export type TemplateAudience = "wedding" | "trades" | "freelance" | "marketing";

export type TemplatePill = {
  /** URL value for `?audience=`. The pill matching `defaultId` omits this from the URL. */
  id: string;
  label: string;
  count: number;
};

const SCOPED_CSS = `
.tpills-shell{display:flex;flex-direction:column;gap:6px;min-width:0}
.tpills-row{display:flex;align-items:center;gap:4px;min-width:0;
 overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;
 scroll-snap-type:x proximity;margin:0 -4px;padding:0 4px;
 -webkit-mask-image:linear-gradient(to right,#000 0,#000 calc(100% - 32px),transparent);
 mask-image:linear-gradient(to right,#000 0,#000 calc(100% - 32px),transparent)}
@media (min-width:700px){.tpills-row{-webkit-mask-image:none;mask-image:none}}
.tpills-row::-webkit-scrollbar{display:none}
.tpills-pill{flex-shrink:0;scroll-snap-align:start;
 display:inline-flex;align-items:center;
 border:0;background:transparent;border-radius:9999px;
 padding:6px 14px;font-size:13.5px;letter-spacing:-0.01em;
 text-decoration:none;cursor:pointer;font-family:inherit;
 transition:color 140ms ease,background-color 140ms ease;
 white-space:nowrap;line-height:1.4;color:var(--ink-faint,#71717a);
 font-weight:400}
.tpills-pill:hover{color:var(--ink,#111111);
 background:color-mix(in srgb,var(--ink,#111111) 5%,transparent)}
.tpills-pill:focus-visible{outline:2px solid ${INDIGO};outline-offset:2px}
.tpills-pill--current{color:var(--ink,#111111);font-weight:600;
 background:color-mix(in srgb,${INDIGO} 9%,transparent);cursor:default}
.tpills-pill--current:hover{
 background:color-mix(in srgb,${INDIGO} 9%,transparent)}
.tpills-dot{display:inline-block;width:5px;height:5px;border-radius:50%;
 background:${INDIGO};margin-right:7px;
 opacity:0;transition:opacity 180ms ease}
.tpills-pill--current .tpills-dot{opacity:1}
.tpills-count{margin-left:7px;color:var(--ink-ghost,#d4d4d8);font-weight:400;
 font-variant-numeric:tabular-nums;font-size:11.5px}
.tpills-pill:hover .tpills-count{color:var(--ink-faint,#71717a)}
.tpills-pill--current .tpills-count{
 color:color-mix(in srgb,${INDIGO} 55%,var(--ink-faint,#71717a))}
.tpills-depth{font-size:12px;color:var(--ink-faint,#71717a);
 letter-spacing:-0.005em;padding:0 2px;font-variant-numeric:tabular-nums}
@media (prefers-reduced-motion: reduce){
 .tpills-pill,.tpills-dot{transition:none}
}
`;

export function TemplatePills({
  pills,
  current,
  basePath = "/templates",
  defaultId = "wedding",
  depthLabel,
}: {
  pills: TemplatePill[];
  current: string;
  /** Pathname the audience param is layered onto. Defaults to /templates. */
  basePath?: string;
  /** The id whose pill renders without a URL param (the page default). */
  defaultId?: string;
  /** Honest count signal below the row, e.g. "47 wedding templates". */
  depthLabel?: string;
}) {
  const router = useRouter();

  const buildHref = (id: string) =>
    id === defaultId ? basePath : `${basePath}?audience=${id}`;

  return (
    <div className="tpills-shell">
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />
      <nav aria-label="Filter templates by audience" className="tpills-row">
        {pills.map((p) => {
          const isCurrent = p.id === current;
          if (isCurrent) {
            return (
              <span
                key={p.id}
                aria-current="page"
                tabIndex={0}
                className="tpills-pill tpills-pill--current"
              >
                <span aria-hidden className="tpills-dot" />
                {p.label}
                <span
                  className="tpills-count"
                  aria-label={`${p.count} templates, currently selected`}
                >
                  {p.count}
                </span>
              </span>
            );
          }
          const href = buildHref(p.id);
          return (
            <a
              key={p.id}
              href={href}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                router.replace(href, { scroll: false });
              }}
              className="tpills-pill"
              aria-label={`${p.label} — ${p.count} templates`}
            >
              {p.label}
              <span className="tpills-count" aria-hidden>
                {p.count}
              </span>
            </a>
          );
        })}
      </nav>
      {depthLabel ? (
        <span aria-live="polite" aria-atomic="true" className="tpills-depth">
          {depthLabel}
        </span>
      ) : null}
    </div>
  );
}
