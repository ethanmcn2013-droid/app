import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { entitlementsDb } from "./client";
import {
  entitlements,
  type EntitlementSource,
  type EntitlementTier,
} from "./schema";

/**
 * Insert a row into the shared signal-entitlements DB. Used by
 * Tasks (Stripe webhook + comp redemption) and Studio (admin grants).
 *
 * Idempotent on `sourceRef` + `source`, if a row with the same
 * (source, source_ref) already exists for the user, returns its id
 * without inserting. This makes the helper safe to retry from
 * webhook handlers.
 */
export async function writeSharedEntitlement(input: {
  userClerkId: string;
  tier: EntitlementTier;
  source: EntitlementSource;
  sourceRef?: string | null;
  expiresAtMs?: number | null;
  metadata?: Record<string, unknown> | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}, database?: ReturnType<typeof entitlementsDb>): Promise<{ id: string; created: boolean }> {
  const db = database ?? entitlementsDb();

  if (input.sourceRef) {
    const existing = await db
      .select({ id: entitlements.id })
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userClerkId, input.userClerkId),
          eq(entitlements.source, input.source),
          eq(entitlements.sourceRef, input.sourceRef),
        ),
      )
      .limit(1);
    if (existing[0]) return { id: existing[0].id, created: false };
  }

  const id = input.sourceRef
    ? `e-${createHash("sha256").update(JSON.stringify([input.userClerkId, input.source, input.sourceRef])).digest("hex")}`
    : `e-${randomUUID()}`;

  // Retry on transient errors, Turso reads at the edge can briefly
  // reject writes during failover. Three attempts with short
  // exponential backoff narrows the divergence window from
  // "indefinite" to a sub-second blip. The daily reconcile sweep
  // (Tasks /api/cron/digest) is the safety net beyond that.
  const BACKOFFS_MS = [0, 100, 300];
  let lastErr: unknown;
  for (const wait of BACKOFFS_MS) {
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      const inserted = await db.insert(entitlements).values({
        id,
        userClerkId: input.userClerkId,
        tier: input.tier,
        source: input.source,
        sourceRef: input.sourceRef ?? null,
        expiresAt: input.expiresAtMs ?? null,
        status: "active",
        stripeCustomerId: input.stripeCustomerId ?? null,
        stripeSubscriptionId: input.stripeSubscriptionId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      }).onConflictDoNothing({ target: entitlements.id }).returning({ id: entitlements.id });
      return { id, created: inserted.length > 0 };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/**
 * Mark an entitlement expired in the shared DB. Used by Stripe's
 * subscription.deleted webhook. Matches by stripe_subscription_id
 * (the deterministic key) or by sourceRef as a fallback.
 */
export async function expireSharedEntitlement(input: {
  stripeSubscriptionId?: string | null;
  sourceRef?: string | null;
}): Promise<void> {
  const db = entitlementsDb();
  const now = Date.now();
  if (input.stripeSubscriptionId) {
    await db
      .update(entitlements)
      .set({ expiresAt: now, status: "expired", updatedAt: now })
      .where(eq(entitlements.stripeSubscriptionId, input.stripeSubscriptionId));
    return;
  }
  if (input.sourceRef) {
    await db
      .update(entitlements)
      .set({ expiresAt: now, status: "expired", updatedAt: now })
      .where(eq(entitlements.sourceRef, input.sourceRef));
  }
}
