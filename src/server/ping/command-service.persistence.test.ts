import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { taskToSchedule } from "@/components/hybrid/adapter";
import type { Task } from "@/lib/data";
import type { CalendarFrame } from "@/lib/calendar-frame";
import { accountDeletionTombstoneKey } from "@/server/account-deletion-key";
import { createLocalConversationDatabaseAdapter, type ConversationSqlExecutor, type ConversationSqlResult, type ConversationSqlStatement } from "@/server/conversations/database";
import { createPingCommandService, type PingExecutionResult, type PingProofSeam } from "./command-service";
import { createPingProofFixture, PROOF_NOW, PROOF_PROJECT, proofCommand, proofContext,
  proofCount, proofEditCommand, seedProofSponsor, seedProofTask } from "./proof-fixture";

const options = { now: () => PROOF_NOW };
const frame: CalendarFrame = { nowIso: new Date(PROOF_NOW).toISOString(), today: "2026-10-06", locale: "en-IE",
  timeZone: "Europe/Dublin", source: "server", planningPeriod: null };
const tables = ["tasks", "activities", "ping_command_receipts", "sponsored_use_intents", "sponsored_use_subjects"] as const;

const tableOrder = {
  tasks: "id",
  activities: "id",
  ping_command_receipts: "actor_id,command_id",
  sponsored_use_intents: "id",
  sponsored_use_subjects: "actor_key,epoch",
} as const;

type SqlMutationLabel = string;

