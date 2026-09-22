import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { assertProjectId } from "@/lib/projects/project-ref";
import * as schema from "@/server/db/schema";
import { canonicalVenueCodeNotes } from "@/server/venue-issuance/canonical";
import { issuanceReceiptKey, manifestHash, venueCodeFingerprint, type IssuanceManifest } from "@/lib/venue-issuance/protocol";
import { createLocalConversationDatabaseAdapter } from "./database";
import { createConversationService } from "./service";
import { createConversationTaskOutcomeService, type PromoteMessageToTaskInput } from "./work-links";
import { accountDeletionTombstoneKey } from "@/server/account-deletion-key";
import { resolveTaskOutcome, taskOutcomeIsUnknown } from "@/components/app/messages/task-outcome-client";

const repoRoot = resolve(process.cwd());
const sourceProject = assertProjectId("synthetic_project_source");
const destinationProject = assertProjectId("synthetic_project_destination");

async function fixture() {
  const root = process.env.PC08_WORK_DIR ? resolve(process.env.PC08_WORK_DIR) : tmpdir();
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, "signal-pc08-"));
  const client = createClient({ url: `file:${join(directory, "tasks.db").replaceAll("\\", "/")}` });
  await client.execute("PRAGMA foreign_keys = OFF");
  const migrations = (await readdir(join(repoRoot, "drizzle"))).filter((name) => /^\d{4}_.+\.sql$/.test(name) && name >= "0014_").sort();
  for (const migration of migrations) await client.executeMultiple(await readFile(join(repoRoot, "drizzle", migration), "utf8"));
  const now = Date.now();
  await client.batch([
    { sql: "INSERT INTO users(id,clerk_id,name,color,initials) VALUES ('alice','clerk_alice','Alice','#111','AA')" },
    { sql: "INSERT INTO users(id,clerk_id,name,color,initials) VALUES ('bob','clerk_bob','Bob','#222','BB')" },
    { sql: "INSERT INTO users(id,clerk_id,name,color,initials) VALUES ('mallory','clerk_mallory','Mallory','#333','MM')" },
    { sql: "INSERT INTO workspaces(id,slug,name,owner_user_id,context_type,created_at,updated_at) VALUES (?,'source','Source','alice','project',?,?)", args: [sourceProject, now, now] },
    { sql: "INSERT INTO workspaces(id,slug,name,owner_user_id,context_type,created_at,updated_at) VALUES (?,'destination','Destination','alice','project',?,?)", args: [destinationProject, now, now] },
    { sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,'alice','owner',?)", args: [sourceProject, now] },
    { sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,'bob','member',?)", args: [sourceProject, now] },
    { sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,'alice','owner',?)", args: [destinationProject, now] },
    { sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,'bob','member',?)", args: [destinationProject, now] },
  ], "write");
  const adapter = createLocalConversationDatabaseAdapter({ client });
  const conversations = createConversationService(adapter);
  const room = await conversations.ensureProjectConversation({ actorId: "alice", projectId: sourceProject });
  assert.equal(room.ok, true);
  if (!room.ok) throw new Error("room setup failed");
  const sent = await conversations.sendMessage({ actorId: "alice", input: {
    projectId: sourceProject, conversationId: room.value.conversationId, clientRequestId: "source_request_0001",
    expectedAudienceEpoch: room.value.audienceEpoch, body: "Private source body that must never be copied",
    rootId: null, mentionUserIds: [],
  } });
  assert.equal(sent.ok, true);
  if (!sent.ok) throw new Error("message setup failed");
  const input: PromoteMessageToTaskInput = {
    clientRequestId: "promotion_request_0001", sourceProjectId: sourceProject,
    conversationId: room.value.conversationId, messageId: sent.value.messageId,
    expectedRevision: sent.value.revision, expectedAudienceEpoch: room.value.audienceEpoch,
    destinationProjectId: destinationProject, title: "Confirm the reviewed plan", ownerUserId: "bob", dueDate: "2026-10-25",
  };
  return { client, adapter, input };
}

