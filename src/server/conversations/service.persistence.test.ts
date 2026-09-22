import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { createClient, type Client } from "@libsql/client";
import { assertProjectId } from "@/lib/projects/project-ref";
import {
  createLocalConversationDatabaseAdapter,
  createUnavailableConversationDatabaseAdapter,
  type ConversationDatabaseAdapter,
} from "./database";
import { createConversationService } from "./service";
import { createConversationHttp } from "./http";
import { resolveConversationControls } from "../../lib/conversations/flags";
import { accountDeletionTombstoneKey } from "@/server/account-deletion-key";

const repoRoot = resolve(process.cwd());
const projectA = assertProjectId("synthetic_project_a");
const projectB = assertProjectId("synthetic_project_b");

async function freshDatabase(): Promise<{ client: Client; directory: string }> {
  const fixtureRoot = process.env.PC06_WORK_DIR ? resolve(process.env.PC06_WORK_DIR) : tmpdir();
  await mkdir(fixtureRoot, { recursive: true });
  const directory = await mkdtemp(join(fixtureRoot, "signal-conversation-pc06-"));
  const databasePath = join(directory, "tasks.db").replaceAll("\\", "/");
  const client = createClient({ url: `file:${databasePath}` });
  await client.execute("PRAGMA foreign_keys = OFF");
  const migrations = (await readdir(join(repoRoot, "drizzle")))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name) && name >= "0014_")
    .sort();
  for (const migration of migrations) {
    await client.executeMultiple(await readFile(join(repoRoot, "drizzle", migration), "utf8"));
  }
  const now = Date.now();
  await client.batch([
    { sql: "INSERT INTO users(id, clerk_id, handle, name, color, initials) VALUES (?, ?, ?, ?, '#444444', ?)", args: ["synthetic_alice", "clerk_alice", "alice", "Alice", "AA"] },
    { sql: "INSERT INTO users(id, clerk_id, handle, name, color, initials) VALUES (?, ?, ?, ?, '#555555', ?)", args: ["synthetic_bob", "clerk_bob", "bob", "Bob", "BB"] },
    { sql: "INSERT INTO users(id, clerk_id, handle, name, color, initials) VALUES (?, ?, ?, ?, '#666666', ?)", args: ["synthetic_charlie", "clerk_charlie", "charlie", "Charlie", "CC"] },
    { sql: "INSERT INTO workspaces(id, slug, name, owner_user_id, context_type, created_at, updated_at) VALUES (?, 'project-a', 'Project A', 'synthetic_alice', 'project', ?, ?)", args: [projectA, now, now] },
    { sql: "INSERT INTO workspaces(id, slug, name, owner_user_id, context_type, created_at, updated_at) VALUES (?, 'project-b', 'Project B', 'synthetic_charlie', 'project', ?, ?)", args: [projectB, now, now] },
    { sql: "INSERT INTO workspace_members(workspace_id, user_id, role, joined_at) VALUES (?, 'synthetic_alice', 'owner', ?)", args: [projectA, now] },
    { sql: "INSERT INTO workspace_members(workspace_id, user_id, role, joined_at) VALUES (?, 'synthetic_bob', 'member', ?)", args: [projectA, now] },
    { sql: "INSERT INTO workspace_members(workspace_id, user_id, role, joined_at) VALUES (?, 'synthetic_charlie', 'owner', ?)", args: [projectB, now] },
  ], "write");
  return { client, directory };
}

async function withFixture(run: (fixture: { client: Client; service: ReturnType<typeof createConversationService> }) => Promise<void>) {
  const fixture = await freshDatabase();
  try {
    const adapter = createLocalConversationDatabaseAdapter({
      client: fixture.client,
    });
    await run({ client: fixture.client, service: createConversationService(adapter) });
  } finally {
    fixture.client.close();
    // The installed local libSQL native handle releases its Windows file lock
    // after process teardown, not synchronously from close(). The files live in
    // the OS temp directory and contain synthetic identities only.
  }
}

