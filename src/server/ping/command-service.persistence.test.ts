import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { taskToSchedule } from "@/components/hybrid/adapter";
import type { Task } from "@/lib/data";
import type { CalendarFrame } from "@/lib/calendar-frame";
import { accountDeletionTombstoneKey } from "@/server/account-deletion-key";
import { createLocalConversationDatabaseAdapter } from "@/server/conversations/database";
import { createPingCommandService, type PingProofSeam } from "./command-service";
import { createPingProofFixture, PROOF_NOW, PROOF_PROJECT, proofCommand, proofContext,
  proofCount, proofEditCommand, seedProofSponsor, seedProofTask } from "./proof-fixture";

const options = { now: () => PROOF_NOW };
const frame: CalendarFrame = { nowIso: new Date(PROOF_NOW).toISOString(), today: "2026-10-06", locale: "en-IE",
  timeZone: "Europe/Dublin", source: "server", planningPeriod: null };
const tables = ["tasks", "activities", "ping_command_receipts", "sponsored_use_intents", "sponsored_use_subjects"] as const;

test("file-backed FK-ON max creation retains literal titles, canonical sequence/activities/capture and survives reconnect", async () => {
  const f = await createPingProofFixture();
  try {
    const captureConfig = await seedProofSponsor(f.client);
    const service = createPingCommandService(f.adapter, { ...options, captureConfig });
    const command = { ...proofCommand(1, { selfAssignment: "add", dueDate: "2026-10-25", statusColumnKey: "done" }, 10),
      operation: { ...proofCommand(1).operation, kind: "create_placeholders" as const, title: "Follow up {n}", count: 10,
        effects: { selfAssignment: "add" as const, dueDate: "2026-10-25", statusColumnKey: "done" as const } } };
    const result = await service.execute({ command, context: proofContext(command) });
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) return;
    assert.equal(result.receipt.affectedCount, 10); assert.equal(result.receipt.changedCount, 10);
    const rows = (await f.client.execute("SELECT * FROM tasks ORDER BY seq")).rows;
    assert.deepEqual(rows.map(row => row.seq), [1,2,3,4,5,6,7,8,9,10]);
    assert.deepEqual(rows.map(row => row.position), [1,2,3,4,5,6,7,8,9,10]);
    for (const row of rows) {
      assert.equal(row.title, "Follow up {n}"); assert.equal(row.priority, "p2");
      assert.equal(row.assignees, '["alice"]'); assert.equal(row.completed_at, PROOF_NOW / 1000);
      assert.deepEqual(taskToSchedule({ id: row.id, dueAt: new Date(Number(row.due_at)*1000).toISOString() } as unknown as Task, frame), { kind: "due", dueOn: "2026-10-25" });
    }
    assert.equal(await proofCount(f.client, "activities"), 10);
    assert.equal(await proofCount(f.client, "sponsored_use_intents"), 10);
    assert.equal(await proofCount(f.client, "sponsored_use_subjects"), 1);
    assert.equal(await proofCount(f.client, "ping_command_receipts"), 1);
    for (const row of (await f.client.execute("SELECT payload FROM sponsored_use_intents")).rows) assert.ok(!String(row.payload).includes("Follow up"));
    f.client.close();
    const reopened = createClient({ url: `file:${f.databasePath.replaceAll("\\", "/")}` });
    try {
      await reopened.execute("PRAGMA foreign_keys=ON");
      const restored = createPingCommandService(createLocalConversationDatabaseAdapter({ client: reopened }), options);
      const lookup = await restored.getReceipt({ actorId: "alice", commandId: command.commandId });
      assert.deepEqual(lookup, { ok: true, state: "committed", receipt: result.receipt });
      assert.deepEqual(await restored.execute({ command, context: proofContext(command) }), { ...result, replayed: true });
      assert.equal(await proofCount(reopened, "tasks"), 10);
    } finally { reopened.close(); }
  } finally { f.client.close(); }
});

