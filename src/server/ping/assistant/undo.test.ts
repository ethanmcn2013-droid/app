import assert from "node:assert/strict";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { createPingProofFixture, PROOF_PROJECT, seedProofTask } from "../proof-fixture";
import { AssistantUndoConflict, executeAssistantUndo } from "./undo";
import { createTaskDiscussionService } from "@/server/conversations/task-discussion";
import { assistantConversationAdapter } from "./conversation-transaction";
import type { AssistantReversal } from "@/lib/ping/assistant/release2";

const snapshotKeys = ["id","workspaceId","seq","title","description","lane","priority","assignees","due","dueAt","estimate","tags","idleDays","blockedBy","recurrence","startDay","durationDays","position","parentTaskId","externalContactName","externalContactEmail","cents","sourceNoteId","sourceNoteExtractBody","sourceNoteExtractSha256","boardColumnKey","completedAt","isMilestone","archivedAt","createdAt","updatedAt"] as const;
function jsonSnapshot(row: Record<string, unknown>) {
  return Object.fromEntries(snapshotKeys.map(key => [key, row[key] instanceof Date ? (row[key] as Date).toISOString() : row[key]]));
}

test("task Undo restores only the captured fields and refuses a later edit without partial writes", async () => {
  const proof = await createPingProofFixture();
  const database = drizzle(proof.client, { schema });
  try {
    await seedProofTask(proof.client, "undo-task");
    const [beforeRow] = await database.select().from(schema.tasks).where(eq(schema.tasks.id, "undo-task"));
    await database.update(schema.tasks).set({ title: "Changed by Ping", updatedAt: new Date(Date.now() + 10_000) }).where(eq(schema.tasks.id, "undo-task"));
    const [afterRow] = await database.select().from(schema.tasks).where(eq(schema.tasks.id, "undo-task"));
    const reversal: AssistantReversal = { kind: "tasks", projectId: PROOF_PROJECT,
      rows: [{ id: beforeRow.id, before: jsonSnapshot(beforeRow as unknown as Record<string, unknown>), after: jsonSnapshot(afterRow as unknown as Record<string, unknown>) }] };
    const result = await database.transaction(tx => executeAssistantUndo(tx, "alice", reversal), { behavior: "immediate" });
    assert.equal(result.status, "reverted");
    const [restored] = await database.select().from(schema.tasks).where(eq(schema.tasks.id, "undo-task"));
    assert.equal(restored.title, beforeRow.title);

    await database.update(schema.tasks).set({ title: "Ping changed", updatedAt: new Date(Date.now() + 20_000) }).where(eq(schema.tasks.id, "undo-task"));
    const [changedRow] = await database.select().from(schema.tasks).where(eq(schema.tasks.id, "undo-task"));
    const stale = { ...reversal, rows: [{ ...reversal.rows[0], after: jsonSnapshot(afterRow as unknown as Record<string, unknown>) }] } as AssistantReversal;
    await assert.rejects(database.transaction(tx => executeAssistantUndo(tx, "alice", stale), { behavior: "immediate" }), AssistantUndoConflict);
    const [unchanged] = await database.select().from(schema.tasks).where(eq(schema.tasks.id, "undo-task"));
    assert.equal(unchanged.title, "Ping changed");
    assert.equal(changedRow.title, unchanged.title);
  } finally { proof.client.close(); }
});

test("Undo of an assistant-created task soft archives the exact row", async () => {
  const proof = await createPingProofFixture();
  const database = drizzle(proof.client, { schema });
  try {
    await seedProofTask(proof.client, "created-by-ping");
    const [row] = await database.select().from(schema.tasks).where(eq(schema.tasks.id, "created-by-ping"));
    const reversal: AssistantReversal = { kind: "tasks", projectId: PROOF_PROJECT,
      rows: [{ id: row.id, before: null, after: jsonSnapshot(row as unknown as Record<string, unknown>) }] };
    await database.transaction(tx => executeAssistantUndo(tx, "alice", reversal), { behavior: "immediate" });
    const [archived] = await database.select().from(schema.tasks).where(eq(schema.tasks.id, row.id));
    assert.ok(archived.archivedAt instanceof Date);
    assert.equal(archived.title, row.title);
  } finally { proof.client.close(); }
});

