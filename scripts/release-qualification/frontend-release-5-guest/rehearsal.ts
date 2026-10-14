import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { initialize, snapshot, cleanup, db, client } from "./database";
import { setActor, actorReads } from "./actor";
import { fixtureLogs } from "./log";
import { invalidations } from "./cache";
import * as actions from "@/server/actions/wedding-guests";
import { readGuestListWith } from "@/server/wedding/guests";
import { catererCsv } from "@/lib/wedding/guests";
import { exportAccountData } from "@/server/account-export";
import { eraseAccountData } from "@/server/account-erasure";
import { deleteProjectRowsInTransaction } from "@/server/projects/project-deletion-rows";
import { users, workspaces, workspaceMembers, weddingHouseholds, weddingGuests, projectDriveOperations } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const root=process.env.GUEST_HARNESS_ROOT!;
const attempt=process.env.GUEST_ATTEMPT!;
const out=join(root,"attempts",attempt); mkdirSync(out,{recursive:true});
if (!(globalThis as any).__networkBlocked) throw new Error("Network blocker must preload before source imports");
const cases: {name:string,run:()=>Promise<void>}[]=[];
const checks: unknown[]=[];
function check(name:string,run:()=>Promise<void>){cases.push({name,run})}
function ok(result:any){assert.equal(result.ok,true,JSON.stringify(result));return result.value}
async function list(id="w-a"){return (await readGuestListWith(db,id)).households}
async function household(project="w-a",name="Harness Person") {return ok(await actions.addHouseholdAction(project,{name,guests:[{firstName:name}]})) as string}
async function seed(){
 await db.insert(users).values(["a","b","member","coowner","outsider"].map(id=>({id,clerkId:"clerk-"+id,handle:id,email:id+"@fixture.invalid",name:"Synthetic "+id,color:"fixture",initials:id.slice(0,2)})));
 await db.insert(workspaces).values([
  {id:"w-a",slug:"w-a",name:"Harness A",ownerUserId:"a",activeDomain:"wedding"},
  {id:"w-a2",slug:"w-a2",name:"Harness A second",ownerUserId:"a",activeDomain:"wedding"},
  {id:"w-b",slug:"w-b",name:"Foreign Private B",ownerUserId:"b",activeDomain:"wedding"},
  {id:"w-normal",slug:"w-normal",name:"Non wedding",ownerUserId:"a"},
 ]);
 await db.insert(workspaceMembers).values([
 {workspaceId:"w-a",userId:"a",role:"owner"},{workspaceId:"w-a2",userId:"a",role:"owner"},
 {workspaceId:"w-b",userId:"b",role:"owner"},{workspaceId:"w-b",userId:"a",role:"member"},
 {workspaceId:"w-a",userId:"member",role:"member"},{workspaceId:"w-a",userId:"coowner",role:"owner"},
 {workspaceId:"w-normal",userId:"a",role:"owner"}]);
 setActor("b"); await household("w-b","Foreign Private Person"); setActor("a");
}
function mutations(project="w-a",h="unknown-household",g="unknown-guest") {return [
 ()=>actions.addHouseholdAction(project,{guests:[{firstName:"Forbidden"}]}),
 ()=>actions.updateHouseholdAction(project,h,{name:"Forbidden"}),
 ()=>actions.deleteHouseholdAction(project,h),
 ()=>actions.setHouseholdRsvpAction(project,h,"attending"),
 ()=>actions.addGuestAction(project,h,{firstName:"Forbidden"}),
 ()=>actions.updateGuestAction(project,g,{firstName:"Forbidden"}),
 ()=>actions.deleteGuestAction(project,g),
 ()=>actions.importGuestsAction(project,"First name,Last name\nForbidden,Import")
]}
async function refusesAll(project="w-a") {const before=await snapshot(); for(const call of mutations(project)) {const result=await call();assert.equal(result.ok,false,JSON.stringify(result));assert.deepEqual(await snapshot(),before);assert.ok(!JSON.stringify(result).includes("Foreign Private"));} }

