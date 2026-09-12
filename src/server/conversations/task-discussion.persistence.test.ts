import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createClient, type Client } from "@libsql/client";
import { createLocalConversationDatabaseAdapter } from "./database";
import { createTaskDiscussionService } from "./task-discussion";
import { createTaskDiscussionHttp } from "./task-discussion-http";
import { resolveConversationControls } from "@/lib/conversations/flags";

const repoRoot = resolve(process.cwd());
const projectA = "synthetic_project_a";
const projectB = "synthetic_project_b";
const migration31 = "0031_task_discussion.sql";

async function applyMigrations(client: Client, through = migration31) {
  const migrations = (await readdir(join(repoRoot, "drizzle")))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name) && name >= "0014_" && name <= through)
    .sort();
  for (const migration of migrations) {
    await client.executeMultiple(await readFile(join(repoRoot, "drizzle", migration), "utf8"));
  }
}

async function freshDatabase(): Promise<{ client: Client; directory: string }> {
  const fixtureRoot = process.env.PC10_WORK_DIR ? resolve(process.env.PC10_WORK_DIR) : tmpdir();
  await mkdir(fixtureRoot, { recursive: true });
  const directory = await mkdtemp(join(fixtureRoot, "signal-task-discussion-pc10-"));
  const path = join(directory, "tasks.db").replaceAll("\\", "/");
  const client = createClient({ url: `file:${path}` });
  await client.execute("PRAGMA foreign_keys=OFF");
  await applyMigrations(client);
  const now = Math.floor(Date.now() / 1_000);
  await client.batch([
    { sql: "INSERT INTO users(id,clerk_id,handle,name,color,initials) VALUES (?,?,?,?,?,?)", args: ["synthetic_alice","clerk_alice","alice","Alice","#444","AA"] },
    { sql: "INSERT INTO users(id,clerk_id,handle,name,color,initials) VALUES (?,?,?,?,?,?)", args: ["synthetic_bob","clerk_bob","bob","Bob","#555","BB"] },
    { sql: "INSERT INTO users(id,clerk_id,handle,name,color,initials) VALUES (?,?,?,?,?,?)", args: ["synthetic_charlie","clerk_charlie","charlie","Charlie","#666","CC"] },
    { sql: "INSERT INTO workspaces(id,slug,name,owner_user_id,context_type,created_at,updated_at) VALUES (?,'project-a','Project A','synthetic_alice','project',?,?)", args: [projectA,now,now] },
    { sql: "INSERT INTO workspaces(id,slug,name,owner_user_id,context_type,created_at,updated_at) VALUES (?,'project-b','Project B','synthetic_charlie','project',?,?)", args: [projectB,now,now] },
    { sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,'synthetic_alice','owner',?)", args: [projectA,now] },
    { sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,'synthetic_bob','member',?)", args: [projectA,now] },
    { sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,'synthetic_charlie','owner',?)", args: [projectB,now] },
    { sql: "INSERT INTO tasks(id,workspace_id,title,lane,priority,assignees,created_at,updated_at,archived_at) VALUES ('task_a',?,'Task A','backlog','p2','[]',?,?,NULL)", args: [projectA,now,now] },
    { sql: "INSERT INTO tasks(id,workspace_id,title,lane,priority,assignees,created_at,updated_at,archived_at) VALUES ('task_b',?,'Task B','backlog','p2','[]',?,?,NULL)", args: [projectB,now,now] },
  ], "write");
  return { client, directory };
}

const serviceFor = (client: Client) => createTaskDiscussionService(createLocalConversationDatabaseAdapter({ client }));
const sendInput = (epoch: number, request = "request_task_comment_0001", body = "Canonical update") => ({
  taskId: "task_a", clientRequestId: request, expectedAudienceEpoch: epoch,
  body, rootCommentId: null, mentionUserIds: ["synthetic_bob"],
});