function sendInput(conversationId: string, request: string, epoch: number, body = "A durable update") {
  return {
    projectId: projectA,
    conversationId,
    clientRequestId: request,
    expectedAudienceEpoch: epoch,
    body,
    rootId: null,
    mentionUserIds: ["synthetic_bob"],
  } as const;
}

test("conversation writes honor January deletion fences while existing history remains readable", async () => {
  await withFixture(async ({ client, service }) => {
    const room = await service.ensureProjectConversation({ actorId: "synthetic_alice", projectId: projectA });
    if (!room.ok) assert.fail("room setup failed");
    const first = await service.sendMessage({ actorId: "synthetic_bob", input: sendInput(room.value.conversationId, "before_delete_fence_01", room.value.audienceEpoch) });
    assert.equal(first.ok, true);
    await client.execute({
      sql: `INSERT INTO project_drive_operations(id,workspace_id,operation_kind,status,dedupe_key)
        VALUES ('delete_conversation_project',?,'project_delete','pending',?)`,
      args: [projectA, "b".repeat(64)],
    });
    assert.deepEqual(await service.sendMessage({ actorId: "synthetic_bob", input: sendInput(room.value.conversationId, "during_delete_fence_01", room.value.audienceEpoch) }), { ok: false, code: "unavailable" });
    assert.equal((await service.getMessagePage({ actorId: "synthetic_bob", projectId: projectA, conversationId: room.value.conversationId })).ok, true);
    await client.execute("DELETE FROM project_drive_operations WHERE id='delete_conversation_project'");
    const ownerKey = accountDeletionTombstoneKey("clerk_alice");
    await client.execute({ sql: "INSERT INTO meta(key,value) VALUES (?,'erasure-requested:v1')", args: [ownerKey] });
    assert.deepEqual(await service.sendMessage({ actorId: "synthetic_bob", input: sendInput(room.value.conversationId, "owner_erasure_fence_01", room.value.audienceEpoch) }), { ok: false, code: "unavailable" });
    await client.execute({ sql: "DELETE FROM meta WHERE key=?", args: [ownerKey] });
    const actorKey = accountDeletionTombstoneKey("clerk_bob");
    await client.execute({ sql: "INSERT INTO meta(key,value) VALUES (?,'erasure-requested:v1')", args: [actorKey] });
    assert.deepEqual(await service.sendMessage({ actorId: "synthetic_bob", input: sendInput(room.value.conversationId, "actor_erasure_fence_01", room.value.audienceEpoch) }), { ok: false, code: "unavailable" });
    assert.equal(Number((await client.execute("SELECT COUNT(*) AS n FROM conversation_messages")).rows[0].n), 1);
  });
});

test("unverified storage fails closed and Clerk identity resolves only through clerk_id", async () => {
  const unavailable = createConversationService(createUnavailableConversationDatabaseAdapter("test"));
  assert.equal(await unavailable.resolveActor("clerk_alice"), null);
  assert.deepEqual(await unavailable.getProjectConversation({ actorId: "synthetic_alice", projectId: projectA }), {
    ok: false,
    code: "temporarily_unavailable",
  });

  await withFixture(async ({ service }) => {
    assert.equal(await service.resolveActor("clerk_alice"), "synthetic_alice");
    assert.equal(await service.resolveActor("synthetic_alice"), null);
    assert.equal(await service.resolveActor("clerk_missing"), null);
    assert.deepEqual(await service.listProjects({ actorId: "synthetic_bob" }), { ok: true, value: [{ id: projectA, name: "Project A" }] });
    assert.deepEqual(await service.listProjects({ actorId: "synthetic_charlie" }), { ok: true, value: [{ id: projectB, name: "Project B" }] });
  });
});

