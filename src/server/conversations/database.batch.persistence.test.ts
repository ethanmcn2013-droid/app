import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type InStatement } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { canonicalVenueCodeNotes } from "@/server/venue-issuance/canonical";
import { issuanceReceiptKey, manifestHash, venueCodeFingerprint, type IssuanceManifest } from "@/lib/venue-issuance/protocol";
import { assertProjectId } from "@/lib/projects/project-ref";
import { accountDeletionTombstoneKey } from "@/server/account-deletion-key";
import { createLocalConversationDatabaseAdapter, createRemoteConversationDatabaseAdapter, executeConversationBatch, type ConversationSqlStatement } from "./database";
import { createConversationService } from "./service";
import { createConversationTaskOutcomeService } from "./work-links";

const projectId = assertProjectId("batch_test_project");
const sql = (statement: string | ConversationSqlStatement) => typeof statement === "string" ? statement : statement.sql;
const native = (statement: string | ConversationSqlStatement): InStatement => typeof statement === "string" ? statement : { sql: statement.sql, args: [...(statement.args ?? [])] };

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "conversation-batch-"));
  const client = createClient({ url: `file:${join(directory, "test.db").replaceAll("\\", "/")}` });
  for (const file of (await readdir("drizzle")).filter(name => /^\d{4}_.+\.sql$/.test(name) && name >= "0014_").sort()) {
    await client.executeMultiple(await readFile(join("drizzle", file), "utf8"));
  }
  await client.batch([
    "INSERT INTO users(id,clerk_id,name,color,initials) VALUES ('alice','clerk_alice','Alice','#111','AA'),('bob','clerk_bob','Bob','#222','BB')",
    { sql: "INSERT INTO workspaces(id,slug,name,owner_user_id,context_type) VALUES (?,?,'Test','alice','project')", args: [projectId, projectId] },
    { sql: "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES (?,'alice','owner'),(?,'bob','member')", args: [projectId, projectId] },
  ]);
  // Serialize native test handles only: the installed native driver does not
  // support overlapping interactive handles. Production remote scheduling is unchanged.
  let tail = Promise.resolve();
  const control = { fault: "", invalidAllocation: "", loseCommitResponse: false, batches: [] as string[][],
    readBatches: [] as string[][], executions: [] as string[] };
  const adapter = createRemoteConversationDatabaseAdapter({ client: {
    execute: statement => client.execute(native(statement)),
    transaction: async mode => {
      const previous = tail; let release!: () => void;
      tail = new Promise<void>(resolve => { release = resolve; });
      await previous;
      let tx;
      try { tx = await client.transaction(mode); } catch (error) { release(); throw error; }
      return {
        execute: statement => { control.executions.push(sql(statement)); return tx.execute(native(statement)); },
        batch: async statements => {
          (sql(statements[0]).startsWith("SELECT") ? control.readBatches : control.batches).push(statements.map(sql));
          const converted = statements.map(statement => control.fault && sql(statement).includes(control.fault)
            ? "SELECT * FROM synthetic_missing_table" : native(statement));
          const results = await tx.batch(converted);
          if (control.invalidAllocation && sql(statements[0]).startsWith("INSERT INTO tasks")) {
            if (control.invalidAllocation === "activity") return [results[0], { ...results[1], rowsAffected: 0 }];
            return [{ ...results[0], rows: control.invalidAllocation === "duplicate" ? [...results[0].rows, ...results[0].rows] : [] }, results[1]];
          }
          return results;
        },
        commit: async () => { try { await tx.commit(); if (control.loseCommitResponse) throw Error("commit_response_lost"); } finally { release(); } },
        rollback: async () => { try { await tx.rollback(); } finally { release(); } },
      };
    },
  } });
  const service = createConversationService(adapter);
  const room = await service.ensureProjectConversation({ actorId: "alice", projectId });
  assert.ok(room.ok); if (!room.ok) throw Error("fixture_room");
  const input = (request: string) => ({ projectId, conversationId: room.value.conversationId,
    clientRequestId: request, expectedAudienceEpoch: room.value.audienceEpoch, body: "Synthetic batch message", rootId: null, mentionUserIds: ["bob"] });
  const count = async (table: string) => Number((await client.execute(`SELECT count(*) n FROM ${table}`)).rows[0].n);
  return { client, adapter, service, room: room.value, input, count, control };
}

