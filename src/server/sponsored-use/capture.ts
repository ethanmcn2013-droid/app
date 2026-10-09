import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, lt, lte, or } from "drizzle-orm";
import type { db } from "@/server/db";
import { entitlements, userPreferences, users } from "@/server/db/schema";
import { hashIdentity } from "@/lib/account/instrumentation/emitter";
import { hashEpoch } from "@/lib/sponsored-use/service-auth";
import { sponsoredUseIntents, sponsoredUseProjectLinks, sponsoredUseSubjects } from "./schema";
import { readCanonicalVenueClaim } from "@/server/venue-issuance/canonical";
export type UsageExecutor = Pick<typeof db, "select" | "insert" | "update" | "delete">;
export function usageActorKey(clerkId: string): string {
  return createHash("sha256").update("usage-erasure:v1:" + clerkId).digest("hex");
}
export type CaptureConfig = { enabled: boolean; salt?: string; now: number };
export function captureConfig(): CaptureConfig {
  return { enabled: process.env.SPONSOR_USAGE_EVENTS === "1",
    salt: process.env.SPONSOR_USAGE_HASH_SALT, now: Date.now() };
}
/** A gift belongs to the Project. A partner can act under its sole grant,
 * but a second active comp grant makes attribution ambiguous for everyone. */
export async function soleActiveProjectCompGrant(reader: Pick<UsageExecutor, "select">,
  projectId: string, at: number) {
  const grants = await reader.select().from(entitlements).where(and(
    eq(entitlements.workspaceId, projectId), eq(entitlements.source, "comp"),
    eq(entitlements.tier, "wedding"), lte(entitlements.startedAt, new Date(at)),
    or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, new Date(at))),
  )).limit(2);
  return grants.length === 1 ? grants[0] : null;
}
export async function soleProjectCompGrantAcrossInterval(reader: Pick<UsageExecutor, "select">,
  entitlementId: string, projectId: string, startsAt: number, endsAt: number): Promise<boolean> {
  const overlapping = await reader.select({ id: entitlements.id }).from(entitlements).where(and(
    eq(entitlements.workspaceId, projectId), eq(entitlements.source, "comp"),
    eq(entitlements.tier, "wedding"), lt(entitlements.startedAt, new Date(endsAt)),
    or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, new Date(startsAt))),
  )).limit(2);
  return overlapping.length === 1 && overlapping[0].id === entitlementId;
}
/** Only called within addTaskAction's transaction; stores intent, never delivers. */
export async function captureTaskCreated(tx: UsageExecutor,
  input: { actorUserId: string; projectId: string }, config = captureConfig()): Promise<void> {
  if (!config.enabled || !config.salt || config.salt.length < 16) return;
  const [actor] = await tx.select({ clerkId: users.clerkId }).from(users)
    .where(eq(users.id, input.actorUserId)).limit(1);
  if (!actor?.clerkId) return;
  // The action has already reauthorized the actor's task capability in this
  // transaction. Attribute a couple member to the Project's sole gift.
  const grant = await soleActiveProjectCompGrant(tx, input.projectId, config.now);
  if (!grant?.notes?.startsWith("comp:")) return;
  const canonical = await readCanonicalVenueClaim(tx, { entitlementId: grant.id });
  if (!canonical || canonical.workspaceId !== input.projectId ||
    config.now < canonical.grantStartsAt || config.now >= canonical.grantEndsAt) return;
  const [recipient] = await tx.select({ clerkId: users.clerkId }).from(users)
    .where(eq(users.id, grant.userId)).limit(1);
  if (!recipient?.clerkId) return;
  const preferences = await tx.select({ userId: userPreferences.userId, enabled: userPreferences.sponsorMeasurementEnabled })
    .from(userPreferences).where(or(eq(userPreferences.userId, input.actorUserId), eq(userPreferences.userId, grant.userId)));
  if (preferences.some(row => row.enabled === false)) return;
  const epoch = hashEpoch(config.salt);
  const subjectIdHash = hashIdentity(actor.clerkId, config.salt);
  const actorKey = usageActorKey(actor.clerkId);
  const workspaceIdHash = hashIdentity(input.projectId, config.salt);
  const event = { eventId: randomUUID(), instrumentationVersion: "instrumentation.v1",
    product: "tasks", kind: "task_created", occurredAt: Math.floor(config.now / 60_000) * 60_000,
    subjectIdHash, workspaceIdHash };
  await tx.insert(sponsoredUseIntents).values({ id: event.eventId, kind: "event", actorKey,
    entitlementId: grant.id, epoch, payload: JSON.stringify(event), createdAt: config.now });
  await tx.insert(sponsoredUseSubjects).values({ actorKey, epoch, subjectIdHash, updatedAt: config.now })
    .onConflictDoUpdate({ target: [sponsoredUseSubjects.actorKey, sponsoredUseSubjects.epoch],
      set: { updatedAt: config.now } });
  await tx.insert(sponsoredUseProjectLinks).values({ recipientKey: usageActorKey(recipient.clerkId), epoch,
    workspaceIdHash, sponsorId: canonical.sponsorId, updatedAt: config.now }).onConflictDoUpdate({
      target: [sponsoredUseProjectLinks.recipientKey, sponsoredUseProjectLinks.epoch, sponsoredUseProjectLinks.workspaceIdHash],
      set: { updatedAt: config.now },
    });
}
