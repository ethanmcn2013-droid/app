import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { freshFileDb } from "./memory-test-db";
import * as schema from "./schema";
import { activities, compCodes, entitlements, meta, tasks, users, workspaceMembers, workspaces } from "./schema";
let claim: typeof import("./comp-redemption").claimCompEntitlement;
before(async () => {
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  claim = (await import("./comp-redemption")).claimCompEntitlement;
});
const now = new Date("2026-09-04T12:00:00Z");
async function fixture() {
  const f = await freshFileDb();
  await f.client.execute("PRAGMA journal_mode=WAL");
  for (const id of ["owner", "member", "outsider"]) await f.db.insert(users).values({ id, clerkId: id, initials: "FX", color: "fixture" });
  for (const id of ["a", "b"]) {
    const owner = id === "a" ? "owner" : "outsider";
    await f.db.insert(workspaces).values({ id, slug: id, name: id, ownerUserId: owner, contextType: "wedding", primaryDate: "2029-06-01" });
    await f.db.insert(workspaceMembers).values({ workspaceId: id, userId: owner, role: "owner" });
  }
  await f.db.insert(workspaceMembers).values({ workspaceId: "a", userId: "member", role: "member" });
  await f.db.insert(compCodes).values({ code: "SYNTHETIC-COMP", tier: "wedding", durationDays: 548, quantity: 1, redeemed: 0,
    notes: JSON.stringify({ source_type: "venue_edition", sponsor_slug: "synthetic", sponsor_name: "Synthetic venue" }) });
  return { ...f, input: { code: "SYNTHETIC-COMP", actorUserId: "owner", candidateProjectId: "a", now } };
}
async function counts(f: Awaited<ReturnType<typeof fixture>>) {
  return { grants: (await f.db.select().from(entitlements)).length, tasks: (await f.db.select().from(tasks)).length,
    activities: (await f.db.select().from(activities)).length, receipts: (await f.db.select().from(meta)).length,
    redeemed: (await f.db.select().from(compCodes))[0].redeemed };
}
test("one venue claim includes access, 18 tasks, activities, receipt and project metadata", async () => {
 const f=await fixture();try {
  const result=await claim(f.db,f.input);assert.equal(result.ok,true);if(!result.ok)return;
  assert.equal(result.entitlement.workspaceId,"a");assert.equal(result.sponsorSlug,"synthetic");
  assert.equal(result.entitlement.expiresAt?.toISOString(),"2029-08-30T00:00:00.000Z");
  assert.deepEqual(await counts(f),{grants:1,tasks:18,activities:18,receipts:1,redeemed:1});
  assert.equal((await f.db.select().from(workspaces).where(eq(workspaces.id,"a")))[0].templateId,"wedding-planning-workspace");
 }finally{f.cleanup();}
});
for(const [table,verb] of [["entitlements","INSERT"],["activities","INSERT"],["meta","INSERT"],["workspaces","UPDATE"]] as const) {
 test("failure at "+table+" rolls back all writes and identical retry succeeds",async()=>{
  const f=await fixture();try{
   await f.client.execute("CREATE TRIGGER reject_fixture BEFORE "+verb+" ON "+table+" BEGIN SELECT RAISE(ABORT,'synthetic failure'); END");
   await assert.rejects(()=>claim(f.db,f.input), error => {
    assert.match(String((error as Error).cause), /synthetic failure/); return true;
   });
   assert.deepEqual(await counts(f),{grants:0,tasks:0,activities:0,receipts:0,redeemed:0});
   await f.client.execute("DROP TRIGGER reject_fixture");assert.equal((await claim(f.db,f.input)).ok,true);
   assert.equal((await counts(f)).redeemed,1);
  }finally{f.cleanup();}
 });
}
test("response-loss retry preserves edits, original project and expiry despite a different active project",async()=>{
 const f=await fixture();try{
  const first=await claim(f.db,f.input);assert.equal(first.ok,true);if(!first.ok)return;
  const [task]=await f.db.select().from(tasks);await f.db.update(tasks).set({title:"My edits"}).where(eq(tasks.id,task.id));
  await f.db.update(compCodes).set({expiresAt:new Date("2026-09-04T13:00:00Z")});
  const again=await claim(f.db,{...f.input,candidateProjectId:"b",now:new Date("2026-09-05T12:00:00Z")});assert.equal(again.ok,true);if(!again.ok)return;
  assert.equal(again.entitlement.id,first.entitlement.id);assert.equal(again.entitlement.workspaceId,"a");
  assert.equal(again.entitlement.expiresAt?.getTime(),first.entitlement.expiresAt?.getTime());
  assert.equal((await f.db.select().from(tasks).where(eq(tasks.id,task.id)))[0].title,"My edits");assert.equal((await counts(f)).tasks,18);
 }finally{f.cleanup();}
});
test("removed, wrong-project and archived actors cannot claim or replay access",async()=>{
 const f=await fixture();try{
  assert.equal((await claim(f.db,{...f.input,actorUserId:"outsider"})).ok,false);
  assert.equal((await claim(f.db,{...f.input,candidateProjectId:"b"})).ok,false);
  await f.db.update(workspaces).set({archivedAt:now}).where(eq(workspaces.id,"a"));assert.equal((await claim(f.db,f.input)).ok,false);
  await f.db.update(workspaces).set({archivedAt:null}).where(eq(workspaces.id,"a"));assert.equal((await claim(f.db,f.input)).ok,true);
  await f.db.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId,"a"));assert.equal((await claim(f.db,f.input)).ok,false);
  assert.equal((await counts(f)).redeemed,1);
 }finally{f.cleanup();}
});
test("expired code and revoked grant cannot create or revive access",async()=>{
 const f=await fixture();try{
  await f.db.update(compCodes).set({expiresAt:now});assert.deepEqual(await claim(f.db,f.input),{ok:false,reason:"expired"});
  await f.db.update(compCodes).set({expiresAt:null});assert.equal((await claim(f.db,f.input)).ok,true);
  await f.db.update(entitlements).set({expiresAt:new Date(0)});assert.deepEqual(await claim(f.db,f.input),{ok:false,reason:"expired"});assert.equal((await counts(f)).redeemed,1);
 }finally{f.cleanup();}
});
test("concurrent duplicate submissions on independent connections converge to one claim and starter",async()=>{
 const f=await fixture();const filename=String((await f.client.execute("PRAGMA database_list")).rows[0].file);
 const client=createClient({url:pathToFileURL(filename).href});try{
  const other=drizzle(client,{schema});const attempts=await Promise.allSettled([claim(f.db,f.input),claim(other,f.input)]);
  assert.ok(attempts.some(r=>r.status==="fulfilled"&&r.value.ok));
  for(const attempt of attempts)if(attempt.status==="rejected")assert.match(String(attempt.reason),/SQLITE_BUSY|locked/i);
  assert.equal((await claim(other,f.input)).ok,true);
  assert.deepEqual(await counts(f),{grants:1,tasks:18,activities:18,receipts:1,redeemed:1});
 }finally{client.close();f.cleanup();}
});
test("an authorized unclaimed owner cannot redeem exhausted capacity",async()=>{
 const f=await fixture();try{await f.db.update(compCodes).set({redeemed:1});assert.deepEqual(await claim(f.db,f.input),{ok:false,reason:"exhausted"});assert.equal((await counts(f)).grants,0);}finally{f.cleanup();}
});

