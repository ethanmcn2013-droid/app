"use client";

import { useEffect, useRef, useState } from "react";
import {
  ANALYTICS_URL,
  NOTES_URL,
  ROADMAP_URL,
  STUDIO_URL,
  TASKS_URL,
} from "@/lib/product-urls";

type ProductSlug = "tasks" | "roadmap" | "notes" | "analytics";

const PRODUCTS: {
  slug: ProductSlug;
  word: string;
  tagline: string;
  url: string;
}[] = [
  { slug: "tasks", word: "tasks", tagline: "Execution clarity", url: TASKS_URL },
  { slug: "roadmap", word: "roadmap", tagline: "Direction clarity", url: ROADMAP_URL },
  { slug: "notes", word: "notes", tagline: "Capture clarity", url: NOTES_URL },
  { slug: "analytics", word: "analytics", tagline: "Attention clarity", url: ANALYTICS_URL },
];

const INDIGO = "#4f46e5";

/**
 * Suite launcher. Replaces the static `signal studio.` breadcrumb anchor
 * with a click-to-open popover listing all four products. Same trigger
 * type/colour as the prior anchor — discovery is via cursor + click, not
 * an extra caret. Current product is shown but de-emphasised with a
 * "here" tag; other products open in a new tab so the user keeps their
 * current workspace.
 */
export function SuiteLauncher({ current }: { current: ProductSlug }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
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
              return (
                <li key={p.slug}>
                  <a
                    href={p.url}
                    target={isCurrent ? undefined : "_blank"}
                    rel={isCurrent ? undefined : "noopener noreferrer"}
                    aria-current={isCurrent ? "true" : undefined}
                    role="menuitem"
                    onClick={() => setOpen(false)}
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
                        {p.tagline}
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
          <a
            href={STUDIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block border-t border-line-soft/70 px-3.5 py-2.5 text-[11px] text-ink-quiet no-underline transition-colors hover:bg-bg-sunken/40 hover:text-ink"
          >
            Visit signalstudio.ie →
          </a>
        </div>
      ) : null}
    </div>
  );
}
