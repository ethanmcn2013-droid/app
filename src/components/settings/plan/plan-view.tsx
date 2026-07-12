"use client";

import Link from "next/link";
import { useState } from "react";
import type { PlanSummary } from "@/server/db/plan-summary";
import { createBillingPortalSessionAction } from "@/server/actions/plan";

export function PlanView({ summary }: { summary: PlanSummary }) {
  if (summary.kind === "comp_wedding") return <CompWeddingView s={summary} />;
  if (summary.kind === "paid" || summary.kind === "paid_wedding") {
    return <PaidView s={summary} />;
  }
  return <FreeView />;
}

function FreeView() {
  return (
    <div>
      <div className="rounded-xl border border-line-soft bg-bg-elevated p-6">
        <div className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          Free
        </div>
        <p className="mt-2 max-w-[480px] text-[13.5px] leading-[1.6] text-ink-soft">
          One workspace, all four products, three editing guests. The default
          we built around, most of what most people need.
        </p>
      </div>
      <Link
        href="https://signalstudio.ie/pricing"
        target="_blank"
        rel="noopener noreferrer"
        className="group mt-5 inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
      >
        See paid plans
        <svg
          className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
    </div>
  );
}

function CompWeddingView({
  s,
}: {
  s: Extract<PlanSummary, { kind: "comp_wedding" }>;
}) {
  const expiresAt = s.expiresAt ?? null;
  return (
    <div>
      <div
        className="rounded-xl border p-6"
        style={{
          borderColor: "rgba(190, 24, 93, 0.18)",
          background: "rgba(190, 24, 93, 0.04)",
        }}
      >
        <div
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{ color: "#be185d" }}
        >
          Wedding suite · with our compliments
        </div>
        <p className="mt-2 max-w-[520px] text-[14px] leading-[1.65] text-ink">
          A year of Signal Studio, on{" "}
          <strong className="font-semibold">{s.sponsorName}</strong>. Expires{" "}
          {expiresAt ? longDate(expiresAt) : "in a year"}.
        </p>
        <p className="mt-3 max-w-[520px] text-[12.5px] leading-[1.65] text-ink-soft">
          When the year is up, the workspace stays. Tasks, notes, and the
          timeline are yours, you&apos;ll just be moved to the Free tier, which
          has everything most couples need after the wedding&apos;s done.
        </p>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-3 text-[12.5px] sm:grid-cols-2">
        <Pair label="Code redeemed" value={s.code} />
        <Pair label="Redeemed on" value={shortDate(s.startedAt)} />
      </dl>
    </div>
  );
}

function PaidView({
  s,
}: {
  s: Extract<PlanSummary, { kind: "paid" | "paid_wedding" }>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setPending(true);
    setError(null);
    try {
      const { url } = await createBillingPortalSessionAction();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open billing");
      setPending(false);
    }
  }

  const tierLabel = labelForTier(s.tier);
  const priceLabel = priceForTier(s.tier);
  const renewVerb = s.kind === "paid_wedding" ? "Expires" : "Renews";

  return (
    <div>
      <div className="rounded-xl border border-line-soft bg-bg-elevated p-6">
        <div className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          {tierLabel}
        </div>
        <p className="mt-2 text-[14px] leading-[1.6] text-ink">
          {tierLabel} · {priceLabel}.
        </p>
        {s.expiresAt ? (
          <p className="mt-1 text-[13px] text-ink-soft">
            {renewVerb} {longDate(s.expiresAt)}.
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={openPortal}
            className="group inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-ink-soft disabled:opacity-50"
          >
            {pending ? "Opening…" : "Manage billing"}
            <svg
              className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        {error ? (
          <div className="mt-3 text-[12px] text-rose-700">{error}</div>
        ) : null}
      </div>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line-soft bg-bg-elevated px-4 py-3">
      <dt className="text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-[13px] text-ink">{value}</dd>
    </div>
  );
}

function labelForTier(t: PlanSummary["tier"]): string {
  if (t === "workspace") return "Workspace";
  if (t === "event") return "Event";
  if (t === "studio") return "Studio";
  if (t === "wedding") return "Wedding suite";
  return "Free";
}

function priceForTier(t: PlanSummary["tier"]): string {
  if (t === "workspace") return "€12 per month";
  if (t === "event") return "€89 · one-time";
  if (t === "studio") return "€14.95 per month";
  if (t === "wedding") return "€79 · one-time";
  return "€0";
}

function shortDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function longDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