test("0031 preserves canonical legacy ids and quarantines only unprovable tenant rows", async () => {
  const fixtureRoot = process.env.PC10_WORK_DIR ? resolve(process.env.PC10_WORK_DIR) : tmpdir();
  await mkdir(fixtureRoot, { recursive: true });
  const directory = await mkdtemp(join(fixtureRoot, "signal-task-discussion-upgrade-"));
  const client = createClient({ url: `file:${join(directory, "tasks.db").replaceAll("\\", "/")}` });
  try {
    await client.execute("PRAGMA foreign_keys=OFF");
    await applyMigrations(client, "0030_project_direct_messages.sql");
    const now = 1_789_142_500;
    await client.batch([
      { sql: "INSERT INTO users(id,handle,name,color,initials) VALUES ('legacy_author','legacy','Legacy','#444','LA')" },
      { sql: "INSERT INTO workspaces(id,slug,name,owner_user_id,context_type,created_at,updated_at) VALUES ('legacy_project','legacy','Legacy','legacy_author','project',?,?)", args: [now,now] },
      { sql: "INSERT INTO tasks(id,workspace_id,title,lane,priority,assignees,created_at,updated_at) VALUES ('legacy_task','legacy_project','Legacy task','backlog','p2','[]',?,?)", args: [now,now] },
      { sql: "INSERT INTO comments(id,workspace_id,task_id,user_id,body,created_at) VALUES ('legacy-stable-id',NULL,'legacy_task','legacy_author','kept',?)", args: [now] },
      { sql: "INSERT INTO comments(id,workspace_id,task_id,user_id,body,created_at) VALUES ('legacy-mismatch','wrong','legacy_task','legacy_author','quarantine',?)", args: [now+1] },
    ], "write");
    await client.executeMultiple(await readFile(join(repoRoot, "drizzle", migration31), "utf8"));
    const kept = (await client.execute("SELECT id,workspace_id,revision,create_seq FROM comments WHERE id='legacy-stable-id'")).rows[0];
    assert.deepEqual({ ...kept }, { id: "legacy-stable-id", workspace_id: "legacy_project", revision: 1, create_seq: 1 });
    const quarantined = (await client.execute("SELECT workspace_id,revision,create_seq FROM comments WHERE id='legacy-mismatch'")).rows[0];
    assert.deepEqual({ ...quarantined }, { workspace_id: null, revision: null, create_seq: null });
    assert.equal((await client.execute("SELECT reason FROM task_comment_migration_report WHERE comment_id='legacy-mismatch'")).rows[0].reason, "tenant_mismatch");
  } finally { client.close(); }
});