test("four aligned callers use actual native transaction batches with unique sequence/task effects and replay", async () => {
  const f = await fixture();
  try {
    const inputs = Array.from({ length: 4 }, (_, i) => f.input(`batch_send_request_${i}`));
    const results = await Promise.all(inputs.map(input => f.service.sendMessage({ actorId: "alice", input })));
    const receipts = results.map(result => { assert.ok(result.ok); if (!result.ok) throw Error("send"); return result.value; });
    assert.equal(new Set(receipts.map(r => r.createSeq)).size, 4);
    assert.equal(new Set(receipts.map(r => r.changeSeq)).size, 4);
    for (const table of ["conversation_messages", "conversation_changes", "conversation_receipts", "conversation_attention", "conversation_outbox"]) assert.equal(await f.count(table), 4);
    assert.equal(f.control.batches.length, 4);
    assert.ok(f.control.batches.every(batch => batch.length === 6 && batch[0].startsWith("UPDATE conversations")));
    assert.deepEqual(await f.service.sendMessage({ actorId: "alice", input: inputs[0] }), results[0]);
    assert.deepEqual(await f.service.sendMessage({ actorId: "alice", input: { ...inputs[0], body: "different" } }), { ok: false, code: "request_conflict" });
    assert.equal(f.control.batches.length, 4);
    const tasks = createConversationTaskOutcomeService(f.adapter);
    const promotions = receipts.map((receipt, i) => ({ sourceProjectId: projectId, destinationProjectId: projectId,
      conversationId: f.room.conversationId, messageId: receipt.messageId, expectedRevision: 1,
      expectedAudienceEpoch: f.room.audienceEpoch, clientRequestId: `batch_promote_request_${i}`,
      title: `Task ${i}`, ownerUserId: "bob", dueDate: "2026-10-25" as const }));
    const promoted = await Promise.all(promotions.map(input => tasks.promoteMessageToTask({ actorId: "alice", input })));
    assert.ok(promoted.every(result => result.ok));
    assert.equal(f.control.batches.length, 12);
    for (const [index, batch] of f.control.batches.slice(4).entries()) assert.deepEqual(batch.map(s => /INSERT INTO (\w+)/.exec(s)?.[1]),
      index % 2 === 0 ? ["tasks", "activities"] : ["work_links", "suite_outbox", "work_operation_receipts"]);
    for (const table of ["tasks", "activities", "work_links", "suite_outbox", "work_operation_receipts"]) assert.equal(await f.count(table), 4);
    const taskRows = (await f.client.execute("SELECT seq,position,due,due_at,priority FROM tasks ORDER BY seq")).rows;
    assert.equal(new Set(taskRows.map(r => r.seq)).size, 4); assert.equal(new Set(taskRows.map(r => r.position)).size, 4);
    assert.ok(taskRows.every(r => r.due === "2026-10-25" && Number(r.due_at) === Date.UTC(2026, 9, 25, 12) / 1000 && r.priority === "p2"));
    assert.deepEqual(await tasks.promoteMessageToTask({ actorId: "alice", input: promotions[0] }), promoted[0]);
    assert.equal(f.control.batches.length, 12);
  } finally { f.client.close(); }
});

test("every send batch statement failure rolls back counters, message, attention, outbox and receipt", async () => {
  const f = await fixture();
  try {
    const before = (await f.client.execute("SELECT next_create_seq,next_change_seq FROM conversations")).rows;
    for (const table of ["UPDATE conversations", "INSERT INTO conversation_messages", "INSERT INTO conversation_changes", "INSERT INTO conversation_attention", "INSERT INTO conversation_outbox", "INSERT INTO conversation_receipts"]) {
      f.control.fault = table;
      await assert.rejects(f.service.sendMessage({ actorId: "alice", input: f.input("batch_fault_request_001") }), /synthetic_missing_table/);
      for (const name of ["conversation_messages", "conversation_changes", "conversation_receipts", "conversation_attention", "conversation_outbox"]) assert.equal(await f.count(name), 0);
      assert.deepEqual((await f.client.execute("SELECT next_create_seq,next_change_seq FROM conversations")).rows, before);
    }
  } finally { f.client.close(); }
});