test("HTTP receipt recovery survives lost acknowledgment and send rollback; another connection revokes all later reads", async () => {
  const fixture = await freshDatabase();
  const second = createClient({ url: `file:${join(fixture.directory, "tasks.db").replaceAll("\\", "/")}` });
  const service = createConversationService(createLocalConversationDatabaseAdapter({ client: fixture.client }));
  let sends = true;
  const handle = createConversationHttp({ authenticate: () => service.resolveActor("clerk_alice"), service: async () => service,
    controls: () => resolveConversationControls({ SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true", SIGNAL_CONVERSATION_SEND_ENABLED: String(sends), SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS: "synthetic_alice" }),
  });
  const origin = "https://app.example.test";
  const post = (body: unknown) => handle(new Request(`${origin}/api/conversations`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }));
  try {
    const ensured = await (await post({ action: "ensure", projectId: projectA })).json();
    assert.equal(ensured.ok, true);
    const input = { ...sendInput(ensured.value.conversationId, "request_http_persist_01", ensured.value.audienceEpoch), action: "send" };
    const acknowledgment = await post(input);
    assert.equal(acknowledgment.status, 200); // Simulate caller losing this body after the committed response.
    const lookupUrl = `${origin}/api/conversations?action=receipt&projectId=${projectA}&conversationId=${input.conversationId}&clientRequestId=${input.clientRequestId}`;
    const recovered = await (await handle(new Request(lookupUrl))).json();
    assert.equal(recovered.value.state, "committed");
    assert.deepEqual((await (await post(input)).json()).value, recovered.value.receipt);
    assert.equal(Number((await second.execute("SELECT COUNT(*) AS n FROM conversation_messages")).rows[0].n), 1);
    sends = false;
    assert.equal((await post({ ...input, clientRequestId: "request_send_off_0001" })).status, 403);
    assert.equal((await handle(new Request(lookupUrl))).status, 200);
    await second.execute({ sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id='synthetic_alice'", args: [projectA] });
    assert.equal((await handle(new Request(lookupUrl))).status, 404);
    assert.equal((await handle(new Request(`${origin}/api/conversations?action=history&projectId=${projectA}&conversationId=${input.conversationId}`))).status, 404);
    sends = true;
    assert.equal((await post(input)).status, 404);
  } finally { second.close(); fixture.client.close(); }
});

test("ensure and send are durable and idempotent, with atomic directed effects", async () => {
  await withFixture(async ({ client, service }) => {
    assert.deepEqual(await service.getProjectConversation({ actorId: "synthetic_alice", projectId: projectA }), { ok: true, value: null });
    const ensured = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      service.ensureProjectConversation({ actorId: index % 2 ? "synthetic_alice" : "synthetic_bob", projectId: projectA })));
    const first = ensured[0];
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(new Set(ensured.map((result) => result.ok ? result.value.conversationId : result.code)).size, 1);
    const audience = await service.listProjectAudience({ actorId: "synthetic_alice", projectId: projectA });
    assert.equal(audience.ok && audience.value.members.length, 2);

    const input = sendInput(first.value.conversationId, "request_send_0001", first.value.audienceEpoch);
    const concurrent = await Promise.all(Array.from({ length: 40 }, () =>
      service.sendMessage({ actorId: "synthetic_alice", input })));
    const sent = concurrent[0];
    assert.equal(sent.ok, true);
    for (const result of concurrent) assert.deepEqual(result, sent);
    const retry = await service.sendMessage({ actorId: "synthetic_alice", input });
    assert.deepEqual(retry, sent);
    assert.deepEqual(await service.sendMessage({ actorId: "synthetic_alice", input: { ...input, body: "Changed" } }), {
      ok: false,
      code: "request_conflict",
    });
    const lookup = await service.getReceipt({ actorId: "synthetic_alice", projectId: projectA, conversationId: first.value.conversationId, clientRequestId: input.clientRequestId });
    assert.equal(lookup.ok && lookup.value.state, "committed");

    for (const table of ["conversation_messages", "conversation_changes", "conversation_receipts", "conversation_attention", "conversation_outbox"]) {
      const count = await client.execute(`SELECT COUNT(*) AS count FROM ${table}`);
      assert.equal(Number(count.rows[0].count), 1, table);
    }
  });
});

test("recent and older pages use current sources and a matching delta cursor; revoked or foreign readers get no page", async () => {
  await withFixture(async ({ client, service }) => {
    const room = await service.ensureProjectConversation({ actorId: "synthetic_alice", projectId: projectA });
    if (!room.ok) assert.fail("fixture room missing");
    const scope = { actorId: "synthetic_alice", projectId: projectA, conversationId: room.value.conversationId };
    const sent = [];
    for (let i = 0; i < 3; i++) {
      const result = await service.sendMessage({ actorId: scope.actorId, input: { ...sendInput(scope.conversationId, `request_paged_000${i}`, room.value.audienceEpoch, `Message ${i}`), mentionUserIds: [] } });
      if (!result.ok) assert.fail("fixture send failed");
      sent.push(result.value);
    }
    const recent = await service.getMessagePage({ ...scope, limit: 2 });
    if (!recent.ok) assert.fail("recent page missing");
    assert.deepEqual(recent.value.messages.map((m) => m.id), sent.slice(1).map((m) => m.messageId));
    assert.equal(recent.value.hasOlder, true);
    assert.equal(recent.value.throughChangeSeq, 3);
    assert.equal((await service.tombstoneMessage({ ...scope, messageId: sent[0].messageId, clientRequestId: "request_page_delete1", expectedRevision: 1, expectedAudienceEpoch: room.value.audienceEpoch })).ok, true);
    const older = await service.getMessagePage({ ...scope, limit: 2, beforeCreateSeq: recent.value.beforeCreateSeq! });
    if (!older.ok) assert.fail("older page missing");
    assert.equal(older.value.hasOlder, false);
    assert.equal(older.value.messages[0].body, null);
    assert.equal(older.value.throughChangeSeq, 4);
    assert.deepEqual(await service.getHistory({ ...scope, afterChangeSeq: 99 }), { ok: false, code: "resync_required" });
    const delta = await service.getHistory({ ...scope, afterChangeSeq: recent.value.throughChangeSeq });
    assert.equal(delta.ok && delta.value.messages[0].body, null);
    assert.deepEqual(await service.getMessagePage({ ...scope, projectId: projectB }), { ok: false, code: "unavailable" });
    await client.execute({ sql: "DELETE FROM workspace_members WHERE user_id = ? AND workspace_id = ?", args: [scope.actorId, projectA] });
    assert.deepEqual(await service.getMessagePage(scope), { ok: false, code: "unavailable" });
  });
});

test("process exit after commit preserves one source and receipt for a fresh process", async () => {
  const fixture = await freshDatabase();
  const path = join(fixture.directory, "tasks.db").replaceAll("\\", "/");
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) if (/^(TASKS_|NOTES_|TIMELINE_|SIGNAL_|NEXT_PUBLIC_|CLERK_|SENTRY_|RESEND_|STRIPE_|BLOB_|OPENAI_|ANTHROPIC_|VERCEL_|CRON_|OUTBOX_)/.test(key)) delete environment[key];
  const run = (mode: string) => spawnSync(process.execPath, ["--import", "tsx", "--import", "./src/test/register-server-only.mjs", "src/server/conversations/fixtures/restart-process.ts", path, mode], { cwd: repoRoot, env: environment, encoding: "utf8", timeout: 20_000 });
  try {
    const committed = run("commit");
    assert.equal(committed.status, 0, committed.stderr);
    assert.equal(committed.stdout, "");
    const recovery = run("recover");
    assert.equal(recovery.status, 0, recovery.stderr);
    const result = JSON.parse(recovery.stdout);
    assert.equal(result.recovered.value.state, "committed");
    assert.deepEqual(result.retried.value, result.recovered.value.receipt);
    for (const table of ["conversation_messages", "conversation_receipts", "conversation_attention", "conversation_outbox"]) {
      const count: Awaited<ReturnType<Client["execute"]>> = await fixture.client.execute(`SELECT COUNT(*) AS n FROM ${table}`);
      assert.equal(Number(count.rows[0].n), 1, table);
    }
  } finally { fixture.client.close(); }
});

