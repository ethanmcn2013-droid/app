import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { sponsoredUseIntents, sponsoredUseSubjects } from "./schema";
import { usageActorKey, type UsageExecutor } from "./capture";
import { RETENTION_MS } from "@/lib/sponsored-use/service-auth";

/** The caller has already established the real account deletion fence. */
export async function queueUsageErasure(tx: UsageExecutor, clerkId: string, now = Date.now()): Promise<void> {
  const actorKey = usageActorKey(clerkId);
  const subjects = await tx.select().from(sponsoredUseSubjects).where(eq(sponsoredUseSubjects.actorKey, actorKey));
  for (const subject of subjects) {
    await tx.insert(sponsoredUseIntents).values({
      id: "erase:" + subject.epoch + ":" + subject.subjectIdHash, kind: "erase", actorKey,
      epoch: subject.epoch, entitlementId: null,
      payload: JSON.stringify({ subjectIdHash: subject.subjectIdHash }),
      createdAt: now,
    }).onConflictDoNothing();
  }
  await tx.delete(sponsoredUseIntents).where(and(eq(sponsoredUseIntents.actorKey, actorKey), eq(sponsoredUseIntents.kind, "event")));
  await tx.delete(sponsoredUseSubjects).where(eq(sponsoredUseSubjects.actorKey, actorKey));
}
/** Hard raw-data horizon even when delivery is unavailable. Never erase unacked erasure intents. */
export async function sweepUsageIntents(tx: UsageExecutor, now: number): Promise<void> {
  await tx.delete(sponsoredUseIntents).where(and(eq(sponsoredUseIntents.kind, "event"), lt(sponsoredUseIntents.createdAt, now - RETENTION_MS)));
  await tx.delete(sponsoredUseIntents).where(and(eq(sponsoredUseIntents.kind, "erase"), lt(sponsoredUseIntents.deliveredAt, now - RETENTION_MS)));
  const cutoff = new Date(now); cutoff.setUTCMonth(cutoff.getUTCMonth() - 24);
  await tx.delete(sponsoredUseSubjects).where(lt(sponsoredUseSubjects.updatedAt, cutoff.getTime()));
}