test("Undo takes back a message through the canonical author and audience guards", async () => {
  const proof = await createPingProofFixture();
  const database = drizzle(proof.client, { schema });
  try {
    const sent = await database.transaction(async tx => {
      const { createConversationService } = await import("@/server/conversations/service");
      const { assistantConversationAdapter } = await import("./conversation-transaction");
      const service = createConversationService(assistantConversationAdapter(tx), { directMessagesEnabled: false });
      const projectId = PROOF_PROJECT as Parameters<typeof service.ensureProjectConversation>[0]["projectId"];
      const room = await service.ensureProjectConversation({ actorId: "alice", projectId });
      assert.equal(room.ok, true);
      if (!room.ok) throw new Error("room unavailable");
      const result = await service.sendMessage({ actorId: "alice", input: { projectId, conversationId: room.value.conversationId,
        clientRequestId: "undo_message_send_01", expectedAudienceEpoch: room.value.audienceEpoch,
        body: "Synthetic Ping message", rootId: null, mentionUserIds: [] } });
      assert.equal(result.ok, true);
      if (!result.ok) throw new Error("message unavailable");
      return { projectId, conversationId: room.value.conversationId, audienceEpoch: room.value.audienceEpoch, message: result.value };
    }, { behavior: "immediate" });
    const reversal: AssistantReversal = { kind: "messages", projectId: PROOF_PROJECT, items: [{ kind: "conversation",
      scopeId: sent.conversationId, itemId: sent.message.messageId, revision: sent.message.revision, audienceEpoch: sent.audienceEpoch }] };
    const undone = await database.transaction(tx => executeAssistantUndo(tx, "alice", reversal), { behavior: "immediate" });
    assert.equal(undone.status, "reverted");
    const row = await proof.client.execute({ sql: "SELECT body,revision,deleted_at FROM conversation_messages WHERE id=?", args: [sent.message.messageId] });
    assert.equal(row.rows[0].body, null);
    assert.equal(Number(row.rows[0].revision), sent.message.revision + 1);
    assert.notEqual(row.rows[0].deleted_at, null);
  } finally { proof.client.close(); }
});

test("Undo takes back a task comment only for its author at the current revision and audience", async () => {
  const proof = await createPingProofFixture();
  const database = drizzle(proof.client, { schema });
  try {
    await seedProofTask(proof.client, "comment-undo-task");
    const sent = await database.transaction(async tx => {
      const service = createTaskDiscussionService(assistantConversationAdapter(tx));
      const opened = await service.openTaskDiscussion({ actorId: "alice", taskId: "comment-undo-task", limit: 1 });
      assert.equal(opened.ok, true);
      if (!opened.ok) throw new Error("discussion unavailable");
      const result = await service.sendComment({ actorId: "alice", input: { taskId: "comment-undo-task", clientRequestId: "comment_send_undo_01",
        expectedAudienceEpoch: opened.value.audienceEpoch, body: "Original synthetic comment", rootCommentId: null, mentionUserIds: [] } });
      assert.equal(result.ok, true);
      if (!result.ok) throw new Error("comment unavailable");
      return { audienceEpoch: opened.value.audienceEpoch, receipt: result.value };
    }, { behavior: "immediate" });
    const original: AssistantReversal = { kind: "messages", projectId: PROOF_PROJECT, items: [{ kind: "task_discussion",
      scopeId: "comment-undo-task", itemId: sent.receipt.commentId, revision: sent.receipt.revision, audienceEpoch: sent.audienceEpoch }] };
    // Bob has Project access, but canonical discussion Undo still requires the comment author.
    await assert.rejects(database.transaction(tx => executeAssistantUndo(tx, "bob", original), { behavior: "immediate" }), AssistantUndoConflict);
    let row = await proof.client.execute({ sql: "SELECT body,revision,deleted_at FROM comments WHERE id=?", args: [sent.receipt.commentId] });
    assert.equal(row.rows[0].body, "Original synthetic comment");

    const edited = await database.transaction(async tx => {
      const service = createTaskDiscussionService(assistantConversationAdapter(tx));
      return service.editComment({ actorId: "alice", taskId: "comment-undo-task", commentId: sent.receipt.commentId,
        clientRequestId: "comment_edit_undo_01", expectedRevision: sent.receipt.revision, expectedAudienceEpoch: sent.audienceEpoch,
        body: "Updated synthetic comment", mentionUserIds: [] });
    }, { behavior: "immediate" });
    assert.equal(edited.ok, true);
    await assert.rejects(database.transaction(tx => executeAssistantUndo(tx, "alice", original), { behavior: "immediate" }), AssistantUndoConflict);
    row = await proof.client.execute({ sql: "SELECT body,revision,deleted_at FROM comments WHERE id=?", args: [sent.receipt.commentId] });
    assert.equal(row.rows[0].body, "Updated synthetic comment");

    const current: AssistantReversal = { kind: "messages", projectId: PROOF_PROJECT, items: [{ kind: "task_discussion",
      scopeId: "comment-undo-task", itemId: sent.receipt.commentId, revision: sent.receipt.revision + 1, audienceEpoch: sent.audienceEpoch }] };
    const undone = await database.transaction(tx => executeAssistantUndo(tx, "alice", current), { behavior: "immediate" });
    assert.equal(undone.status, "reverted");
    row = await proof.client.execute({ sql: "SELECT body,revision,deleted_at FROM comments WHERE id=?", args: [sent.receipt.commentId] });
    assert.equal(row.rows[0].body, null);
    assert.equal(Number(row.rows[0].revision), sent.receipt.revision + 2);
    assert.notEqual(row.rows[0].deleted_at, null);
  } finally { proof.client.close(); }
});

