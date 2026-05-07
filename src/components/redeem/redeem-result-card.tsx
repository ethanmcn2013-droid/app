"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { RedeemResult } from "@/server/actions/comp";

const FAILURE_COPY: Record<
  Exclude<RedeemResult, { ok: true }>["reason"],
  { headline: string; body: string }
> = {
  "not-found": {
    headline: "We don't recognize that code.",
    body: "Double-check the link — letter for letter, dash for dash. If it came from us and still won't unlock, send it back and we'll look it up.",
  },
  exhausted: {
    headline: "All redemptions on this code are used up.",
    body: "This was a limited batch and someone got there first. Drop us a line and we'll see if we can mint a fresh one.",
  },
  expired: {
    headline: "This code has expired.",
    body: "Some gift codes have a window. The window on this one closed. Reach out and we'll figure out a fresh one.",
  },
  "already-redeemed": {
    headline: "You've already redeemed this one.",
    body: "Your access is still active — head into the workspace.",
  },
};

const TIER_LABEL = {
  free: "Free",
  pro: "Pro",
  team: "Team",
  studio: "Studio",
  wedding: "Wedding suite",
} as const;

export function RedeemResultCard({
  code,
  result,
}: {
  code: string;
  result: RedeemResult;
}) {
  if (result.ok) {
    const expiresLabel = result.expiresAt
      ? new Date(result.expiresAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "for life";
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[480px] rounded-2xl border border-emerald-200 bg-emerald-50/30 p-7 text-center shadow-[0_24px_60px_-30px_rgba(16,185,129,0.32)]"
      >
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,0.5)]">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Redeemed
        </div>
        <h1 className="mt-1.5 text-balance text-[24px] font-semibold leading-snug tracking-[-0.01em] text-ink">
          You&rsquo;re on{" "}
          <span className="text-emerald-700">
            {TIER_LABEL[result.tier]}
          </span>{" "}
          until {expiresLabel}.
        </h1>
        {result.notes ? (
          <p className="mx-auto mt-3 max-w-[40ch] text-[12.5px] leading-[1.5] text-ink-soft">
            {result.notes}
          </p>
        ) : null}
        <div className="mt-2 font-mono text-[10.5px] tabular-nums text-ink-quiet">
          {code}
        </div>
        <Link
          href="/app/board"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13.5px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px"
        >
          Open the workspace
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </Link>
      </motion.div>
    );
  }

  const copy = FAILURE_COPY[result.reason];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[480px] rounded-2xl border border-line-soft bg-bg-elevated p-7 text-center shadow-[0_24px_60px_-30px_rgba(20,21,26,0.18)]"
    >
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-bg-sunken text-ink-quiet">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
        Couldn&rsquo;t redeem
      </div>
      <h1 className="mt-1.5 text-balance text-[20px] font-semibold leading-snug tracking-[-0.01em] text-ink">
        {copy.headline}
      </h1>
      <p className="mx-auto mt-3 max-w-[40ch] text-[13px] leading-[1.55] text-ink-soft">
        {copy.body}
      </p>
      <div className="mt-3 font-mono text-[10.5px] tabular-nums text-ink-quiet">
        {code}
      </div>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
      >
        Back to Tasks
      </Link>
    </motion.div>
  );
}
