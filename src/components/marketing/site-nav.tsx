"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { SuiteLauncher } from "@/components/app/suite-launcher";
import { UserButton } from "@clerk/nextjs";

const UMBRELLA_PRICING = "https://signalstudio.ie/pricing";
const UMBRELLA_DESIGN = "https://signalstudio.ie/design";

const NAV: { href: string; label: string; external?: boolean }[] = [
  { href: "/#demo",        label: "Demo"    },
  { href: "/#anatomy",     label: "Anatomy" },
  { href: "/app/board",    label: "App"     },
  { href: UMBRELLA_PRICING, label: "Pricing", external: true },
  { href: UMBRELLA_DESIGN,  label: "Design",  external: true },
];

/**
 * L3 — auth-aware marketing nav (DESIGN.md §14).
 * When authed: no "Sign in"; account menu replaces auth controls.
 * The isAuthed prop is set by the server wrapper (SiteNavServer) so no
 * client-side auth fetch is needed. Unauthed: identical to prior behavior.
 */
export function SiteNav({ isAuthed = false }: { isAuthed?: boolean }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = "mobile-nav-menu";

  // Close on Escape, return focus to trigger
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

  // Close when route changes (click on a link)
  const closeMenu = () => setOpen(false);

  return (
    <header
      className="sticky top-0 z-40 border-b border-line-soft/75"
      style={{
        background: "color-mix(in srgb, var(--bg) 88%, transparent)",
        backdropFilter: "saturate(150%) blur(12px)",
        WebkitBackdropFilter: "saturate(150%) blur(12px)",
      }}
    >
      <div className="mx-auto flex h-14 w-full max-w-[1240px] items-center justify-between px-6">
        <div className="flex min-w-0 items-center gap-3 whitespace-nowrap">
          <div className="inline-flex">
            <SuiteLauncher current="tasks" isAuthed={isAuthed} />
          </div>
          <span aria-hidden style={{ color: "var(--ink-faint)", fontSize: 12 }}>/</span>
          <Wordmark size="md" />
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 text-[13px] text-ink-soft md:flex">
          {NAV.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-ink"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-ink"
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="flex items-center gap-2">
          {isAuthed ? (
            /* L3: authed — account menu replaces auth controls (DESIGN.md §14) */
            <div className="inline-flex items-center">
              <UserButton
                appearance={{
                  elements: { avatarBox: "h-8 w-8 rounded-full" },
                }}
              />
            </div>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="inline-flex min-h-8 items-center rounded-full px-3.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink"
              >
                Sign in
              </Link>
            </>
          )}

          {/* Mobile menu toggle — only visible below md */}
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close navigation" : "Open navigation"}
            onClick={() => setOpen((v) => !v)}
            className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line-soft/75 text-ink-soft transition-colors hover:bg-bg-sunken hover:text-ink md:hidden"
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
        </div>
      </div>

      {/* Mobile dropdown — below-the-bar, hairline-separated, no shadow */}
      {open && (
        <div
          id={menuId}
          role="navigation"
          aria-label="Site navigation"
          className="border-t border-line-soft/60 bg-bg/95 px-6 pb-5 pt-4 md:hidden"
        >
          <ul className="space-y-0.5">
            {NAV.map((item) => (
              <li key={item.href}>
                {item.external ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={closeMenu}
                    className="flex items-center gap-1.5 rounded-md px-2 py-2.5 text-[14px] text-ink-soft transition-colors hover:bg-bg-sunken hover:text-ink"
                  >
                    {item.label}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="opacity-40">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    onClick={closeMenu}
                    className="block rounded-md px-2 py-2.5 text-[14px] text-ink-soft transition-colors hover:bg-bg-sunken hover:text-ink"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
