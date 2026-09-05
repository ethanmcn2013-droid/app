import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { db } from "@/server/db";
import { eventPurchaseDesignations, users, workspaceMembers, workspaces } from "@/server/db/schema";
import { hasAccountDeletionStartedWith } from "@/server/account-deletion-lifecycle";
import { assertProjectNotDeleting, ProjectDeletionInProgressError } from "@/server/projects/project-deletion-fence";
import { parseProjectId } from "@/lib/projects/project-ref";
import { eventAccessExpiresAt } from "@/server/checkout-policy";
import type { StripeAccess } from "@/server/stripe-access";

export type EventDatabase = typeof db;
export type EventExecutor = Pick<EventDatabase, "select" | "insert" | "update">;
type Receipt = typeof eventPurchaseDesignations.$inferSelect;
type Refusal = NonNullable<Receipt["reason"]>;

export class EventDesignationPendingError extends Error {
  readonly code = "event-designation-reconciliation-required";
  constructor() {
    super("Payment is recorded, but project designation requires reconciliation.");
    this.name = "EventDesignationPendingError";
  }
}

function canonicalIdentity(actorUserId: string, workspaceId: string) {
  if (typeof actorUserId !== "string" || !actorUserId || actorUserId.trim() !== actorUserId ||
      !parseProjectId(workspaceId)) throw new Error("Event project is not available.");
}

function positiveSecond(date: Date): Date {
  const milliseconds = date.getTime();
  if (!Number.isFinite(milliseconds) || milliseconds < 1000) throw new Error("Event payment term is invalid.");
  return new Date(Math.floor(milliseconds / 1000) * 1000);
}

function reference(value: string) {
  if (!/^stripe:cs_[A-Za-z0-9_]{1,240}$/.test(value)) throw new Error("Event payment reference is invalid.");
  return value;
}

/** Fresh primary ownership, membership and the existing deletion fences.
 * Pass the transaction that will commit checkout or settlement, never a UI proof.
 */
export async function eventOwnerRefusal(
  database: EventExecutor, actorUserId: string, workspaceId: string,
): Promise<Refusal | null> {
  canonicalIdentity(actorUserId, workspaceId);
  if (await hasAccountDeletionStartedWith(database, actorUserId)) throw new Error("Billing account is not available.");
  const [actor] = await database.select({ id: users.id }).from(users)
    .where(and(eq(users.id, actorUserId), eq(users.clerkId, actorUserId))).limit(1);
  if (!actor) throw new Error("Billing account is not available.");
  const [project] = await database.select({ owner: workspaces.ownerUserId, archived: workspaces.archivedAt })
    .from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  if (!project) throw new Error("Event project is not available.");
  try { await assertProjectNotDeleting(database, workspaceId); }
  catch (error) {
    if (error instanceof ProjectDeletionInProgressError) return "project_deleting";
    throw error;
  }
  if (project.archived) return "project_archived";
  if (project.owner !== actorUserId) return "owner_changed";
  const [member] = await database.select({ userId: workspaceMembers.userId }).from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, actorUserId))).limit(1);
  return member ? null : "membership_removed";
}

/** Durable intent precedes the provider call, so losing its response/commit
 * leaves an exact local proof the signed settlement metadata can reconcile.
 * This is a server-only writer, not a remotely callable action or sales bypass.
 */
export async function prepareEventCheckoutWith(
  database: EventDatabase, input: { actorUserId: string; workspaceId: string },
): Promise<string> {
  return database.transaction(async transaction => {
    if (await eventOwnerRefusal(transaction, input.actorUserId, input.workspaceId)) {
      throw new Error("Only the current primary owner can designate this Event project.");
    }
    const id = "eci_" + randomUUID();
    await transaction.insert(eventPurchaseDesignations).values({
      id, purchaserUserId: input.actorUserId, workspaceId: input.workspaceId,
      checkoutAuthorizedAt: positiveSecond(new Date()),
    });
    return id;
  }, { behavior: "immediate" });
}

/** Rechecks ownership after preparation and holds the existing local fences
 * across session creation. Provider idempotency is scoped to this durable intent.
 */
export async function createEventCheckoutWith(
  database: EventDatabase,
  input: { actorUserId: string; workspaceId: string },
  createSession: (intentId: string) => Promise<{ id: string; url: string | null }>,
): Promise<{ url: string }> {
  const id = await prepareEventCheckoutWith(database, input);
  return database.transaction(async transaction => {
    if (await eventOwnerRefusal(transaction, input.actorUserId, input.workspaceId)) {
      throw new Error("Event checkout authority changed. Please try again.");
    }
    const session = await createSession(id);
    if (!session.url) throw new Error("Event checkout did not return a destination.");
    await transaction.update(eventPurchaseDesignations).set({ providerReference: reference("stripe:" + session.id) })
      .where(and(eq(eventPurchaseDesignations.id, id), eq(eventPurchaseDesignations.purchaserUserId, input.actorUserId),
        eq(eventPurchaseDesignations.workspaceId, input.workspaceId)));
    return { url: session.url };
  }, { behavior: "immediate" });
}