test("lost acknowledgment survives process restart and changed request payload conflicts", async () => {
  const fixture = await freshDatabase();
  try {
    let service = serviceFor(fixture.client);
    const opened = await service.openTaskDiscussion({ actorId: "synthetic_alice", taskId: "task_a" });
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const input = sendInput(opened.value.audienceEpoch);
    const committed = await service.sendComment({ actorId: "synthetic_alice", input });
    assert.equal(committed.ok, true); // Caller loses this acknowledgment.
    fixture.client.close();
    const reopened = createClient({ url: `file:${join(fixture.directory, "tasks.db").replaceAll("\\", "/")}` });
    service = serviceFor(reopened);
    const receipt = await service.getReceipt({ actorId: "synthetic_alice", taskId: "task_a", clientRequestId: input.clientRequestId });
    assert.equal(receipt.ok && receipt.value.state, "committed");
    assert.deepEqual(await service.sendComment({ actorId: "synthetic_alice", input }), committed);
    assert.deepEqual(await service.sendComment({ actorId: "synthetic_alice", input: { ...input, body: "changed" } }), { ok: false, code: "request_conflict" });
    assert.equal(Number((await reopened.execute("SELECT COUNT(*) AS n FROM comments WHERE revision IS NOT NULL")).rows[0].n), 1);
    assert.equal(Number((await reopened.execute("SELECT COUNT(*) AS n FROM conversation_messages")).rows[0].n), 0);
    for (const table of ["activities","task_comment_changes","task_comment_receipts","task_comment_attention","task_comment_outbox"]) {
      assert.equal(Number((await reopened.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n), 1, table);
    }
    assert.equal((await reopened.execute("SELECT instr(payload,'Canonical update') AS leaked FROM activities")).rows[0].leaked, 0);
    reopened.close();
  } finally { try { fixture.client.close(); } catch {} }
});

test("raw revoke and archive advance the task epoch and fail closed", async () => {
  const fixture = await freshDatabase();
  const raw = createClient({ url: `file:${join(fixture.directory, "tasks.db").replaceAll("\\", "/")}` });
  try {
    const service = serviceFor(fixture.client);
    const opened = await service.openTaskDiscussion({ actorId: "synthetic_alice", taskId: "task_a" });
    if (!opened.ok) assert.fail("open failed");
    await raw.execute("DELETE FROM workspace_members WHERE workspace_id='synthetic_project_a' AND user_id='synthetic_bob'");
    assert.deepEqual(await service.sendComment({ actorId: "synthetic_alice", input: sendInput(opened.value.audienceEpoch, "request_task_comment_0002") }), { ok: false, code: "audience_changed" });
    const afterRevoke = await service.openTaskDiscussion({ actorId: "synthetic_alice", taskId: "task_a" });
    if (!afterRevoke.ok) assert.fail("reopen failed");
    await raw.execute("UPDATE tasks SET archived_at=unixepoch() WHERE id='task_a'");
    assert.deepEqual(await service.sendComment({ actorId: "synthetic_alice", input: { ...sendInput(afterRevoke.value.audienceEpoch, "request_task_comment_0003"), mentionUserIds: [] } }), { ok: false, code: "archived" });
    assert.deepEqual(await service.openTaskDiscussion({ actorId: "synthetic_bob", taskId: "task_a" }), { ok: false, code: "unavailable" });
  } finally { raw.close(); fixture.client.close(); }
});

test("same-task top-level roots, edits, tombstones and raw SQL guards preserve identity", async () => {
  const fixture = await freshDatabase();
  try {
    const service = serviceFor(fixture.client);
    const opened = await service.openTaskDiscussion({ actorId: "synthetic_alice", taskId: "task_a" });
    if (!opened.ok) assert.fail("open failed");
    const root = await service.sendComment({ actorId: "synthetic_alice", input: { ...sendInput(opened.value.audienceEpoch, "request_task_root_0001"), mentionUserIds: [] } });
    if (!root.ok) assert.fail("root failed");
    assert.deepEqual(await service.sendComment({ actorId: "synthetic_alice", input: { ...sendInput(opened.value.audienceEpoch, "request_task_foreign_01"), rootCommentId: "absent" } }), { ok: false, code: "invalid_input" });
    const edit = await service.editComment({ actorId: "synthetic_alice", taskId: "task_a", commentId: root.value.commentId,
      clientRequestId: "request_task_edit_0001", expectedRevision: 1, expectedAudienceEpoch: opened.value.audienceEpoch,
      body: "Edited body", mentionUserIds: ["synthetic_bob"] });
    assert.equal(edit.ok && edit.value.revision, 2);
    const deleted = await service.tombstoneComment({ actorId: "synthetic_alice", taskId: "task_a", commentId: root.value.commentId,
      clientRequestId: "request_task_delete_01", expectedRevision: 2, expectedAudienceEpoch: opened.value.audienceEpoch });
    assert.equal(deleted.ok && deleted.value.revision, 3);
    const row = (await fixture.client.execute({ sql: "SELECT id,body,deleted_at,create_seq FROM comments WHERE id=?", args: [root.value.commentId] })).rows[0];
    assert.equal(row.id, root.value.commentId); assert.equal(row.body, null); assert.equal(row.create_seq, 1);
    assert.equal(Number((await fixture.client.execute("SELECT COUNT(*) AS n FROM task_comment_attention")).rows[0].n), 0);
    await assert.rejects(fixture.client.execute({ sql: `INSERT INTO comments
      (id,workspace_id,task_id,user_id,body,created_at,client_request_id,request_hash,revision,create_seq)
      VALUES ('forged','synthetic_project_b','task_a','synthetic_alice','x',unixepoch(),'request_forged_0001','h',1,2)` }));
  } finally { fixture.client.close(); }
});

test("a failure after canonical source insertion rolls back every effect and sequence", async () => {
  const fixture = await freshDatabase();
  try {
    const base = fixture.client;
    let failOutbox = true;
    const service = createTaskDiscussionService(createLocalConversationDatabaseAdapter({ client: {
      execute: async (statement) => {
        const sql = typeof statement === "string" ? statement : statement.sql;
        if (failOutbox && /INSERT INTO task_comment_outbox/.test(sql)) {
          failOutbox = false;
          throw new Error("injected_outbox_failure");
        }
        return base.execute(typeof statement === "string" ? statement : { sql: statement.sql, args: [...(statement.args ?? [])] });
      },
    } }));
    const opened = await service.openTaskDiscussion({ actorId: "synthetic_alice", taskId: "task_a" });
    if (!opened.ok) assert.fail("open failed");
    await assert.rejects(service.sendComment({ actorId: "synthetic_alice", input: sendInput(opened.value.audienceEpoch, "request_task_rollback_01") }), /injected_outbox_failure/);
    for (const table of ["comments","activities","task_comment_changes","task_comment_receipts","task_comment_attention","task_comment_outbox"]) {
      assert.equal(Number((await base.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n), 0, table);
    }
    assert.equal((await base.execute("SELECT next_create_seq||':'||next_change_seq AS seq FROM task_discussion_state WHERE task_id='task_a'")).rows[0].seq, "1:1");
  } finally { fixture.client.close(); }
});

test("HTTP derives the Project from the task and rejects identity or scope substitution", async () => {
  const fixture = await freshDatabase();
  try {
    const service = serviceFor(fixture.client);
    const controls = () => resolveConversationControls({
      SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true",
      SIGNAL_CONVERSATION_SEND_ENABLED: "true",
      SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS: "synthetic_alice",
    });
    const handle = createTaskDiscussionHttp({ authenticate: async () => "synthetic_alice", controls, service: async () => service });
    const origin = "https://app.example.test";
    const open = await handle(new Request(`${origin}/api/task-discussion?action=open&taskId=task_a`));
    const snapshot = await open.json();
    assert.equal(open.status, 200); assert.equal(snapshot.value.projectId, projectA);
    const post = (body: unknown) => handle(new Request(`${origin}/api/task-discussion`, {
      method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
    }));
    assert.equal((await post({ action: "send", projectId: projectB, taskId: "task_a" })).status, 400);
    assert.equal((await post({ action: "send", actorId: "synthetic_bob", taskId: "task_a" })).status, 400);
    const input = { action: "send", ...sendInput(snapshot.value.audienceEpoch, "request_task_http_0001") };
    const sent = await post(input); assert.equal(sent.status, 200);
    const lookup = await handle(new Request(`${origin}/api/task-discussion?action=receipt&taskId=task_a&clientRequestId=${input.clientRequestId}`));
    assert.equal((await lookup.json()).value.state, "committed");
    const listed = await (await handle(new Request(`${origin}/api/task-discussion?action=list&projectId=${projectA}`))).json();
    assert.deepEqual(listed.value, [{ taskId: "task_a", title: "Task A" }]);
    assert.equal((await handle(new Request(`${origin}/api/task-discussion?action=list&projectId=${projectB}`))).status, 404);
    assert.equal((await handle(new Request(`${origin}/api/task-discussion?action=open&taskId=task_b`))).status, 404);
    const unauthenticated = createTaskDiscussionHttp({ authenticate: async () => null, controls, service: async () => service });
    assert.equal((await unauthenticated(new Request(`${origin}/api/task-discussion?action=open&taskId=task_a`))).status, 401);
  } finally { fixture.client.close(); }
});
