import "server-only";
import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { entitlements, users, workspaces, workspaceMembers } from "@/server/db/schema";
import { hasAccountDeletionStartedWith } from "./account-deletion-lifecycle";
import { entitlementsDb } from "@/lib/entitlements-shared/client";
import { entitlements as sharedEntitlements } from "@/lib/entitlements-shared/schema";
import type { PaidTier } from "@/server/stripe";
import { recordEventSettlementInTransaction, markEventRevokedInTransaction, EventDesignationPendingError } from "@/server/db/event-designation";

export type StripeAccess = Readonly<{
  userId: string;
  workspaceId: string | null;
  tier: PaidTier;
  reference: string;
  customerId: string;
  subscriptionId: string | null;
  expiresAt: Date | null;
  revoked: boolean;
  /** Only the verified Event checkout handler supplies this new-intent proof. */
  eventDesignation?: Readonly<{ intentId: string; settledAt: Date }>;
}>;

type SharedDatabase = ReturnType<typeof entitlementsDb>;
type AccessDependencies = {
  database?: typeof db;
  sharedDatabase?: SharedDatabase;
  mirror?: typeof reconcileSharedStripeAccess;
};

/** Hold the existing deletion boundary through checkout/portal creation. */
export async function withBillingAccount<T>(userId: string, work: () => Promise<T>, database = db): Promise<T> {
  return database.transaction(async transaction => {
    if (await hasAccountDeletionStartedWith(transaction, userId)) throw new Error("Billing account is not available.");
    const [owner] = await transaction.select({ id: users.id }).from(users)
      .where(and(eq(users.id, userId), eq(users.clerkId, userId))).limit(1);
    if (!owner) throw new Error("Billing account is not available.");
    return work();
  }, { behavior: "immediate" });
}

/** Zero is a permanent provider-revocation tombstone, never a natural expiry.
 * A subscription may extend its paid term, but no retry may undo revocation.
 * Existing timestamp readers already treat the Unix epoch as expired.
 */
export async function reconcileStripeAccess(input: StripeAccess, dependencies: AccessDependencies = {}): Promise<void> {
  await reconcileStripeAccessBatch([input], dependencies);
}

/** Commit every validated local reference before any mirror can fail or stall.
 * Each local transaction is independent: one bad reference cannot suppress
 * another verified revocation. Failures remain retryable at the webhook.
 */
export async function reconcileStripeAccessBatch(inputs: readonly StripeAccess[], dependencies: AccessDependencies = {}): Promise<void> {
  const store = dependencies.database ?? db;
  const mirror = dependencies.mirror ?? (value => reconcileSharedStripeAccess(value, dependencies.sharedDatabase));
  const pending: { input: StripeAccess; id: string }[] = [];
  const failures: unknown[] = [];
  for (const input of inputs) {
    try {
      await retryBusyWrite(async () => {
        const result = await commitLocalAccess(input, dependencies);
        if (result?.id) pending.push({ input, id: result.id });
        if (result?.designationPending) failures.push(new EventDesignationPendingError());
      });
    } catch (error) { failures.push(error); }
  }
  for (const { input, id } of pending) {
    try {
      await retryBusyWrite(() => store.transaction(async transaction => {
        if (await hasAccountDeletionStartedWith(transaction, input.userId)) return;
        const [stored] = await transaction.select().from(entitlements)
          .where(and(eq(entitlements.id, id), eq(entitlements.userId, input.userId))).limit(1);
        if (!stored) throw new Error("Billing access changed before reconciliation.");
        await mirror({ ...input, expiresAt: stored.expiresAt, revoked: stored.expiresAt?.getTime() === 0 });
      }, { behavior: "immediate" }));
    } catch (error) { failures.push(error); }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "Billing access reconciliation is pending.");
}