async function count(client: Client, table: string): Promise<number> {
  return Number((await client.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n);
}

test("client recovery keeps the original task request through lost acknowledgment and destination access loss", async () => {
  const f = await fixture();
  try {
    const service = createConversationTaskOutcomeService(f.adapter);
    let promotions = 0;
    const transport = {
      isCurrent: () => true,
      lookup: (clientRequestId: string) => service.getTaskReceipt({ actorId: "alice", clientRequestId }),
      promote: async (input: PromoteMessageToTaskInput) => {
        promotions++;
        const result = await service.promoteMessageToTask({ actorId: "alice", input });
        assert.equal(result.ok, true);
        throw new Error("lost_acknowledgment");
      },
    };
    await assert.rejects(resolveTaskOutcome(f.input, transport), /lost_acknowledgment/);
    await f.client.execute({ sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id='alice'", args: [destinationProject] });
    const denied = await resolveTaskOutcome(f.input, transport);
    assert.deepEqual(denied, { ok: false, code: "unavailable", outcomeUnknown: true });
    assert.equal(taskOutcomeIsUnknown(denied), true, "form must retain the original attempt");
    await f.client.execute({ sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,'alice','owner',?)", args: [destinationProject, Date.now()] });
    const recovered = await resolveTaskOutcome(f.input, transport);
    assert.equal(recovered.ok, true);
    if (!recovered.ok) throw new Error("receipt recovery failed");
    assert.equal(recovered.value.clientRequestId, f.input.clientRequestId);
    assert.equal(recovered.value.taskAvailable, true);
    assert.equal(promotions, 1);
    for (const table of ["tasks", "work_links", "work_operation_receipts"]) assert.equal(await count(f.client, table), 1, table);
  } finally { f.client.close(); }
});

test("promotion is atomic, body-free, dated, non-milestone, and exactly replayable", async () => {
  const f = await fixture();
  try {
    const service = createConversationTaskOutcomeService(f.adapter);
    const concurrent = await Promise.all(Array.from({ length: 20 }, () =>
      service.promoteMessageToTask({ actorId: "alice", input: f.input })));
    const first = concurrent[0];
    assert.equal(first.ok, true);
    for (const result of concurrent) assert.deepEqual(result, first);
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input: f.input }), first);
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input: { ...f.input, title: "Changed" } }), { ok: false, code: "request_conflict" });
    for (const table of ["tasks", "activities", "work_links", "suite_outbox", "work_operation_receipts"]) assert.equal(await count(f.client, table), 1, table);
    const task = (await f.client.execute("SELECT title,due,due_at,is_milestone,assignees FROM tasks")).rows[0];
    assert.equal(task.title, f.input.title);
    assert.equal(task.due, "2026-10-25");
    assert.equal(Number(task.due_at), Date.UTC(2026, 9, 25, 12) / 1000);
    assert.equal(Number(task.is_milestone), 0);
    assert.equal(task.assignees, '["bob"]');
    const columns = await f.client.execute("SELECT name FROM pragma_table_info('work_links') WHERE name LIKE '%body%' OR name LIKE '%excerpt%'");
    assert.equal(columns.rows.length, 0);
    if (first.ok) assert.equal((await service.getTaskOutcome({ actorId: "bob", taskId: first.value.taskId })).ok, true);
    assert.deepEqual(await service.getTaskDestination({ actorId: "alice", projectId: destinationProject }), {
      ok: true, value: { projectId: destinationProject, name: "Destination", members: [{ id: "alice", name: "Alice" }, { id: "bob", name: "Bob" }] },
    });
    if (first.ok) assert.deepEqual(await service.getTaskOutcome({ actorId: "mallory", taskId: first.value.taskId }), { ok: true, value: null });
  } finally { f.client.close(); }
});

