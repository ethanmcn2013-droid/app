import "server-only";
import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { entitlements, users, workspaces, workspaceMembers } from "@/server/db/schema";
import { hasAccountDeletionStartedWith } from "./account-deletion-lifecycle";
import { entitlementsDb } from "@/lib/entitlements-shared/client";
import { entitlements as sharedEntitlements } from "@/lib/entitlements-shared/schema";
import type { PaidTier } from "@/server/stripe";

export type StripeAccess = Readonly<{
  userId: string;
  workspaceId: string | null;
  tier: PaidTier;
  reference: string;
  customerId: string;
  subscriptionId: string | null;
  expiresAt: Date | null;
  revoked: boolean;
}>;

/** Zero is a permanent provider-revocation tombstone, never a natural expiry.
 * A subscription may extend its paid term, but no retry may undo revocation.
 * Existing timestamp readers already treat the Unix epoch as expired.
 */
export async function reconcileStripeAccess(input: StripeAccess, dependencies: {
  database?: typeof db;
  mirror?: typeof reconcileSharedStripeAccess;
} = {}): Promise<void> {
  const store = dependencies.database ?? db;
  const mirror = dependencies.mirror ?? reconcileSharedStripeAccess;
  if (!input.reference || !input.customerId || (input.workspaceId === null && input.tier !== "studio")) {
    throw new Error("Billing scope is incomplete.");
  }
  if (input.expiresAt && (!Number.isFinite(input.expiresAt.getTime()) || input.expiresAt.getTime() <= 0)) {
    throw new Error("Billing term is invalid.");
  }
  if (input.subscriptionId && !input.revoked && input.expiresAt === null) throw new Error("A paid subscription term is required.");
  await retryBusyWrite(async () => {
    // Commit local truth first, so a failed mirror cannot roll back revocation.
    const storedId = await store.transaction(async (database) => {
      if (await hasAccountDeletionStartedWith(database, input.userId)) return;
      const [owner] = await database.select({ id: users.id }).from(users)
        .where(and(eq(users.id, input.userId), eq(users.clerkId, input.userId))).limit(1);
      if (!owner) throw new Error("Payment account is not available.");
      if (input.workspaceId !== null && !input.revoked) {
        const [membership] = await database.select({ id: workspaces.id }).from(workspaces)
          .innerJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, input.userId)))
          .where(and(eq(workspaces.id, input.workspaceId), isNull(workspaces.archivedAt))).limit(1);
        if (!membership) throw new Error("Payment project is not available. Reconciliation is required.");
      }
      // isolation-ok: a verified Stripe delivery locates its global provider reference;
      // every matching owner/project/tier/source is checked below before a write,
      // and neither the row nor its values are returned to a requesting client.
      const existing = await database.select().from(entitlements)
        .where(eq(entitlements.notes, input.reference)).limit(2);
      if (existing.length > 1 || existing.some(row => row.userId !== input.userId || row.workspaceId !== input.workspaceId || row.tier !== input.tier || row.source !== "purchase")) {
        throw new Error("Billing reference has a different recorded scope.");
      }
      const id = existing[0]?.id ?? `e-${createHash("sha256").update(JSON.stringify([input.userId, input.reference])).digest("hex")}`;
      const term = input.revoked ? new Date(0) : input.expiresAt;
      const seconds = term ? Math.floor(term.getTime() / 1000) : null;
      await database.insert(entitlements).values({
        id, userId: input.userId, workspaceId: input.workspaceId, tier: input.tier,
        source: "purchase", notes: input.reference, expiresAt: term,
      }).onConflictDoUpdate({
        target: entitlements.id,
        set: {
          expiresAt: sql`CASE WHEN ${entitlements.expiresAt} = 0 OR ${input.revoked} THEN 0
            WHEN ${Boolean(input.subscriptionId)} THEN max(coalesce(${entitlements.expiresAt}, 0), ${seconds})
            ELSE ${entitlements.expiresAt} END`,
        },
        setWhere: and(eq(entitlements.userId, input.userId), eq(entitlements.tier, input.tier), eq(entitlements.source, "purchase"),
          input.workspaceId === null ? isNull(entitlements.workspaceId) : eq(entitlements.workspaceId, input.workspaceId)),
      });
      const [stored] = await database.select().from(entitlements).where(eq(entitlements.id, id)).limit(1);
      if (!stored || stored.userId !== input.userId || stored.workspaceId !== input.workspaceId || stored.tier !== input.tier) {
        throw new Error("Billing reference has a different recorded scope.");
      }
      return stored.id;
    });
    if (!storedId) return;
    // Reacquire the account fence before mirroring. Erasure may have started
    // between commits; it must not race a new shared record into existence.
    await store.transaction(async database => {
      if (await hasAccountDeletionStartedWith(database, input.userId)) return;
      const [stored] = await database.select().from(entitlements)
        .where(and(eq(entitlements.id, storedId), eq(entitlements.userId, input.userId))).limit(1);
      if (!stored) throw new Error("Billing access changed before reconciliation.");
      await mirror({ ...input, expiresAt: stored.expiresAt, revoked: stored.expiresAt?.getTime() === 0 });
    });
  });
}

