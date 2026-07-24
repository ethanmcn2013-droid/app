"use client";

/**
 * Studio Bar mobile search — the Delight Layer's Search-Expand affordance,
 * adapted for the Studio Bar's charcoal chrome (Phase 1).
 *
 * Below `md` the full command field is hidden and the bar showed a bare
 * search icon that opened the palette. This replaces that icon with the
 * lab Search-Expand Nav's morph: tapping the icon glides it left to become
 * a field's leading glyph while an inline input fades in across the bar and
 * a ✕ appears on the right. It is additive and touches none of the chrome
 * contract tokens — the bar's h-10 / --x-studio-chrome / z-40 / mark and
 * identity cells / signal-pulse slot all stay in studio-bar.tsx.
 *
 * The inline field isn't a second search engine: on submit it hands the
 * typed text to the existing palette (STUDIO_PALETTE_EVENT with a `query`
 * detail), so the palette stays the one source of results. Calm horizontal
 * morph; honours prefers-reduced-motion.
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { STUDIO_PALETTE_EVENT } from "./studio-chrome-context";

const EASE = [0.22, 1, 0.36, 1] as const;

function SearchGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function StudioBarSearch({
  label = "Search, jump or create",
}: {
  /** Accessible name for the trigger and field; the bar supplies the
   *  surface-aware command label so the affordance reads in context. */
  label?: string;
} = {}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Dismiss on outside pointer or Escape, matching the palette's calm exits.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function submit(query: string) {
    setOpen(false);
    window.dispatchEvent(
      new CustomEvent(STUDIO_PALETTE_EVENT, { detail: { query } }),
    );
  }

  return (
    <div ref={rootRef} className="relative flex-none md:hidden">
      {/* Collapsed trigger — the search icon, matching the create/account chips. */}
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 flex-none items-center justify-center rounded-md border border-white/[0.09] bg-white/[0.04] text-[var(--x-studio-ink-soft)] outline-none transition-colors hover:border-white/[0.14] hover:bg-white/[0.07] focus-visible:border-[var(--x-studio-accent)]"
        style={{ opacity: open ? 0 : 1, pointerEvents: open ? "none" : undefined }}
      >
        <SearchGlyph />
      </button>

      {/* Expanded field — anchored to the bar, growing left from the trigger.
          Absolute so it overlays the create + account cluster while active. */}
      {open ? (
        <motion.form
          role="search"
          initial={reduced ? false : { opacity: 0, scaleX: 0.92 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={reduced ? { duration: 0 } : { duration: 0.24, ease: EASE }}
          style={{ originX: 1 }}
          className="absolute right-0 top-1/2 flex h-8 w-[min(72vw,320px)] -translate-y-1/2 items-center gap-2 rounded-md border border-white/[0.14] bg-[var(--x-studio-chrome)] px-2.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]"
          onSubmit={(e) => {
            e.preventDefault();
            submit(inputRef.current?.value ?? "");
          }}
        >
          <span className="flex-none text-[var(--x-studio-ink-quiet)]">
            <SearchGlyph />
          </span>
          <input
            ref={inputRef}
            type="search"
            aria-label={label}
            placeholder="Search, jump or create…"
            spellCheck={false}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--x-studio-ink)] placeholder:text-[var(--x-studio-ink-soft)] outline-none [&::-webkit-search-cancel-button]:appearance-none"
          />
          <button
            type="button"
            aria-label="Close search"
            onClick={() => setOpen(false)}
            className="flex h-6 w-6 flex-none items-center justify-center rounded text-[var(--x-studio-ink-soft)] outline-none transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:border-[var(--x-studio-accent)]"
          >
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </motion.form>
      ) : null}
    </div>
  );
}