check("01-primary-owner-real-actions-success-and-reload",async()=>{
 const id=ok(await actions.addHouseholdAction("w-a",{name:"Owner Household",guests:[{firstName:"Adult",lastName:"Synthetic"},{firstName:"Child",isChild:true}],unnamedPlusOne:true,email:"synthetic@fixture.invalid"}));
 let h=(await list()).find(x=>x.id===id)!;assert.equal(h.guests.length,3);assert.equal(h.guests[1]!.meal,"child");assert.ok(h.guests.find(g=>g.plusOneOf));
 ok(await actions.setHouseholdRsvpAction("w-a",id,"attending"));ok(await actions.updateGuestAction("w-a",h.guests[0]!.id,{meal:"vegetarian",dietary:"Synthetic dietary marker"}));ok(await actions.updateHouseholdAction("w-a",id,{invitation:"sent",notes:"Private synthetic notes"}));
 const extra=ok(await actions.addGuestAction("w-a",id,{firstName:"Added"}));ok(await actions.deleteGuestAction("w-a",extra));
 h=(await list()).find(x=>x.id===id)!;assert.equal(h.guests.length,3);assert.ok(h.guests.every(x=>x.rsvp==="attending"));assert.equal(h.invitation,"sent");assert.equal(h.guests[0]!.dietary,"Synthetic dietary marker");
 assert.ok(invalidations.includes("/app/wedding/guests"));ok(await actions.deleteHouseholdAction("w-a",id));assert.equal((await list()).length,0);assert.equal((await list("w-b")).length,1);
});
for(const actor of ["member","coowner"])check("02-"+actor+"-is-authorized-on-active-project",async()=>{setActor(actor);const id=await household();ok(await actions.setHouseholdRsvpAction("w-a",id,"attending"));assert.equal((await list())[0]!.guests[0]!.rsvp,"attending");ok(await actions.deleteHouseholdAction("w-a",id));assert.equal((await list()).length,0)});
check("03-nonmember-all-eight-actions-refuse-without-mutation",async()=>{setActor("outsider");await refusesAll();assert.equal(actorReads,8)});
check("04-unauthenticated-all-eight-actions-refuse-without-mutation",async()=>{setActor(null);await refusesAll();assert.equal(actorReads,8)});
check("05-archived-project-all-eight-actions-refuse",async()=>{await db.update(workspaces).set({archivedAt:new Date()}).where(eq(workspaces.id,"w-a"));await refusesAll()});
check("06-deletion-fence-all-four-nonterminal-statuses-refuse",async()=>{for(const status of ["pending","running","retry_wait","manual_attention"] as const){await db.insert(projectDriveOperations).values({id:"delete-"+status,workspaceId:"w-a",operationKind:"project_delete",status,dedupeKey:(String(["pending","running","retry_wait","manual_attention"].indexOf(status)+1)).repeat(64),createdAt:new Date(1700000000000),updatedAt:new Date(1700000003000),...(status!=="pending"?{attemptCount:1,lastAttemptAt:new Date(1700000001000)}:{}),...(status==="running"?{leaseExpiresAt:new Date(1700000002000)}:{}),...(status==="retry_wait"?{nextAttemptAt:new Date(1700000002000),lastErrorCode:"provider_unavailable" as const}:{}),...(status==="manual_attention"?{lastErrorCode:"provider_unavailable" as const}:{})});await refusesAll();await db.delete(projectDriveOperations).where(eq(projectDriveOperations.id,"delete-"+status));}});
check("07-nonwedding-project-all-eight-actions-refuse",async()=>{await refusesAll("w-normal")});
check("08-foreign-project-and-sibling-household-identifiers-refuse",async()=>{
 const foreign=(await list("w-b"))[0]!;const own=await household("w-a","Owned A");const other=await household("w-a","Sibling A");const sibling=(await list()).find(h=>h.id===other)!;const before=await snapshot();
 const foreignCalls=[()=>actions.updateHouseholdAction("w-a",foreign.id,{name:"Hijack"}),()=>actions.deleteHouseholdAction("w-a",foreign.id),()=>actions.setHouseholdRsvpAction("w-a",foreign.id,"attending"),()=>actions.addGuestAction("w-a",foreign.id,{firstName:"Hijack"}),()=>actions.updateGuestAction("w-a",foreign.guests[0]!.id,{rsvp:"attending"}),()=>actions.deleteGuestAction("w-a",foreign.guests[0]!.id),()=>actions.addGuestAction("w-a",own,{plusOneOf:foreign.guests[0]!.id}),()=>actions.addGuestAction("w-a",own,{plusOneOf:sibling.guests[0]!.id})];
 for(const call of foreignCalls){assert.equal((await call()).ok,false);assert.deepEqual(await snapshot(),before)}
});
check("09-malformed-and-missing-project-ids-refuse",async()=>{for(const p of ["", " w-a", "https://fixture.invalid", "unknown"]){await refusesAll(p)}});
check("10-total-600-success-and-601-refusal-with-no-partial-rows",async()=>{
 const id=ok(await actions.addHouseholdAction("w-a",{guests:Array.from({length:599},(_,i)=>({firstName:"Guest"+i}))}));ok(await actions.addGuestAction("w-a",id,{firstName:"SixHundred"}));assert.equal((await list())[0]!.guests.length,600);const before=await snapshot();
 for(const call of [()=>actions.addGuestAction("w-a",id,{firstName:"TooMany"}),()=>actions.addHouseholdAction("w-a",{guests:[{firstName:"TooMany"}]}),()=>actions.importGuestsAction("w-a","First name\nTooMany")]){const x=await call();assert.equal(x.ok,false);assert.equal((x as any).reason,"limit");assert.deepEqual(await snapshot(),before)}
});
check("11-import-601-input-rows-is-explicitly-capped-at-600",async()=>{const text="First name,Household\n"+Array.from({length:601},(_,i)=>"Row"+i+",One household").join("\n");const value=ok(await actions.importGuestsAction("w-a",text));assert.deepEqual(value,{households:1,guests:600});assert.equal((await list())[0]!.guests.length,600)});
check("12-mid-import-sql-trigger-failure-rolls-back-first-household",async()=>{
 await client.execute(`CREATE TRIGGER harness_fail_second BEFORE INSERT ON wedding_households WHEN NEW.name='Rollback Two' AND (SELECT count(*) FROM wedding_households WHERE workspace_id='w-a' AND name='Rollback One')=1 BEGIN SELECT RAISE(ABORT,'synthetic second household fault after first insertion'); END`);
 const before=await snapshot();const x=await actions.importGuestsAction("w-a","First name,Household\nFirst,Rollback One\nSecond,Rollback Two");assert.equal(x.ok,false);assert.equal((x as any).reason,"unavailable");assert.deepEqual(await snapshot(),before);assert.equal((await list()).length,0);
});
check("13-invalid-and-oversize-input-leaves-no-rows",async()=>{const before=await snapshot();assert.equal((await actions.importGuestsAction("w-a","x".repeat(200001))).ok,false);assert.equal((await actions.addHouseholdAction("w-a",{guests:[{firstName:" "}]})).ok,false);assert.deepEqual(await snapshot(),before)});
check("14-real-exporter-privacy-formula-prefixes-and-csv-quoting",async()=>{
 for(const prefix of ["=","+","-","@"]){const id=ok(await actions.addHouseholdAction("w-a",{name:" \t"+prefix+"Household ",guests:[{firstName:" \t"+prefix+"Formula ",lastName:'Quote"Comma,'}],email:"PRIVATE_CONTACT@fixture.invalid",phone:"PRIVATE_PHONE",address:"PRIVATE_ADDRESS"}));const h=(await list()).find(h=>h.id===id)!;ok(await actions.updateHouseholdAction("w-a",id,{notes:"PRIVATE_NOTES"}));ok(await actions.updateGuestAction("w-a",h.guests[0]!.id,{rsvp:"attending",dietary:" \t"+prefix+"Dietary "}));}
 await household("w-a","NOT_ATTENDING_SECRET");const csv=catererCsv(await list(),{household:true,meal:true,dietary:true});writeFileSync(join(out,"synthetic-caterer.csv"),csv);
 for(const prefix of ["=","+","-","@"]) {assert.ok(csv.includes("'"+prefix+"Formula"));assert.ok(csv.includes("'"+prefix+"Household"));assert.ok(csv.includes("'"+prefix+"Dietary"));}
 for(const secret of ["PRIVATE_CONTACT","PRIVATE_PHONE","PRIVATE_ADDRESS","PRIVATE_NOTES","NOT_ATTENDING_SECRET"])assert.ok(!csv.includes(secret));assert.ok(csv.includes('Quote""Comma,'));assert.equal(csv.trim().split("\n").length,5);
 const compact=catererCsv(await list(),{household:false,meal:false,dietary:false});assert.equal(compact.split("\n")[0],"Guest");
});
check("15-account-export-owned-projects-only-not-other-owner-membership",async()=>{
 await household("w-a","Owned Export");await household("w-a2","Second Owned Export");const result=await exportAccountData(db,"clerk-a");const owned=(result as any).ownedWorkspaces;assert.deepEqual([...new Set(owned.weddingHouseholds.map((h:any)=>h.workspaceId))].sort(),["w-a","w-a2"]);assert.equal(owned.weddingGuests.length,2);assert.ok(!JSON.stringify(owned.weddingHouseholds).includes("Foreign Private"));
 const member=await exportAccountData(db,"clerk-member");assert.equal((member as any).ownedWorkspaces.weddingHouseholds.length,0);assert.equal((member as any).ownedWorkspaces.weddingGuests.length,0);
});
check("16-canonical-project-row-cleanup-with-foreign-keys-off",async()=>{await household("w-a","Delete Owned");const beforeForeign=await list("w-b");await db.transaction(async tx=>{await deleteProjectRowsInTransaction(tx,"w-a")},{behavior:"immediate"});assert.equal((await list()).length,0);assert.deepEqual(await list("w-b"),beforeForeign);assert.equal((await db.select().from(workspaces).where(eq(workspaces.id,"w-a"))).length,1)});
check("17-canonical-account-erasure-removes-owned-guests-preserves-other-owner",async()=>{await household("w-a","Erase Owned");await household("w-a2","Erase Second Owned");const beforeForeign=await list("w-b");const providerCalls: string[]=[];await eraseAccountData(db,"clerk-a",{deleteStoredBytes:async()=>{providerCalls.push("unexpected-bytes");throw new Error("No bytes expected")}});assert.equal((await list("w-a")).length,0);assert.equal((await list("w-a2")).length,0);assert.deepEqual(await list("w-b"),beforeForeign);assert.equal(providerCalls.length,0);assert.equal((await db.select().from(users).where(eq(users.id,"a"))).length,0);assert.equal((await db.select().from(users).where(eq(users.id,"b"))).length,1)});

