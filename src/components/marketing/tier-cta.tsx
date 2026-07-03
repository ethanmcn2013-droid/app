"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createCheckoutSessionAction } from "@/server/actions/billing";
import type { PaidTier } from "@/server/stripe";

type Props = {
  label: string;
  href?: string;
  tier?: PaidTier;
  accent?: "default" | "popular" | "specialty";
};

/**
 * Pricing-card CTA. When `tier` is set, fires
 * `createCheckoutSessionAction` and redirects to the Stripe-hosted
 * checkout. When `href` is set instead, renders a plain `<Link>`.
 *
 * Dev path (Stripe unconfigured), the action grants the entitlement
 * locally and returns a `?upgrade=ok&dev=1` redirect so the rest of
 * the app's tier gating still exercises end-to-end.
 */
export function TierCta({ label, href, tier, accent }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cls =
    "mt-5 inline-flex items-center justify-center rounded-full px-4 py-2 text-[12.5px] font-medium transition-transform hover:-translate-y-px disabled:opacity-60 " +
    (accent === "popular" || accent === "specialty"
      ? "bg-ink text-white"
      : "border border-line bg-white text-ink-soft hover:text-ink");

  if (tier) {
    return (
      <>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                const { url } = await createCheckoutSessionAction(tier);
                window.location.href = url;
              } catch (e) {
                setError((e as Error).message);
              }
            });
          }}
          className={cls}
        >
          {pending ? "Redirecting…" : label}
        </button>
        {error ? (
          <p className="mt-2 text-[11.5px] text-rose-600">{error}</p>
        ) : null}
      </>
    );
  }

  return (
    <Link href={href ?? "/app/board"} className={cls}>
      {label}
    </Link>
  );
}
