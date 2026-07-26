"use client";

import { useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";

type Props = {
  sponsorName: string;
  sponsorSlug: string;
};

const DISMISS_PREFIX = "signal-tasks.venue-welcome-dismissed:";
const DISMISS_PREFIX_OLD = "venue-welcome-dismissed:";

/**
 * One-time dismissible card shown after a venue-edition redemption
 * lands the user on /app/tasks. Persists dismissal in localStorage,
 * keyed by sponsor slug so a future venue (Lamb's Hill → Glin Castle)
 * gets its own card. Copy locked in BRAND.md voice; do not edit at
 * venue boundary.
 */
export function VenueWelcomeCard({ sponsorName, sponsorSlug }: Props) {
  const mounted = useHydrated();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    try {
      if (localStorage.getItem(`${DISMISS_PREFIX}${sponsorSlug}`) === "1") return true;
      // Migration: if old key is set, migrate to new key and treat as dismissed.
      if (localStorage.getItem(`${DISMISS_PREFIX_OLD}${sponsorSlug}`) === "1") {
        localStorage.setItem(`${DISMISS_PREFIX}${sponsorSlug}`, "1");
        localStorage.removeItem(`${DISMISS_PREFIX_OLD}${sponsorSlug}`);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(`${DISMISS_PREFIX}${sponsorSlug}`, "1");
    } catch {
      /* no-op */
    }
  };

  if (!mounted || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 md:bottom-8"
    >
      <div
        className="pointer-events-auto flex max-w-[520px] items-start gap-4 rounded-xl border border-brand/40 bg-bg/95 p-5 shadow-lg backdrop-blur"
        style={{ boxShadow: "0 12px 32px -8px rgba(79, 70, 229, 0.18)" }}
      >
        <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand" />
        <div className="flex-1">
          <div
            className="mb-1 text-[10px] font-semibold uppercase text-brand"
            style={{ letterSpacing: "0.14em" }}
          >
            Compliments of {sponsorName}
          </div>
          <p className="text-[14px] leading-[1.5] text-ink">
            Your wedding workspace is ready. Plan without the noise, every
            view is the same items, all in plain English.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="-mr-1 -mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-ink-quiet transition-colors hover:bg-ink-100 hover:text-ink"
          aria-label="Dismiss"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