test("promotion batch errors roll back preceding canonical Task/activity and retain source message", async () => {
  const f = await fixture();
  try {
    const sent = await f.service.sendMessage({ actorId: "alice", input: f.input("batch_source_request_001") });
    assert.ok(sent.ok); if (!sent.ok) throw Error("source");
    const input = { sourceProjectId: projectId, destinationProjectId: projectId, conversationId: f.room.conversationId,
      messageId: sent.value.messageId, expectedRevision: 1, expectedAudienceEpoch: f.room.audienceEpoch,
      clientRequestId: "batch_task_failure_001", title: "Test", ownerUserId: "bob", dueDate: "2026-10-25" as const };
    const service = createConversationTaskOutcomeService(f.adapter, { captureConfig: { enabled: true, salt: "synthetic-capture-salt", now: Date.now() } });
    for (const table of ["tasks", "activities", "work_links", "suite_outbox", "work_operation_receipts"]) {
      f.control.fault = `INSERT INTO ${table}`;
      await assert.rejects(service.promoteMessageToTask({ actorId: "alice", input }), /synthetic_missing_table/);
      for (const name of ["tasks", "activities", "work_links", "suite_outbox", "work_operation_receipts", "sponsored_use_intents"]) assert.equal(await f.count(name), 0);
      assert.equal(await f.count("conversation_messages"), 1);
    }
  } finally { f.client.close(); }
});

test("malformed native Task allocation/activity acknowledgments roll back all promotion effects", async () => {
  const f = await fixture();
  try {
    const sent = await f.service.sendMessage({ actorId: "alice", input: f.input("allocation_source_request_001") });
    assert.ok(sent.ok); if (!sent.ok) throw Error("source");
    const input = { sourceProjectId: projectId, destinationProjectId: projectId, conversationId: f.room.conversationId,
      messageId: sent.value.messageId, expectedRevision: 1, expectedAudienceEpoch: f.room.audienceEpoch,
      clientRequestId: "allocation_task_request_001", title: "Test", ownerUserId: "bob", dueDate: "2026-10-25" as const };
    const service = createConversationTaskOutcomeService(f.adapter);
    for (const invalid of ["absent", "duplicate", "activity"]) {
      f.control.invalidAllocation = invalid;
      await assert.rejects(service.promoteMessageToTask({ actorId: "alice", input }), /conversation_task_allocation_invalid/);
      for (const table of ["tasks", "activities", "work_links", "suite_outbox", "work_operation_receipts"]) assert.equal(await f.count(table), 0);
    }
    f.control.invalidAllocation = "";
    assert.ok((await service.promoteMessageToTask({ actorId: "alice", input })).ok);
    assert.deepEqual((await f.client.execute("SELECT seq,position FROM tasks")).rows.map(row => [row.seq, row.position]), [[1, 1]]);
  } finally { f.client.close(); }
});