test("DM task provenance and receipts reauthorize the immutable source conversation for every reader",async()=>{
  const f=await fixture(); try{
    const conversations=createConversationService(f.adapter,{directMessagesEnabled:true});
    const requested=await conversations.requestDirectMessage({actorId:"alice",projectId:sourceProject,recipientId:"bob",clientRequestId:"dm_task_request_001"});
    if(!requested.ok) assert.fail("DM request failed"); const conversationId=requested.value.scope.conversationId;
    const accepted=await conversations.transitionDirectMessage({actorId:"bob",projectId:sourceProject,conversationId,clientRequestId:"dm_task_accept_0001",expectedAudienceEpoch:requested.value.scope.audienceEpoch,operation:"accept"});
    if(!accepted.ok) assert.fail("DM accept failed");
    const sent=await conversations.sendMessage({actorId:"alice",input:{projectId:sourceProject,conversationId,clientRequestId:"dm_task_source_0001",expectedAudienceEpoch:accepted.value.scope.audienceEpoch,body:"private source body",rootId:null,mentionUserIds:[]}});
    if(!sent.ok) assert.fail("DM source failed");
    const input={...f.input,clientRequestId:"dm_promotion_000001",conversationId,messageId:sent.value.messageId,expectedRevision:1,expectedAudienceEpoch:accepted.value.scope.audienceEpoch};
    const outcomes=createConversationTaskOutcomeService(f.adapter,{directMessagesEnabled:true}); const promoted=await outcomes.promoteMessageToTask({actorId:"alice",input});
    if(!promoted.ok) assert.fail("DM promotion failed");
    const stored=(await f.client.execute({sql:"SELECT source_conversation_id FROM work_operation_receipts WHERE actor_id='alice' AND client_request_id=?",args:[input.clientRequestId]})).rows[0];
    assert.equal(stored.source_conversation_id,conversationId);
    assert.equal((await outcomes.getTaskOutcome({actorId:"bob",taskId:promoted.value.taskId})).ok,true);
    const gatedOutcomes=createConversationTaskOutcomeService(f.adapter);
    assert.deepEqual(await gatedOutcomes.getTaskOutcome({actorId:"bob",taskId:promoted.value.taskId}),{ok:true,value:null});
    assert.deepEqual(await gatedOutcomes.getTaskReceipt({actorId:"alice",clientRequestId:input.clientRequestId}),{ok:false,code:"unavailable"});
    await f.client.execute({sql:"INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,'mallory','member',?)",args:[destinationProject,Date.now()]});
    assert.deepEqual(await outcomes.getTaskOutcome({actorId:"mallory",taskId:promoted.value.taskId}),{ok:true,value:null});
    await f.client.execute({sql:"DELETE FROM workspace_members WHERE workspace_id=? AND user_id='alice'",args:[sourceProject]});
    assert.deepEqual(await outcomes.getTaskReceipt({actorId:"alice",clientRequestId:input.clientRequestId}),{ok:false,code:"unavailable"});
    await f.client.execute({sql:"INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,'alice','owner',?)",args:[sourceProject,Date.now()]});
    assert.deepEqual(await outcomes.getTaskReceipt({actorId:"alice",clientRequestId:input.clientRequestId}),{ok:false,code:"unavailable"},"membership alone must not restore DM source entitlement");
  } finally {f.client.close();}
});

test("promotion rejects stale source audience/revision, forged owner, revoked membership, and archives", async () => {
  const f = await fixture();
  try {
    const service = createConversationTaskOutcomeService(f.adapter);
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input: { ...f.input, expectedAudienceEpoch: f.input.expectedAudienceEpoch + 1 } }), { ok: false, code: "audience_changed" });
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input: { ...f.input, expectedRevision: 9 } }), { ok: false, code: "revision_conflict" });
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input: { ...f.input, ownerUserId: "mallory" } }), { ok: false, code: "unavailable" });
    await f.client.execute({ sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id='alice'", args: [destinationProject] });
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input: f.input }), { ok: false, code: "unavailable" });
    assert.equal(await count(f.client, "tasks"), 0);
    await f.client.execute({ sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,'alice','owner',?)", args: [destinationProject, Date.now()] });
    await f.client.execute({ sql: "UPDATE workspaces SET archived_at=? WHERE id=?", args: [Date.now(), destinationProject] });
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input: f.input }), { ok: false, code: "archived" });
  } finally { f.client.close(); }
});

