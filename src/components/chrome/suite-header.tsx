"use client";

/**
 * SuiteHeader — the one marketing header shell for Signal Studio.
 *
 * Canonical source for the FOUR product repos (tasks / analytics / roadmap /
 * notes). Copy byte-identical. Do NOT diverge. Path in each repo:
 *   src/components/chrome/suite-header.tsx
 *
 * Design contract: content/hq/decisions/product-header-contract.md
 *   "One shell, product-specific content slots. Products may not create
 *    separate header systems, product colors, animated nav gestures, or
 *    different geometry."
 *
 * Why a shared component (2026-07-04): the header contract used to be a
 * geometry-only gate (sticky / 56px / 1240px) that permitted four bespoke
 * header files. They drifted — three different hairline colors (one a
 * green-grey leftover from the retired Notes register), two wordmark sizes,
 * two nav font sizes, four mobile-menu implementations. The suite stopped
 * holding still. This component is the fix: the shell, the left lockup, the
 * desktop nav, and the mobile menu are ONE implementation. Each product
 * passes only what is legitimately its own — its launcher, its wordmark
 * glyph, its nav links, and its account control — through slots.
 *
 * ── Slots ─────────────────────────────────────────────────────────
 *   launcher   the SuiteLauncher (import path differs per repo, so it is
 *              passed in, never imported here)
 *   wordmark   the product wordmark glyph (tasks· / timeline· / signal· /
 *              notes.) rendered at the shared "md" size
 *   nav        the product's marketing nav links (data only; rendered here)
 *   account    the product's auth control (Sign in link / account menu /
 *              escape hatch). Auth wiring stays per-repo; this only places it.
 *   breadcrumb optional node after the wordmark (Notes section label)
 *
 * ── Tokens ────────────────────────────────────────────────────────
 * Colors come through CSS-var fallback chains so the one file themes
 * correctly in every repo regardless of its token names. The hairline is a
 * component-scoped default (rgba(17,17,17,0.08)) so all four render the SAME
 * neutral rule — this is what kills the green-grey / border-soft divergence.
 * A repo may override --suite-header-hairline at :root for a sanctioned skin,
 * but the default is the unified suite hairline.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export type SuiteNavItem = { href: string; label: string; external?: boolean };

const HAIRLINE = "var(--suite-header-hairline, rgba(17, 17, 17, 0.08))";
const BG = "color-mix(in srgb, var(--bg, #ffffff) 88%, transparent)";
const INK = "var(--ink, #14151a)";
const INK_SOFT = "var(--ink-soft, #52525b)";
const INK_FAINT = "var(--ink-faint, #a1a1aa)";

function ExternalGlyph() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ opacity: 0.4 }}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function SuiteHeader({
  launcher,
  wordmark,
  nav,
  account,
  breadcrumb,
  ariaLabel = "Site navigation",
}: {
  launcher: React.ReactNode;
  wordmark: React.ReactNode;
  nav: SuiteNavItem[];
  account?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = "suite-mobile-nav";

  // Close on Escape, return focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        borderBottom: `1px solid ${HAIRLINE}`,
        background: BG,
        backdropFilter: "saturate(150%) blur(12px)",
        WebkitBackdropFilter: "saturate(150%) blur(12px)",
      }}
    >
      <div className="mx-auto flex h-14 w-full max-w-[1240px] items-center justify-between px-6">
        {/* Left lockup: launcher · / · wordmark · (breadcrumb) */}
        <div className="flex min-w-0 items-center gap-3 whitespace-nowrap">
          <div className="inline-flex">{launcher}</div>
          <span aria-hidden style={{ color: INK_FAINT, fontSize: 12 }}>
            /
          </span>
          {wordmark}
          {breadcrumb}
        </div>

        {/* Desktop nav */}
        <nav
          className="hidden items-center gap-7 md:flex"
          style={{ fontSize: 13, color: INK_SOFT }}
        >
          {nav.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="suite-header-link"
                style={{ color: INK_SOFT, textDecoration: "none", transition: "color 140ms ease" }}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="suite-header-link"
                style={{ color: INK_SOFT, textDecoration: "none", transition: "color 140ms ease" }}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        {/* Right cluster: account slot + mobile toggle (only when there is
            nav to collapse; products with no marketing nav, e.g. Notes, show
            no dead hamburger) */}
        <div className="flex items-center gap-2">
          {account}
          {nav.length > 0 && (
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close navigation" : "Open navigation"}
            onClick={() => setOpen((v) => !v)}
            className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full md:hidden"
            style={{ border: `1px solid ${HAIRLINE}`, color: INK_SOFT }}
          >
            {open ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="3" y1="7" x2="21" y2="7" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="17" x2="21" y2="17" />
              </svg>
            )}
          </button>
          )}
        </div>
      </div>

      {/* Mobile dropdown, below the bar, hairline-separated, no shadow */}
      {open && nav.length > 0 && (
        <div
          id={menuId}
          role="navigation"
          aria-label={ariaLabel}
          className="px-6 pb-5 pt-4 md:hidden"
          style={{ borderTop: `1px solid ${HAIRLINE}`, background: BG }}
        >
          <ul className="space-y-0.5">
            {nav.map((item) => (
              <li key={item.href}>
                {item.external ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={closeMenu}
                    className="flex items-center gap-1.5 rounded-md px-2 py-2.5"
                    style={{ fontSize: 14, color: INK_SOFT, textDecoration: "none" }}
                  >
                    {item.label}
                    <ExternalGlyph />
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    onClick={closeMenu}
                    className="block rounded-md px-2 py-2.5"
                    style={{ fontSize: 14, color: INK_SOFT, textDecoration: "none" }}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <style>{`.suite-header-link:hover{color:${INK} !important;}`}</style>
    </header>
  );
}
