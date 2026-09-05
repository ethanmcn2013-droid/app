/* eslint-disable @typescript-eslint/no-require-imports -- Paired local-only actual action/route acceptance. */
const assert=require("node:assert/strict"),path=require("node:path");
const {usageFixture,SALT}=require("../../src/server/sponsored-use/fixture.cjs");
const {eq}=require("drizzle-orm");
const studioRoot=process.argv[process.argv.indexOf("--studio-root")+1];
if(!process.argv.includes("--studio-root") || !studioRoot)throw Error("Supply the matching local Studio checkout with --studio-root");
const {studioUsageFixture}=require(path.resolve(studioRoot,"src/lib/account/instrumentation/usage-fixture.cjs"));
const checks=[];
async function check(name,fn){await fn();checks.push(name);console.log("PASS "+name);}
(async()=>{
 const keys=["SPONSOR_USAGE_EVENTS","SPONSOR_USAGE_HASH_SALT","SPONSOR_USAGE_SERVICE_SECRET","SPONSOR_USAGE_ACCEPTED_EPOCHS",
  "SPONSOR_USAGE_ENVIRONMENT","SPONSOR_USAGE_APP_ORIGIN","SPONSOR_USAGE_STUDIO_ORIGIN","VENUE_ISSUANCE_SECRET","SIGNAL_HQ_PASSWORD","CRON_SECRET"];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]])),clock=Date.now;
 const app=await usageFixture(),studio=await studioUsageFixture(path.resolve(studioRoot));
 try {
  const auth=app.load("src/lib/sponsored-use/service-auth.ts"),epoch=auth.hashEpoch(SALT),secret="synthetic-purpose-separated-usage-secret";
  Object.assign(process.env,{SPONSOR_USAGE_EVENTS:"1",SPONSOR_USAGE_HASH_SALT:SALT,SPONSOR_USAGE_SERVICE_SECRET:secret,
   SPONSOR_USAGE_ACCEPTED_EPOCHS:epoch,SPONSOR_USAGE_ENVIRONMENT:"internal_test",SPONSOR_USAGE_APP_ORIGIN:"http://app.test",
   SPONSOR_USAGE_STUDIO_ORIGIN:"http://studio.test",VENUE_ISSUANCE_SECRET:"different-synthetic-issuance-service-key",
   SIGNAL_HQ_PASSWORD:"synthetic-hq-password",CRON_SECRET:"synthetic-cron-secret"});
  let now=app.now;Date.now=()=>now;
  const canonical=app.load("src/server/venue-issuance/canonical.ts"),protocol=app.load("src/lib/venue-issuance/protocol.ts");
  async function mirror(issued,fulfilled=true) {
   const m=issued.manifest;
   await studio.database.insert(studio.schema.venueFulfilmentRequests).values({id:m.issuanceId,sponsorId:m.sponsorId,
    studioSponsorId:"local-fixture",requestJson:"{}",manifestJson:JSON.stringify(m),manifestHash:protocol.manifestHash(m),
    operatorId:"fixture",operatorName:"Synthetic",createdAt:m.issuedAt,updatedAt:now,fulfilledAt:fulfilled?now:null});
   await studio.database.insert(studio.schema.licenseCodes).values({id:m.codes[0].licenseCodeId,sponsorId:m.sponsorId,
    code:issued.code,sourceType:"venue_edition",tier:"wedding",durationDays:548,batchId:m.issuanceId});
  }
  async function quietGrant(digit,suffix) {
   const project="quiet-"+digit,code="VENUE-ABCDE-FGHJ"+suffix;
   const m={...app.issued.manifest,issuanceId:"vi-"+digit.repeat(32),codes:[{licenseCodeId:"vlc-"+digit.repeat(32),codeFingerprint:protocol.venueCodeFingerprint(code)}]};
   await app.db.insert(app.schema.workspaces).values({id:project,slug:project,name:"Private quiet project",ownerUserId:"owner"});
   await app.db.insert(app.schema.workspaceMembers).values({workspaceId:project,userId:"owner",role:"owner"});
   await app.db.insert(app.schema.meta).values({key:protocol.issuanceReceiptKey(m.issuanceId),value:JSON.stringify({manifest:m,manifestHash:protocol.manifestHash(m)})});
   await app.db.insert(app.schema.compCodes).values({code,tier:"wedding",durationDays:548,quantity:1,redeemed:1,notes:canonical.canonicalVenueCodeNotes(m,m.codes[0])});
   // These projects belong to the original action-day cohort. Advancing the
   // rollup clock must not move a later-inserted fixture grant into the next day.
   await app.db.insert(app.schema.entitlements).values({id:"quiet-grant-"+digit,userId:"owner",workspaceId:project,source:"comp",tier:"wedding",
    startedAt:new Date(app.now-86400000),expiresAt:new Date(app.now+5*86400000),notes:"comp:"+code});
   await mirror({manifest:m,code});
  }
  const appProvenance=app.load("src/app/api/internal/sponsored-use/provenance/route.ts").POST;
  studio.state.send=async request=>{
   assert.equal(new URL(request.url).origin,"http://app.test");return appProvenance(request);
  };
  const ingest=studio.load("src/app/api/internal/sponsored-use/ingest/route.ts").POST;
  const erase=studio.load("src/app/api/internal/sponsored-use/erase/route.ts").POST;
  const deliver=()=>app.load("src/server/sponsored-use/delivery.ts").deliverUsage(app.db,{enabled:process.env.SPONSOR_USAGE_EVENTS==="1",studioOrigin:"http://studio.test",secret,
   issuanceSecret:process.env.VENUE_ISSUANCE_SECRET,now,send:request=>new URL(request.url).pathname===auth.USAGE_PATHS.erase?erase(request):ingest(request)});
  await check("actual task action atomically captures one seven-field intent with no raw task or code",async()=>{
   await app.action({id:"paired-task",title:"PRIVATE TASK BEARER CONTENT",projectId:"a"});
   assert.deepEqual(await app.counts(),{tasks:1,activities:1,sponsored_use_intents:1,sponsored_use_subjects:1});
   const [intent]=await app.db.select().from(app.usageSchema.sponsoredUseIntents);
   assert.equal(Object.keys(JSON.parse(intent.payload)).length,7);assert.ok(!intent.payload.includes("PRIVATE"));assert.ok(!intent.payload.includes(app.issued.code));
  });
  await mirror(app.issued,false);
  await check("signed actual routes keep durable delivery pending while canonical shared acknowledgement is absent",async()=>{
   assert.equal((await deliver()).failed,1);assert.equal((await studio.database.select().from(studio.schema.sponsorUsageEvents)).length,0);
   assert.equal((await app.db.select().from(app.usageSchema.sponsoredUseIntents))[0].deliveredAt,null);
  });
  await check("canonical repair enables exact actual route delivery and one shared SQLite event",async()=>{
   await studio.database.update(studio.schema.venueFulfilmentRequests).set({fulfilledAt:now}).where(eq(studio.schema.venueFulfilmentRequests.id,app.issued.manifest.issuanceId));
   assert.equal((await deliver()).delivered,1);assert.equal((await deliver()).delivered,0);
   const [row]=await studio.database.select().from(studio.schema.sponsorUsageEvents);assert.equal(row.sponsorId,"synthetic-sponsor");
   const intent=(await app.db.select().from(app.usageSchema.sponsoredUseIntents))[0],event=JSON.parse(intent.payload);
   assert.equal((await ingest(auth.signedUsageRequest("http://studio.test"+auth.USAGE_PATHS.ingest,event,secret,epoch,now))).status,200);
   assert.equal((await ingest(auth.signedUsageRequest("http://studio.test"+auth.USAGE_PATHS.ingest,{...event,workspaceIdHash:"0".repeat(32)},secret,epoch,now))).status,409);
   assert.equal((await studio.database.select().from(studio.schema.sponsorUsageEvents)).length,1);
  });
  await quietGrant("b","M");
  now+=86400000+8*3600000;
  const cron=studio.load("src/app/api/cron/sponsored-use/route.ts").GET;
  const runJob=()=>cron(new Request("http://studio.test/api/cron/sponsored-use",{headers:{authorization:"Bearer "+process.env.CRON_SECRET}}));
  const hqAction=studio.load("src/app/hq/account-review/actions.ts").loadLiveVenueSnapshotAction;
  const download=studio.load("src/app/hq/account-review/download/route.ts").GET;
  await check("actual maintenance auth denies strangers; closed-day job persists Tasks-only coverage",async()=>{
   assert.equal((await cron(new Request("http://studio.test/api/cron/sponsored-use"))).status,401);
   assert.equal((await runJob()).status,200);
   const [day]=await studio.database.select().from(studio.schema.sponsorUsageDaily);
   assert.equal(day.meaningfulActions,1);assert.equal(day.eligibleWorkspaces,2);assert.equal(day.coverageMask,2);assert.equal(day.expectedMask,15);
  });
  await check("actual HQ action and download deny missing authentication",async()=>{
   await assert.rejects(()=>hqAction("synthetic"),e=>e.url?.startsWith("/hq/access"));
   await assert.rejects(()=>download(new Request("http://studio.test/hq/account-review/download?source=live&venue=synthetic&format=csv")),e=>e.url?.startsWith("/hq/access"));
  });
  studio.state.hqToken=await studio.load("src/lib/hq/auth.ts").createHqAccessToken();
  for(const n of [2,3])await check("actual authenticated HQ projection/export privacy threshold "+n,async()=>{
   if(n===3){
    await quietGrant("c","N");assert.equal((await runJob()).status,200);
    const days=await studio.database.select().from(studio.schema.sponsorUsageDaily);
    assert.equal(days.length,1);assert.equal(days[0].eligibleWorkspaces,3,"all three fixture grants cover the original action day");
   }
   const loaded=await hqAction("synthetic");assert.equal(loaded.ok,true);
   assert.equal(loaded.snapshot.adoption.activeRecently.state,n===2?"withheld":"lower_bound");
   if(n===2)for(const key of ["daysCovered","modulesCovered"])assert.equal(Object.hasOwn(loaded.snapshot.coverage,key),false);
   else assert.equal(loaded.snapshot.coverage.daysCovered,1,"eligible cohort retains observed coverage");
   assert.equal(loaded.snapshot.productReach.find(r=>r.product==="Notes").workspacesReached.state,"unavailable");
   for(const format of ["csv","html"]){
    const response=await download(new Request("http://studio.test/hq/account-review/download?source=live&venue=synthetic&format="+format));
    assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");
    const body=await response.text();for(const privateValue of [app.issued.code,"clerk-owner","PRIVATE TASK",protocol.venueCodeFingerprint(app.issued.code)])assert.ok(!body.includes(privateValue));
   }
  });
  await check("actual account-deletion fence queues erasure and signed route removes personal usage while preserving daily counts",async()=>{
   delete process.env.SPONSOR_USAGE_EVENTS; // disabling collection cannot disable erasure
   await app.load("src/server/account-deletion-lifecycle.ts").beginAccountDeletionWith(app.db,"clerk-owner");
   assert.equal((await deliver()).delivered,1);
   assert.equal((await studio.database.select().from(studio.schema.sponsorUsageEvents)).length,0);
   assert.equal((await studio.database.select().from(studio.schema.sponsorWorkspaceLifecycle)).length,0);
   assert.equal((await studio.database.select().from(studio.schema.sponsorUsageDaily)).length,1);
  });
  await check("actual retention removes old aggregate rows and acknowledged App receipts",async()=>{
   now+=800*86400000;
   assert.equal((await runJob()).status,200);await deliver();
   assert.equal((await studio.database.select().from(studio.schema.sponsorUsageDaily)).length,0);
   assert.equal((await app.db.select().from(app.usageSchema.sponsoredUseIntents)).length,0);
  });
  console.log(JSON.stringify({passed:checks.length,checks,network:"local Request only",coverage:"Tasks creation only",providers:false}));
 } finally {
  Date.now=clock;app.close();studio.close();for(const key of keys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
