/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness loads actual TS actions with explicit framework boundaries. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { usageFixture,SALT } = require("./fixture.cjs");
const {eq}=require("drizzle-orm");
const secret="synthetic-usage-secret-thirty-two-characters";
async function fixture(fn){
 process.env.SPONSOR_USAGE_EVENTS="1";process.env.SPONSOR_USAGE_HASH_SALT=SALT;
 const f=await usageFixture();
 try{
  await f.action({id:"task-created",title:"PRIVATE TASK",projectId:"a"});
  const [intent]=await f.db.select().from(f.usageSchema.sponsoredUseIntents);
  const transport=f.load("src/lib/sponsored-use/service-auth.ts");
  const read=f.load("src/server/venue-issuance/canonical.ts").readCanonicalVenueClaim;
  const handler=f.load("src/server/sponsored-use/provenance-handler.ts").provenanceHandler(f.db,read,
   {enabled:true,salt:SALT,secret,now:f.now});
  await fn({...f,intent,transport,handler,request:p=>transport.signedUsageRequest("http://app.test"+transport.USAGE_PATHS.provenance,p,secret,intent.epoch,f.now)});
 }finally{f.close();delete process.env.SPONSOR_USAGE_EVENTS;delete process.env.SPONSOR_USAGE_HASH_SALT;}
}
test("actual authenticated App provenance binds durable event, exact canonical claim and minute interval",()=>fixture(async f=>{
 const response=await f.handler(f.request({eventId:f.intent.id}));assert.equal(response.status,200);
 const {proof}=await response.json();assert.ok(proof);assert.equal(proof.issuanceId,f.issued.manifest.issuanceId);
 assert.equal(proof.eventDigest,f.transport.digest(f.intent.payload));assert.equal(proof.epoch,f.intent.epoch);
 const text=JSON.stringify(proof);for(const raw of [f.issued.code,"clerk-owner","PRIVATE TASK","Synthetic venue"])assert.ok(!text.includes(raw));
 const page=await (await f.handler(f.request({issuanceId:proof.issuanceId,cursor:"0"}))).json();
 assert.equal(page.claims.length,1);assert.equal(page.nextCursor,null);
}));
for(const mutation of ["member","archive","revocation","owner-erasure","wrong-project","tamper"]){
 test("actual provenance refuses "+mutation,()=>fixture(async f=>{
  if(mutation==="member")await f.db.delete(f.schema.workspaceMembers).where(eq(f.schema.workspaceMembers.userId,"owner"));
  if(mutation==="archive")await f.db.update(f.schema.workspaces).set({archivedAt:new Date()}).where(eq(f.schema.workspaces.id,"a"));
  if(mutation==="revocation")await f.db.update(f.schema.entitlements).set({expiresAt:new Date(0)});
  if(mutation==="owner-erasure")await f.load("src/server/account-deletion-lifecycle.ts").beginAccountDeletionWith(f.db,"clerk-owner");
  if(mutation==="wrong-project")await f.db.update(f.schema.entitlements).set({workspaceId:"b"});
  if(mutation==="tamper")await f.db.update(f.schema.meta).set({value:"{}"});
  assert.equal((await (await f.handler(f.request({eventId:f.intent.id}))).json()).proof,null);
 }));
}
test("provenance rejects foreign purpose/bounds and fails retryably on real store error",()=>fixture(async f=>{
 const wrong=f.transport.signedUsageRequest("http://app.test"+f.transport.USAGE_PATHS.ingest,{eventId:f.intent.id},secret,f.intent.epoch,f.now);
 assert.equal((await f.handler(wrong)).status,401);
 assert.equal((await f.handler(f.request({issuanceId:f.issued.manifest.issuanceId,cursor:"10000"}))).status,400);
 await f.client.execute("DROP TABLE comp_codes");
 const result=await f.handler(f.request({eventId:f.intent.id}));assert.equal(result.status,503);assert.deepEqual(await result.json(),{ok:false});
}));
