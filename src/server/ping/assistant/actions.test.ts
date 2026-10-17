import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import { createPingProofFixture, PROOF_PROJECT } from "../proof-fixture";
import { executeAssistantAction, type AssistantActionInput } from "./actions";
import type { AssistantAction, AssistantActionResult } from "@/lib/ping/assistant/contract";
import { getAssistantContext } from "./context";
import type { AssistantDeliveryPort } from "./delivery";

async function fixture() {
  const proof = await createPingProofFixture();
  const statements: string[] = [];
  const database = drizzle(proof.client, { schema, logger: { logQuery(query) { statements.push(query.split(" ")[0]); } } });
  await database.run(sql`CREATE TABLE assistant_test_receipts(id TEXT PRIMARY KEY,result TEXT NOT NULL)`);
  const results: Record<string, AssistantActionResult> = {};
  const commitStep: AssistantActionInput["commitStep"] = async (id, _fence, operation) => database.transaction(async tx => {
    const old = await tx.all<{ result: string }>(sql`SELECT result FROM assistant_test_receipts WHERE id=${id}`);
    if (old[0]) return JSON.parse(old[0].result) as AssistantActionResult;
    const result = await operation(tx);
    await tx.run(sql`INSERT INTO assistant_test_receipts(id,result) VALUES(${id},${JSON.stringify(result)})`);
    return result;
  }, { behavior: "immediate" });
  async function run(step: AssistantAction, overrides: Partial<AssistantActionInput> = {}) {
    const result = await executeAssistantAction({ actorId: "alice", runId: "synthetic-run", stepId: step.id, fence: 1,
      step, commitStep, results, referenceDate: "2026-10-18", currentProjectId: PROOF_PROJECT, ...overrides });
    results[step.id] = result;
    return result;
  }
  async function deliveryPort(): Promise<AssistantDeliveryPort> {
    await database.run(sql`CREATE TABLE assistant_test_deliveries(key TEXT PRIMARY KEY,state TEXT NOT NULL)`);
    const summary = async () => {
      const rows = await database.all<{ state: string }>(sql`SELECT state FROM assistant_test_deliveries`);
      return { queued: rows.filter(row => row.state === "queued").length, accepted: rows.filter(row => row.state === "accepted").length,
        unknown: rows.filter(row => row.state === "unknown" || row.state === "claimed").length, suppressed: rows.filter(row => row.state === "suppressed").length };
    };
    return {
      async queueDeliveries(tx, _id, keys) { for (const key of keys) await tx.run(sql`INSERT INTO assistant_test_deliveries(key,state) VALUES(${key},'queued')`); },
      async claimDelivery({ key }) {
        const rows = await database.all<{ key: string }>(sql`UPDATE assistant_test_deliveries SET state='claimed' WHERE key=${key} AND state='queued' RETURNING key`);
        return rows.length ? { fence: 1, idempotencyKey: key } : null;
      },
      async settleDelivery({ key, outcome }) { await database.run(sql`UPDATE assistant_test_deliveries SET state=${outcome} WHERE key=${key}`); return summary(); },
      deliverySummary: summary,
    };
  }
  return { ...proof, database, results, run, deliveryPort, statements };
}

