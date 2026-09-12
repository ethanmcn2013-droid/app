import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createClient, type Client } from "@libsql/client";
import { assertProjectId } from "@/lib/projects/project-ref";
import { createLocalConversationDatabaseAdapter } from "./database";
import { createConversationService } from "./service";
import { createConversationTaskOutcomeService, type PromoteMessageToTaskInput } from "./work-links";

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
