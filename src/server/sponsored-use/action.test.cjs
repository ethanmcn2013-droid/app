/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness loads actual TS actions with explicit framework boundaries. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { usageFixture, SALT } = require("./fixture.cjs");
const { eq } = require("drizzle-orm");
const empty = { tasks: 0, activities: 0, sponsored_use_intents: 0, sponsored_use_subjects: 0 };
async function fixture(fn) {
  const prior = { flag: process.env.SPONSOR_USAGE_EVENTS, salt: process.env.SPONSOR_USAGE_HASH_SALT };
  process.env.SPONSOR_USAGE_EVENTS = "1"; process.env.SPONSOR_USAGE_HASH_SALT = SALT;
  const f = await usageFixture();
  try { await fn(f); } finally {
    f.close();
    for (const [key, value] of [["SPONSOR_USAGE_EVENTS", prior.flag], ["SPONSOR_USAGE_HASH_SALT", prior.salt]])
      if(value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
test("actual task action commits one activity and seven-field minute-rounded durable intent", () => fixture(async f => {
  await f.action({ id: "task-a", title: "PRIVATE TASK CONTENT", projectId: "a" });
  assert.deepEqual(await f.counts(), { tasks: 1, activities: 1, sponsored_use_intents: 1, sponsored_use_subjects: 1 });
  const [receipt] = await f.db.select().from(f.usageSchema.sponsoredUseIntents);
  const event = JSON.parse(receipt.payload);
  assert.equal(Object.keys(event).length, 7); assert.equal(event.occurredAt % 60000, 0);
  assert.equal(event.kind, "task_created"); assert.equal(event.product, "tasks");
  const emitter = f.load("src/lib/account/instrumentation/emitter.ts");
  assert.equal(event.subjectIdHash, emitter.hashIdentity("clerk-owner", SALT)); // canonical Clerk identity, not legacy row id
  assert.equal(event.workspaceIdHash, emitter.hashIdentity("a", SALT));
  assert.ok(!JSON.stringify(receipt).includes("PRIVATE TASK")); assert.ok(!JSON.stringify(receipt).includes("clerk-owner"));
  await assert.rejects(() => f.action({ id: "task-a", title: "retry", projectId: "a" }));
  assert.equal((await f.counts()).sponsored_use_intents, 1);
}));
for (const table of ["activities", "sponsored_use_intents", "sponsored_use_subjects"])
test("actual action rolls task/activity/intent back when " + table + " fails; retry succeeds", () => fixture(async f => {
  await f.client.execute("CREATE TRIGGER fixture_fail BEFORE INSERT ON " + table + " BEGIN SELECT RAISE(ABORT,'fixture'); END");
  await assert.rejects(() => f.action({ id: "task-a", title: "private", projectId: "a" }));
  assert.deepEqual(await f.counts(), empty);
  await f.client.execute("DROP TRIGGER fixture_fail");
  await f.action({ id: "task-a", title: "private", projectId: "a" });
  assert.equal((await f.counts()).sponsored_use_intents, 1);
}));
test("member task capability suffices; no project metadata change or new grant", () => fixture(async f => {
  f.state.actor = "member";
  await f.seedClaim("member", "a", "b");
  const before = await f.db.select().from(f.schema.workspaces);
  await f.action({ id: "task-member", title: "member's task", projectId: "a" });
  assert.equal((await f.counts()).sponsored_use_intents, 1);
  assert.deepEqual(await f.db.select().from(f.schema.workspaces), before);
  assert.equal((await f.db.select().from(f.schema.entitlements)).length, 2);
}));
for (const denial of ["foreign", "removed-after-preflight", "archived", "account", "owner-account"])
test("actual action denies " + denial + " with no usage or task writes", () => fixture(async f => {
  if(denial === "foreign") f.state.actor = "outsider";
  if(denial === "removed-after-preflight") f.state.afterAuth = () => f.db.delete(f.schema.workspaceMembers).where(eq(f.schema.workspaceMembers.userId, "owner"));
  if(denial === "archived") await f.db.update(f.schema.workspaces).set({ archivedAt: new Date() }).where(eq(f.schema.workspaces.id, "a"));
  if(denial === "account") await f.load("src/server/account-deletion-lifecycle.ts").beginAccountDeletionWith(f.db, "clerk-owner");
  if(denial === "owner-account") {
    f.state.actor = "member";
    await f.seedClaim("member", "a", "b");
    await f.load("src/server/account-deletion-lifecycle.ts").beginAccountDeletionWith(f.db, "clerk-owner");
  }
  await f.action({ id: "denied", title: "private", projectId: "a" });
  assert.deepEqual(await f.counts(), empty);
}));
test("flag-off and demo create no usage; wrong-project grant never supplies provenance", () => fixture(async f => {
  delete process.env.SPONSOR_USAGE_EVENTS;
  await f.action({ id: "off", title: "private", projectId: "a" });
  assert.equal((await f.counts()).sponsored_use_intents, 0);
  process.env.SPONSOR_USAGE_EVENTS = "1"; f.state.demo = true;
  await f.action({ id: "demo", title: "private", projectId: "a" });
  assert.equal((await f.counts()).tasks, 1);
  f.state.demo = false;
  await f.db.update(f.schema.entitlements).set({ workspaceId: "b" });
  await f.action({ id: "no-grant", title: "private", projectId: "a" });
  assert.equal((await f.counts()).sponsored_use_intents, 0);
}));
test("erasure fence removes receipts and retains exactly one pseudonymous control on retries", () => fixture(async f => {
  await f.action({ id: "task-a", title: "private", projectId: "a" });
  const erase = f.load("src/server/account-deletion-lifecycle.ts").beginAccountDeletionWith;
  await erase(f.db, "clerk-owner"); await erase(f.db, "clerk-owner");
  const rows = await f.db.select().from(f.usageSchema.sponsoredUseIntents);
  assert.equal(rows.length, 1); assert.equal(rows[0].kind, "erase"); assert.equal(rows[0].entitlementId, null);
  assert.ok(!JSON.stringify(rows).includes("clerk-owner"));
  await f.action({ id: "late", title: "private", projectId: "a" });
  assert.equal((await f.counts()).tasks, 1);
}));
test("delivery retries exact signed payload after failure; no remote error or raw identity stored", () => fixture(async f => {
  await f.action({ id: "task-a", title: "private", projectId: "a" });
  const requests = [], delivery = f.load("src/server/sponsored-use/delivery.ts").deliverUsage;
  const config = { enabled: true, studioOrigin: "http://studio.test", secret: "synthetic-secret-that-is-at-least-32-characters",
    now: f.now, send: async request => { requests.push(await request.text()); return Response.json({ok:requests.length!==1}, { status: requests.length === 1 ? 503 : 200 }); } };
  assert.equal((await delivery(f.db, config)).failed, 1); assert.equal((await delivery(f.db, config)).delivered, 1);
  assert.equal(requests[0], requests[1]); assert.equal((await delivery(f.db, config)).delivered, 0);
}));

test("capture-off pauses positive delivery but keeps erasure and hard retention alive", () => fixture(async f => {
  await f.action({id:"off-later",title:"private",projectId:"a"});
  const delivery=f.load("src/server/sponsored-use/delivery.ts").deliverUsage;
  let sent=0;const config={enabled:false,studioOrigin:"http://studio.test",secret:"synthetic-secret-at-least-32-characters",now:f.now,
    send:async request=>{sent++;assert.ok(request.url.endsWith("/erase"));return Response.json({ok:true});}};
  assert.equal((await delivery(f.db,config)).delivered,0);assert.equal(sent,0);
  await f.load("src/server/account-deletion-lifecycle.ts").beginAccountDeletionWith(f.db,"clerk-owner");
  assert.equal((await delivery(f.db,config)).delivered,1);
  await delivery(f.db,{...config,now:f.now+36*86400000});
  assert.equal((await f.counts()).sponsored_use_intents,0);
}));

for (const kind of ["event", "erase"]) test("exact bounded acknowledgement retains "+kind+" custody until protocol success", () => fixture(async f => {
  await f.action({id:"ack-task",title:"private",projectId:"a"});
  if(kind==="erase")await f.load("src/server/account-deletion-lifecycle.ts").beginAccountDeletionWith(f.db,"clerk-owner");
  const delivery=f.load("src/server/sponsored-use/delivery.ts").deliverUsage;
  const [original]=await f.db.select().from(f.usageSchema.sponsoredUseIntents);
  const config={enabled:kind==="event",studioOrigin:"http://studio.test",secret:"synthetic-secret-at-least-32-characters",now:f.now};
  const json=body=>new Response(body,{status:200,headers:{"content-type":"application/json"}});
  let oversizedCancelled=false;
  const invalid=[
    ()=>new Response("<html>Not a receipt</html>",{status:200,headers:{"content-type":"text/html"}}),
    ()=>Response.json({ok:true},{status:202}),()=>new Response(null,{status:204}),
    ()=>Response.json({ok:false}),()=>Response.json({ok:true,extra:"uncommitted"}),
    ()=>json('{"ok":false,"ok":true}'),()=>json('{"ok":true'),()=>json('[]'),()=>json('null'),
    ()=>json('{"ok":"true"}'),()=>new Response('{"ok":true}',{status:200}),
    ()=>json(new Uint8Array([0xff])),
    ()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(" ".repeat(257)));},cancel(){oversizedCancelled=true;}}),{status:200,headers:{"content-type":"application/json","content-length":"11"}}),
    ()=>new Response(new ReadableStream({start(c){c.error(new Error("private remote failure"));}}),{status:200,headers:{"content-type":"application/json"}}),
  ];
  for(const response of invalid) {
    const result=await delivery(f.db,{...config,send:async request=>{assert.equal(await request.text(),original.payload);return response();}});
    assert.deepEqual(result,{delivered:0,failed:1});
    assert.deepEqual((await f.db.select().from(f.usageSchema.sponsoredUseIntents))[0],original,"invalid ack must not alter custody");
  }
  assert.equal(oversizedCancelled,true,"oversized stream cancelled without trusting declared length");
  const accepted=await delivery(f.db,{...config,send:async()=>new Response(new ReadableStream({start(c){
    for(const part of [' { "ok"',': true }\n'])c.enqueue(new TextEncoder().encode(part));c.close();
  }}),{status:200,headers:{"content-type":"application/json; charset=utf-8"}})});
  assert.deepEqual(accepted,{delivered:1,failed:0});
  assert.equal((await f.db.select().from(f.usageSchema.sponsoredUseIntents))[0].deliveredAt,f.now);
  assert.deepEqual(await delivery(f.db,{...config,send:async()=>{throw Error("already acknowledged");}}),{delivered:0,failed:0});
}));

test("unfinished success JSON times out and leaves erasure retryable", () => fixture(async f => {
  await f.action({id:"slow-ack",title:"private",projectId:"a"});
  await f.load("src/server/account-deletion-lifecycle.ts").beginAccountDeletionWith(f.db,"clerk-owner");
  let cancelled=false;
  const result=await f.load("src/server/sponsored-use/delivery.ts").deliverUsage(f.db,{
    enabled:false,studioOrigin:"http://studio.test",secret:"synthetic-secret-at-least-32-characters",now:f.now,
    send:async()=>new Response(new ReadableStream({
      start(c){c.enqueue(new TextEncoder().encode('{"ok":true}'));},cancel(){cancelled=true;},
    }),{status:200,headers:{"content-type":"application/json"}}),
  });
  assert.deepEqual(result,{delivered:0,failed:1});assert.equal(cancelled,true);
  assert.equal((await f.db.select().from(f.usageSchema.sponsoredUseIntents))[0].deliveredAt,null);
}));
