import assert from "node:assert/strict";
import { test } from "node:test";
import { authenticateUsageRequest, hashEpoch, signedUsageRequest, USAGE_PATHS, MAX_BODY_BYTES } from "./service-auth";
const secret="synthetic-usage-secret-at-least-thirty-two";
const epoch=hashEpoch("synthetic-salt-for-fixtures");
const now=Date.parse("2026-09-04T12:00:00Z");
const url="http://fixture.test"+USAGE_PATHS.ingest;
const config={secret,epoch,now};
test("usage signature authenticates exact path, purpose, epoch and body",async()=>{
 const good=signedUsageRequest(url,{eventId:"fixture"},secret,epoch,now);
 assert.deepEqual(await authenticateUsageRequest(good,USAGE_PATHS.ingest,config),{ok:true,payload:{eventId:"fixture"}});
 for(const change of ["body","path","epoch","time","secret","shared-secret","method"]){
  const original=signedUsageRequest(url,{eventId:"fixture"},secret,epoch,now);
  const headers=new Headers(original.headers);
  let target=url,method="POST",body=await original.text();
  if(change==="body")body=JSON.stringify({eventId:"different"});
  if(change==="path")target="http://fixture.test"+USAGE_PATHS.erase;
  if(change==="epoch")headers.set("x-sponsored-use-epoch","deadbeef");
  if(change==="time")headers.set("x-sponsored-use-timestamp",String(now-300001));
  if(change==="method")method="PUT";
  const request=new Request(target,{method,headers,body});
  const result=await authenticateUsageRequest(request,USAGE_PATHS.ingest,
   {...config,...(change==="secret"?{secret:"different-secret-at-least-thirty-two-characters"}:{}),
   ...(change==="shared-secret"?{issuanceSecret:secret}:{})});
  assert.equal(result.ok,false,change);
 }
});
test("streamed body bound is enforced without trusting Content-Length; missing config fails closed",async()=>{
 const good=signedUsageRequest(url,{},secret,epoch,now);
 const oversized=new Request(url,{method:"POST",headers:good.headers,body:"x".repeat(MAX_BODY_BYTES+1)});
 assert.equal((await authenticateUsageRequest(oversized,USAGE_PATHS.ingest,config)).ok,false);
 assert.equal((await authenticateUsageRequest(signedUsageRequest(url,{},secret,epoch,now),USAGE_PATHS.ingest,{epoch,now})).ok,false);
 assert.throws(()=>signedUsageRequest("http://fixture.test/api/internal/venue-issuance",{},secret,epoch,now));
 assert.throws(()=>signedUsageRequest(url+"?destination=other",{},secret,epoch,now));
});
