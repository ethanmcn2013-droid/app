/**
 * Persistent top chrome — L4 unified suite chrome (DESIGN.md §14).
 *
 * Byte-identical geometry across all five products so a cross-product
 * jump swaps only the body; the chrome appears not to move.
 *
 * Perceived continuity, not a true SPA — hard document navigation still
 * occurs between subdomains. Monorepo + DB-merge ruled out by locked
 * decisions.
 *
 * Layout (amended 2026-05-19 — §14 pill-switcher revision):
 *   Left  — "signal studio." umbrella anchor (once, same-tab) + 4-product
 *           pill switcher (SuiteSwitcher). The active pill IS the product
 *           breadcrumb — no separate "/ product" mark needed.
 *   Right — UserButtonWithSuite only
 *
 * "signal studio." appears exactly ONCE in this header (D6 contract held).
 * The cross-product switcher is now always-visible pills instead of the
 * click-to-open popover (SuiteLauncher) — the popover stays on the
 * unauthed marketing nav where one product is in view at a time.
 *
 * Height: h-14 (56px). Sticky top-0 z-40. backdrop-blur-md.
 * Background: bg semi-transparent (uses Tailwind; matches SiteNav).
 * Hairline border-b on scroll (JS-driven class toggle).
 * Max-width: 80rem (matches §4 app content width), px-6.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { SuiteSwitcher } from "@/components/app/suite-switcher-pills";
import { UserButtonWithSuite } from "@/components/app/user-button-with-suite";

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
      <div className="mx-auto flex h-14 w-full max-w-[80rem] items-center justify-between gap-3 px-6">
        {/*
         * Left slot — §14 (amended 2026-05-19):
         *   [signal studio.] | [notes][tasks][roadmap][analytics]
         *
         * SuiteSwitcher renders the quiet umbrella anchor (once — D6), a
         * hairline divider, then the always-visible 4-product pills. The
         * active pill is the product-you-are-in indicator, so there is no
         * separate "/ product" breadcrumb.
         */}
        <div className="flex min-w-0 items-center">
          <SuiteSwitcher current="tasks" />
        </div>

        {/*
         * Right slot — UserButtonWithSuite only.
         * This matches the Notes/Roadmap/Analytics pattern.
         */}
        <div className="flex flex-shrink-0 items-center gap-3">
          <UserButtonWithSuite current="tasks" />
        </div>
      </div>
    </header>
  );
}