test("100 creates and 90 archives are atomic, replayable and reversible without deletion", async context => {
  const f = await fixture();
  try {
    const step: AssistantAction = { id: "create", kind: "create_tasks", project: { kind: "current" },
      template: { count: 100, titlePrefix: "Synthetic task", assignees: [{ kind: "self" }], milestoneCount: 5, dueDate: "tomorrow" } };
    f.statements.length = 0; const started = performance.now();
    const created = await f.run(step);
    const creationMs = performance.now() - started, creationStatements = f.statements.length;
    context.diagnostic(`Synthetic local SQLite 100 creates: ${creationMs.toFixed(1)} ms, ${creationStatements} statements including authorization/transaction/receipt.`);
    assert.ok(creationStatements < 50, `Unexpected repeated SQL: ${creationStatements}`);
    assert.equal(created.createdTaskIds?.length, 100);
    assert.deepEqual(await f.run(step), created);
    const before = await f.client.execute("SELECT COUNT(*) n,COUNT(DISTINCT seq) seqs,SUM(is_milestone) milestones FROM tasks");
    assert.equal(Number(before.rows[0].n), 100); assert.equal(Number(before.rows[0].seqs), 100);
    assert.equal(Number(before.rows[0].milestones), 5);
    f.statements.length = 0; const archiveStarted = performance.now();
    const archived = await f.run({ id: "archive", kind: "archive_tasks", project: { kind: "current" },
      targets: { kind: "created", stepId: "create", limit: 90 }, archived: true });
    context.diagnostic(`Synthetic local SQLite 90 archives: ${(performance.now() - archiveStarted).toFixed(1)} ms, ${f.statements.length} statements including authorization/transaction/receipt.`);
    assert.ok(f.statements.length < 50);
    assert.equal(archived.affectedCount, 90); assert.equal(archived.undo?.taskIds.length, 90);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM tasks WHERE archived_at IS NOT NULL")).rows[0].n), 90);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM tasks")).rows[0].n), 100);
    await f.run({ id: "restore", kind: "archive_tasks", project: { kind: "current" }, targets: { kind: "created", stepId: "create", limit: 90 }, archived: false });
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM tasks WHERE archived_at IS NOT NULL")).rows[0].n), 0);
  } finally { f.client.close(); }
});

test("Undo restores the exact changed IDs and preserves previously archived children", async () => {
  const f = await fixture();
  try {
    const created = await f.run({ id: "parent", kind: "create_tasks", project: { kind: "current" }, tasks: [{ title: "Synthetic parent" }] });
    const id = created.createdTaskIds![0];
    await f.client.execute({ sql: "INSERT INTO tasks(id,workspace_id,title,lane,priority,assignees,parent_task_id,archived_at) VALUES('old-child',?,'Previously archived child','todo','p2','[]',?,1)", args: [PROOF_PROJECT, id] });
    const archived = await f.run({ id: "archive", kind: "archive_tasks", project: { kind: "current" }, targets: { kind: "selected" }, archived: true }, { selectedTaskIds: [id] });
    assert.deepEqual(archived.undo?.taskIds, [id]);
    await f.run({ id: "undo", kind: "archive_tasks", project: { kind: "current" }, targets: { kind: "selected" }, archived: false }, { selectedTaskIds: archived.undo!.taskIds });
    assert.equal(Number((await f.client.execute("SELECT archived_at FROM tasks WHERE id='old-child'")).rows[0].archived_at), 1);
  } finally { f.client.close(); }
});

test("Timeline preparation occurs after a durable pending intent; recovery never repeats task writes", async () => {
  const f = await fixture();
  try {
    let calls = 0, settled = 0;
    const action: AssistantAction = { id: "preview", kind: "preview_timeline", project: { kind: "current" } };
    const options: Partial<AssistantActionInput> = {
      prepareTimeline: async ({ projectId, stepId }) => {
        const row = await f.client.execute({ sql: "SELECT result FROM assistant_test_receipts WHERE id=?", args: [stepId] });
        assert.equal(JSON.parse(String(row.rows[0].result)).code, "timeline_pending"); calls++;
        return { href: `/app/timeline/synthetic/current-preview?workspaceId=${projectId}` };
      },
      settleTimelineResult: async (_actor, _run, step, result) => { settled++; await f.client.execute({ sql: "UPDATE assistant_test_receipts SET result=? WHERE id=?", args: [JSON.stringify(result), step] }); },
    };
    const result = await f.run(action, options);
    assert.equal(result.code, "timeline_ready"); assert.equal(calls, 1); assert.equal(settled, 1);
    await f.run(action, options); assert.equal(calls, 1);
    const invalid = await f.run({ ...action, id: "invalid-preview" }, { ...options,
      prepareTimeline: async () => ({ href: `/app/timeline/synthetic/preview?workspaceId=${PROOF_PROJECT}` }) });
    assert.equal(invalid.status, "blocked"); assert.equal(invalid.href, undefined);
  } finally { f.client.close(); }
});