async function commitLocalAccess(input: StripeAccess, dependencies: AccessDependencies): Promise<{ id?: string; designationPending?: boolean } | undefined> {
  const store = dependencies.database ?? db;
  if (!input.reference || !input.customerId || (input.workspaceId === null && input.tier !== "studio")) {
    throw new Error("Billing scope is incomplete.");
  }
  if (input.expiresAt && (!Number.isFinite(input.expiresAt.getTime()) || input.expiresAt.getTime() <= 0)) {
    throw new Error("Billing term is invalid.");
  }
  if (input.subscriptionId && !input.revoked && input.expiresAt === null) throw new Error("A paid subscription term is required.");
  return store.transaction(async (database) => {
    if (await hasAccountDeletionStartedWith(database, input.userId)) return;
    const [owner] = await database.select({ id: users.id }).from(users)
      .where(and(eq(users.id, input.userId), eq(users.clerkId, input.userId))).limit(1);
    if (!owner) throw new Error("Payment account is not available.");
    // isolation-ok: a verified Stripe delivery locates its global provider reference;
    // every matching owner/project/tier/source is checked below before a write,
    // and neither the row nor its values are returned to a requesting client.
    const existing = await database.select().from(entitlements)
      .where(eq(entitlements.notes, input.reference)).limit(2);
    if (existing.length > 1 || existing.some(row => row.userId !== input.userId || row.workspaceId !== input.workspaceId || row.tier !== input.tier || row.source !== "purchase")) {
      throw new Error("Billing reference has a different recorded scope.");
    }
    const eventReceipt = await recordEventSettlementInTransaction(database, input, existing.length === 1);
    const designationPending = eventReceipt?.designation === "paid_undesignated";
    if (designationPending && !input.revoked && !eventReceipt.revoked) {
      // Commit the paid receipt, then return a retryable failure OUTSIDE this
      // transaction. It must not create positive local or shared authority.
      return { designationPending: true };
    }
    let revoked = input.revoked || eventReceipt?.revoked === true || existing[0]?.expiresAt?.getTime() === 0;
    if (input.workspaceId !== null && !revoked && !(eventReceipt?.designation === "designated" && existing.length === 1)) {
      const [membership] = await database.select({ id: workspaces.id }).from(workspaces)
        .innerJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, input.userId)))
        .where(and(eq(workspaces.id, input.workspaceId), isNull(workspaces.archivedAt))).limit(1);
      if (!membership) throw new Error("Payment project is not available. Reconciliation is required.");
    }
    if (!revoked) {
      const binding = await positiveBinding(input, existing.length > 0, dependencies.sharedDatabase ?? entitlementsDb());
      revoked = binding.status === "revoked";
    }
    if (revoked) await markEventRevokedInTransaction(database, input);
    const id = existing[0]?.id ?? `e-${createHash("sha256").update(JSON.stringify([input.userId, input.reference])).digest("hex")}`;
    const term = revoked ? new Date(0) : input.expiresAt;
    const seconds = term ? Math.floor(term.getTime() / 1000) : null;
    await database.insert(entitlements).values({
      id, userId: input.userId, workspaceId: input.workspaceId, tier: input.tier,
      source: "purchase", notes: input.reference, expiresAt: term,
    }).onConflictDoUpdate({
      target: entitlements.id,
      set: {
        expiresAt: sql`CASE WHEN ${entitlements.expiresAt} = 0 OR ${revoked} THEN 0
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
    // A verified refund resolves the payment without retroactively designating
    // the project. Only its failed negative mirror still needs delivery retry.
    return { id: stored.id, designationPending: designationPending && !revoked };
  }, { behavior: "immediate" });
}

/** Positive-write policy: an existing local purchase must already have an
 * exact durable customer/subscription binding. Missing bindings and shared
 * outages are retryable failures, never permission to extend local access.
 * A first verified settlement establishes its binding before its first local
 * grant, under the same account/project checks and deletion transaction.
 */
async function positiveBinding(input: StripeAccess, hasLocalPurchase: boolean, database: SharedDatabase) {
  let rows = await sharedReferences(input, database);
  if (rows.length === 0 && !hasLocalPurchase) {
    await reconcileSharedStripeAccess(input, database);
    rows = await sharedReferences(input, database);
  }
  if (rows.length !== 1 || !sharedScopeMatches(rows[0], input) ||
      rows[0].stripeCustomerId !== input.customerId || rows[0].stripeSubscriptionId !== input.subscriptionId) {
    throw new Error("Verified billing binding is missing or has a different scope. Reconciliation is required.");
  }
  return rows[0];
}

type SharedRow = typeof sharedEntitlements.$inferSelect;
function sharedScopeMatches(row: SharedRow, input: Pick<StripeAccess, "userId" | "workspaceId" | "tier">) {
  const metadata = row.metadata ? JSON.parse(row.metadata) as { workspaceId?: unknown } : null;
  return row.userClerkId === input.userId && row.tier === input.tier && metadata?.workspaceId === input.workspaceId;
}
function sharedReferences(input: Pick<StripeAccess, "reference" | "subscriptionId">, database: SharedDatabase) {
  const source = input.subscriptionId ? "workspace_subscription" : "event_pass";
  // isolation-ok: exact verified provider reference; callers validate every returned scope before writing.
  return database.select().from(sharedEntitlements)
    .where(and(eq(sharedEntitlements.source, source), eq(sharedEntitlements.sourceRef, input.reference))).limit(2);
}

export type HistoricalStripeRevocation = Pick<StripeAccess, "userId" | "workspaceId" | "tier" | "reference">;

/** Customerless history can only reduce an existing, exactly scoped purchase.
 * Never insert a row or fill in customer/subscription authority on this path.
 */
export async function revokeHistoricalStripeAccess(input: HistoricalStripeRevocation, dependencies: AccessDependencies = {}): Promise<void> {
  if (!input.reference.startsWith("stripe:") || !input.workspaceId || (input.tier !== "event" && input.tier !== "wedding")) {
    throw new Error("Historical billing scope is invalid.");
  }
  const store = dependencies.database ?? db;
  await retryBusyWrite(async () => {
    const id = await store.transaction(async transaction => {
      if (await hasAccountDeletionStartedWith(transaction, input.userId)) return;
      // isolation-ok: only the exact verified provider reference is considered; every local scope is checked below.
      const rows = await transaction.select().from(entitlements).where(eq(entitlements.notes, input.reference)).limit(2);
      if (rows.length !== 1 || rows[0].userId !== input.userId || rows[0].workspaceId !== input.workspaceId ||
          rows[0].tier !== input.tier || rows[0].source !== "purchase") {
        throw new Error("Historical billing reference is missing or has a different scope.");
      }
      await transaction.update(entitlements).set({ expiresAt: new Date(0) }).where(eq(entitlements.id, rows[0].id));
      await markEventRevokedInTransaction(transaction, input);
      return rows[0].id;
    }, { behavior: "immediate" });
    if (!id) return;
    await store.transaction(async transaction => {
      if (await hasAccountDeletionStartedWith(transaction, input.userId)) return;
      const [local] = await transaction.select().from(entitlements)
        .where(and(eq(entitlements.id, id), eq(entitlements.userId, input.userId))).limit(1);
      if (!local || local.expiresAt?.getTime() !== 0) throw new Error("Historical revocation changed before reconciliation.");
      const database = dependencies.sharedDatabase ?? entitlementsDb();
      const rows = await sharedReferences({ ...input, subscriptionId: null }, database);
      if (rows.length > 1 || rows.some(row => !sharedScopeMatches(row, input) || row.stripeSubscriptionId !== null)) {
        throw new Error("Historical shared billing scope does not match.");
      }
      if (!rows[0]) return;
      const updated = await database.update(sharedEntitlements).set({ status: "revoked", expiresAt: 0, updatedAt: Date.now() })
        .where(and(eq(sharedEntitlements.id, rows[0].id), eq(sharedEntitlements.userClerkId, input.userId),
          eq(sharedEntitlements.tier, input.tier), eq(sharedEntitlements.source, "event_pass"),
          eq(sharedEntitlements.sourceRef, input.reference), isNull(sharedEntitlements.stripeSubscriptionId),
          sql`json_extract(${sharedEntitlements.metadata}, '$.workspaceId') IS ${input.workspaceId}`))
        .returning({ id: sharedEntitlements.id });
      if (updated.length !== 1) throw new Error("Historical shared billing scope changed during reconciliation.");
    }, { behavior: "immediate" });
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
  const existing = await sharedReferences(input, database);
  const matches = (row: typeof sharedEntitlements.$inferSelect) => {
    return sharedScopeMatches(row, input) &&
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
