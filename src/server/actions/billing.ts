"use server";

import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { entitlements } from "@/server/db/schema";
import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
import { priceIdFor, stripe, type PaidTier } from "@/server/stripe";
import type { EntitlementTier } from "@/lib/data";

const FALLBACK_BASE = "http://localhost:3001";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_BASE;
}

/**
 * Mint a Stripe Checkout session for the chosen tier. Returns the
 * redirect URL the client should `window.location` to.
 *
 * Tier-scoping note (Phase 4):
 *   - `studio` is a user-level subscription — the entitlement row
 *     gets `workspaceId = NULL` so it applies across every workspace
 *     the user owns.
 *   - `pro`, `team`, and `wedding` remain workspace-scoped.
 *
 * Dev fallback: when Stripe isn't configured, writes the entitlement
 * locally and returns a dev-success URL — lets the rest of the app's
 * tier-gating run without provisioning real keys.
 */
export async function createCheckoutSessionAction(
  tier: PaidTier,
): Promise<{ url: string }> {
  const me = await getCurrentUser();
  const ws = await getActiveWorkspace();

  // Studio is the only tier that's user-level rather than workspace-
  // level. Carry NULL through metadata + grant so downstream code
  // sees the right scope.
  const scopedWorkspaceId: string | null = tier === "studio" ? null : ws;

  if (!stripe) {
    // Dev path: short-circuit, grant the entitlement locally.
    await grantEntitlement({
      userId: me,
      workspaceId: scopedWorkspaceId,
      tier,
      source: "purchase",
      durationDays: tier === "wedding" ? null : 30,
      notes: "dev:no-stripe",
    });
    return { url: `${siteUrl()}/app/board?upgrade=ok&dev=1` };
  }

  const priceId = priceIdFor(tier);
  if (!priceId) {
    throw new Error(`No Stripe price id for tier "${tier}"`);
  }

  // Stripe metadata must be string-valued; we encode user-level
  // scoping with the literal "*" sentinel and decode it server-side
  // in the webhook. Keeps the type contract honest.
  const metadataWorkspaceId = scopedWorkspaceId ?? "*";

  const session = await stripe.checkout.sessions.create({
    mode: tier === "wedding" ? "payment" : "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl()}/app/board?upgrade=ok&session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/pricing?upgrade=cancel`,
    client_reference_id: `${me}::${metadataWorkspaceId}`,
    metadata: { userId: me, workspaceId: metadataWorkspaceId, tier },
    subscription_data:
      tier === "wedding"
        ? undefined
        : {
            metadata: { userId: me, workspaceId: metadataWorkspaceId, tier },
          },
  });

  if (!session.url) {
    throw new Error("Stripe returned a session without a URL");
  }
  return { url: session.url };
}

/** Server-side helper used by both the dev path above AND the
 *  Stripe webhook on `checkout.session.completed`. Single source
 *  of truth for entitlement-row insertion.
 *
 *  `workspaceId` accepts null for user-level entitlements (Studio).
 *  The DB column is already nullable; the type tightens the contract
 *  so the call site declares scope intent explicitly. */
export async function grantEntitlement(input: {
  userId: string;
  workspaceId: string | null;
  tier: EntitlementTier;
  source: "purchase" | "comp" | "edu" | "default";
  /** null = perpetual (e.g. wedding one-time). */
  durationDays: number | null;
  notes?: string | null;
}): Promise<void> {
  const id = `e-${Math.random().toString(36).slice(2, 12)}`;
  const expiresAt =
    input.durationDays != null
      ? new Date(Date.now() + input.durationDays * 24 * 60 * 60 * 1000)
      : null;
  await db.insert(entitlements).values({
    id,
    workspaceId: input.workspaceId,
    userId: input.userId,
    tier: input.tier,
    source: input.source,
    startedAt: new Date(),
    expiresAt,
    notes: input.notes ?? null,
  });
}

/** Cancel an active entitlement — called from Stripe's
 *  `customer.subscription.deleted` webhook. Sets `expiresAt = now`
 *  rather than deleting the row, so the audit trail survives. */
export async function expireEntitlementByNotes(
  notesMatch: string,
): Promise<void> {
  await db
    .update(entitlements)
    .set({ expiresAt: new Date() })
    .where(eq(entitlements.notes, notesMatch));
}
