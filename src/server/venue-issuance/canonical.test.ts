import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { freshFileDb } from "@/server/db/memory-test-db";
import { compCodes, entitlements, meta } from "@/server/db/schema";
import { issuanceReceiptKey, manifestHash, venueCodeFingerprint, type IssuanceManifest } from "@/lib/venue-issuance/protocol";
import { readCanonicalVenueClaim } from "./canonical";

const code="VENUE-ABCDE-FGHJK", issuedAt=Date.parse("2026-09-04T12:00:00Z");
const manifest:IssuanceManifest={version:1,issuanceId:"vi-"+"b".repeat(32),sponsorId:"s-rehearsal",
 sponsorSlug:"synthetic",sponsorName:"Synthetic venue",environment:"internal_test",issuedAt,
 eligibility:{kind:"pilot",reference:"pilot-synthetic-authorization",startsAt:issuedAt-86400000,endsAt:issuedAt+86400000},
 tier:"wedding",durationDays:548,codes:[{licenseCodeId:"vlc-"+"c".repeat(32),codeFingerprint:venueCodeFingerprint(code)}]};
async function fixture(){
 const f=await freshFileDb();
 const binding={version:1,issuanceId:manifest.issuanceId,sponsorId:"s-rehearsal",...manifest.codes[0]};
 await f.db.insert(meta).values({key:issuanceReceiptKey(manifest.issuanceId),value:JSON.stringify({manifest,manifestHash:manifestHash(manifest)})});
 await f.db.insert(compCodes).values({code,tier:"wedding",durationDays:548,quantity:1,redeemed:1,
 notes:JSON.stringify({sponsor_slug:"synthetic",sponsor_name:"Synthetic venue",source_type:"venue_edition",studio_tier:"wedding",studio_duration_days:548,venue_issuance:binding})});
 await f.db.insert(entitlements).values({id:"grant",source:"comp",tier:"wedding",workspaceId:"project-a",userId:"couple",
 startedAt:new Date(issuedAt+1000),expiresAt:new Date(issuedAt+548*86400000),notes:"comp:"+code});
 return f;
}
test("canonical read returns exact actor/project/access interval, independent of later venue lapse",async()=>{
 const f=await fixture();try{
  const result=await readCanonicalVenueClaim(f.db,{entitlementId:"grant"});
  assert.equal(result?.userId,"couple");assert.equal(result?.workspaceId,"project-a");
  assert.equal(result?.grantStartsAt,issuedAt+1000);assert.equal(result?.grantEndsAt,issuedAt+548*86400000);
  assert.equal(result?.eligibilityEndsAt,issuedAt+86400000);
  assert.equal(result?.codeFingerprint,manifest.codes[0].codeFingerprint);
  assert.equal(JSON.stringify(result).includes(code),false);
  assert.equal(JSON.stringify(result).includes("Synthetic venue"),false);
 }finally{f.cleanup();}
});
test("a legacy grant or a changed receipt cannot acquire authority from a code hash",async()=>{
 const f=await fixture();try{
  await f.db.update(meta).set({value:JSON.stringify({manifest:{...manifest,sponsorId:"different"},manifestHash:manifestHash(manifest)})}).where(eq(meta.key,issuanceReceiptKey(manifest.issuanceId)));
  assert.equal(await readCanonicalVenueClaim(f.db,{entitlementId:"grant"}),null);
  await f.db.delete(meta).where(eq(meta.key,issuanceReceiptKey(manifest.issuanceId)));
  assert.equal(await readCanonicalVenueClaim(f.db,{entitlementId:"grant"}),null);
 }finally{f.cleanup();}
});
test("epoch revocation, duplicate exact grants and source mismatch fail closed",async()=>{
 const f=await fixture();try{
  await f.db.update(entitlements).set({expiresAt:new Date(0)}).where(eq(entitlements.id,"grant"));
  assert.equal(await readCanonicalVenueClaim(f.db,{entitlementId:"grant"}),null);
  await f.db.update(entitlements).set({expiresAt:new Date(issuedAt+548*86400000)}).where(eq(entitlements.id,"grant"));
  await f.db.insert(entitlements).values({id:"duplicate",source:"comp",tier:"wedding",workspaceId:"project-b",userId:"another",startedAt:new Date(issuedAt+1000),expiresAt:new Date(issuedAt+548*86400000),notes:"comp:"+code});
  assert.equal(await readCanonicalVenueClaim(f.db,{entitlementId:"grant"}),null);
  await f.db.delete(entitlements).where(eq(entitlements.id,"duplicate"));
  await f.db.update(entitlements).set({source:"purchase"}).where(eq(entitlements.id,"grant"));
  assert.equal(await readCanonicalVenueClaim(f.db,{entitlementId:"grant"}),null);
 }finally{f.cleanup();}
});
test("actual closed SQLite store is retryable unavailable, not permanent missing provenance",async()=>{
 const f=await fixture();try{
  f.client.close();
  await assert.rejects(readCanonicalVenueClaim(f.db,{entitlementId:"grant"}),/^Error: unavailable$/);
 }finally{f.cleanup();}
});