let failed=0;
for(const c of cases){let receipt:any={name:c.name,startedAt:new Date().toISOString(),identityBoundary:"trusted synthetic actor fixture; not Clerk/JWT authentication"};appendFileSync(join(out,"events.jsonl"),JSON.stringify({event:"case-start",...receipt})+"\n");
 try{fixtureLogs.length=0;invalidations.length=0;receipt.database=await initialize(attempt+"-"+c.name);await seed();writeFileSync(join(out,c.name+".before.json"),JSON.stringify(await snapshot(),null,2));await c.run();receipt.status="PASS";}catch(error){failed++;receipt.status="FAIL";receipt.error={name:(error as Error).name,message:(error as Error).message,stack:(error as Error).stack};}
 finally{try{writeFileSync(join(out,c.name+".after.json"),JSON.stringify(await snapshot(),null,2));receipt.fixtureLogs=fixtureLogs;receipt.cacheInvalidations=invalidations;receipt.cleanup=cleanup();if(!receipt.cleanup.closed){receipt.status="FAIL";failed++;}}catch(error){receipt.cleanupError=String(error);receipt.status="FAIL";failed++;}receipt.endedAt=new Date().toISOString();checks.push(receipt);appendFileSync(join(out,"events.jsonl"),JSON.stringify({event:"case-end",...receipt})+"\n");console.log(JSON.stringify({name:receipt.name,status:receipt.status,cleanup:receipt.cleanup?.allAbsent,error:receipt.error?.message,cleanupError:receipt.cleanupError}));}
}
const result={schema:"signal-disposable-guest-action-results/1",sourceCommit:"b805c5501f8198218791491ae0a2f26efbae0657",sourceTree:"07ea449b3f9f39724961875bd612f18f6ae34071",attempt,networkAttempts:(globalThis as any).__blockedNetworkAttempts,startedAt:(checks[0] as any)?.startedAt,endedAt:new Date().toISOString(),total:cases.length,passed:checks.filter((x:any)=>x.status==="PASS").length,failed:checks.filter((x:any)=>x.status!=="PASS").length,allAssertionsPass:failed===0,allPass:false,pendingParentCleanup:true,checks,scope:"Actual current guest actions/authz/fence/SQL/transactions and real account export/project rows/erasure; trusted actor shim. No Clerk/browser/provider/production qualification.",sourcePins:JSON.parse(readFileSync(join(root,"source-pins.json"),"utf8"))};writeFileSync(join(out,"results.json"),JSON.stringify(result,null,2)+"\n");process.exitCode=failed?1:0;
