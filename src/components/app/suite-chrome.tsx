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
 * Layout:
 *   Left  — signal studio. (umbrella wordmark → signalstudio.ie) + / + tasks
 *   Right — Products switcher (SuiteLauncher, authed mode) + UserButton
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
import { STUDIO_URL } from "@/lib/product-urls";

const INDIGO = "#4f46e5";

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
        {/* Left slot: signal studio. / tasks breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Umbrella wordmark — links to signalstudio.ie */}
          <a
            href={STUDIO_URL}
            aria-label="Signal Studio"
            className="flex-shrink-0 text-[12px] font-normal tracking-[-0.01em] text-[var(--ink-quiet,#71717a)] transition-colors hover:text-[var(--ink,#111111)]"
            style={{ textDecoration: "none" }}
          >
            signal studio<span style={{ color: INDIGO }}>.</span>
          </a>

          {/* Separator */}
          <span
            aria-hidden
            className="flex-shrink-0 select-none text-[12px] text-[var(--ink-ghost,#d4d4d8)]"
          >
            /
          </span>

          {/* Product mark — tasks, lowercase, ink-soft */}
          <span
            className="flex-shrink-0 text-[12px] font-normal tracking-[-0.01em] text-[var(--ink-soft,#3f3f46)]"
            aria-label="Current product: tasks"
          >
            tasks
          </span>
        </div>

        {/* Right slot: suite switcher (authed mode) + account menu */}
        <div className="flex items-center gap-3">
          {/*
           * SuiteLauncher in authed mode: deep-links to /app entries,
           * app-context labels. Positioned in the chrome, not the
           * marketing nav, so it is always rendered on /app/* surfaces.
           */}
          <SuiteLauncher current="tasks" isAuthed={true} />

          <UserButtonWithSuite current="tasks" />
        </div>
      </div>
    </header>
  );
}
