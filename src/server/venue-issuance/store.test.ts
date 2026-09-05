import assert from "node:assert/strict";
import { before, test } from "node:test";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { freshFileDb } from "@/server/db/memory-test-db";
import * as schema from "@/server/db/schema";
import { compCodes, entitlements, meta, users, workspaces, workspaceMembers } from "@/server/db/schema";
import { generateCompCode } from "@/lib/comp-code";
import { manifestHash, venueCodeFingerprint, VENUE_ISSUANCE_PATH, type IssuanceCommand, type IssuanceManifest } from "@/lib/venue-issuance/protocol";
import { signIssuanceRequest, type IssuanceAuth } from "@/lib/venue-issuance/service-auth";
import { handleVenueIssuance } from "./handler";
import { executeVenueIssuance } from "./store";
import { readCanonicalVenueClaim } from "./canonical";
let claim: typeof import("@/server/db/comp-redemption").claimCompEntitlement;
before(async () => {
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  claim = (await import("@/server/db/comp-redemption")).claimCompEntitlement;
});
const now = Date.parse("2026-09-04T16:00:00.000Z");
const auth: IssuanceAuth = { secret: "fixture-issuance-key-".repeat(3), usageSecret: "fixture-usage-key-".repeat(3), keyEpoch: "fixture-1" };
function issue(count = 1): Extract<IssuanceCommand, {operation:"issue"}> {
  const codes = Array.from({length: count}, (_,i) => ({licenseCodeId:"vlc-"+String(i+1).padStart(32,"0"), code:generateCompCode("VENUE")}));
  const manifest: IssuanceManifest = {version:1,issuanceId:"vi-"+"a".repeat(32), sponsorId:"s-test", sponsorSlug:"test-venue",
    sponsorName:"Synthetic venue",environment:"internal_test",issuedAt:now,eligibility:{kind:"standard",reference:"event-synthetic",startsAt:now-86400000,endsAt:now+86400000},
    tier:"wedding",durationDays:548,codes:codes.map(row=>({licenseCodeId:row.licenseCodeId,codeFingerprint:venueCodeFingerprint(row.code)}))};
  return {operation:"issue",manifest,codes};
}
async function fixture() {
  const f=await freshFileDb();
  await f.client.execute("PRAGMA journal_mode=WAL");
  for(const id of ["owner","other"]) await f.db.insert(users).values({id,clerkId:id,initials:"FX",color:"fixture"});
  for(const id of ["a","b"]) {
    await f.db.insert(workspaces).values({id,slug:id,name:id,ownerUserId:"owner",contextType:"wedding"});
    await f.db.insert(workspaceMembers).values({workspaceId:id,userId:"owner",role:"owner"});
  }
  return f;
}
function request(command: IssuanceCommand, key=auth, path=VENUE_ISSUANCE_PATH, at=now) {
  const body=JSON.stringify(command);
  return new Request("http://localhost"+path,{method:"POST",headers:signIssuanceRequest(body,key,at),body});
}
test("signed issue/readback is atomic, replay-stable and returns no bearer",async()=>{
 const f=await fixture();try {
  const input=issue(2), service={database:f.db,auth,environment:"internal_test" as const,enabled:true,now:()=>now};
  const response=await handleVenueIssuance(request(input),service);
  assert.equal(response.status,200);
  const first=await response.json(); assert.equal(first.codes.length,2);
  assert.equal(JSON.stringify(first).includes(input.codes[0].code),false);
  const replay=await handleVenueIssuance(request(input),service);assert.equal(replay.status,200);
  assert.equal((await f.db.select().from(compCodes)).length,2);
  assert.equal((await f.db.select().from(meta)).length,1);
  assert.deepEqual(await replay.json(),first);
  const changed=structuredClone(input);changed.manifest.sponsorName="Different venue";
  assert.equal((await handleVenueIssuance(request(changed),service)).status,409);
 }finally{f.cleanup();}
});
test("purpose, key separation, exact path, timestamp, body and deployment flag precede writes",async()=>{
 const f=await fixture();try{
  const input=issue(), service={database:f.db,auth,environment:"internal_test" as const,enabled:true,now:()=>now};
  for(const req of [
    request(input,{...auth,secret:auth.usageSecret!,usageSecret:undefined}),
    request(input,auth,VENUE_ISSUANCE_PATH+"?extra=1"),
    request(input,auth,"/api/internal/sponsored-use"),
    request(input,auth,VENUE_ISSUANCE_PATH,now-300001),
    new Request("http://localhost"+VENUE_ISSUANCE_PATH,{method:"POST",headers:signIssuanceRequest(JSON.stringify(input),auth,now),body:JSON.stringify({...input,extra:true})}),
  ]) assert.equal((await handleVenueIssuance(req,service)).status,401);
  assert.equal((await handleVenueIssuance(request(input),{...service,enabled:false})).status,503);
  assert.equal((await handleVenueIssuance(request(input),{...service,auth:{...auth,usageSecret:auth.secret}})).status,503);
  assert.equal((await f.db.select().from(compCodes)).length,0);
 }finally{f.cleanup();}
});
test("failure after first code rolls back receipt and full set; identical retry completes",async()=>{
 const f=await fixture();try{
  const input=issue(2);
  await f.client.execute("CREATE TRIGGER injected_issue_failure BEFORE INSERT ON comp_codes WHEN (SELECT count(*) FROM comp_codes)>0 BEGIN SELECT RAISE(ABORT,'synthetic failure'); END");
  await assert.rejects(executeVenueIssuance(f.db,input,"internal_test",now));
  assert.equal((await f.db.select().from(compCodes)).length,0);
  assert.equal((await f.db.select().from(meta)).length,0);
  await f.client.execute("DROP TRIGGER injected_issue_failure");
  await executeVenueIssuance(f.db,input,"internal_test",now);
  // A lost response cannot tell the caller whether the prior commit happened.
  await executeVenueIssuance(f.db,input,"internal_test",now+1000);
  assert.equal((await f.db.select().from(compCodes)).length,2);
 }finally{f.cleanup();}
});
test("an existing legacy code cannot acquire canonical provenance by matching its fingerprint",async()=>{
 const f=await fixture();try{
  const input=issue();
  await f.db.insert(compCodes).values({code:input.codes[0].code,tier:"wedding",durationDays:548,quantity:1,redeemed:0});
  await assert.rejects(executeVenueIssuance(f.db,input,"internal_test",now),/conflict/);
  assert.equal((await f.db.select().from(meta)).length,0);
 }finally{f.cleanup();}
});
test("same-code App claim/replay keeps project and term; canonical provenance verifies exact grant",async()=>{
 const f=await fixture();try{
  const input=issue();await executeVenueIssuance(f.db,input,"internal_test",now);
  const first=await claim(f.db,{code:input.codes[0].code,actorUserId:"owner",candidateProjectId:"a",now:new Date(now+1000)});
  assert.equal(first.ok,true);if(!first.ok)return;
  const replay=await claim(f.db,{code:input.codes[0].code,actorUserId:"owner",candidateProjectId:"b",now:new Date(now+2000)});
  assert.equal(replay.ok,true);if(!replay.ok)return;
  assert.equal(replay.entitlement.id,first.entitlement.id);assert.equal(replay.entitlement.workspaceId,"a");
  assert.equal(replay.entitlement.expiresAt?.getTime(),first.entitlement.expiresAt?.getTime());
  const proof=await readCanonicalVenueClaim(f.db,{entitlementId:first.entitlement.id});
  assert.equal(proof?.issuanceId,input.manifest.issuanceId);assert.equal(proof?.workspaceId,"a");
  assert.equal(JSON.stringify(proof).includes(input.codes[0].code),false);
  await assert.rejects(executeVenueIssuance(f.db,{operation:"withdraw",issuanceId:input.manifest.issuanceId,manifestHash:manifestHash(input.manifest),licenseCodeId:input.codes[0].licenseCodeId},"internal_test",now+3000),/already_claimed/);
  assert.equal((await f.db.select().from(entitlements))[0].expiresAt?.getTime(),first.entitlement.expiresAt?.getTime());
  await f.db.update(entitlements).set({expiresAt:new Date(0)}).where(eq(entitlements.id,first.entitlement.id));
  assert.equal(await readCanonicalVenueClaim(f.db,{entitlementId:first.entitlement.id}),null);
 }finally{f.cleanup();}
});
test("withdrawal and actual concurrent claim serialize; neither can revoke a committed grant",async()=>{
 const f=await fixture();const filename=String((await f.client.execute("PRAGMA database_list")).rows[0].file);
 const second=createClient({url:pathToFileURL(filename).href});try{
  const input=issue();await executeVenueIssuance(f.db,input,"internal_test",now);
  const otherDb=drizzle(second,{schema});
  const results=await Promise.allSettled([
    executeVenueIssuance(otherDb,{operation:"withdraw",issuanceId:input.manifest.issuanceId,manifestHash:manifestHash(input.manifest),licenseCodeId:input.codes[0].licenseCodeId},"internal_test",now+1000),
    claim(f.db,{code:input.codes[0].code,actorUserId:"owner",candidateProjectId:"a",now:new Date(now+1000)}),
  ]);
  const grantRows=await f.db.select().from(entitlements);
  const row=(await f.db.select().from(compCodes))[0];
  if(grantRows.length===1){
    assert.equal(row.redeemed,1);assert.equal(row.expiresAt,null);
    assert.equal(results[0].status,"rejected");
    if(results[0].status==="rejected")assert.match(String(results[0].reason),/already_claimed/);
    assert.ok(grantRows[0].expiresAt!.getTime()>now);
  }else{
    assert.equal(row.redeemed,0);assert.equal(row.expiresAt?.getTime(),0);
    assert.equal(results[0].status,"fulfilled");assert.equal(results[1].status,"fulfilled");
    if(results[1].status==="fulfilled")assert.deepEqual(results[1].value,{ok:false,reason:"expired"});
  }
 }finally{second.close();f.cleanup();}
});
test("withdrawn-unused code stays withdrawn on issue replay and grants nothing",async()=>{
 const f=await fixture();try{
  const input=issue();await executeVenueIssuance(f.db,input,"internal_test",now);
  const withdrawal={operation:"withdraw" as const,issuanceId:input.manifest.issuanceId,manifestHash:manifestHash(input.manifest),licenseCodeId:input.codes[0].licenseCodeId};
  await executeVenueIssuance(f.db,withdrawal,"internal_test",now+1000);
  const replay=await executeVenueIssuance(f.db,input,"internal_test",now+2000);assert.equal(replay.codes[0].state,"withdrawn");
  assert.deepEqual(await claim(f.db,{code:input.codes[0].code,actorUserId:"owner",candidateProjectId:"a",now:new Date(now+3000)}),{ok:false,reason:"expired"});
 }finally{f.cleanup();}
});