/** Only lock contention is retried here. Each write above is idempotent;
 * provider/database outages still return a failure for signed-event redelivery. */
async function retryBusyWrite(work: () => Promise<void>): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try { await work(); return; }
    catch (error) {
      const cause = error as { code?: string; cause?: { code?: string } };
      if (attempt >= 5 || (cause.code !== "SQLITE_BUSY" && cause.cause?.code !== "SQLITE_BUSY")) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
}

/** The shared ledger enforces the same irreversible revocation rule atomically. */
export async function reconcileSharedStripeAccess(input: StripeAccess, database = entitlementsDb()): Promise<void> {
  const source = input.subscriptionId ? "workspace_subscription" : "event_pass";
  const existing = await database.select().from(sharedEntitlements)
    .where(and(eq(sharedEntitlements.source, source), eq(sharedEntitlements.sourceRef, input.reference))).limit(2);
  const matches = (row: typeof sharedEntitlements.$inferSelect) => {
    const metadata = row.metadata ? JSON.parse(row.metadata) as { workspaceId?: unknown } : null;
    return row.userClerkId === input.userId && row.tier === input.tier && metadata?.workspaceId === input.workspaceId &&
      (!row.stripeCustomerId || row.stripeCustomerId === input.customerId) &&
      (!row.stripeSubscriptionId || row.stripeSubscriptionId === input.subscriptionId);
  };
  if (existing.length > 1 || existing.some(row => !matches(row))) throw new Error("Shared billing scope does not match.");
  const id = existing[0]?.id ?? `e-${createHash("sha256").update(JSON.stringify([input.userId, source, input.reference])).digest("hex")}`;
  const term = input.revoked ? 0 : input.expiresAt?.getTime() ?? null;
  await database.insert(sharedEntitlements).values({
    id, userClerkId: input.userId, tier: input.tier, source, sourceRef: input.reference,
    expiresAt: term, status: input.revoked ? "revoked" : "active",
    stripeCustomerId: input.customerId, stripeSubscriptionId: input.subscriptionId,
    metadata: JSON.stringify({ workspaceId: input.workspaceId, origin: "stripe-reconciliation" }),
  }).onConflictDoUpdate({
    target: sharedEntitlements.id,
    set: {
      expiresAt: sql`CASE WHEN ${sharedEntitlements.status} = 'revoked' OR ${input.revoked} THEN 0
        WHEN ${Boolean(input.subscriptionId)} THEN max(coalesce(${sharedEntitlements.expiresAt}, 0), ${term})
        ELSE ${sharedEntitlements.expiresAt} END`,
      status: sql`CASE WHEN ${sharedEntitlements.status} = 'revoked' OR ${input.revoked} THEN 'revoked' ELSE 'active' END`,
      stripeCustomerId: input.customerId, stripeSubscriptionId: input.subscriptionId, updatedAt: Date.now(),
    },
    setWhere: and(eq(sharedEntitlements.userClerkId, input.userId), eq(sharedEntitlements.tier, input.tier),
      sql`json_extract(${sharedEntitlements.metadata}, '$.workspaceId') IS ${input.workspaceId}`,
      sql`(${sharedEntitlements.stripeCustomerId} IS NULL OR ${sharedEntitlements.stripeCustomerId} = ${input.customerId})`,
      sql`(${sharedEntitlements.stripeSubscriptionId} IS NULL OR ${sharedEntitlements.stripeSubscriptionId} IS ${input.subscriptionId})`),
  });
  const [stored] = await database.select().from(sharedEntitlements).where(eq(sharedEntitlements.id, id)).limit(1);
  if (!stored || !matches(stored)) throw new Error("Shared billing scope does not match.");
}

/** A provider-authenticated ledger binding, never an email-address lookup. */
export async function billingCustomerForUser(userId: string, database = entitlementsDb()): Promise<string | null> {
  const rows = await database.select({ customerId: sharedEntitlements.stripeCustomerId }).from(sharedEntitlements)
    .where(and(eq(sharedEntitlements.userClerkId, userId), sql`${sharedEntitlements.stripeCustomerId} IS NOT NULL`));
  const ids = [...new Set(rows.map(row => row.customerId).filter((id): id is string => Boolean(id)))];
  if (ids.length > 1) throw new Error("Your billing records need review before the portal can open.");
  return ids[0] ?? null;
}