test("fresh mapping, deletion fences and revoked membership refuse writes before batch; lost commit remains recoverable", async () => {
  const f = await fixture();
  try {
    assert.equal(await f.service.resolveActor("clerk_alice"), "alice");
    await f.client.execute("UPDATE users SET clerk_id='changed_clerk' WHERE id='alice'");
    assert.equal(await f.service.resolveActor("clerk_alice"), null);
    assert.equal(await f.service.resolveActor("changed_clerk"), "alice");
    const tombstone = accountDeletionTombstoneKey("changed_clerk");
    await f.client.execute({ sql: "INSERT INTO meta(key,value) VALUES (?,'pending')", args: [tombstone] });
    assert.deepEqual(await f.service.sendMessage({ actorId: "alice", input: f.input("batch_denial_request_001") }), { ok: false, code: "unavailable" });
    assert.equal(f.control.batches.length, 0);
    await f.client.execute({ sql: "DELETE FROM meta WHERE key=?", args: [tombstone] });
    f.control.loseCommitResponse = true;
    const input = f.input("batch_lost_commit_001");
    await assert.rejects(f.service.sendMessage({ actorId: "alice", input }), /commit_response_lost/);
    assert.equal(await f.count("conversation_messages"), 1);
    f.control.loseCommitResponse = false;
    const recovered = await f.service.sendMessage({ actorId: "alice", input }); assert.ok(recovered.ok);
    assert.equal(f.control.batches.length, 1);
    await f.client.execute({ sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id='alice'", args: [projectId] });
    assert.deepEqual(await f.service.sendMessage({ actorId: "alice", input }), { ok: false, code: "unavailable" });
    assert.equal(f.control.batches.length, 1);
  } finally { f.client.close(); }
});

test("native promotion batch preserves canonical sponsored capture and rolls it back when a later receipt fails", async () => {
  const f = await fixture();
  try {
    const now = Date.now(), code = "VENUE-ABCDE-FGHJK";
    const manifest: IssuanceManifest = {
      version: 1, issuanceId: "vi-" + "a".repeat(32), sponsorId: "synthetic-sponsor",
      sponsorSlug: "synthetic", sponsorName: "Synthetic venue", environment: "internal_test", issuedAt: now - 2 * 86_400_000,
      eligibility: { kind: "pilot", reference: "synthetic-fixture-only", startsAt: now - 3 * 86_400_000, endsAt: now + 86_400_000 },
      tier: "wedding", durationDays: 548, codes: [{ licenseCodeId: "vlc-" + "a".repeat(32), codeFingerprint: venueCodeFingerprint(code) }],
    };
    const database = drizzle(f.client, { schema });
    await database.insert(schema.meta).values({ key: issuanceReceiptKey(manifest.issuanceId), value: JSON.stringify({ manifest, manifestHash: manifestHash(manifest) }) });
    await database.insert(schema.compCodes).values({ code, tier: "wedding", durationDays: 548, quantity: 1, redeemed: 1, notes: canonicalVenueCodeNotes(manifest, manifest.codes[0]) });
    await database.insert(schema.entitlements).values({ id: "claim-alice", userId: "alice", workspaceId: projectId, source: "comp", tier: "wedding",
      startedAt: new Date(now - 86_400_000), expiresAt: new Date(now + 86_400_000), notes: "comp:" + code });
    const sent = await f.service.sendMessage({ actorId: "alice", input: f.input("batch_capture_source_001") });
    assert.ok(sent.ok); if (!sent.ok) throw Error("source");
    const input = { sourceProjectId: projectId, destinationProjectId: projectId, conversationId: f.room.conversationId,
      messageId: sent.value.messageId, expectedRevision: 1, expectedAudienceEpoch: f.room.audienceEpoch,
      clientRequestId: "batch_capture_task_001", title: "Test", ownerUserId: "bob", dueDate: "2026-10-25" as const };
    const service = createConversationTaskOutcomeService(f.adapter, { captureConfig: { enabled: true, salt: "synthetic-sponsored-capture-salt", now } });
    f.control.fault = "INSERT INTO work_operation_receipts";
    await assert.rejects(service.promoteMessageToTask({ actorId: "alice", input }), /synthetic_missing_table/);
    for (const table of ["tasks", "activities", "work_links", "suite_outbox", "work_operation_receipts", "sponsored_use_intents", "sponsored_use_subjects"]) assert.equal(await f.count(table), 0);
    f.control.fault = "";
    const result = await service.promoteMessageToTask({ actorId: "alice", input }); assert.ok(result.ok);
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input }), result);
    for (const table of ["tasks", "activities", "work_links", "suite_outbox", "work_operation_receipts", "sponsored_use_intents", "sponsored_use_subjects"]) assert.equal(await f.count(table), 1);
  } finally { f.client.close(); }
});