test("500 cumulative task effects are enforced before mutation; prior-request snapshot is excluded", async () => {
  const f = await fixture();
  try {
    const created = await f.run({ id: "create", kind: "create_tasks", project: { kind: "current" }, tasks: [{ title: "One" }, { title: "Two" }] });
    f.results.syntheticEarlier = { stepId: "synthetic-earlier", kind: "update_tasks", status: "completed", summary: "Synthetic prior effects",
      affectedCount: 497, projectId: PROOF_PROJECT };
    f.results.__previous = { ...created, affectedCount: 500 };
    const archive: AssistantAction = { id: "archive", kind: "archive_tasks", project: { kind: "current" }, targets: { kind: "previous", limit: 2 }, archived: true };
    await assert.rejects(f.run(archive), /unsupported/);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM tasks WHERE archived_at IS NOT NULL")).rows[0].n), 0);
    const allowed = await f.run({ ...archive, targets: { kind: "previous", limit: 1 } });
    assert.equal(allowed.affectedCount, 1);
    await assert.rejects(f.run({ id: "over", kind: "create_tasks", project: { kind: "current" }, tasks: [{ title: "Must not appear" }] }), /unsupported/);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM tasks")).rows[0].n), 2);
  } finally { f.client.close(); }
});

test("new Project ownership and dependent task creation share canonical services", async () => {
  const f = await fixture();
  try {
    const project = await f.run({ id: "project", kind: "create_project", name: "Synthetic assistant project" });
    assert.ok(project.createdProjectId);
    const created = await f.run({ id: "tasks", kind: "create_tasks", project: { kind: "created", stepId: "project" },
      tasks: [{ title: "Synthetic milestone", milestone: true, dueDate: "next_monday" }] });
    assert.equal(created.projectId, project.createdProjectId);
    assert.equal(Number((await f.client.execute({ sql: "SELECT COUNT(*) n FROM workspace_members WHERE workspace_id=? AND user_id='alice' AND role='owner'", args: [project.createdProjectId!] })).rows[0].n), 1);
    assert.equal((await f.client.execute("SELECT due FROM tasks")).rows[0].due, "2026-10-19");
  } finally { f.client.close(); }
});

test("cross-Project selection, ambiguous titles and stale created references cannot write", async () => {
  const f = await fixture();
  try {
    await f.run({ id: "create", kind: "create_tasks", project: { kind: "current" }, tasks: [{ title: "Duplicate" }, { title: "Duplicate" }] });
    const action: AssistantAction = { id: "bad", kind: "archive_tasks", project: { kind: "current" }, targets: { kind: "titles", titles: ["Duplicate"] }, archived: true };
    await assert.rejects(f.run(action), /ambiguous/);
    await assert.rejects(f.run({ ...action, targets: { kind: "selected" } }, { selectedTaskIds: ["foreign-task"] }), /stale/);
    await assert.rejects(f.run({ ...action, targets: { kind: "created", stepId: "other-run" } }), /unavailable/);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM tasks WHERE archived_at IS NOT NULL")).rows[0].n), 0);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM assistant_test_receipts")).rows[0].n), 1);
  } finally { f.client.close(); }
});

test("late batch write failure rolls back tasks, activities and completion receipt", async () => {
  const f = await fixture();
  try {
    await f.client.execute("CREATE TRIGGER synthetic_failure BEFORE INSERT ON tasks WHEN NEW.title='Batch 60' BEGIN SELECT RAISE(ABORT,'synthetic'); END");
    await assert.rejects(f.run({ id: "batch", kind: "create_tasks", project: { kind: "current" }, template: { count: 100, titlePrefix: "Batch" } }));
    for (const table of ["tasks", "activities", "assistant_test_receipts"]) {
      assert.equal(Number((await f.client.execute(`SELECT COUNT(*) n FROM ${table}`)).rows[0].n), 0);
    }
  } finally { f.client.close(); }
});

test("context contains only member Projects and authorized Project roster; revoked actor cannot mutate", async () => {
  const f = await fixture();
  try {
    const context = await f.database.transaction(tx => getAssistantContext(tx, "alice", PROOF_PROJECT));
    assert.equal(context.projects.some(project => project.id === "synthetic-foreign-project"), false);
    assert.deepEqual(context.members.map(member => member.userId).sort(), ["alice", "bob", "owner"]);
    await f.client.execute("DELETE FROM workspace_members WHERE user_id='alice'");
    await assert.rejects(f.run({ id: "batch", kind: "create_tasks", project: { kind: "current" }, tasks: [{ title: "Refused" }] }), /unavailable/);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM tasks")).rows[0].n), 0);
  } finally { f.client.close(); }
});