test("promotion refuses January Project deletion and actor/owner account fences before creating anything", async () => {
  const f = await fixture();
  try {
    const service = createConversationTaskOutcomeService(f.adapter);
    const assertNoCreation = async () => {
      for (const table of ["tasks", "activities", "work_links", "suite_outbox", "work_operation_receipts", "sponsored_use_intents"]) {
        assert.equal(await count(f.client, table), 0, table);
      }
    };
    await f.client.execute({
      sql: `INSERT INTO project_drive_operations(id, workspace_id, operation_kind, status, dedupe_key)
        VALUES ('delete_destination', ?, 'project_delete', 'pending', ?)`,
      args: [destinationProject, "a".repeat(64)],
    });
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input: f.input }), { ok: false, code: "unavailable" });
    await assertNoCreation();
    await f.client.execute("DELETE FROM project_drive_operations WHERE id='delete_destination'");

    await f.client.execute({
      sql: `INSERT INTO project_drive_operations(id, workspace_id, operation_kind, status, dedupe_key)
        VALUES ('delete_source', ?, 'project_delete', 'pending', ?)`,
      args: [sourceProject, "d".repeat(64)],
    });
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input: f.input }), { ok: false, code: "unavailable" });
    await assertNoCreation();
    await f.client.execute("DELETE FROM project_drive_operations WHERE id='delete_source'");

    const ownerKey = accountDeletionTombstoneKey("clerk_alice");
    await f.client.execute({ sql: "INSERT INTO meta(key,value) VALUES (?,'erasure-requested:v1')", args: [ownerKey] });
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "bob", input: f.input }), { ok: false, code: "unavailable" });
    await assertNoCreation();
    await f.client.execute({ sql: "DELETE FROM meta WHERE key=?", args: [ownerKey] });

    const actorKey = accountDeletionTombstoneKey("clerk_bob");
    await f.client.execute({ sql: "INSERT INTO meta(key,value) VALUES (?,'erasure-requested:v1')", args: [actorKey] });
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "bob", input: f.input }), { ok: false, code: "unavailable" });
    await assertNoCreation();
    await f.client.execute({ sql: "DELETE FROM meta WHERE key=?", args: [actorKey] });

    // The capture adaptor uses this same SQL transaction, even when the
    // conservative canonical claim rejects collection for this fixture.
    const guarded = createConversationTaskOutcomeService(f.adapter, {
      captureConfig: { enabled: true, salt: "synthetic-at-least-sixteen", now: Date.now() },
    });
    assert.equal((await guarded.promoteMessageToTask({ actorId: "alice", input: f.input })).ok, true);
    assert.equal(await count(f.client, "sponsored_use_intents"), 0);
  } finally { f.client.close(); }
});

test("message promotion captures one canonical sponsored intent atomically and rolls it back with the Task", async () => {
  const f = await fixture();
  try {
    const now = Date.now();
    const salt = "synthetic-sponsored-capture-salt";
    const code = "VENUE-ABCDE-FGHJK";
    const manifest: IssuanceManifest = {
      version: 1, issuanceId: "vi-" + "a".repeat(32), sponsorId: "synthetic-sponsor",
      sponsorSlug: "synthetic", sponsorName: "Synthetic venue", environment: "internal_test",
      issuedAt: now - 2 * 86_400_000,
      eligibility: { kind: "pilot", reference: "synthetic-fixture-only", startsAt: now - 3 * 86_400_000, endsAt: now + 86_400_000 },
      tier: "wedding", durationDays: 548,
      codes: [{ licenseCodeId: "vlc-" + "a".repeat(32), codeFingerprint: venueCodeFingerprint(code) }],
    };
    const database = drizzle(f.client, { schema });
    await database.insert(schema.meta).values({ key: issuanceReceiptKey(manifest.issuanceId), value: JSON.stringify({ manifest, manifestHash: manifestHash(manifest) }) });
    await database.insert(schema.compCodes).values({ code, tier: "wedding", durationDays: 548, quantity: 1, redeemed: 1,
      notes: canonicalVenueCodeNotes(manifest, manifest.codes[0]) });
    await database.insert(schema.entitlements).values({ id: "claim-alice", userId: "alice", workspaceId: destinationProject,
      source: "comp", tier: "wedding", startedAt: new Date(now - 86_400_000), expiresAt: new Date(now + 86_400_000), notes: "comp:" + code });
    const service = createConversationTaskOutcomeService(f.adapter, { captureConfig: { enabled: true, salt, now } });
    const first = await service.promoteMessageToTask({ actorId: "alice", input: f.input });
    assert.equal(first.ok, true);
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input: f.input }), first);
    assert.equal(await count(f.client, "sponsored_use_intents"), 1);
    assert.equal(await count(f.client, "sponsored_use_subjects"), 1);
    const [intent] = (await f.client.execute("SELECT payload FROM sponsored_use_intents")).rows;
    const payload = JSON.parse(String(intent.payload));
    assert.equal(payload.kind, "task_created");
    assert.ok(!JSON.stringify(payload).includes(f.input.title));

    await f.client.execute("CREATE TRIGGER fail_sponsored_capture BEFORE INSERT ON sponsored_use_intents BEGIN SELECT RAISE(ABORT,'synthetic capture failure'); END");
    const second = { ...f.input, clientRequestId: "promotion_capture_rollback_0001" };
    await assert.rejects(() => service.promoteMessageToTask({ actorId: "alice", input: second }));
    assert.equal(await count(f.client, "tasks"), 1);
    assert.equal(await count(f.client, "work_operation_receipts"), 1);
    assert.equal(await count(f.client, "sponsored_use_intents"), 1);
  } finally { f.client.close(); }
});

