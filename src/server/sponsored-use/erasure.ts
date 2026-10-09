import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { entitlements, users } from "@/server/db/schema";
import { hashIdentity } from "@/lib/account/instrumentation/emitter";
import { hashEpoch } from "@/lib/sponsored-use/service-auth";
import { readCanonicalVenueClaim } from "@/server/venue-issuance/canonical";
import { sponsoredUseIntents, sponsoredUseProjectLinks, sponsoredUseSubjects } from "./schema";
import { usageActorKey, type UsageExecutor } from "./capture";
import { RETENTION_MS } from "@/lib/sponsored-use/service-auth";

/** The caller has already established the real account deletion fence. */
export async function queueUsageErasure(tx: UsageExecutor, clerkId: string, now = Date.now()): Promise<void> {
  const actorKey = usageActorKey(clerkId);
  const workspaceControls = new Map<string, {epoch:string;workspaceIdHash:string;sponsorId:string}>();
  const [recipient] = await tx.select({id:users.id}).from(users).where(eq(users.clerkId,clerkId));
  if (recipient) {
    const grants = await tx.select({id:entitlements.id}).from(entitlements).where(eq(entitlements.userId,recipient.id));
    const previous: unknown = (()=>{try{return JSON.parse(process.env.SPONSOR_USAGE_PREVIOUS_SALTS_JSON ?? "[]");}catch{return [];}})();
    const salts = [process.env.SPONSOR_USAGE_HASH_SALT,...(Array.isArray(previous)?previous:[])]
      .filter((salt):salt is string=>typeof salt==="string" && salt.length>=16);
    for (const grant of grants) {
      const claim = await readCanonicalVenueClaim(tx,{entitlementId:grant.id});
      if (!claim || claim.userId!==recipient.id) continue;
      for (const salt of salts) {
        const epoch=hashEpoch(salt),workspaceIdHash=hashIdentity(claim.workspaceId,salt);
        workspaceControls.set(epoch+":"+workspaceIdHash+":"+claim.sponsorId,{epoch,workspaceIdHash,sponsorId:claim.sponsorId});
      }
    }
  }
  const subjects = await tx.select().from(sponsoredUseSubjects).where(eq(sponsoredUseSubjects.actorKey, actorKey));
  for (const subject of subjects) {
    await tx.insert(sponsoredUseIntents).values({
      id: "erase:subject:" + subject.epoch + ":" + subject.subjectIdHash, kind: "erase", actorKey,
      epoch: subject.epoch, entitlementId: null,
      payload: JSON.stringify({ subjectIdHash: subject.subjectIdHash }),
      createdAt: now,
    }).onConflictDoNothing();
  }
  const links = await tx.select().from(sponsoredUseProjectLinks).where(eq(sponsoredUseProjectLinks.recipientKey, actorKey));
  for (const link of links) workspaceControls.set(link.epoch+":"+link.workspaceIdHash+":"+link.sponsorId,link);
  for (const control of workspaceControls.values()) {
    await tx.insert(sponsoredUseIntents).values({
      id: "erase:workspace:" + control.epoch + ":" + control.workspaceIdHash + ":" + control.sponsorId,
      kind: "erase", actorKey, epoch: control.epoch, entitlementId: null,
      payload: JSON.stringify({ workspaceIdHash: control.workspaceIdHash, sponsorId: control.sponsorId }), createdAt: now,
    }).onConflictDoNothing();
  }
  await tx.delete(sponsoredUseIntents).where(and(eq(sponsoredUseIntents.actorKey, actorKey), eq(sponsoredUseIntents.kind, "event")));
  await tx.delete(sponsoredUseSubjects).where(eq(sponsoredUseSubjects.actorKey, actorKey));
  await tx.delete(sponsoredUseProjectLinks).where(eq(sponsoredUseProjectLinks.recipientKey, actorKey));
}
/** Hard raw-data horizon even when delivery is unavailable. Never erase unacked erasure intents. */
export async function sweepUsageIntents(tx: UsageExecutor, now: number): Promise<void> {
  await tx.delete(sponsoredUseIntents).where(and(eq(sponsoredUseIntents.kind, "event"), lt(sponsoredUseIntents.createdAt, now - RETENTION_MS)));
  await tx.delete(sponsoredUseIntents).where(and(eq(sponsoredUseIntents.kind, "erase"), lt(sponsoredUseIntents.deliveredAt, now - RETENTION_MS)));
  const cutoff = new Date(now); cutoff.setUTCMonth(cutoff.getUTCMonth() - 24);
  await tx.delete(sponsoredUseSubjects).where(lt(sponsoredUseSubjects.updatedAt, cutoff.getTime()));
  await tx.delete(sponsoredUseProjectLinks).where(lt(sponsoredUseProjectLinks.updatedAt, cutoff.getTime()));
}