test("compound selected edits preserve others and scheduling fields; clear/DST changes reach actual Hybrid projection", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "task-a", { durationDays: 3, startDay: 2 });
    await seedProofTask(f.client, "task-b");
    await seedProofTask(f.client, "unselected");
    await seedProofTask(f.client, "foreign", {projectId:"synthetic-foreign-project"});
    const untouched=(await f.client.execute("SELECT * FROM tasks WHERE id IN ('unselected','foreign') ORDER BY id")).rows;
    const service = createPingCommandService(f.adapter, options);
    const compound = await proofEditCommand(f.client, ["task-a", "task-b"], { selfAssignment: "add", dueDate: "2026-03-29", statusColumnKey: "done" });
    const result = await service.execute({ command: compound, context: proofContext(compound) });
    assert.equal(result.ok, true, JSON.stringify(result));
    let row = (await f.client.execute("SELECT * FROM tasks WHERE id='task-a'")).rows[0];
    assert.equal(row.assignees, '["bob","alice"]'); assert.equal(row.start_day, 2); assert.equal(row.duration_days, 3);
    assert.equal(row.completed_at, PROOF_NOW/1000);
    assert.deepEqual(taskToSchedule({ id:"task-a", dueAt: new Date(Number(row.due_at)*1000).toISOString(), durationDays: 3, startDay: 2 } as unknown as Task, frame),
      { kind: "range", startOn: "2026-03-27", dueOn: "2026-03-29" });
    assert.equal(await proofCount(f.client, "activities"), 6);
    const clear = await proofEditCommand(f.client, ["task-a"], { selfAssignment:"remove", dueDate:null, statusColumnKey:"todo" }, 2);
    assert.equal((await service.execute({ command: clear, context: proofContext(clear) })).ok, true);
    row = (await f.client.execute("SELECT * FROM tasks WHERE id='task-a'")).rows[0];
    assert.equal(row.assignees, '["bob"]'); assert.equal(row.due, null); assert.equal(row.due_at, null); assert.equal(row.completed_at, null);
    assert.equal(row.start_day, 2); assert.equal(row.duration_days, 3);
    assert.deepEqual(taskToSchedule({ id:"task-a", dueAt:null, durationDays:3, startDay:2 } as unknown as Task, frame), { kind:"unscheduled" });
    assert.deepEqual(taskToSchedule({ id:"task-a", dueAt:null, durationDays:3, startDay:2 } as unknown as Task,
      {...frame,planningPeriod:{id:"synthetic-period",name:"Synthetic",startDate:"2026-10-01",endDate:null}}),
      {kind:"range",startOn:"2026-10-03",dueOn:"2026-10-05"}, "due clear preserves independently anchored span");
    const noop = await proofEditCommand(f.client, ["task-a"], { selfAssignment:"remove", dueDate:null, statusColumnKey:"todo" }, 3);
    const unchanged = await service.execute({ command: noop, context: proofContext(noop) });
    assert.equal(unchanged.ok, true);
    if (unchanged.ok) assert.deepEqual([unchanged.receipt.outcome, unchanged.receipt.affectedCount, unchanged.receipt.changedCount], ["no_changes",1,0]);
    assert.equal(await proofCount(f.client, "activities"), 9);
    assert.deepEqual((await f.client.execute("SELECT * FROM tasks WHERE id IN ('unselected','foreign') ORDER BY id")).rows,untouched);
  } finally { f.client.close(); }
});

test("selected compound failure restores full prior records and emits no partial activity/receipt",async()=>{
  const f=await createPingProofFixture();
  try {
    await seedProofTask(f.client,"task-a");await seedProofTask(f.client,"task-b");
    const before=(await f.client.execute("SELECT * FROM tasks ORDER BY id")).rows;
    const command=await proofEditCommand(f.client,["task-a","task-b"],{selfAssignment:"add",dueDate:"2026-10-25",statusColumnKey:"done"});
    const service=createPingCommandService(f.adapter,{...options,afterWrite(seam,index){if(seam==="activity"&&index===2)throw new Error("synthetic");}});
    assert.deepEqual(await service.execute({command,context:proofContext(command)}),{ok:false,reason:"temporarily_unavailable"});
    assert.deepEqual((await f.client.execute("SELECT * FROM tasks ORDER BY id")).rows,before);
    assert.equal(await proofCount(f.client,"activities"),0);assert.equal(await proofCount(f.client,"ping_command_receipts"),0);
  } finally {f.client.close();}
});

test("every durable seam and sixth insert failure rolls back actual sponsored intent, task, activity and receipt", async () => {
  for (const seam of ["task","activity","capture","receipt"] as PingProofSeam[]) {
    const f = await createPingProofFixture();
    try {
      const captureConfig = await seedProofSponsor(f.client);
      const service = createPingCommandService(f.adapter, { ...options, captureConfig, afterWrite(value,index) {
        if (value === seam && (seam === "receipt" || index === 6)) throw new Error("synthetic-private-secret");
      } });
      const command = proofCommand(1,{},10);
      assert.deepEqual(await service.execute({ command, context: proofContext(command) }), { ok:false, reason:"temporarily_unavailable" });
      for (const table of tables) assert.equal(await proofCount(f.client,table),0, `${seam}:${table}`);
    } finally { f.client.close(); }
  }
});

