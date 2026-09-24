"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/primitives/toast";
import { createCheckoutSessionAction } from "@/server/actions/billing";
import { createBillingPortalSessionAction } from "@/server/actions/plan";
import { redeemCompCodeAction } from "@/server/actions/comp";
import type { EntitlementTier } from "@/lib/data";
import type { PaidTier } from "@/server/stripe";
import { EVENT_SELF_SERVE_AVAILABLE, EVENT_UNAVAILABLE_MESSAGE } from "@/lib/billing-availability";
import { SectionHeader } from "../settings-app";
import { Badge, SettingsGroup, SettingsRow, cx, ui } from "../settings-ui";
import { REDEEM_FAILURE_COPY, REDEEM_TIER_LABELS } from "@/components/redeem/redeem-copy";

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
    blurb: "One project. All three products. Three editing guests.",
    features: [
      "One project",
      "Board, list, calendar, and timeline views",
      "Daily digest",
      "Three editing guests",
    ],
    selfServe: true,
  },
  {
    id: "workspace",
    label: "Pro",
    price: "€12 / mo",
    blurb: "Unlimited projects. Notes, Tasks and Timeline.",
    paidTier: "workspace",
    features: [
      "Unlimited projects",
      "Editing guest limit not yet published",
      "All three products, with the daily briefing in Home",
      "Recurring tasks and dates written in plain English",
    ],
    selfServe: true,
  },
  {
    id: "event",
    label: "Event",
    price: "€89 once",
    blurb: `One project for one event. ${EVENT_UNAVAILABLE_MESSAGE}`,
    paidTier: "event",
    features: [
      "One project, 12 months of editing",
      "Unlimited guests",
      "No subscription, no auto-renew",
    ],
    selfServe: EVENT_SELF_SERVE_AVAILABLE,
  },
  {
    id: "studio",
    label: "Studio",
    price: "By arrangement",
    blurb: "One subscription. Every project you own.",
    features: [
      "Unlimited projects, one per client",
      "Pro features on every project you own",
      "No per-seat tax inside any of them",
      "One bill, not one per project",
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
      "One project. One wedding. Eighteen months, or three months past the wedding, whichever is later.",
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
  const isPaid = tier !== "free";
  const current = TIER_META.find((t) => t.id === tier) ?? TIER_META[0];

  function startCheckout(target: PaidTier) {
    startTransition(async () => {
      try {
        const { url } = await createCheckoutSessionAction(target);
        window.location.href = url;
      } catch (e) {
        toast("Couldn’t start checkout", {
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
        toast("Couldn’t open billing portal", {
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
          toast(`Redeemed: ${REDEEM_TIER_LABELS[result.tier]}`, {
            tone: "success",
            body: result.expiresAt
              ? `Expires ${new Date(result.expiresAt).toLocaleDateString()}`
              : "No expiry.",
          });
          setCode("");
        } else {
          const failure = REDEEM_FAILURE_COPY[result.reason];
          toast(failure.headline, {
            tone: "warn",
            body: failure.body,
          });
        }
      } catch (err) {
        toast("Couldn’t redeem", {
          tone: "error",
          body: (err as Error).message,
        });
      }
    });
  }

  // Available self-serve tiers + the user's CURRENT tier when it isn't
  // already in that set (Studio + Wedding only render when the user holds
  // them).
  const visibleTiers = TIER_META.filter(
    (t) => t.selfServe || t.id === tier,
  );
  const cols =
    visibleTiers.length === 4 ? "md:grid-cols-4" :
    visibleTiers.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3";

  return (
    <div>
      <SectionHeader
        title="Billing"
        description="Review your plan, manage billing or redeem an access code."
      />

      {/* Current plan */}
      <SettingsGroup title="Current plan">
        <div className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between md:px-5">
          <div className="flex min-w-0 items-start gap-3.5">
            <span
              aria-hidden
              className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[var(--v3-radius)] bg-[var(--v3-accent-soft)] text-[color:var(--v3-accent)]"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2.25 13.75 5.5v5L8 13.75 2.25 10.5v-5Z" />
                <path d="m2.25 5.5 5.75 3.25 5.75-3.25M8 8.75v5" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[18px] font-semibold leading-6 tracking-[-0.015em] text-[color:var(--v3-text)]">
                  {current.label}
                </span>
                <span className="text-[13px] tabular-nums text-[color:var(--v3-text-3)]">
                  {current.price}
                </span>
              </div>
              <p className="mt-1 max-w-[460px] text-[12.5px] leading-[1.5] text-[color:var(--v3-text-2)]">
                {current.blurb}
              </p>
            </div>
          </div>
          {isPaid ? (
            <button
              type="button"
              onClick={openPortal}
              disabled={pending}
              className={ui.button}
            >
              Manage billing
            </button>
          ) : null}
        </div>
      </SettingsGroup>

      {/* Tier comparison */}
      <SettingsGroup title="Plans">
        <div className={cx("grid grid-cols-1 divide-y divide-[color:var(--v3-border)] md:divide-x md:divide-y-0", cols)}>
          {visibleTiers.map((t) => {
            const isCurrent = t.id === tier;
            const canUpgrade = TIER_RANK[t.id] > TIER_RANK[tier];
            return (
              <div
                key={t.id}
                className={cx(
                  "flex flex-col p-4 md:p-5",
                  isCurrent
                    ? "bg-[color-mix(in_srgb,var(--v3-accent)_5%,transparent)]"
                    : "",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-[color:var(--v3-text)]">
                    {t.label}
                  </span>
                  {isCurrent ? (
                    <Badge tone="accent">Your plan</Badge>
                  ) : null}
                </div>
                <div className="mt-2 text-[20px] font-semibold leading-7 tabular-nums tracking-[-0.02em] text-[color:var(--v3-text)]">
                  {t.price}
                </div>
                <p className="mt-1 text-[12px] leading-[1.5] text-[color:var(--v3-text-2)]">
                  {t.blurb}
                </p>
                <ul className="mt-4 flex-1 space-y-2">
                  {t.features.map((f) => (
                    <li
                      key={f}
                      className="flex gap-2 text-[12.5px] leading-[1.45] text-[color:var(--v3-text-2)]"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="mt-px shrink-0 text-[color:var(--v3-accent)]"
                      >
                        <path d="m3.5 8.5 3 3 6-7" />
                      </svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className={cx(ui.button, "w-full")}
                    >
                      Current
                    </button>
                  ) : t.paidTier && canUpgrade ? (
                    <button
                      type="button"
                      onClick={() => t.paidTier && startCheckout(t.paidTier)}
                      disabled={pending}
                      className={cx(ui.primary, "w-full")}
                    >
                      Upgrade
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </SettingsGroup>

      {/* Comp code */}
      <SettingsGroup title="Access code">
        <form onSubmit={redeem}>
          <SettingsRow
            label="Got a code?"
            htmlFor="billing-access-code"
            description="Redeem an access code you received from Signal Studio or your venue."
          >
            <input
              id="billing-access-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="GIFT-A4B2X9"
              disabled={pending}
              className={cx(ui.input, "font-mono tracking-[0.06em] sm:w-[200px]")}
            />
            <button
              type="submit"
              disabled={pending || !code.trim()}
              className={ui.button}
            >
              {pending ? "Working…" : "Redeem"}
            </button>
          </SettingsRow>
        </form>
      </SettingsGroup>

      <p className="mt-4 px-0.5 text-[12.5px] leading-[1.55] text-[color:var(--v3-text-2)]">
        Need help with a payment or access code?{" "}
        <a
          href="mailto:hello@signalstudio.ie?subject=Billing%20or%20access%20help"
          className={ui.link}
        >
          Email Signal Studio
        </a>
        . Tell us which account you used and what happened. Keep your receipt or
        original invitation ready.
      </p>
    </div>
  );
}