test("canonical task comments and Project chat keep original receipts on replay", async () => {
  const f = await fixture();
  try {
    await f.run({ id: "create", kind: "create_tasks", project: { kind: "current" }, tasks: [{ title: "Synthetic discussion" }] });
    const comment: AssistantAction = { id: "comment", kind: "add_comment", project: { kind: "current" },
      targets: { kind: "created", stepId: "create" }, body: "Synthetic task comment" };
    await f.run(comment); await f.run(comment);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM comments")).rows[0].n), 1);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM task_comment_receipts")).rows[0].n), 1);
    const message: AssistantAction = { id: "message", kind: "send_message", project: { kind: "current" }, body: "Synthetic Project message" };
    await f.run(message); await f.run(message);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM conversation_messages")).rows[0].n), 1);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM conversation_receipts")).rows[0].n), 1);
    const read = await f.run({ id: "read", kind: "read_chat", project: { kind: "current" } });
    assert.equal(read.items?.[0].title, "Synthetic Project message");
  } finally { f.client.close(); }
});

test("nudges honor mute and cooldown; uncertain fake delivery is never retried", async () => {
  const f = await fixture();
  try {
    const delivery = await f.deliveryPort(); let calls = 0;
    await f.client.execute("UPDATE users SET email='synthetic-bob@example.invalid' WHERE id='bob'");
    await f.run({ id: "create", kind: "create_tasks", project: { kind: "current" }, tasks: [{ title: "Synthetic nudge", assignees: [{ kind: "name", name: "bob" }] }] });
    const action: AssistantAction = { id: "nudge", kind: "nudge_tasks", project: { kind: "current" }, targets: { kind: "created", stepId: "create" } };
    const options: Partial<AssistantActionInput> = { delivery, deliveryTransaction: operation => f.database.transaction(operation),
      dispatch: async () => { calls++; throw new Error("synthetic uncertain transport"); } };
    const result = await f.run(action, options);
    assert.equal(result.delivery?.unknown, 1); assert.equal(calls, 1);
    await f.run(action, options); assert.equal(calls, 1);
    const cooldown = await f.run({ ...action, id: "cooldown" }, options);
    assert.equal(cooldown.affectedCount, 0); assert.equal(calls, 1);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM notifications WHERE kind='nudge'")).rows[0].n), 1);
    await f.client.execute("DELETE FROM activities WHERE kind='nudgeSent'");
    await f.client.execute("INSERT INTO notification_prefs(user_id,nudges) VALUES('bob',0)");
    const muted = await f.run({ ...action, id: "muted" }, options);
    assert.equal(muted.affectedCount, 0); assert.equal(muted.delivery?.suppressed, 1); assert.equal(calls, 1);
  } finally { f.client.close(); }
});

test("invitations require owner capability and only fake accepted transport records delivery evidence", async () => {
  const f = await fixture();
  try {
    const delivery = await f.deliveryPort(); let calls = 0;
    const action: AssistantAction = { id: "invite", kind: "invite_members", project: { kind: "current" }, emails: ["synthetic-guest@example.invalid"] };
    const options: Partial<AssistantActionInput> = { delivery, deliveryTransaction: operation => f.database.transaction(operation),
      dispatch: async intent => { calls++; assert.equal(intent.kind, "invite"); assert.ok(intent.inviteToken); return { outcome: "accepted", providerId: "synthetic-provider-receipt" }; } };
    await assert.rejects(f.run(action, options), /unavailable/); assert.equal(calls, 0);
    const accepted = await f.run(action, { ...options, actorId: "owner" });
    assert.equal(accepted.delivery?.accepted, 1); assert.equal(calls, 1);
    await f.run(action, { ...options, actorId: "owner" }); assert.equal(calls, 1);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM pending_invites WHERE last_sent_at IS NOT NULL")).rows[0].n), 1);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM workspace_events WHERE kind='inviteSent'")).rows[0].n), 1);
    assert.equal(JSON.stringify(accepted).includes("@"), false);
    assert.equal(JSON.stringify(accepted).includes("synthetic-provider-receipt"), false);
  } finally { f.client.close(); }
});