test("stale readset, missing/foreign selection and config drift reject the entire batch before writes", async () => {
  for (const mode of ["assignees","due","duration","lane","config","missing","foreign"] as const) {
    const f = await createPingProofFixture();
    try {
      await seedProofTask(f.client,"task-a"); await seedProofTask(f.client,"task-b");
      const command = await proofEditCommand(f.client,["task-a","task-b"], {selfAssignment:"add",dueDate:"2026-10-25",statusColumnKey:"done"});
      const context = proofContext(command);
      if (mode === "config") await f.client.execute({sql:"INSERT INTO meta(key,value) VALUES(?,?)",args:[`board:${PROOF_PROJECT}:columns`,'{"doneKeys":["review"]}']});
      else if (mode === "missing") await f.client.execute("DELETE FROM tasks WHERE id='task-b'");
      else if (mode === "foreign") await f.client.execute("UPDATE tasks SET workspace_id='synthetic-foreign-project' WHERE id='task-b'");
      else await f.client.execute(`UPDATE tasks SET ${mode === "assignees" ? "assignees='[]'" : mode === "due" ? "due='2026-12-01'" : mode === "duration" ? "duration_days=2" : "lane='doing'"} WHERE id='task-b'`);
      assert.deepEqual(await createPingCommandService(f.adapter,options).execute({ command,context }),{ok:false,reason:"conflict"});
      const first=(await f.client.execute("SELECT assignees,lane,due FROM tasks WHERE id='task-a'")).rows[0];
      assert.deepEqual({...first},{assignees:'["bob"]',lane:"todo",due:null});
      assert.equal(await proofCount(f.client,"activities"),0); assert.equal(await proofCount(f.client,"ping_command_receipts"),0);
    } finally { f.client.close(); }
  }
});

test("trusted capture/item/finality cannot be changed by a normalized interpreter envelope", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client,"task-a");
    const command=await proofEditCommand(f.client,["task-a"],{selfAssignment:"add"});
    const service=createPingCommandService(f.adapter,options);
    for(const kind of ["project","selection","precondition","item","incomplete"] as const) {
      const context=structuredClone(proofContext(command));
      if(kind==="project") Object.assign(context.captured,{projectId:"synthetic-foreign-project"});
      if(kind==="selection") Object.assign(context.captured,{selectedTaskIds:[]});
      if(kind==="precondition") Object.assign(context.captured,{expected:{"task-a":{assignees:[]}}});
      if(kind==="item") Object.assign(context.input,{itemId:"different-item"});
      if(kind==="incomplete") Object.assign(context.input,{state:"incomplete"});
      assert.deepEqual(await service.execute({command,context}),{ok:false,reason:kind==="incomplete"?"incomplete_input":"invalid_command"});
    }
    assert.equal(await proofCount(f.client,"activities"),0); assert.equal(await proofCount(f.client,"ping_command_receipts"),0);
  } finally { f.client.close(); }
});

test("lost response recovery, same-key conflict and same-adapter concurrent retry never duplicate writes", async () => {
  const f=await createPingProofFixture();
  try {
    const service=createPingCommandService(f.adapter,options),command=proofCommand();
    const results=await Promise.all(Array.from({length:8},()=>service.execute({command,context:proofContext(command)})));
    assert.ok(results.every(result=>result.ok)); assert.equal(results.filter(result=>result.ok&&!result.replayed).length,1);
    const first=results[0]; if(!first.ok) return;
    assert.deepEqual(await service.getReceipt({actorId:"alice",commandId:command.commandId}),{ok:true,state:"committed",receipt:first.receipt});
    const changed={...command,operation:{...command.operation,kind:"create_placeholders" as const,count:2,title:"Untitled task",effects:{}}};
    assert.deepEqual(await service.execute({command:changed,context:proofContext(changed)}),{ok:false,reason:"request_conflict"});
    assert.equal(await proofCount(f.client,"tasks"),1); assert.equal(await proofCount(f.client,"activities"),1);
    assert.deepEqual(await service.getReceipt({actorId:"alice",commandId:"-".repeat(36)}),{ok:false,reason:"invalid_command"});
    const uppercase={...command,commandId:"ABCDEF01-0000-4000-8000-000000000001"};
    const committed=await service.execute({command:uppercase,context:proofContext(uppercase)}); assert.equal(committed.ok,true);
    if(committed.ok) assert.deepEqual(await service.getReceipt({actorId:"alice",commandId:uppercase.commandId}),{ok:true,state:"committed",receipt:committed.receipt});
  } finally { f.client.close(); }
});

