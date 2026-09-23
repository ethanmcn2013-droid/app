import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { entitlements } from "@/server/db/schema";
import type { EntitlementTier } from "@/lib/data";
import { expireSharedEntitlement, writeSharedEntitlement } from "@/lib/entitlements-shared/writes";
import type { EntitlementSource as SharedSource } from "@/lib/entitlements-shared/schema";
import { opLog } from "@/server/operational-log";

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

/** Internal helper used by verified provider webhooks. This module must
 * never become a client-callable Server Action.
 *
 *  `workspaceId` accepts null for user-level entitlements (Studio).
 *  The DB column is already nullable; the type tightens the contract
 *  so the call site declares scope intent explicitly.
 *
 * Local insertion is idempotent on user and provider reference. Every retry
 * resumes the shared write with the original term, including historical rows.
 */
export async function grantEntitlement(input: {
  userId: string;
  workspaceId: string | null;
  tier: EntitlementTier;
  source: "purchase" | "comp" | "edu" | "default";
  /** null = perpetual (e.g. wedding one-time). */
  durationDays: number | null;
  /** Provider-backed absolute term; retries must not move the end date. */
  expiresAt?: Date | null;
  notes?: string | null;
}, dependencies: {
  database?: typeof db;
  mirror?: typeof writeSharedEntitlement;
} = {}): Promise<void> {
  const database = dependencies.database ?? db;
  const mirror = dependencies.mirror ?? writeSharedEntitlement;
  let existing: typeof entitlements.$inferSelect | undefined;
  if (input.notes) {
    [existing] = await database
      .select()
      .from(entitlements)
      // Internal lookup is scoped to the provider-authenticated user.
      .where(and(eq(entitlements.notes, input.notes), eq(entitlements.userId, input.userId)))
      .limit(1);
    if (existing && (existing.workspaceId !== input.workspaceId || existing.tier !== input.tier || existing.source !== input.source)) {
      throw new Error("Entitlement reference does not match its recorded scope.");
    }
  }

  // The primary key serialises concurrent retries without a schema change.
  // Honour historical random IDs found above before using the stable key.
  const id = existing?.id ?? (input.notes
    ? `e-${createHash("sha256").update(JSON.stringify([input.userId, input.notes])).digest("hex")}`
    : `e-${crypto.randomUUID()}`);
  const expiresAt = existing ? existing.expiresAt : input.expiresAt !== undefined ? input.expiresAt :
    input.durationDays != null
      ? new Date(Date.now() + input.durationDays * 24 * 60 * 60 * 1000)
      : null;
  await database.insert(entitlements).values({
    id,
    workspaceId: input.workspaceId,
    userId: input.userId,
    tier: input.tier,
    source: input.source,
    startedAt: new Date(),
    expiresAt,
    notes: input.notes ?? null,
  }).onConflictDoNothing({ target: entitlements.id });

  const [stored] = await database.select().from(entitlements)
    .where(and(eq(entitlements.id, id), eq(entitlements.userId, input.userId))).limit(1);
  if (!stored || stored.workspaceId !== input.workspaceId || stored.tier !== input.tier || stored.source !== input.source) {
    throw new Error("Entitlement reference does not match its recorded scope.");
  }

  // E-3.2 · Mirror the grant into the shared signal-entitlements DB
  // so Roadmap / Analytics / Notes / Studio can read the same tier.
  // The local grant survives a failed mirror, but the webhook must retry.
  // Do not acknowledge completed fulfilment until both writes agree.
  const sharedSource = toSharedSource(input.source, input.tier);
  if (sharedSource) {
    try {
      await mirror({
        userClerkId: input.userId,
        tier: input.tier,
        source: sharedSource,
        sourceRef: input.notes ?? null,
        expiresAtMs: stored.expiresAt ? stored.expiresAt.getTime() : null,
        metadata: {
          workspaceId: input.workspaceId,
          origin: "tasks-grantEntitlement",
        },
      });
    } catch {
      opLog("warn", "billing", "Fulfilment pending", { localGrantRecorded: true });
      throw new Error("Payment fulfilment is pending. Retry the same provider event.");
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
  } catch {
    opLog("warn", "billing", "Expiry pending", { localExpiryRecorded: true });
    throw new Error("Billing access reconciliation is pending.");
  }
}
