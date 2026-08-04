"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/primitives/toast";
import { Dialog } from "@/components/primitives/dialog";
import {
  createCheckoutSessionAction,
  expireEntitlementByNotes,
} from "@/server/actions/billing";
import { createBillingPortalSessionAction } from "@/server/actions/plan";
import { redeemCompCodeAction } from "@/server/actions/comp";
import type { EntitlementTier } from "@/lib/data";
import type { PaidTier } from "@/server/stripe";
import { SectionHeader } from "../settings-app";

type TierMeta = {
  id: EntitlementTier;
  label: string;
  price: string;
  blurb: string;
  features: string[];
  /** Self-serve tiers carry a paidTier so the UI shows a checkout
   *  button. Tiers without paidTier exist (Studio, Wedding) but are
   *  granted by arrangement only, UI shows a "by arrangement" note
   *  + a mailto, not a checkout button. */
  paidTier?: PaidTier;
  /** Hide from the upgrade-options grid. Currently used for tiers
   *  that are operator-granted only and would confuse a self-serve
   *  buyer (Studio, Wedding). They still render as the user's CURRENT
   *  tier when they hold one. */
  selfServe?: boolean;
};

const TIER_META: TierMeta[] = [
  {
    id: "free",
    label: "Free",
    price: "€0",
    blurb: "One workspace. All four products. Three editing guests.",
    features: [
      "One workspace",
      "Board, list, calendar, and timeline views",
      "Daily digest",
      "Three editing guests",
    ],
    selfServe: true,
  },
  {
    id: "workspace",
    label: "Workspace",
    price: "€12 / mo",
    blurb: "Unlimited workspaces. Unlimited guests. All four products.",
    paidTier: "workspace",
    features: [
      "Unlimited workspaces",
      "Unlimited guests and collaborators",
      "All four products, Tasks, Roadmap, Analytics, Notes",
      "Recurring tasks, blockers, NLP dates",
    ],
    selfServe: true,
  },
  {
    id: "event",
    label: "Event",
    price: "€89 once",
    blurb: "One workspace for one event. 12 months active, reads forever.",
    paidTier: "event",
    features: [
      "One workspace, 12 months of editing",
      "Unlimited guests",
      "Read-only forever after the event",
      "No subscription, no auto-renew",
    ],
    selfServe: true,
  },
  {
    id: "studio",
    label: "Studio",
    price: "By arrangement",
    blurb: "One subscription. Every workspace you own.",
    features: [
      "Unlimited workspaces, one per client, one per project",
      "Workspace features on every workspace you own",
      "No per-seat tax inside any of them",
      "One bill, not one per workspace",
    ],
    // No paidTier, no selfServe, only shown when the user already
    // holds it (granted via Studio /api/internal/entitlements/grant).
  },
  {
    id: "wedding",
    label: "Wedding",
    // Every string on this card was wrong against a ratified decision, and this is
    // the card the sponsored couple sees. Corrected 2026-08-03 (Wave 3):
    //   "Via venue partner"   — "partner" is a banned programme term (R-042); the
    //                           ratified name is the Founding 25 and the couple is
    //                           never shown a price at all (D-001).
    //   "Twelve months"       — the term is max(redemption + 548d, wedding + 90d)
    //   "12 months of editing"  per D-022, never a flat twelve or eighteen months.
    //   "Reads forever"       — permanence wording, banned (D-001 p16, R-008). It also
    //                           promised Keepsake, which does not exist in this repo:
    //                           `grep -rni keepsake src` returns nothing. Saying nothing
    //                           about what follows the term is the only honest option
    //                           until it is built (D-016).
    //   "Up to 6 collaborators" — a seat count, and D-020 grants unlimited. It was also
    //                           false: getMemberCapacity returns max: null for this tier.
    price: "Included by your venue",
    blurb:
      "One workspace. One wedding. Eighteen months, or three months past the wedding, whichever is later.",
    features: [
      "Wedding-shaped starter pack from day one",
      "Invite your spouse, your planner and your family",
      "Read-only links for anyone who just needs to see it",
    ],
    // Granted via comp-code (LAMBSHIL flow). Not self-serve.
  },
];

const TIER_RANK: Record<EntitlementTier, number> = {
  free: 0,
  event: 1,
  wedding: 2,
  workspace: 3,
  studio: 4,
};

