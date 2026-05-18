/**
 * Persistent top chrome — L4 seamless ecosystem (DESIGN.md §14).
 *
 * Byte-identical geometry across all five products so a cross-product
 * jump swaps only the body; the chrome appears not to move.
 *
 * Perceived continuity, not a true SPA — hard document navigation still
 * occurs between subdomains. Monorepo + DB-merge ruled out by locked
 * decisions.
 *
 * Layout (P2-4 fix — IA_COHERENCE.md §3B canon):
 *   Left  — SuiteLauncher (IS the "signal studio." trigger) + / + tasks
 *   Right — UserButtonWithSuite only
 *
 * "signal studio." appears exactly ONCE in this header. The static anchor
 * that was the left wordmark has been replaced by the SuiteLauncher trigger —
 * matching the Notes/Roadmap pattern and resolving the Tasks outlier (D6).
 *
 * Height: h-14 (56px). Sticky top-0 z-40. backdrop-blur-md.
 * Background: bg semi-transparent (uses Tailwind; matches SiteNav).
 * Hairline border-b on scroll (JS-driven class toggle).
 * Max-width: 80rem (matches §4 app content width), px-6.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { SuiteLauncher } from "@/components/app/suite-launcher";
import { UserButtonWithSuite } from "@/components/app/user-button-with-suite";
import { Wordmark } from "@/components/brand/wordmark";

export function SuiteChrome() {
  // Hairline border-b on scroll — transparent at rest
  const [scrolled, setScrolled] = useState(false);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    function onScroll() {
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 2);
        frameRef.current = null;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <header
      className={
        "sticky top-0 z-40 backdrop-blur-md transition-[border-color] duration-150 " +
        "bg-white/85 " +
        (scrolled
          ? "border-b border-[var(--line-soft,#e4e4e7)]"
          : "border-b border-transparent")
      }
    >
      <div className="mx-auto flex h-14 w-full max-w-[80rem] items-center justify-between px-6">
        {/*
         * Left slot — IA_COHERENCE.md §3B canon:
         *   [SuiteLauncher] [/] [product-mark]
         *
         * The SuiteLauncher IS the "signal studio." trigger — clicking it
         * opens the product switcher panel. There is no separate static
         * anchor. "signal studio." appears exactly once in this header.
         */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Umbrella trigger — SuiteLauncher in authed mode */}
          <SuiteLauncher current="tasks" isAuthed={true} />

          {/* Separator */}
          <span
            aria-hidden
            className="flex-shrink-0 select-none text-[12px] text-[var(--ink-ghost,#d4d4d8)]"
          >
            /
          </span>

          {/* Product mark — tasks· with its gesture dot */}
          <Wordmark size="sm" />
        </div>

        {/*
         * Right slot — UserButtonWithSuite only.
         * The SuiteLauncher is in the LEFT slot; no second instance here.
         * This matches the Notes/Roadmap/Analytics pattern.
         */}
        <div className="flex items-center gap-3">
          <UserButtonWithSuite current="tasks" />
        </div>
      </div>
    </header>
  );
}
