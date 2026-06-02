"use client";

import { useEffect } from "react";
import {
  NOTES_URL,
  TASKS_URL,
  ROADMAP_URL,
  ANALYTICS_URL,
} from "@/lib/product-urls";

type Slug = "notes" | "tasks" | "roadmap" | "analytics";

/**
 * Cross-product pivot — the intended workflow order (operator-directed
 * 2026-05-18): notes → tasks → roadmap → analytics. Capture → execute →
 * plan → measure. Endpoints are terminal (no wrap): notes has no back,
 * analytics has no forward.
 *
 * Ghost edge chevrons: ~25% opacity at rest, rise to full and reveal the
 * destination wordmark on hover/focus. Neighbour is prefetched on intent.
 * Desktop keyboard ←/→ mirror the arrows (suppressed in form fields).
 * Hidden below the suite breakpoint — the SuiteLauncher covers mobile
 * cross-navigation, and edge-anchored controls fight thumb-scroll there.
 *
 * Each jump is a real cross-subdomain navigation; the prefetch hint keeps
 * it feeling instant on the dominant (warm-cache) path.
 */
const ORDER: { slug: Slug; word: string; url: string }[] = [
  { slug: "notes", word: "notes", url: NOTES_URL },
  { slug: "tasks", word: "tasks", url: TASKS_URL },
  { slug: "roadmap", word: "roadmap", url: ROADMAP_URL },
  { slug: "analytics", word: "analytics", url: ANALYTICS_URL },
];

function prefetch(url: string) {
  if (typeof document === "undefined") return;
  if (document.head.querySelector(`link[data-suite-prefetch="${url}"]`)) return;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = url;
  link.setAttribute("data-suite-prefetch", url);
  document.head.appendChild(link);
}

function SuiteArrow({
  dir,
  word,
  url,
}: {
  dir: "prev" | "next";
  word: string;
  url: string;
}) {
  const isNext = dir === "next";
  return (
    <a
      href={url}
      className={`sa-arrow sa-${dir}`}
      aria-label={`${isNext ? "Next" : "Previous"} product: ${word}`}
      onMouseEnter={() => prefetch(url)}
      onFocus={() => prefetch(url)}
      onPointerDown={() => prefetch(url)}
    >
      {isNext && (
        <span className="sa-label" aria-hidden>
          {word}
          <span className="sa-dot" />
        </span>
      )}
      <span className="sa-chev" aria-hidden>
        {isNext ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        )}
      </span>
      {!isNext && (
        <span className="sa-label" aria-hidden>
          <span className="sa-dot" />
          {word}
        </span>
      )}
    </a>
  );
}

export function SuiteArrows({ current }: { current: Slug }) {
  const idx = ORDER.findIndex((p) => p.slug === current);
  const prev = idx > 0 ? ORDER[idx - 1] : null;
  const next = idx >= 0 && idx < ORDER.length - 1 ? ORDER[idx + 1] : null;

  useEffect(() => {
    if (!prev && !next) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.isContentEditable ||
          /^(input|textarea|select)$/i.test(t.tagName))
      ) {
        return;
      }
      if (e.key === "ArrowLeft" && prev) window.location.href = prev.url;
      if (e.key === "ArrowRight" && next) window.location.href = next.url;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  if (!prev && !next) return null;

  return (
    <>
      {prev && <SuiteArrow dir="prev" word={prev.word} url={prev.url} />}
      {next && <SuiteArrow dir="next" word={next.word} url={next.url} />}
      <style>{CSS}</style>
    </>
  );
}

const CSS = `
.sa-arrow {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  z-index: 30;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 14px;
  color: var(--ink, #111);
  text-decoration: none;
  opacity: 0.24;
  transition: opacity 220ms cubic-bezier(.22,.7,.2,1);
  -webkit-tap-highlight-color: transparent;
}
.sa-prev { left: 6px; }
.sa-next { right: 6px; }
.sa-arrow:hover,
.sa-arrow:focus-visible { opacity: 1; outline: none; }
.sa-chev {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
}
.sa-label {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  max-width: 0;
  overflow: hidden;
  white-space: nowrap;
  opacity: 0;
  font-family: var(--font-geist), "Geist", system-ui, sans-serif;
  font-weight: 500;
  font-size: 15px;
  letter-spacing: -0.025em;
  transition: max-width 280ms cubic-bezier(.22,.7,.2,1), opacity 200ms ease;
}
.sa-arrow:hover .sa-label,
.sa-arrow:focus-visible .sa-label {
  max-width: 160px;
  opacity: 1;
}
.sa-dot {
  align-self: flex-end;
  width: 5px;
  height: 5px;
  margin: 0 0 3px 1px;
  border-radius: 50%;
  background: #4f46e5;
  flex: 0 0 auto;
  display: inline-block;
}
@media (max-width: 860px) { .sa-arrow { display: none; } }
@media (prefers-reduced-motion: reduce) {
  .sa-arrow, .sa-label { transition: none; }
}
`;