export async function createEventCheckout(
  input: { actorUserId: string; workspaceId: string },
  createSession: (intentId: string) => Promise<{ id: string; url: string | null }>,
): Promise<{ url: string }> {
  const { db: database } = await import("@/server/db");
  return createEventCheckoutWith(database, input, createSession);
}

/** Called only with provider-verified identity inside the local billing commit.
 * An absent new-intent marker never adopts a historical purchase.
 * Its return value is internal evidence, not project content authorization.
 */
export async function recordEventSettlementInTransaction(
  database: EventExecutor, input: StripeAccess, hasLocalPurchase: boolean,
): Promise<Receipt | null> {
  if (input.tier !== "event" || !input.workspaceId) return null;
  const proof = input.eventDesignation;
  const [stored] = await database.select().from(eventPurchaseDesignations).where(and(
    proof ? eq(eventPurchaseDesignations.id, proof.intentId) : eq(eventPurchaseDesignations.providerReference, input.reference),
    eq(eventPurchaseDesignations.purchaserUserId, input.userId),
    eq(eventPurchaseDesignations.workspaceId, input.workspaceId),
  )).limit(1);
  if (!stored) {
    if (proof) throw new Error("Event checkout proof is missing or has a different scope.");
    return null; // Existing fulfilment remains undesignated, with no backfill.
  }
  if (stored.providerReference && stored.providerReference !== input.reference) {
    throw new Error("Event checkout reference has a different binding.");
  }
  reference(input.reference);
  if (stored.designation !== "pending") {
    if (!hasLocalPurchase && stored.designation === "designated" && !input.revoked) {
      throw new Error("Event local fulfilment is missing. Reconciliation is required.");
    }
    // A later ownership lookup must not rewrite either historical outcome.
    if (proof && !input.revoked &&
        positiveSecond(proof.settledAt).getTime() !== stored.settledAt?.getTime()) {
      throw new Error("Event payment term differs from its recorded settlement.");
    }
    if (input.revoked && !stored.revoked) await markEventRevokedInTransaction(database, input);
    return { ...stored, revoked: stored.revoked || input.revoked };
  }
  if (hasLocalPurchase) throw new Error("Existing fulfilment cannot be retrospectively designated.");
  if (!proof || !/^eci_[0-9a-f-]{36}$/.test(proof.intentId) || input.subscriptionId !== null || !input.expiresAt) {
    throw new Error("Event settlement proof is incomplete.");
  }
  const settledAt = positiveSecond(proof.settledAt);
  if (!stored.checkoutAuthorizedAt || settledAt < stored.checkoutAuthorizedAt) {
    throw new Error("Event payment predates its checkout proof.");
  }
  const originalExpiresAt = positiveSecond(eventAccessExpiresAt(settledAt));
  if (positiveSecond(input.expiresAt).getTime() !== originalExpiresAt.getTime()) {
    throw new Error("Event payment term is invalid.");
  }
  const reason = await eventOwnerRefusal(database, input.userId, input.workspaceId);
  const values = {
    providerReference: input.reference, settledAt, originalExpiresAt,
    designation: reason ? "paid_undesignated" as const : "designated" as const,
    reason, settlementAuthorizedAt: reason ? null : positiveSecond(new Date()),
    revoked: input.revoked,
  };
  await database.update(eventPurchaseDesignations).set(values).where(and(
    eq(eventPurchaseDesignations.id, stored.id), eq(eventPurchaseDesignations.purchaserUserId, input.userId),
    eq(eventPurchaseDesignations.workspaceId, input.workspaceId),
  ));
  return { ...stored, ...values };
}

/** A negative observation can only retire an already recorded exact reference.
 * It never replaces the original positive term, purchaser or project proof.
 */
export async function markEventRevokedInTransaction(
  database: EventExecutor, input: Pick<StripeAccess, "userId" | "workspaceId" | "reference" | "tier">,
): Promise<void> {
  if (input.tier !== "event" || !input.workspaceId) return;
  await database.update(eventPurchaseDesignations).set({ revoked: true }).where(and(
    eq(eventPurchaseDesignations.providerReference, input.reference),
    eq(eventPurchaseDesignations.purchaserUserId, input.userId),
    eq(eventPurchaseDesignations.workspaceId, input.workspaceId),
  ));
}