test("faults at every durable seam roll back task, activity, link, outbox, and receipt", async () => {
  for (const seam of ["task", "activity", "link", "outbox", "receipt"] as const) {
    const f = await fixture();
    try {
      const service = createConversationTaskOutcomeService(f.adapter, { afterWrite(value) { if (value === seam) throw new Error(`fault:${seam}`); } });
      await assert.rejects(service.promoteMessageToTask({ actorId: "alice", input: f.input }), new RegExp(`fault:${seam}`));
      for (const table of ["tasks", "activities", "work_links", "suite_outbox", "work_operation_receipts"]) assert.equal(await count(f.client, table), 0, `${seam}:${table}`);
    } finally { f.client.close(); }
  }
});

test("committed receipt recovery precedes changed source, epoch, archive, and former owner checks", async () => {
  const f = await fixture();
  try {
    const service = createConversationTaskOutcomeService(f.adapter);
    const committed = await service.promoteMessageToTask({ actorId: "alice", input: f.input });
    assert.equal(committed.ok, true);
    await f.client.execute({ sql: "UPDATE conversation_messages SET revision=2, body='Edited after promotion' WHERE id=?", args: [f.input.messageId] });
    await f.client.execute({ sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,'mallory','member',?)", args: [sourceProject, Date.now()] });
    await f.client.execute({ sql: "UPDATE workspaces SET archived_at=? WHERE id=?", args: [Date.now(), destinationProject] });
    await f.client.execute({ sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id='bob'", args: [destinationProject] });

    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input: f.input }), committed);
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input: { ...f.input, title: "Changed after commit" } }), { ok: false, code: "request_conflict" });
    const lookup = await service.getTaskReceipt({ actorId: "alice", clientRequestId: f.input.clientRequestId });
    assert.equal(lookup.ok, true);
    if (!lookup.ok) return;
    assert.equal(lookup.value.state, "committed");
    if (lookup.value.state !== "committed") return;
    assert.equal(lookup.value.taskAvailable, true);
    assert.deepEqual(lookup.value.receipt, committed.ok ? committed.value : null);

    await f.client.execute({ sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id='alice'", args: [sourceProject] });
    assert.deepEqual(await service.getTaskReceipt({ actorId: "alice", clientRequestId: f.input.clientRequestId }), { ok: false, code: "unavailable" });
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input: f.input }), { ok: false, code: "unavailable" });
  } finally { f.client.close(); }
});