export function BillingSection({ tier }: { tier: EntitlementTier }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const isPaid = tier !== "free";
  const current = TIER_META.find((t) => t.id === tier) ?? TIER_META[0];

  function startCheckout(target: PaidTier) {
    startTransition(async () => {
      try {
        const { url } = await createCheckoutSessionAction(target);
        window.location.href = url;
      } catch (e) {
        toast("Couldn't start checkout", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  function openPortal() {
    startTransition(async () => {
      try {
        const { url } = await createBillingPortalSessionAction("/app/settings");
        window.location.href = url;
      } catch (e) {
        toast("Couldn't open billing portal", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  function cancelSubscription() {
    setCancelOpen(false);
    startTransition(async () => {
      try {
        // Match by tier-prefixed notes pattern. The Stripe webhook
        // writes notes like `stripe-sub:sub_…`; the dev path writes
        // `dev:no-stripe`. Both expire on cancel.
        await expireEntitlementByNotes("dev:no-stripe");
        toast("Subscription canceled", {
          tone: "success",
          body: "You'll keep paid features until the period ends.",
        });
      } catch (e) {
        toast("Cancel failed", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  function redeem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!code.trim()) return;
    startTransition(async () => {
      try {
        const result = await redeemCompCodeAction(code);
        if (result.ok) {
          toast(`Redeemed: ${result.tier.toUpperCase()}`, {
            tone: "success",
            body: result.expiresAt
              ? `Expires ${new Date(result.expiresAt).toLocaleDateString()}`
              : "No expiry.",
          });
          setCode("");
        } else {
          toast("Code didn't take", {
            tone: "warn",
            body:
              result.reason === "not-found"
                ? "We don't recognize that code."
                : result.reason === "exhausted"
                  ? "All seats on that code are claimed."
                  : result.reason === "expired"
                    ? "That code has expired."
                    : "You've already redeemed this one.",
          });
        }
      } catch (err) {
        toast("Couldn't redeem", {
          tone: "error",
          body: (err as Error).message,
        });
      }
    });
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Billing"
        title="What you're on, and what's next"
        description="Plans aren't gates, they're shapes. Pick the one that fits, change your mind whenever."
      />

      {/* Current tier strip */}
      <div className="rounded-xl border border-line-soft bg-bg-elevated p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
              Current plan
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[20px] font-semibold tracking-tight text-ink">
                {current.label}
              </span>
              <TierBadge tier={tier} />
            </div>
            <p className="mt-1 text-[12.5px] text-ink-soft">{current.blurb}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {isPaid ? (
              <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={openPortal}
                  disabled={pending}
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink disabled:opacity-60"
                >
                  Manage billing
                </button>
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  disabled={pending}
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:border-rose-300 hover:text-rose-600 disabled:opacity-60"
                >
                  Cancel subscription
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Tier comparison, self-serve tiers (Free / Workspace / Event)
       *  + the user's CURRENT tier when it isn't already in that set
       *  (Studio + Wedding only render when the user holds them). */}
      {(() => {
        const visibleTiers = TIER_META.filter(
          (t) => t.selfServe || t.id === tier,
        );
        const cols =
          visibleTiers.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3";
        return (
      <div className="mt-4 overflow-hidden rounded-xl border border-line-soft bg-bg-elevated">
        <div className={`grid grid-cols-1 divide-y divide-line-soft ${cols} md:divide-x md:divide-y-0`}>
          {visibleTiers.map((t) => {
            const isCurrent = t.id === tier;
            const canUpgrade = TIER_RANK[t.id] > TIER_RANK[tier];
            return (
              <div
                key={t.id}
                className={
                  "flex flex-col p-5 " +
                  (isCurrent ? "bg-brand-soft/40" : "")
                }
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-ink">
                    {t.label}
                  </span>
                  {isCurrent ? (
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-brand">
                      You
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-[18px] font-semibold tabular-nums tracking-tight text-ink">
                  {t.price}
                </div>
                <p className="mt-1 text-[11.5px] leading-[1.5] text-ink-quiet">
                  {t.blurb}
                </p>
                <ul className="mt-3 flex-1 space-y-1.5">
                  {t.features.map((f) => (
                    <li
                      key={f}
                      className="flex gap-2 text-[12px] leading-[1.5] text-ink-soft"
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        className="mt-1 flex-shrink-0 text-brand"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-full border border-line bg-bg-sunken/40 px-3 py-1.5 text-[12px] font-medium text-ink-quiet"
                    >
                      Current
                    </button>
                  ) : t.paidTier && canUpgrade ? (
                    <button
                      type="button"
                      onClick={() => t.paidTier && startCheckout(t.paidTier)}
                      disabled={pending}
                      className="w-full rounded-full bg-ink px-3 py-1.5 text-[12px] font-medium text-white shadow-sm hover:bg-ink-soft disabled:opacity-60"
                    >
                      Upgrade
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-ink-quiet"
                    >
                      —
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
        );
      })()}

      {/* Comp code */}
      <form
        onSubmit={redeem}
        className="mt-4 rounded-xl border border-line-soft bg-bg-elevated p-5"
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
          Got a code?
        </div>
        <p className="mt-1 max-w-[520px] text-[12.5px] leading-[1.55] text-ink-soft">
          Student .edu codes, comped seats, the occasional gift. Drop it in.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="GIFT-A4B2X9"
            disabled={pending}
            className="flex-1 rounded-md border border-line bg-white px-3 py-1.5 font-mono text-[13px] tracking-wider text-ink shadow-sm focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={pending || !code.trim()}
            className="rounded-full bg-ink px-4 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-ink-soft disabled:opacity-50"
          >
            {pending ? "Working…" : "Redeem"}
          </button>
        </div>
      </form>

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        labelledBy="cancel-sub-title"
        width={440}
      >
        <div className="px-5 py-5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-rose-700">
            Confirm
          </div>
          <h3
            id="cancel-sub-title"
            className="mt-1 text-[17px] font-semibold tracking-tight"
          >
            Cancel your subscription?
          </h3>
          <p className="mt-2 text-[13px] leading-[1.55] text-ink-soft">
            You&apos;ll keep paid features through the end of the current
            billing period, then drop back to Free. Your tasks stay where
            they are.
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCancelOpen(false)}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={cancelSubscription}
              disabled={pending}
              className="rounded-full bg-rose-600 px-3 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
            >
              {pending ? "Canceling…" : "Yes, cancel"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function TierBadge({ tier }: { tier: EntitlementTier }) {
  const styles: Record<EntitlementTier, { bg: string; ink: string }> = {
    free: { bg: "bg-bg-sunken", ink: "text-ink-quiet" },
    event: { bg: "bg-amber-50", ink: "text-amber-700" },
    wedding: { bg: "bg-rose-50", ink: "text-rose-700" },
    workspace: { bg: "bg-brand-soft", ink: "text-brand" },
    studio: { bg: "bg-ink/5", ink: "text-ink" },
  };
  const s = styles[tier];
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] " +
        s.bg +
        " " +
        s.ink
      }
    >
      {tier}
    </span>
  );
}