test("readback refuses counter/grant disagreement and malformed withdrawal authority",async()=>{
 const f=await fixture();try{
  const input=issue();await executeVenueIssuance(f.db,input,"internal_test",now);
  await claim(f.db,{code:input.codes[0].code,actorUserId:"owner",candidateProjectId:"a",now:new Date(now+1000)});
  await f.db.update(compCodes).set({redeemed:0});
  await assert.rejects(executeVenueIssuance(f.db,input,"internal_test",now+2000),/conflict/);
  await f.db.update(compCodes).set({redeemed:1});
  const row=await executeVenueIssuance(f.db,input,"internal_test",now+2000);assert.equal(row.codes[0].state,"claimed");
 }finally{f.cleanup();}
 const f2=await fixture();try{
  const input=issue();await executeVenueIssuance(f2.db,input,"internal_test",now);
  await executeVenueIssuance(f2.db,{operation:"withdraw",issuanceId:input.manifest.issuanceId,manifestHash:manifestHash(input.manifest),licenseCodeId:input.codes[0].licenseCodeId},"internal_test",now+1000);
  await f2.db.update(meta).set({value:"{}"}).where(eq(meta.key,"venue-withdrawal:v1:"+input.manifest.issuanceId+":"+input.codes[0].licenseCodeId));
  await assert.rejects(executeVenueIssuance(f2.db,input,"internal_test",now+2000),/conflict/);
 }finally{f2.cleanup();}
});