function sqlMutationLabel(statement: ConversationSqlStatement | string): SqlMutationLabel | null {
  const sql = typeof statement === "string" ? statement : statement.sql;
  const normalized = sql.replace(/[\"'`]/g, "");
  const match = normalized.match(/^\s*(INSERT|UPDATE|DELETE|REPLACE)\s+(?:INTO\s+)?([a-z_][\w]*)/i);
  return match ? `${match[1].toLowerCase()} ${match[2].toLowerCase()}` : null;
}

function observedAdapter(client: import("@libsql/client").Client, trace: {
  labels: string[];
  failAt: number | null;
  failureHits: number;
  sentinel: Error;
}): ReturnType<typeof createLocalConversationDatabaseAdapter> {
  const observed: ConversationSqlExecutor = {
    async execute(statement) {
      const label = sqlMutationLabel(statement);
      if (label) {
        trace.labels.push(label);
        if (trace.failAt !== null && trace.labels.length === trace.failAt) {
          trace.failureHits++;
          throw trace.sentinel;
        }
      }
      const result = await client.execute(statement as Parameters<typeof client.execute>[0]);
      return result as unknown as ConversationSqlResult;
    },
  };
  return createLocalConversationDatabaseAdapter({ client: observed });
}

async function orderedMutationTables(client: import("@libsql/client").Client) {
  return Object.fromEntries(await Promise.all(tables.map(async table => [table,
    (await client.execute(`SELECT * FROM ${table} ORDER BY ${tableOrder[table]}`)).rows,
  ])));
}

/** Test interposition only: hold before forwarding the first physical writer BEGIN. */
function beforeFirstWrite(client: import("@libsql/client").Client) {
  let release!: () => void, arrived!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const reached = new Promise<void>(resolve => { arrived = resolve; });
  const trace = { readBegins: 0, writeBegins: 0, writeAuth: 0, writeIdentity: 0, writeFence: 0, mutations: [] as string[] };
  let writing = false;
  const observed: ConversationSqlExecutor = { async execute(statement) {
    const sql = typeof statement === "string" ? statement : statement.sql;
    if (sql === "BEGIN IMMEDIATE") {
      trace.writeBegins++;
      if (trace.writeBegins === 1) { arrived(); await held; }
    }
    const result = await client.execute(statement as Parameters<typeof client.execute>[0]);
    if (sql === "BEGIN IMMEDIATE") writing = true;
    else if (sql === "BEGIN TRANSACTION") trace.readBegins++;
    else if (sql === "COMMIT" || sql === "ROLLBACK") writing = false;
    else if (writing) {
      if (/FROM workspace_members member JOIN workspaces project/.test(sql)) trace.writeAuth++;
      if (/SELECT actor\.id AS actor_id/.test(sql)) trace.writeIdentity++;
      if (/SELECT 1 AS blocked FROM project_drive_operations/.test(sql)) trace.writeFence++;
      const label = sqlMutationLabel(statement); if (label) trace.mutations.push(label);
    }
    return result as unknown as ConversationSqlResult;
  } };
  return { adapter: createLocalConversationDatabaseAdapter({ client: observed }), reached, release, trace };
}

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

test("stale readset, archived/missing/foreign selection and config drift reject the entire batch before writes", async () => {
  for (const mode of ["assignees","due","duration","lane","config","missing","foreign","archive"] as const) {
    const f = await createPingProofFixture();
    try {
      await seedProofTask(f.client,"task-a"); await seedProofTask(f.client,"task-b");
      const command = await proofEditCommand(f.client,["task-a","task-b"], {selfAssignment:"add",dueDate:"2026-10-25",statusColumnKey:"done"});
      const context = proofContext(command);
      if (mode === "config") await f.client.execute({sql:"INSERT INTO meta(key,value) VALUES(?,?)",args:[`board:${PROOF_PROJECT}:columns`,'{"doneKeys":["review"]}']});
      else if (mode === "missing") await f.client.execute("DELETE FROM tasks WHERE id='task-b'");
      else if (mode === "foreign") await f.client.execute("UPDATE tasks SET workspace_id='synthetic-foreign-project' WHERE id='task-b'");
      else if (mode === "archive") await f.client.execute("UPDATE tasks SET archived_at=1791277200 WHERE id='task-b'");
      else await f.client.execute(`UPDATE tasks SET ${mode === "assignees" ? "assignees='[]'" : mode === "due" ? "due='2026-12-01'" : mode === "duration" ? "duration_days=2" : "lane='doing'"} WHERE id='task-b'`);
      // The external edit is permitted to stand; the captured command may not
      // overwrite it or apply a prefix to the still-valid first selected task.
      const afterExternalEdit=(await f.client.execute("SELECT * FROM tasks ORDER BY id")).rows;
      if (mode === "archive") assert.equal(afterExternalEdit.find(row=>row.id==="task-b")?.archived_at,1791277200);
      assert.deepEqual(await createPingCommandService(f.adapter,options).execute({ command,context }),{ok:false,reason:"conflict"});
      assert.deepEqual((await f.client.execute("SELECT * FROM tasks ORDER BY id")).rows,afterExternalEdit);
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
  const worker=resolve("scripts/ping/proof-contention-worker.ts");
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
  const worker=resolve("scripts/ping/proof-contention-worker.ts");
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

test("every physical DML fault position rolls back a selected compound and the success trace is exact", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "fault-task-a");
    await seedProofTask(f.client, "fault-task-b");
    const trace = { labels: [] as string[], failAt: null as number | null, failureHits: 0, sentinel: new Error("synthetic DML fault") };
    const service = createPingCommandService(observedAdapter(f.client, trace), options);
    const expected = [
      "update tasks", "insert activities", "insert activities", "insert activities",
      "update tasks", "insert activities", "insert activities", "insert activities", "insert ping_command_receipts",
    ];

    for (let ordinal = 1; ordinal <= expected.length; ordinal++) {
      const command = await proofEditCommand(f.client, ["fault-task-a", "fault-task-b"],
        { selfAssignment: "add", dueDate: "2026-10-25", statusColumnKey: "done" }, 1000 + ordinal);
      const before = await orderedMutationTables(f.client);
      trace.labels = []; trace.failAt = ordinal; trace.failureHits = 0;
      assert.deepEqual(await service.execute({ command, context: proofContext(command) }),
        { ok: false, reason: "temporarily_unavailable" }, `ordinal ${ordinal}`);
      assert.equal(trace.failureHits, 1, `fault sentinel reached exactly once at ${ordinal}`);
      assert.deepEqual(trace.labels, expected.slice(0, ordinal), `fixed mutation prefix at ${ordinal}`);
      assert.deepEqual(await orderedMutationTables(f.client), before, `all five tables rolled back at ${ordinal}`);
      assert.equal(Number((await f.client.execute({ sql: "SELECT COUNT(*) AS n FROM ping_command_receipts WHERE actor_id=? AND command_id=?",
        args: ["alice", command.commandId] })).rows[0].n), 0, `no original receipt at ${ordinal}`);
    }

    const command = await proofEditCommand(f.client, ["fault-task-a", "fault-task-b"],
      { selfAssignment: "add", dueDate: "2026-10-25", statusColumnKey: "done" }, 9000);
    trace.labels = []; trace.failAt = null; trace.failureHits = 0;
    const result = await service.execute({ command, context: proofContext(command) });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(trace.labels, expected, "positive control proves the complete successful DML sequence");
    assert.equal(await proofCount(f.client, "tasks"), 2);
    assert.equal(await proofCount(f.client, "activities"), 6);
    assert.equal(await proofCount(f.client, "ping_command_receipts"), 1);
    assert.equal(await proofCount(f.client, "sponsored_use_intents"), 0);
    assert.equal(await proofCount(f.client, "sponsored_use_subjects"), 0);
  } finally { f.client.close(); }
});

test("every physical DML fault position rolls back ten captured creates and the success trace is exact", async () => {
  const f = await createPingProofFixture();
  try {
    const captureConfig = await seedProofSponsor(f.client);
    const trace = { labels: [] as string[], failAt: null as number | null, failureHits: 0, sentinel: new Error("synthetic DML fault") };
    const service = createPingCommandService(observedAdapter(f.client, trace), { ...options, captureConfig });
    const expected = Array.from({ length: 10 }, () => [
      "insert tasks", "insert activities", "insert sponsored_use_intents", "insert sponsored_use_subjects",
    ]).flat().concat("insert ping_command_receipts");

    for (let ordinal = 1; ordinal <= expected.length; ordinal++) {
      const command = proofCommand(2000 + ordinal, {}, 10);
      const before = await orderedMutationTables(f.client);
      trace.labels = []; trace.failAt = ordinal; trace.failureHits = 0;
      assert.deepEqual(await service.execute({ command, context: proofContext(command) }),
        { ok: false, reason: "temporarily_unavailable" }, `ordinal ${ordinal}`);
      assert.equal(trace.failureHits, 1, `fault sentinel reached exactly once at ${ordinal}`);
      assert.deepEqual(trace.labels, expected.slice(0, ordinal), `fixed mutation prefix at ${ordinal}`);
      assert.deepEqual(await orderedMutationTables(f.client), before, `all five tables rolled back at ${ordinal}`);
      assert.equal(Number((await f.client.execute({ sql: "SELECT COUNT(*) AS n FROM ping_command_receipts WHERE actor_id=? AND command_id=?",
        args: ["alice", command.commandId] })).rows[0].n), 0, `no original receipt at ${ordinal}`);
    }

    const command = proofCommand(9001, {}, 10);
    trace.labels = []; trace.failAt = null; trace.failureHits = 0;
    const result = await service.execute({ command, context: proofContext(command) });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(trace.labels, expected, "positive control proves all 41 successful-path DML statements");
    assert.equal(await proofCount(f.client, "tasks"), 10);
    assert.equal(await proofCount(f.client, "activities"), 10);
    assert.equal(await proofCount(f.client, "sponsored_use_intents"), 10);
    assert.equal(await proofCount(f.client, "sponsored_use_subjects"), 1);
    assert.equal(await proofCount(f.client, "ping_command_receipts"), 1);
  } finally { f.client.close(); }
});

test("fresh first-write authority denies five canonical blockers installed after capture before BEGIN", async () => {
  for (const mode of ["membership", "role", "actor-delete", "owner-delete", "project-delete"] as const) {
    const f = await createPingProofFixture(), gate = beforeFirstWrite(f.client);
    let pending: Promise<PingExecutionResult> | null = null;
    try {
      await seedProofTask(f.client, "authority-a"); await seedProofTask(f.client, "authority-b");
      await seedProofTask(f.client, "authority-foreign", { projectId: "synthetic-foreign-project" });
      const command = await proofEditCommand(f.client, ["authority-a", "authority-b"],
        { selfAssignment: "add", dueDate: "2026-10-25", statusColumnKey: "done" }, 9100);
      const context = proofContext(command);
      pending = createPingCommandService(gate.adapter, options).execute({ command, context });
      await Promise.race([gate.reached, pending.then(() => { throw Error("original settled before writer barrier"); })]);
      assert.equal(gate.trace.readBegins, 1, "preliminary receipt READ completed before external blocker");
      assert.equal(gate.trace.writeAuth, 0, "no writer authorization before actual BEGIN");
      const key = accountDeletionTombstoneKey(mode === "owner-delete" ? "clerk_owner" : "clerk_alice");
      const dedupe = "b".repeat(64);
      if (mode === "membership") await f.client.execute({ sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id='alice'", args: [PROOF_PROJECT] });
      else if (mode === "role") await f.client.execute({ sql: "UPDATE workspace_members SET role='viewer' WHERE workspace_id=? AND user_id='alice'", args: [PROOF_PROJECT] });
      else if (mode === "project-delete") await f.client.execute({ sql: `INSERT INTO project_drive_operations
        (id,workspace_id,operation_kind,status,dedupe_key) VALUES('synthetic-delete',?,'project_delete','pending',?)`, args: [PROOF_PROJECT, dedupe] });
      else await f.client.execute({ sql: "INSERT INTO meta(key,value) VALUES(?,'synthetic')", args: [key] });
      const blockerStatement = mode === "membership" || mode === "role"
        ? { sql: "SELECT role FROM workspace_members WHERE workspace_id=? AND user_id='alice'", args: [PROOF_PROJECT] }
        : mode === "project-delete"
          ? { sql: "SELECT id,workspace_id,operation_kind,status,dedupe_key FROM project_drive_operations WHERE id='synthetic-delete'" }
          : { sql: "SELECT key,value FROM meta WHERE key=?", args: [key] };
      const blocker = mode === "membership" ? [] : mode === "role" ? [{ role: "viewer" }]
        : mode === "project-delete" ? [{ id: "synthetic-delete", workspace_id: PROOF_PROJECT, operation_kind: "project_delete", status: "pending", dedupe_key: dedupe }]
          : [{ key, value: "synthetic" }];
      assert.deepEqual((await f.client.execute(blockerStatement)).rows, blocker);
      const baseline = await orderedMutationTables(f.client);
      gate.release();
      assert.deepEqual(await pending, { ok: false, reason: "unavailable" }, mode);
      assert.equal(gate.trace.writeBegins, 1); assert.equal(gate.trace.writeAuth, 1);
      const fenced = mode !== "membership" && mode !== "role";
      assert.equal(gate.trace.writeIdentity, fenced ? 1 : 0); assert.equal(gate.trace.writeFence, fenced ? 1 : 0);
      assert.deepEqual(gate.trace.mutations, [], "no physical task/activity/receipt prefix");
      assert.deepEqual(await orderedMutationTables(f.client), baseline, "all five post-blocker tables and every task field preserved");
      assert.equal(await proofCount(f.client, "activities"), 0);
      assert.equal(Number((await f.client.execute({ sql: "SELECT COUNT(*) AS n FROM ping_command_receipts WHERE actor_id='alice' AND command_id=?",
        args: [command.commandId] })).rows[0].n), 0);
      assert.deepEqual((await f.client.execute(blockerStatement)).rows, blocker, "canonical blocker retained");
    } finally { gate.release(); if (pending) await Promise.allSettled([pending]); f.client.close(); }
  }
});

test("concurrent changed plans sharing one original identity commit only the actual winning whole plan", async () => {
  const f = await createPingProofFixture(), gate = beforeFirstWrite(f.client);
  const pending: Promise<PingExecutionResult>[] = [];
  try {
    await seedProofTask(f.client, "pair-a"); await seedProofTask(f.client, "pair-b");
    await seedProofTask(f.client, "pair-foreign", { projectId: "synthetic-foreign-project" });
    const commands = await Promise.all((["doing", "review"] as const).map(statusColumnKey =>
      proofEditCommand(f.client, ["pair-a", "pair-b"], { statusColumnKey }, 9200)));
    const contexts = commands.map(command => proofContext(command)), before = await orderedMutationTables(f.client);
    const service = createPingCommandService(gate.adapter, options); let settled = 0;
    for (let index = 0; index < commands.length; index++) {
      pending.push(service.execute({ command: commands[index], context: contexts[index] }).then(result => { settled++; return result; }));
    }
    await Promise.race([gate.reached, Promise.all(pending).then(() => { throw Error("pair settled before writer barrier"); })]);
    assert.equal(pending.length, 2); assert.equal(settled, 0, "both public calls started before either completed");
    gate.release(); const results = await Promise.all(pending);
    assert.equal(results.filter(result => result.ok && !result.replayed).length, 1);
    assert.equal(results.filter(result => !result.ok && result.reason === "request_conflict").length, 1);
    const winnerIndex = results.findIndex(result => result.ok), loserIndex = 1 - winnerIndex;
    const winner = results[winnerIndex]; assert.ok(winner.ok); assert.equal(winner.replayed, false);
    const lane = commands[winnerIndex].operation.effects.statusColumnKey;
    const committedAtSeconds = Math.floor(PROOF_NOW / 1000);
    const expectedRows = before.tasks.map((row: Record<string, unknown>) => row.id === "pair-a" || row.id === "pair-b"
      ? { ...row, lane, board_column_key: null, idle_days: null, updated_at: committedAtSeconds } : { ...row });
    const after = await orderedMutationTables(f.client);
    assert.equal(after.tasks.length, before.tasks.length); assert.deepEqual(after.tasks, expectedRows);
    const expectedActivities = ["pair-a", "pair-b"].map(taskId => ({
      id: `ping-a-${createHash("sha256").update(JSON.stringify(["alice", commands[winnerIndex].commandId, taskId, "lane"])).digest("hex").slice(0, 24)}`,
      workspace_id: PROOF_PROJECT, task_id: taskId, user_id: "alice", kind: "update",
      payload: '{"kind":"update","field":"lane"}', created_at: committedAtSeconds,
    })).sort((a, b) => a.id.localeCompare(b.id));
    assert.deepEqual(after.activities, expectedActivities);
    assert.deepEqual(after.sponsored_use_intents, before.sponsored_use_intents);
    assert.deepEqual(after.sponsored_use_subjects, before.sponsored_use_subjects);
    const receipt = { version: "ping.receipt.v1", commandId: commands[winnerIndex].commandId,
      projectId: PROOF_PROJECT, committedAtSeconds, outcome: "completed", affectedCount: 2, changedCount: 2,
      effects: ["pair-a", "pair-b"].map(taskId => ({ taskId, changedFields: ["lane"] })) };
    assert.deepEqual(winner.receipt, receipt); assert.equal(after.ping_command_receipts.length, 1);
    const persisted = after.ping_command_receipts[0];
    assert.equal(persisted.actor_id, "alice"); assert.equal(persisted.command_id, commands[winnerIndex].commandId);
    assert.equal(persisted.project_id, PROOF_PROJECT); assert.equal(persisted.committed_at, committedAtSeconds);
    assert.deepEqual(JSON.parse(String(persisted.receipt_json)), receipt);
    assert.deepEqual(await service.getReceiptForCommand({ command: commands[winnerIndex], context: contexts[winnerIndex] }),
      { ok: true, state: "committed", receipt });
    assert.deepEqual(await service.getReceiptForCommand({ command: commands[loserIndex], context: contexts[loserIndex] }),
      { ok: false, reason: "request_conflict" });
    assert.deepEqual(await orderedMutationTables(f.client), after, "authorized receipt recovery performs no writes");
  } finally { gate.release(); await Promise.allSettled(pending); f.client.close(); }
});
