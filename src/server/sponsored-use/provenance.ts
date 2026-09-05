import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { MAX_VENUE_CODES } from "@/lib/venue-issuance/protocol";
import type { db } from "@/server/db";
import { compCodes, entitlements, users, workspaces } from "@/server/db/schema";
import { authorizeStoredProject } from "@/server/actions/project-authz";
import { hasAccountDeletionStartedWith } from "@/server/account-deletion-lifecycle";
import { assertProjectNotDeleting } from "@/server/projects/project-deletion-fence";
import { hashIdentity } from "@/lib/account/instrumentation/emitter";
import { digest, hashEpoch, RETENTION_MS } from "@/lib/sponsored-use/service-auth";
import type { UsageClaimProof, UsageEventProof, UsageProofPage } from "@/lib/sponsored-use/proof";
import { sponsoredUseIntents } from "./schema";
type Reader = Pick<typeof db,"select">;
export type CanonicalClaim = {
  version:1;issuanceId:string;licenseCodeId:string;codeFingerprint:string;sponsorId:string;
  environment:"internal_test"|"production";issuedAt:number;
  entitlementId:string;userId:string;workspaceId:string;grantStartsAt:number;grantEndsAt:number;
};
export type CanonicalClaimReader = (reader:Reader,input:{entitlementId:string})=>Promise<CanonicalClaim|null>;
async function claimProof(database: Reader, readClaim: CanonicalClaimReader, id: string, salt: string): Promise<UsageClaimProof|null> {
  const claim = await readClaim(database,{entitlementId:id});
  if(!claim) return null;
  const allowed = await authorizeStoredProject({storedProjectId:claim.workspaceId,actorUserId:claim.userId,
    capability:"createOrEditTasks",archivePolicy:"enforce",executor:database});
  if(!allowed.ok) return null;
  const [actor] = await database.select({clerkId:users.clerkId}).from(users).where(eq(users.id,claim.userId));
  const [owner] = await database.select({clerkId:users.clerkId}).from(workspaces)
    .innerJoin(users,eq(users.id,workspaces.ownerUserId)).where(eq(workspaces.id,claim.workspaceId));
  if(!actor?.clerkId || !owner?.clerkId || await hasAccountDeletionStartedWith(database,actor.clerkId) ||
    await hasAccountDeletionStartedWith(database,owner.clerkId)) return null;
  try { await assertProjectNotDeleting(database,claim.workspaceId); }
  catch(error) { if((error as {code?:string}).code==="project-deletion-in-progress") return null; throw error; }
  return {version:1,issuanceId:claim.issuanceId,licenseCodeId:claim.licenseCodeId,codeFingerprint:claim.codeFingerprint,
    sponsorId:claim.sponsorId,environment:claim.environment,issuedAt:claim.issuedAt,
    grantStartsAt:claim.grantStartsAt,grantEndsAt:claim.grantEndsAt,
    subjectIdHash:hashIdentity(actor.clerkId,salt),workspaceIdHash:hashIdentity(claim.workspaceId,salt),epoch:hashEpoch(salt)};
}
export async function readUsageEventProof(database: Reader, readClaim: CanonicalClaimReader,
  eventId: string, salt: string, now: number): Promise<UsageEventProof|null> {
  const [intent] = await database.select().from(sponsoredUseIntents)
    .where(and(eq(sponsoredUseIntents.id,eventId),eq(sponsoredUseIntents.kind,"event")));
  if(!intent?.entitlementId || intent.epoch!==hashEpoch(salt) || intent.createdAt<=now-RETENTION_MS) return null;
  const proof = await claimProof(database,readClaim,intent.entitlementId,salt);
  if(!proof || intent.createdAt<proof.grantStartsAt || intent.createdAt>=proof.grantEndsAt) return null;
  const event = JSON.parse(intent.payload);
  if(event.subjectIdHash!==proof.subjectIdHash || event.workspaceIdHash!==proof.workspaceIdHash ||
    event.occurredAt!==Math.floor(intent.createdAt/60000)*60000 || event.eventId!==intent.id ||
    event.product!=="tasks" || event.kind!=="task_created" || Object.keys(event).length!==7) return null;
  return {...proof,eventId,eventDigest:digest(intent.payload)};
}
export async function readUsageEligiblePage(database: Reader, readClaim: CanonicalClaimReader,
  issuanceId: string, offset: number, salt: string): Promise<UsageProofPage> {
  if(offset !== 0) throw new Error("Usage provenance unavailable");
  const candidates = await database.select({id:entitlements.id}).from(entitlements)
    .innerJoin(compCodes,sql`${entitlements.notes} = 'comp:' || ${compCodes.code}`)
    .where(and(eq(entitlements.source,"comp"),
      sql`json_extract(CASE WHEN json_valid(${compCodes.notes}) THEN ${compCodes.notes} ELSE '{}' END, '$.venue_issuance.issuanceId') = ${issuanceId}`))
    .orderBy(asc(entitlements.id)).limit(MAX_VENUE_CODES + 1);
  // One canonical issuance is at most 25 single-use codes. Return its entire
  // claim population in this transaction: offset pagination across mutable
  // grants could skip a claim and falsely lower a privacy denominator.
  if(candidates.length > MAX_VENUE_CODES) throw new Error("Usage provenance unavailable");
  const claims:UsageClaimProof[]=[];
  for(const candidate of candidates) {
    const proof=await claimProof(database,readClaim,candidate.id,salt);
    if(proof?.issuanceId===issuanceId) claims.push(proof);
  }
  return {claims,nextCursor:null};
}