test("independent file contention fails closed; fresh-process recovery retains identity and current auth", () => {
  const worker=resolve("src/server/ping/proof-contention-worker.ts");
  const run=(args:string[])=>spawnSync(process.execPath,["--import","tsx","--import","./src/test/register-server-only.mjs",worker,...args],{encoding:"utf8",timeout:30000});
  const contention=run(["contend"]);
  assert.equal(contention.status,0,contention.stderr);
  const observed=JSON.parse(contention.stdout.trim());
  assert.equal(observed.blocked,true);assert.equal(observed.noDuplicateWrites,true);
  for(const key of ["sameConnectionReplayRecovered","sameConnectionNewWriteRecovered","sameProcessReopenReplayRecovered","sameProcessReopenWriteBlocked","readRecovery","newWriteCommitted"]) {
    assert.equal(typeof observed[key],"boolean",key);
  }
  const recovery=run(["recover",observed.databasePath]);
  assert.equal(recovery.status,0,recovery.stderr);
  assert.deepEqual(JSON.parse(recovery.stdout.trim()),{freshProcessRecovered:true,originalIdentity:true,noDuplicateWrites:true,currentAuth:true,previousNewWriteCommitted:observed.newWriteCommitted});
});

test("recovery worker refuses a non-fixture path before opening a database",()=>{
  const worker=resolve("src/server/ping/proof-contention-worker.ts");
  const result=spawnSync(process.execPath,["--import","tsx","--import","./src/test/register-server-only.mjs",worker,"recover",resolve("AGENTS.md")],{encoding:"utf8",timeout:15000});
  assert.equal(result.status,1);assert.equal(result.stderr.trim(),"invalid_ping_proof_fixture_path");
  assert.equal(result.stdout,"");
});
test("receipt reads/replay reauthorize membership and actor/owner deletion; archive permits historical receipt but denies new writes", async () => {
  for(const mode of ["membership","role","actor-delete","owner-delete","archive"] as const) {
    const f=await createPingProofFixture();
    try {
      const service=createPingCommandService(f.adapter,options),command=proofCommand();
      const first=await service.execute({command,context:proofContext(command)});assert.equal(first.ok,true);
      if(mode==="membership") await f.client.execute("DELETE FROM workspace_members WHERE user_id='alice'");
      if(mode==="role") await f.client.execute("UPDATE workspace_members SET role='viewer' WHERE user_id='alice'");
      if(mode.endsWith("delete")) await f.client.execute({sql:"INSERT INTO meta(key,value) VALUES(?,'synthetic')",args:[accountDeletionTombstoneKey(mode==="actor-delete"?"clerk_alice":"clerk_owner")]});
      if(mode==="archive") await f.client.execute("UPDATE workspaces SET archived_at=1");
      const read=await service.getReceipt({actorId:"alice",commandId:command.commandId});
      const replay=await service.execute({command,context:proofContext(command)});
      if(mode==="archive") {assert.equal(read.ok,true);assert.equal(replay.ok,true);const next=proofCommand(2);assert.deepEqual(await service.execute({command:next,context:proofContext(next)}),{ok:false,reason:"unavailable"});}
      else {assert.deepEqual(read,{ok:false,reason:"unavailable"});assert.deepEqual(replay,{ok:false,reason:"unavailable"});}
      assert.equal(await proofCount(f.client,"tasks"),1);assert.equal(await proofCount(f.client,"ping_command_receipts"),1);
    } finally {f.client.close();}
  }
});

test("configured system done semantics preserve old stamp between done columns and clear it on exit",async()=>{
  const f=await createPingProofFixture();
  try {
    await seedProofTask(f.client,"task-a",{lane:"review",completedAt:123});
    await f.client.execute({sql:"INSERT INTO meta(key,value) VALUES(?,?)",args:[`board:${PROOF_PROJECT}:columns`,'{"doneKeys":["review","done"]}']});
    const service=createPingCommandService(f.adapter,options);
    for(const [index,column] of [[1,"done"],[2,"todo"]] as const) {
      const command=await proofEditCommand(f.client,["task-a"],{statusColumnKey:column},index);
      assert.equal((await service.execute({command,context:proofContext(command)})).ok,true);
      const row=(await f.client.execute("SELECT completed_at FROM tasks WHERE id='task-a'")).rows[0];
      assert.equal(row.completed_at,column==="done"?123:null);
    }
  } finally {f.client.close();}
});
