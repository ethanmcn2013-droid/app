"use server";

import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { entitlements } from "@/server/db/schema";
import { getActiveWorkspaceOrNull, getCurrentUser } from "@/server/auth";
import { authorizeProjectCandidate } from "@/server/actions/project-authz";
import {
  MissingStripePriceError,
  priceIdFor,
  stripe,
  type BillingInterval,
  type PaidTier,
} from "@/server/stripe";
import type { EntitlementTier } from "@/lib/data";
import {
  expireSharedEntitlement,
  writeSharedEntitlement,
} from "@/lib/entitlements-shared/writes";
import type { EntitlementSource as SharedSource } from "@/lib/entitlements-shared/schema";
import { isDemoMode } from "@/lib/access-mode";

/** Translate Tasks's local source vocab to canonical shared vocab.
 *  Tier-aware: a "purchase" of a one-time tier (wedding/event) maps
 *  to event_pass; a "purchase" of a recurring tier maps to
 *  workspace_subscription. */
function toSharedSource(
  source: "purchase" | "comp" | "edu" | "default",
  tier: EntitlementTier,
): SharedSource | null {
  switch (source) {
    case "purchase":
      return tier === "wedding" || tier === "event"
        ? "event_pass"
        : "workspace_subscription";
    case "comp":
      return "compliments";
    case "edu":
      return "student_edu";
    case "default":
      return null; // free defaults don't need a shared row
  }
}

const FALLBACK_BASE = "http://localhost:3001";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_BASE;
}

/**
 * Mint a Stripe Checkout session for the chosen tier. Returns the
 * redirect URL the client should `window.location` to.
 *
 * Tier-scoping note (Phase 4):
 *   - `studio` is a user-level subscription, the entitlement row
 *     gets `workspaceId = NULL` so it applies across every workspace
 *     the user owns.
 *   - `pro`, `team`, and `wedding` remain workspace-scoped.
 *
 * Dev fallback: when Stripe isn't configured, writes the entitlement
 * locally and returns a dev-success URL, lets the rest of the app's
 * tier-gating run without provisioning real keys.
 */
export async function createCheckoutSessionAction(
  tier: PaidTier,
  interval: BillingInterval = "monthly",
): Promise<{ url: string }> {
  if (isDemoMode()) {
    return { url: `${siteUrl()}/app/tasks?checkout=review&tier=${tier}` };
  }
  const me = await getCurrentUser();
  // The entitlement this checkout grants is scoped to a Project, so the
  // Project has to be proved before Stripe is told which one to bill for.
  // Previously an ambient cookie chose it, and its LEGACY_WORKSPACE_ID
  // fallback could have attached a paid entitlement to a workspace the caller
  // had proved no membership of (D-005).
  const ambient = await getActiveWorkspaceOrNull();
  const grant = await authorizeProjectCandidate({
    candidateProjectId: ambient,
    capability: "createOrEditTasks",
    actorUserId: me,
  });
  if (!grant.ok) throw new Error("That project isn’t available.");
  const ws = grant.projectId;

  // Studio is the only tier that's user-level rather than workspace-
  // level. Carry NULL through metadata + grant so downstream code
  // sees the right scope.
  const scopedWorkspaceId: string | null = tier === "studio" ? null : ws;

  const configuredPriceId = priceIdFor(tier, interval);
  if (interval === "annual" && !configuredPriceId) {
    throw new MissingStripePriceError(tier, interval);
  }

  if (!stripe) {
    // Dev path: short-circuit, grant the entitlement locally.
    await grantEntitlement({
      userId: me,
      workspaceId: scopedWorkspaceId,
      tier,
      source: "purchase",
      durationDays:
        tier === "wedding" ? null : interval === "annual" ? 365 : 30,
      notes: `dev:no-stripe${interval === "annual" ? ":annual" : ""}`,
    });
    return { url: `${siteUrl()}/app/tasks?upgrade=ok&dev=1` };
  }

  const priceId = configuredPriceId;
  if (!priceId) {
    throw new MissingStripePriceError(tier, interval);
  }

  // Stripe metadata must be string-valued; we encode user-level
  // scoping with the literal "*" sentinel and decode it server-side
  // in the webhook. Keeps the type contract honest.
  const metadataWorkspaceId = scopedWorkspaceId ?? "*";

  const session = await stripe.checkout.sessions.create({
    mode: tier === "wedding" ? "payment" : "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl()}/app/tasks?upgrade=ok&session={CHECKOUT_SESSION_ID}`,
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
 *  so the call site declares scope intent explicitly.
 *
 *  Idempotent on `notes`: if a row with the same notes value already
 *  exists, the call is a no-op. This makes the function safe to retry
 *  from the Stripe webhook handler, the `stripe:<event-id>` notes
 *  string serves as the natural dedup key, so a webhook retry after
 *  a partial-handler crash re-runs the grant without creating a
 *  duplicate entitlement. */
export async function grantEntitlement(input: {
  userId: string;
  workspaceId: string | null;
  tier: EntitlementTier;
  source: "purchase" | "comp" | "edu" | "default";
  /** null = perpetual (e.g. wedding one-time). */
  durationDays: number | null;
  notes?: string | null;
}): Promise<void> {
  if (input.notes) {
    const [existing] = await db
      .select({ id: entitlements.id })
      .from(entitlements)
      // isolation-ok: idempotency dedupe keyed on the globally-unique comp
      // `notes` marker; reads only the id to decide skip, returns no tenant
      // data to any caller.
      .where(eq(entitlements.notes, input.notes))
      .limit(1);
    if (existing) return;
  }

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

  // E-3.2 · Mirror the grant into the shared signal-entitlements DB
  // so Roadmap / Analytics / Notes / Studio can read the same tier.
  // Fire-and-forget: if shared write fails, the local grant still
  // succeeds, and a future reconcile sweep can backfill. Entitlement
  // mirroring MUST NOT break a paid checkout.
  const sharedSource = toSharedSource(input.source, input.tier);
  if (sharedSource) {
    try {
      await writeSharedEntitlement({
        userClerkId: input.userId,
        tier: input.tier,
        source: sharedSource,
        sourceRef: input.notes ?? null,
        expiresAtMs: expiresAt ? expiresAt.getTime() : null,
        metadata: {
          workspaceId: input.workspaceId,
          origin: "tasks-grantEntitlement",
        },
      });
    } catch (err) {
      console.warn("[grantEntitlement] shared mirror failed", err);
    }
  }
}

/** Cancel an active entitlement, called from Stripe's
 *  `customer.subscription.deleted` webhook. Sets `expiresAt = now`
 *  rather than deleting the row, so the audit trail survives. */
export async function expireEntitlementByNotes(
  notesMatch: string,
): Promise<void> {
  await db
    .update(entitlements)
    .set({ expiresAt: new Date() })
    .where(eq(entitlements.notes, notesMatch));

  // Mirror the expiry into the shared DB. Match by sourceRef since
  // notes-string maps 1:1 to source_ref in writeSharedEntitlement.
  try {
    await expireSharedEntitlement({ sourceRef: notesMatch });
  } catch (err) {
    console.warn("[expireEntitlementByNotes] shared mirror failed", err);
  }
}