test("a task editor cannot consume a venue code or replace shared Project setup",async()=>{
 const f=await fixture();try{
  assert.deepEqual(await claim(f.db,{...f.input,actorUserId:"member"}),{ok:false,reason:"still-provisioning"});
  assert.deepEqual(await counts(f),{grants:0,tasks:0,activities:0,receipts:0,redeemed:0});
  assert.equal((await f.db.select().from(workspaces).where(eq(workspaces.id,"a")))[0].templateId,null);
 }finally{f.cleanup();}
});

for (const phase of ["account", "project"] as const) {
 test(phase+" deletion intent blocks a new claim and an existing replay", async()=>{
  for(const replay of [false,true]) {
   const f=await fixture();try {
    if(replay)assert.equal((await claim(f.db,f.input)).ok,true);
    if(phase==="account") {
     const {beginAccountDeletionWith}=await import("../account-deletion-lifecycle");
     await beginAccountDeletionWith(f.db,"owner");
     assert.deepEqual(await claim(f.db,f.input),{ok:false,reason:"still-provisioning"});
    } else {
     await f.client.execute({sql:"INSERT INTO project_drive_operations (id,workspace_id,operation_kind,status,dedupe_key) VALUES ('deleting','a','project_delete','pending',?)",args:["a".repeat(64)]});
     await assert.rejects(()=>claim(f.db,f.input),/being deleted/);
    }
    assert.equal((await counts(f)).redeemed,replay?1:0);
    assert.equal((await counts(f)).grants,replay?1:0);
    assert.equal((await counts(f)).tasks,replay?18:0);
   }finally{f.cleanup();}
  }
 });
}
