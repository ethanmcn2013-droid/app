import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import type { db } from "@/server/db";
import { entitlements, users } from "@/server/db/schema";
import { hashIdentity } from "@/lib/account/instrumentation/emitter";
import { hashEpoch } from "@/lib/sponsored-use/service-auth";
import { sponsoredUseIntents, sponsoredUseSubjects } from "./schema";
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
/** Only called within addTaskAction's transaction; stores intent, never delivers. */
export async function captureTaskCreated(tx: UsageExecutor,
  input: { actorUserId: string; projectId: string }, config = captureConfig()): Promise<void> {
  if (!config.enabled || !config.salt || config.salt.length < 16) return;
  const [actor] = await tx.select({ clerkId: users.clerkId }).from(users)
    .where(eq(users.id, input.actorUserId)).limit(1);
  if (!actor?.clerkId) return;
  // Conservative historical gate: ambiguous or noncanonical access is not
  // collected. Studio independently verifies its issuance mirror on delivery.
  const grants = await tx.select().from(entitlements).where(and(
    eq(entitlements.userId, input.actorUserId), eq(entitlements.workspaceId, input.projectId),
    eq(entitlements.source, "comp"), lte(entitlements.startedAt, new Date(config.now)),
    gt(entitlements.expiresAt, new Date(config.now)),
  )).limit(2);
  if (grants.length !== 1 || !grants[0].notes?.startsWith("comp:")) return;
  const canonical = await readCanonicalVenueClaim(tx, { entitlementId: grants[0].id });
  if (!canonical || canonical.userId !== input.actorUserId || canonical.workspaceId !== input.projectId ||
    config.now < canonical.grantStartsAt || config.now >= canonical.grantEndsAt) return;
  const epoch = hashEpoch(config.salt);
  const subjectIdHash = hashIdentity(actor.clerkId, config.salt);
  const actorKey = usageActorKey(actor.clerkId);
  const event = { eventId: randomUUID(), instrumentationVersion: "instrumentation.v1",
    product: "tasks", kind: "task_created", occurredAt: Math.floor(config.now / 60_000) * 60_000,
    subjectIdHash, workspaceIdHash: hashIdentity(input.projectId, config.salt) };
  await tx.insert(sponsoredUseIntents).values({ id: event.eventId, kind: "event", actorKey,
    entitlementId: grants[0].id, epoch, payload: JSON.stringify(event), createdAt: config.now });
  await tx.insert(sponsoredUseSubjects).values({ actorKey, epoch, subjectIdHash, updatedAt: config.now })
    .onConflictDoUpdate({ target: [sponsoredUseSubjects.actorKey, sponsoredUseSubjects.epoch],
      set: { updatedAt: config.now } });
}