test('Undo of a created parent refuses to hide a checklist item added afterward',async()=>{
 const proof=await createPingProofFixture(),database=drizzle(proof.client,{schema});try{
  await seedProofTask(proof.client,'new-parent');
  const [parent]=await database.select().from(schema.tasks).where(eq(schema.tasks.id,'new-parent'));
  await seedProofTask(proof.client,'later-child');
  await database.update(schema.tasks).set({parentTaskId:'new-parent'}).where(eq(schema.tasks.id,'later-child'));
  const reversal:AssistantReversal={kind:'tasks',projectId:PROOF_PROJECT,rows:[{id:parent.id,before:null,after:jsonSnapshot(parent as unknown as Record<string,unknown>)}]};
  await assert.rejects(database.transaction(tx=>executeAssistantUndo(tx,'alice',reversal),{behavior:'immediate'}),AssistantUndoConflict);
  const [unchanged]=await database.select().from(schema.tasks).where(eq(schema.tasks.id,'new-parent'));assert.equal(unchanged.archivedAt,null);
 }finally{proof.client.close();}
});

test("Undo checks a whole restore batch before commit when a later task has changed", async () => {
  const proof = await createPingProofFixture();
  const statements: string[] = [];
  const database = drizzle(proof.client, { schema, logger: { logQuery(query) { statements.push(query); } } });
  try {
    const pairs: Extract<AssistantReversal, {kind:"tasks"}>["rows"][number][] = [];
    for (const id of ["undo-batch-a", "undo-batch-b"]) {
      await seedProofTask(proof.client, id);
      const [before] = await database.select().from(schema.tasks).where(eq(schema.tasks.id, id));
      await database.update(schema.tasks).set({ title: `Ping ${id}`, updatedAt: new Date(Date.now() + 10_000) }).where(eq(schema.tasks.id, id));
      const [after] = await database.select().from(schema.tasks).where(eq(schema.tasks.id, id));
      pairs.push({ id, before: jsonSnapshot(before as unknown as Record<string, unknown>), after: jsonSnapshot(after as unknown as Record<string, unknown>) });
    }
    await database.update(schema.tasks).set({ title: "Changed after Ping", updatedAt: new Date(Date.now() + 20_000) })
      .where(eq(schema.tasks.id, "undo-batch-b"));
    statements.length = 0;
    await assert.rejects(database.transaction(tx => executeAssistantUndo(tx, "alice", { kind: "tasks", projectId: PROOF_PROJECT, rows: pairs }),
      { behavior: "immediate" }), AssistantUndoConflict);
    const rows = await database.select().from(schema.tasks).where(inArray(schema.tasks.id, ["undo-batch-a", "undo-batch-b"]));
    assert.deepEqual(rows.map(row => row.title).sort(), ["Changed after Ping", "Ping undo-batch-a"].sort());
  } finally { proof.client.close(); }
});

test("Undo of 100 unchanged created rows uses bounded batch statements", async context => {
  const proof = await createPingProofFixture();
  const statements: string[] = [];
  const database = drizzle(proof.client, { schema, logger: { logQuery(query) { statements.push(query); } } });
  try {
    for (let index = 0; index < 100; index++) await seedProofTask(proof.client, `created-batch-${index}`);
    const rows = await database.select().from(schema.tasks).where(eq(schema.tasks.workspaceId, PROOF_PROJECT));
    const reversal: AssistantReversal = { kind: "tasks", projectId: PROOF_PROJECT,
      rows: rows.map(row => ({ id: row.id, before: null, after: jsonSnapshot(row as unknown as Record<string, unknown>) })) };
    statements.length = 0;
    const started = performance.now();
    const result = await database.transaction(tx => executeAssistantUndo(tx, "alice", reversal), { behavior: "immediate" });
    context.diagnostic(`Synthetic local SQLite 100-row Undo: ${(performance.now() - started).toFixed(1)} ms, ${statements.length} statements; not a production network latency result.`);
    assert.equal(result.affectedCount, 100);
    assert.ok(statements.length < 35, `Unexpected per-row SQL round trips: ${statements.length}`);
    assert.equal(Number((await proof.client.execute("SELECT COUNT(*) n FROM tasks WHERE archived_at IS NOT NULL")).rows[0].n), 100);
  } finally { proof.client.close(); }
});