test("send batches independent authorization/receipt reads and reuses live fence identities without weakening replay", async () => {
  const f = await fixture();
  try {
    f.control.executions.length = 0;
    const input = f.input("roundtrip_send_request_001");
    const sent = await f.service.sendMessage({ actorId: "alice", input });
    assert.ok(sent.ok);
    assert.equal(f.control.readBatches.length, 1);
    assert.equal(f.control.readBatches[0].length, 2);
    assert.match(f.control.readBatches[0][0], /SELECT c\.\*/);
    assert.match(f.control.readBatches[0][1], /FROM conversation_receipts/);
    assert.equal(f.control.executions.length, 2); // fence blocked-state and mention membership
    assert.ok(f.control.executions.every(statement => !statement.includes("FROM workspaces project")));
    await f.client.execute({ sql: "UPDATE workspaces SET owner_user_id=NULL WHERE id=?", args: [projectId] });
    assert.deepEqual(await f.service.sendMessage({ actorId: "alice", input }), sent);
    assert.deepEqual(await f.service.sendMessage({ actorId: "alice", input: f.input("roundtrip_missing_owner_001") }), { ok: false, code: "unavailable" });
    await f.client.execute("PRAGMA foreign_keys=OFF"); // simulate legacy orphan rows, not an allowed ordinary write
    await f.client.execute({ sql: "UPDATE workspaces SET owner_user_id='ghost_owner' WHERE id=?", args: [projectId] });
    assert.deepEqual(await f.service.sendMessage({ actorId: "alice", input: f.input("roundtrip_orphan_owner_001") }), { ok: false, code: "unavailable" });
    await f.client.execute({ sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id='alice'", args: [projectId] });
    assert.deepEqual(await f.service.sendMessage({ actorId: "alice", input }), { ok: false, code: "unavailable" });
    assert.equal(await f.count("conversation_messages"), 1);
    assert.equal(await f.count("conversation_receipts"), 1);
  } finally { f.client.close(); }
});

test("same-project promotion reuses one live owner proof while replay survives a missing Project owner", async () => {
  const f = await fixture();
  try {
    const sent = await f.service.sendMessage({ actorId: "alice", input: f.input("roundtrip_source_request_001") });
    assert.ok(sent.ok); if (!sent.ok) throw Error("source");
    const input = { sourceProjectId: projectId, destinationProjectId: projectId, conversationId: f.room.conversationId,
      messageId: sent.value.messageId, expectedRevision: 1, expectedAudienceEpoch: f.room.audienceEpoch,
      clientRequestId: "roundtrip_task_request_001", title: "Test", ownerUserId: "bob", dueDate: "2026-10-25" as const };
    const service = createConversationTaskOutcomeService(f.adapter);
    f.control.executions.length = 0;
    const result = await service.promoteMessageToTask({ actorId: "alice", input });
    assert.ok(result.ok);
    assert.equal(f.control.executions.length, 3); // receipt, source/destination, fence; Task/activity share a native batch
    assert.equal(f.control.executions.filter(statement => statement.includes("FROM project_drive_operations")).length, 1);
    assert.ok(f.control.executions.every(statement => !statement.includes("FROM workspaces project")));
    await f.client.execute({ sql: "UPDATE workspaces SET owner_user_id=NULL WHERE id=?", args: [projectId] });
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input }), result);
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input: { ...input, clientRequestId: "roundtrip_task_missing_001" } }), { ok: false, code: "unavailable" });
    await f.client.execute("PRAGMA foreign_keys=OFF"); // simulate legacy orphan rows, not an allowed ordinary write
    await f.client.execute({ sql: "UPDATE workspaces SET owner_user_id='ghost_owner' WHERE id=?", args: [projectId] });
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input: { ...input, clientRequestId: "roundtrip_task_orphan_001" } }), { ok: false, code: "unavailable" });
    assert.equal(await f.count("tasks"), 1);
    assert.equal(await f.count("work_operation_receipts"), 1);
  } finally { f.client.close(); }
});

test("batch helper validates ordered results; local adapter hides top-level client.batch and retains rollback", async () => {
  const trace: string[] = [];
  const client = { execute: async (statement: string | ConversationSqlStatement) => { trace.push(sql(statement)); return { rows: [] }; },
    batch: async () => { throw Error("top_level_batch_must_not_run"); } };
  const local = createLocalConversationDatabaseAdapter({ client });
  await local.transaction("write", executor => executeConversationBatch(executor, ["SELECT 1", "SELECT 2"]));
  assert.deepEqual(trace, ["BEGIN IMMEDIATE", "SELECT 1", "SELECT 2", "COMMIT"]);
  let rolledBack = false, committed = false;
  const remote = createRemoteConversationDatabaseAdapter({ client: { transaction: async () => ({ execute: client.execute,
    batch: async () => [], commit: async () => { committed = true; }, rollback: async () => { rolledBack = true; } }) } });
  await assert.rejects(remote.transaction("write", executor => executeConversationBatch(executor, ["SELECT 1"])), /batch_results_invalid/);
  assert.equal(rolledBack, true); assert.equal(committed, false);
});