test("only explicit mentions create attention while other members retain history", async () => {
  await withFixture(async ({ client, service }) => {
    await client.execute({ sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,'synthetic_charlie','member',?)", args: [projectA, Date.now()] });
    const room = await service.ensureProjectConversation({ actorId: "synthetic_alice", projectId: projectA });
    assert.equal(room.ok, true);
    if (!room.ok) return;
    for (const [request, mentions] of [["request_directed_01", ["synthetic_bob"]], ["request_undirected1", []]] as const) {
      const sent = await service.sendMessage({ actorId: "synthetic_alice", input: { ...sendInput(room.value.conversationId, request, room.value.audienceEpoch), mentionUserIds: mentions } });
      assert.equal(sent.ok, true);
      if (!sent.ok) return;
      for (const table of ["conversation_attention", "conversation_outbox"]) {
        const rows: Awaited<ReturnType<Client["execute"]>> = await client.execute({ sql: `SELECT recipient_id FROM ${table} WHERE message_id = ? ORDER BY recipient_id`, args: [sent.value.messageId] });
        assert.deepEqual(rows.rows.map((row) => row.recipient_id), [...mentions], table);
      }
    }
    const history = await service.getHistory({ actorId: "synthetic_charlie", projectId: projectA, conversationId: room.value.conversationId, afterChangeSeq: 0 });
    assert.equal(history.ok && history.value.messages.length, 2);
  });
});

test("raw account deletion invalidates a cached actor and only affected Project epochs", async () => {
  await withFixture(async ({ client, service }) => {
    const actorId = await service.resolveActor("clerk_bob");
    assert.equal(actorId, "synthetic_bob");
    if (!actorId) return;
    const room = await service.ensureProjectConversation({ actorId, projectId: projectA });
    const unrelated = await service.ensureProjectConversation({ actorId: "synthetic_charlie", projectId: projectB });
    assert.equal(room.ok && unrelated.ok, true);
    if (!room.ok || !unrelated.ok) return;
    const input = { ...sendInput(room.value.conversationId, "request_account_01", room.value.audienceEpoch), mentionUserIds: [] };
    assert.equal((await service.sendMessage({ actorId, input })).ok, true);
    await client.execute("DELETE FROM users WHERE id = 'synthetic_bob'");
    const epochs = await client.execute("SELECT workspace_id,audience_epoch FROM conversations ORDER BY workspace_id");
    assert.deepEqual(epochs.rows.map((row) => [row.workspace_id, Number(row.audience_epoch)]), [[projectA, room.value.audienceEpoch + 1], [projectB, unrelated.value.audienceEpoch]]);
    assert.equal(Number((await client.execute("SELECT COUNT(*) AS n FROM workspace_members WHERE user_id = 'synthetic_bob'")).rows[0].n), 0);
    const scope = { actorId, projectId: projectA, conversationId: room.value.conversationId };
    assert.deepEqual(await service.getProjectConversation(scope), { ok: false, code: "unavailable" });
    assert.deepEqual(await service.getHistory({ ...scope, afterChangeSeq: 0 }), { ok: false, code: "unavailable" });
    assert.deepEqual(await service.getReceipt({ ...scope, clientRequestId: input.clientRequestId }), { ok: false, code: "unavailable" });
    assert.deepEqual(await service.sendMessage({ actorId, input }), { ok: false, code: "unavailable" });
    // Even an orphan membership introduced by a raw writer cannot substitute for a live account.
    await client.execute({ sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,'synthetic_bob','member',?)", args: [projectA, Date.now()] });
    assert.deepEqual(await service.getProjectConversation(scope), { ok: false, code: "unavailable" });
    assert.deepEqual(await service.getHistory({ ...scope, afterChangeSeq: 0 }), { ok: false, code: "unavailable" });
    assert.deepEqual(await service.sendMessage({ actorId, input }), { ok: false, code: "unavailable" });
  });
});

test("every injected failure rolls back source, change, effect, receipt, and sequence allocation", async () => {
  await withFixture(async ({ client }) => {
    const base = createLocalConversationDatabaseAdapter({ client });
    const setup = createConversationService(base);
    const room = await setup.ensureProjectConversation({ actorId: "synthetic_alice", projectId: projectA });
    assert.equal(room.ok, true);
    if (!room.ok) return;

    const seams = [
      ["source", "INSERT INTO conversation_messages"],
      ["change", "INSERT INTO conversation_changes"],
      ["effect", "INSERT INTO conversation_attention"],
      ["receipt", "INSERT INTO conversation_receipts"],
    ] as const;
    for (const [name, statementPrefix] of seams) {
      const faulting: ConversationDatabaseAdapter = {
        available: true,
        boundary: "local-serialized-connection",
        transaction: (mode, operation) => base.transaction(mode, (executor) => operation({
          async execute(statement) {
            const result = await executor.execute(statement);
            const sql = typeof statement === "string" ? statement : statement.sql;
            if (sql.trimStart().startsWith(statementPrefix)) throw new Error(`synthetic_fault_after_${name}`);
            return result;
          },
        })),
      };
      const service = createConversationService(faulting);
      await assert.rejects(service.sendMessage({
        actorId: "synthetic_alice",
        input: sendInput(room.value.conversationId, `request_fault_${name}_01`, room.value.audienceEpoch),
      }), new RegExp(`synthetic_fault_after_${name}`));
      for (const table of ["conversation_messages", "conversation_changes", "conversation_receipts", "conversation_attention", "conversation_outbox"]) {
        const result = await client.execute(`SELECT COUNT(*) AS total FROM ${table}`);
        assert.equal(Number(result.rows[0].total), 0, `${name}:${table}`);
      }
      const sequenceResult: Awaited<ReturnType<Client["execute"]>> = await client.execute({
        sql: "SELECT next_create_seq, next_change_seq FROM conversations WHERE id = ?",
        args: [room.value.conversationId],
      });
      assert.equal(Number(sequenceResult.rows[0].next_create_seq), 1, `${name}:create sequence`);
      assert.equal(Number(sequenceResult.rows[0].next_change_seq), 1, `${name}:change sequence`);
    }
  });
});

test("exact Project, root, epoch, revoke, and archive checks use fresh durable state", async () => {
  await withFixture(async ({ client, service }) => {
    const roomA = await service.ensureProjectConversation({ actorId: "synthetic_alice", projectId: projectA });
    const roomB = await service.ensureProjectConversation({ actorId: "synthetic_charlie", projectId: projectB });
    assert.equal(roomA.ok && roomB.ok, true);
    if (!roomA.ok || !roomB.ok) return;
    const foreign = await service.sendMessage({ actorId: "synthetic_charlie", input: {
      ...sendInput(roomA.value.conversationId, "request_forged_01", roomA.value.audienceEpoch),
      projectId: projectB,
      mentionUserIds: [],
    } });
    assert.deepEqual(foreign, { ok: false, code: "unavailable" });

    const otherRoot = await service.sendMessage({ actorId: "synthetic_charlie", input: {
      projectId: projectB, conversationId: roomB.value.conversationId,
      clientRequestId: "request_otherroot", expectedAudienceEpoch: roomB.value.audienceEpoch,
      body: "Other", rootId: null, mentionUserIds: [],
    } });
    assert.equal(otherRoot.ok, true);
    if (!otherRoot.ok) return;
    assert.deepEqual(await service.sendMessage({ actorId: "synthetic_alice", input: {
      ...sendInput(roomA.value.conversationId, "request_bad_root1", roomA.value.audienceEpoch),
      rootId: otherRoot.value.messageId,
    } }), { ok: false, code: "invalid_input" });

    await client.execute({ sql: "DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = 'synthetic_bob'", args: [projectA] });
    assert.deepEqual(await service.getHistory({ actorId: "synthetic_bob", projectId: projectA, conversationId: roomA.value.conversationId, afterChangeSeq: 0 }), { ok: false, code: "unavailable" });
    assert.deepEqual(await service.sendMessage({ actorId: "synthetic_alice", input: sendInput(roomA.value.conversationId, "request_stale_000", roomA.value.audienceEpoch) }), { ok: false, code: "audience_changed" });

    const epochRow = await client.execute({ sql: "SELECT audience_epoch FROM conversations WHERE id = ?", args: [roomA.value.conversationId] });
    const newEpoch = Number(epochRow.rows[0].audience_epoch);
    await client.execute({ sql: "UPDATE workspaces SET archived_at = ? WHERE id = ?", args: [Date.now(), projectA] });
    assert.deepEqual(await service.sendMessage({ actorId: "synthetic_alice", input: sendInput(roomA.value.conversationId, "request_archived00", newEpoch) }), { ok: false, code: "archived" });
    const readable = await service.getHistory({ actorId: "synthetic_alice", projectId: projectA, conversationId: roomA.value.conversationId, afterChangeSeq: 0 });
    assert.equal(readable.ok, true);
  });
});

test("edit and tombstone replay revisions without retaining deleted body or queued derivatives", async () => {
  await withFixture(async ({ client, service }) => {
    const room = await service.ensureProjectConversation({ actorId: "synthetic_alice", projectId: projectA });
    assert.equal(room.ok, true);
    if (!room.ok) return;
    const sent = await service.sendMessage({ actorId: "synthetic_alice", input: sendInput(room.value.conversationId, "request_lifecycle1", room.value.audienceEpoch, "Original") });
    assert.equal(sent.ok, true);
    if (!sent.ok) return;
    const edited = await service.editMessage({
      actorId: "synthetic_alice", projectId: projectA, conversationId: room.value.conversationId,
      messageId: sent.value.messageId, clientRequestId: "request_edit_00001",
      expectedRevision: 1, expectedAudienceEpoch: room.value.audienceEpoch,
      body: "Revised", mentionUserIds: ["synthetic_bob"],
    });
    assert.equal(edited.ok && edited.value.revision, 2);
    if (!edited.ok) return;
    assert.deepEqual(await service.editMessage({
      actorId: "synthetic_alice", projectId: projectA, conversationId: room.value.conversationId,
      messageId: sent.value.messageId, clientRequestId: "request_edit_stale1",
      expectedRevision: 1, expectedAudienceEpoch: room.value.audienceEpoch,
      body: "Overwrite", mentionUserIds: [],
    }), { ok: false, code: "revision_conflict" });
    const afterCreate = await service.getHistory({ actorId: "synthetic_bob", projectId: projectA, conversationId: room.value.conversationId, afterChangeSeq: sent.value.changeSeq, limit: 1 });
    assert.equal(afterCreate.ok && afterCreate.value.messages[0]?.body, "Revised");

    const deleted = await service.tombstoneMessage({
      actorId: "synthetic_alice", projectId: projectA, conversationId: room.value.conversationId,
      messageId: sent.value.messageId, clientRequestId: "request_delete_001",
      expectedRevision: 2, expectedAudienceEpoch: room.value.audienceEpoch,
    });
    assert.equal(deleted.ok && deleted.value.revision, 3);
    const replay = await service.getHistory({ actorId: "synthetic_bob", projectId: projectA, conversationId: room.value.conversationId, afterChangeSeq: edited.value.changeSeq, limit: 1 });
    assert.equal(replay.ok && replay.value.messages[0]?.body, null);
    const raw = await client.execute({ sql: "SELECT body FROM conversation_messages WHERE id = ?", args: [sent.value.messageId] });
    assert.equal(raw.rows[0].body, null);
    for (const table of ["conversation_attention", "conversation_outbox"]) {
      const countResult: Awaited<ReturnType<Client["execute"]>> = await client.execute({
        sql: `SELECT COUNT(*) AS total FROM ${table} WHERE message_id = ?`,
        args: [sent.value.messageId],
      });
      assert.equal(Number(countResult.rows[0].total), 0);
    }
  });
});

test("database guards reject cross-tenant source rows with foreign keys disabled", async () => {
  await withFixture(async ({ client, service }) => {
    const room = await service.ensureProjectConversation({ actorId: "synthetic_alice", projectId: projectA });
    assert.equal(room.ok, true);
    if (!room.ok) return;
    await assert.rejects(client.execute({
      sql: `INSERT INTO conversation_messages
        (id, conversation_id, workspace_id, author_id, client_request_id, request_hash, create_seq, revision, body, created_at)
        VALUES ('forged_message', ?, ?, 'synthetic_alice', 'forged_request_01', 'hash', 99, 1, 'forged', ?)`,
      args: [room.value.conversationId, projectB, Date.now()],
    }), /invalid_message_tenant/);
    assert.equal((await client.execute("PRAGMA integrity_check")).rows[0].integrity_check, "ok");
  });
});