test("legacy receipts without source conversation retain project entitlement checks", async () => {
  const f = await fixture();
  try {
    const service = createConversationTaskOutcomeService(f.adapter);
    await f.client.execute("DROP TRIGGER work_operation_receipts_source_conversation_required");
    await f.client.execute("DROP TRIGGER work_operation_receipts_guard_insert");
    await f.client.execute({
      sql: `INSERT INTO work_operation_receipts(actor_id, client_request_id, operation, payload_hash,
        source_project_id, source_conversation_id, destination_project_id, task_id, work_link_id, committed_at)
        VALUES ('alice', 'legacy_receipt_0001', 'conversation_task', 'legacy-hash', ?, NULL, ?,
          'legacy-task', 'deleted-work-link', 1)`,
      args: [sourceProject, destinationProject],
    });
    const authorized = await service.getTaskReceipt({ actorId: "alice", clientRequestId: "legacy_receipt_0001" });
    assert.equal(authorized.ok, true);
    if (!authorized.ok) return;
    assert.equal(authorized.value.state, "committed");
    if (authorized.value.state !== "committed") return;
    assert.equal(authorized.value.taskAvailable, false);
    assert.equal(authorized.value.receipt.taskId, "legacy-task");

    await f.client.execute({ sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id='alice'", args: [sourceProject] });
    assert.deepEqual(await service.getTaskReceipt({ actorId: "alice", clientRequestId: "legacy_receipt_0001" }), { ok: false, code: "unavailable" });
    await f.client.execute({ sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,'alice','owner',?)", args: [sourceProject, Date.now()] });
    await f.client.execute({ sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id='alice'", args: [destinationProject] });
    assert.deepEqual(await service.getTaskReceipt({ actorId: "alice", clientRequestId: "legacy_receipt_0001" }), { ok: false, code: "unavailable" });
  } finally { f.client.close(); }
});

test("orphan destination owner membership cannot create any durable effect", async () => {
  const f = await fixture();
  try {
    await f.client.execute({ sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,'ghost_owner','member',?)", args: [destinationProject, Date.now()] });
    const service = createConversationTaskOutcomeService(f.adapter);
    assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input: { ...f.input, ownerUserId: "ghost_owner" } }), { ok: false, code: "unavailable" });
    for (const table of ["tasks", "activities", "work_links", "suite_outbox", "work_operation_receipts"]) assert.equal(await count(f.client, table), 0, table);
  } finally { f.client.close(); }
});

test("usable links require current source, destination, message, and task relationships while receipts survive task loss", async () => {
  for (const mutation of ["source-delete", "destination-delete", "message-delete", "task-move", "task-delete"] as const) {
    const f = await fixture();
    try {
      const service = createConversationTaskOutcomeService(f.adapter);
      const committed = await service.promoteMessageToTask({ actorId: "alice", input: f.input });
      assert.equal(committed.ok, true);
      if (!committed.ok) continue;
      if (mutation === "source-delete") await f.client.execute({ sql: "DELETE FROM workspaces WHERE id=?", args: [sourceProject] });
      if (mutation === "destination-delete") await f.client.execute({ sql: "DELETE FROM workspaces WHERE id=?", args: [destinationProject] });
      if (mutation === "message-delete") await f.client.execute({ sql: "DELETE FROM conversation_messages WHERE id=?", args: [f.input.messageId] });
      if (mutation === "task-move") await f.client.execute({ sql: "UPDATE tasks SET workspace_id=? WHERE id=?", args: [sourceProject, committed.value.taskId] });
      if (mutation === "task-delete") await f.client.execute({ sql: "DELETE FROM tasks WHERE id=?", args: [committed.value.taskId] });
      assert.deepEqual(await service.getTaskOutcome({ actorId: "alice", taskId: committed.value.taskId }), { ok: true, value: null }, mutation);
      const receiptRows = await f.client.execute("SELECT COUNT(*) AS n FROM work_operation_receipts");
      assert.equal(Number(receiptRows.rows[0].n), mutation === "source-delete" || mutation === "destination-delete" ? 0 : 1,
        `Project deletion erases source custody; ordinary source or Task loss retains its receipt:${mutation}`);
      if (mutation === "source-delete" || mutation === "destination-delete") {
        const survivingProject = mutation === "source-delete" ? destinationProject : sourceProject;
        const projectRows = await f.client.execute({ sql: "SELECT COUNT(*) AS n FROM workspaces WHERE id=?", args: [survivingProject] });
        assert.equal(Number(projectRows.rows[0].n), 1, `unrelated Project survives:${mutation}`);
        const survivingSource = await f.client.execute(mutation === "source-delete"
          ? { sql: "SELECT COUNT(*) AS n FROM tasks WHERE id=?", args: [committed.value.taskId] }
          : { sql: "SELECT COUNT(*) AS n FROM conversation_messages WHERE id=?", args: [f.input.messageId] });
        assert.equal(Number(survivingSource.rows[0].n), 1, `unrelated content survives:${mutation}`);
      }
      if (mutation === "task-move" || mutation === "task-delete") {
        const lookup = await service.getTaskReceipt({ actorId: "alice", clientRequestId: f.input.clientRequestId });
        assert.equal(lookup.ok, true);
        if (!lookup.ok) continue;
        assert.equal(lookup.value.state, "committed");
        if (lookup.value.state !== "committed") continue;
        assert.equal(lookup.value.taskAvailable, false);
        assert.deepEqual(lookup.value.receipt, committed.value);
        assert.deepEqual(await service.promoteMessageToTask({ actorId: "alice", input: f.input }), committed);
      }
    } finally { f.client.close(); }
  }
});
