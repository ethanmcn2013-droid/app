import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { createLocalConversationDatabaseAdapter } from "./database";
import { createConversationService } from "./service";
import { createTaskDiscussionService } from "./task-discussion";
import { createMessageAttentionService } from "./attention";
import { assertProjectId } from "../../lib/projects/project-ref";

const project = assertProjectId("synthetic_attention_project");
const taskId = "synthetic_attention_task";

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "signal-attention-j13-"));
  const url = `file:${join(dir, "tasks.db").replaceAll("\\", "/")}`;
  const client = createClient({ url });
  await client.execute("PRAGMA foreign_keys=OFF");
  const files = (await readdir(resolve("drizzle"))).filter(name => /^\d{4}_.+\.sql$/.test(name) && name >= "0014_").sort();
  for (const file of files) await client.executeMultiple(await readFile(join("drizzle", file), "utf8"));
  const now = Math.floor(Date.now() / 1000);
  await client.batch([
    { sql: "INSERT INTO users(id,clerk_id,handle,name,color,initials) VALUES('attention_alice','clerk_attention_alice','alice','Alice','#444','AA')" },
    { sql: "INSERT INTO users(id,clerk_id,handle,name,color,initials) VALUES('attention_bob','clerk_attention_bob','bob','Bob','#555','BB')" },
    { sql: "INSERT INTO users(id,clerk_id,handle,name,color,initials) VALUES('attention_foreign','clerk_attention_foreign','foreign','Foreign','#666','FF')" },
    { sql: "INSERT INTO workspaces(id,slug,name,owner_user_id,context_type,created_at,updated_at) VALUES(?,'attention','Attention Project','attention_alice','project',?,?)", args: [project,now,now] },
    { sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES(?,'attention_alice','owner',?)", args: [project,now] },
    { sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES(?,'attention_bob','member',?)", args: [project,now] },
    { sql: "INSERT INTO tasks(id,workspace_id,title,lane,priority,assignees,created_at,updated_at) VALUES(?,?,'Attention task','backlog','p2','[]',?,?)", args: [taskId,project,now,now] },
  ], "write");
  const adapter = createLocalConversationDatabaseAdapter({ client });
  return { client, url, room: createConversationService(adapter), discussion: createTaskDiscussionService(adapter), attention: createMessageAttentionService(adapter) };
}

async function projectMessage(f: Awaited<ReturnType<typeof fixture>>, request: string, rootId: string | null = null) {
  const scope = await f.room.ensureProjectConversation({ actorId: "attention_alice", projectId: project });
  if (!scope.ok) assert.fail("Project scope missing");
  const result = await f.room.sendMessage({ actorId: "attention_alice", input: {
    projectId: project, conversationId: scope.value.conversationId, clientRequestId: request,
    expectedAudienceEpoch: scope.value.audienceEpoch, body: `Message ${request}`, rootId,
    mentionUserIds: ["attention_bob"],
  } });
  if (!result.ok) assert.fail(`Send failed: ${result.code}`);
  return { scopeId: scope.value.conversationId, itemId: result.value.messageId };
}

test("directed Project attention is reader-private and a hidden reply stays unread across sessions", async () => {
  const f = await fixture();
  const secondClient = createClient({ url: f.url });
  const secondReader = createMessageAttentionService(createLocalConversationDatabaseAdapter({ client: secondClient }));
  try {
    const root = await projectMessage(f, "attention_root_request_001");
    const reply = await projectMessage(f, "attention_reply_request_001", root.itemId);
    const initial = await f.attention.listDirected({ actorId: "attention_bob" });
    if (!initial.ok) assert.fail("Initial attention missing");
    assert.deepEqual(new Set(initial.value.map(item => item.itemId)), new Set([root.itemId, reply.itemId]));
    assert.ok(initial.value.every(item => item.seenAt === null));
    const initialStatus = await f.attention.readStatus({ actorId: "attention_bob", items: [
      { kind: "conversation", ...root }, { kind: "conversation", ...reply },
    ] });
    assert.deepEqual(initialStatus, { ok: true, value: { unreadItemIds: [root.itemId, reply.itemId], positions: [
      { itemId: root.itemId, createSeq: 1 }, { itemId: reply.itemId, createSeq: 2 },
    ] } });
    assert.equal(initial.value.find(item => item.itemId === reply.itemId)?.href.includes(`rootId=${root.itemId}`), true);
    assert.deepEqual(await f.attention.listDirected({ actorId: "attention_foreign" }), { ok: true, value: [] });
    assert.deepEqual(await f.attention.observe({ actorId: "attention_foreign", items: [{ kind: "conversation", ...root }] }), { ok: false, code: "unavailable" });
    await f.client.execute({ sql: "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,'attention_foreign','member')", args: [project] });
    assert.deepEqual(await f.attention.listDirected({ actorId: "attention_foreign" }), { ok: true, value: [] });
    assert.equal((await f.attention.observe({ actorId: "attention_foreign", items: [{ kind: "conversation", ...root }] })).ok, true);
    assert.deepEqual(await f.attention.readStatus({ actorId: "attention_foreign", items: [{ kind: "conversation", ...root }] }),
      { ok: true, value: { unreadItemIds: [], positions: [{ itemId: root.itemId, createSeq: 1 }] } });
    const bobStillUnread = await f.attention.listDirected({ actorId: "attention_bob" });
    if (!bobStillUnread.ok) assert.fail("Bob's attention missing");
    assert.equal(bobStillUnread.value.find(item => item.itemId === root.itemId)?.seenAt, null);
    const observed = await f.attention.observe({ actorId: "attention_bob", items: [{ kind: "conversation", ...root }] });
    assert.equal(observed.ok, true);
    const after = await secondReader.listDirected({ actorId: "attention_bob" });
    if (!after.ok) assert.fail("Second session attention missing");
    assert.notEqual(after.value.find(item => item.itemId === root.itemId)?.seenAt, null);
    assert.equal(after.value.find(item => item.itemId === reply.itemId)?.seenAt, null);
    assert.deepEqual((await f.attention.readStatus({ actorId: "attention_bob", items: [
      { kind: "conversation", ...root }, { kind: "conversation", ...reply },
    ] })), { ok: true, value: { unreadItemIds: [reply.itemId], positions: [
      { itemId: root.itemId, createSeq: 1 }, { itemId: reply.itemId, createSeq: 2 },
    ] } });
    const ranges = (await f.client.execute({ sql: "SELECT root_key,range_start,range_end FROM message_read_coverage WHERE user_id='attention_bob' AND scope_id=?", args: [root.scopeId] })).rows;
    assert.equal(ranges.length, 1);
    assert.equal(ranges[0].root_key, "");
    assert.equal(Number(ranges[0].range_start), 1);
    assert.deepEqual(await f.attention.observe({ actorId: "attention_bob", items: [{ kind: "conversation", ...reply }] }),
      { ok: true, value: { observedAt: (await f.client.execute({ sql: "SELECT observed_at FROM conversation_attention WHERE message_id=?", args: [reply.itemId] })).rows[0].observed_at as number, observedItems: 1 } });
    assert.equal((await f.client.execute({ sql: "SELECT count(*) AS n FROM message_read_coverage WHERE user_id='attention_bob' AND scope_id=? AND root_key=?", args: [root.scopeId,root.itemId] })).rows[0].n, 1);
    await f.client.execute({ sql: "UPDATE workspaces SET archived_at=? WHERE id=?", args: [Math.floor(Date.now() / 1000), project] });
    assert.deepEqual(await secondReader.listDirected({ actorId: "attention_bob" }), { ok: true, value: [] });
    await f.client.execute({ sql: "UPDATE workspaces SET archived_at=NULL WHERE id=?", args: [project] });
    await f.client.execute({ sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id='attention_bob'", args: [project] });
    assert.deepEqual(await secondReader.listDirected({ actorId: "attention_bob" }), { ok: true, value: [] });
    assert.deepEqual(await f.attention.observe({ actorId: "attention_bob", items: [{ kind: "conversation", ...reply }] }), { ok: false, code: "unavailable" });
  } finally { secondClient.close(); f.client.close(); }
});

test("Task Discussion attention shares Inbox, mark-all captures only committed source, and FK-off erasure cleans private ranges", async () => {
  const f = await fixture();
  try {
    const opened = await f.discussion.openTaskDiscussion({ actorId: "attention_alice", taskId });
    if (!opened.ok) assert.fail("Task Discussion missing");
    const sent = await f.discussion.sendComment({ actorId: "attention_alice", input: {
      taskId, clientRequestId: "attention_comment_request_001", expectedAudienceEpoch: opened.value.audienceEpoch,
      body: "Task attention", rootCommentId: null, mentionUserIds: ["attention_bob"],
    } });
    if (!sent.ok) assert.fail("Comment missing");
    const list = await f.attention.listDirected({ actorId: "attention_bob" });
    if (!list.ok) assert.fail("Attention unavailable");
    const item = list.value.find(row => row.kind === "task_discussion");
    assert.ok(item);
    assert.equal(item.href, `/app/task/${taskId}#comment-${sent.value.commentId}`);
    const marked = await f.attention.markAllObserved({ actorId: "attention_bob" });
    assert.equal(marked.ok, true);
    const later = await f.discussion.sendComment({ actorId: "attention_alice", input: {
      taskId, clientRequestId: "attention_comment_request_002", expectedAudienceEpoch: opened.value.audienceEpoch,
      body: "Later task attention", rootCommentId: null, mentionUserIds: ["attention_bob"],
    } });
    assert.equal(later.ok, true);
    const after = await f.attention.listDirected({ actorId: "attention_bob" });
    if (!after.ok) assert.fail("Attention unavailable after send");
    assert.equal(after.value.find(row => row.itemId === sent.value.commentId)?.seenAt === null, false);
    if (!later.ok) assert.fail("Later send failed");
    assert.equal(after.value.find(row => row.itemId === later.value.commentId)?.seenAt, null);
    await f.client.execute({ sql: "UPDATE tasks SET archived_at=? WHERE id=?", args: [Math.floor(Date.now() / 1000), taskId] });
    assert.deepEqual(await f.attention.listDirected({ actorId: "attention_bob" }), { ok: true, value: [] });
    await f.client.execute({ sql: "UPDATE tasks SET archived_at=NULL WHERE id=?", args: [taskId] });
    assert.ok((await f.client.execute("SELECT COUNT(*) AS n FROM message_read_coverage WHERE user_id='attention_bob'")).rows[0].n);
    await f.client.execute("DELETE FROM tasks WHERE id='synthetic_attention_task'");
    assert.equal((await f.client.execute("SELECT COUNT(*) AS n FROM message_read_coverage WHERE source_kind='task_discussion'")).rows[0].n, 0);
    await f.client.execute("DELETE FROM users WHERE id='attention_bob'");
    assert.equal((await f.client.execute("SELECT COUNT(*) AS n FROM message_read_coverage WHERE user_id='attention_bob'")).rows[0].n, 0);
  } finally { f.client.close(); }
});

test("out-of-order visible root observations merge only adjacent ranges for one reader", async () => {
  const f = await fixture();
  try {
    const messages: { scopeId: string; itemId: string }[] = [];
    for (let index = 1; index <= 5; index++) messages.push(await projectMessage(f, `attention_range_${index}`));
    const [first, , third, fourth, fifth] = messages;
    for (const item of [first, third, fifth]) {
      const result = await f.attention.observe({ actorId: "attention_bob", items: [{ kind: "conversation", ...item }] });
      assert.equal(result.ok, true);
    }
    const before = (await f.client.execute({ sql: "SELECT range_start,range_end FROM message_read_coverage WHERE user_id='attention_bob' AND root_key='' ORDER BY range_start" })).rows;
    assert.deepEqual(before.map(row => [Number(row.range_start), Number(row.range_end)]), [[1, 1], [3, 3], [5, 5]]);
    assert.equal((await f.attention.observe({ actorId: "attention_bob", items: [{ kind: "conversation", ...fourth }] })).ok, true);
    const after = (await f.client.execute({ sql: "SELECT range_start,range_end FROM message_read_coverage WHERE user_id='attention_bob' AND root_key='' ORDER BY range_start" })).rows;
    assert.deepEqual(after.map(row => [Number(row.range_start), Number(row.range_end)]), [[1, 1], [3, 5]]);
    const stillUnread = await f.attention.listDirected({ actorId: "attention_bob" });
    if (!stillUnread.ok) assert.fail("Reader attention missing");
    assert.equal(stillUnread.value.find(item => item.itemId === messages[1].itemId)?.seenAt, null);
    const prioritized = await f.attention.listDirected({ actorId: "attention_bob", limit: 2 });
    if (!prioritized.ok) assert.fail("Unread priority missing");
    assert.equal(prioritized.value.length, 2);
    assert.equal(prioritized.value[0].itemId, messages[1].itemId);
  } finally { f.client.close(); }
});

test("an authorized deep link locates an older Task comment beyond the first page", async () => {
  const f = await fixture();
  try {
    const open = await f.discussion.openTaskDiscussion({ actorId: "attention_alice", taskId });
    assert.equal(open.ok, true);
    const rows = Array.from({ length: 55 }, (_, index) => ({
      sql: `INSERT INTO comments(id,workspace_id,task_id,user_id,body,client_request_id,request_hash,create_seq,revision)
        VALUES(?,? ,?,'attention_alice',?,?,?, ?,1)`,
      args: [`older_comment_${index + 1}`, project, taskId, `Comment ${index + 1}`,
        `older_comment_request_${index + 1}`, `hash_${index + 1}`, index + 1],
    }));
    await f.client.batch(rows, "write");
    const latest = await f.discussion.openTaskDiscussion({ actorId: "attention_bob", taskId });
    if (!latest.ok) assert.fail("Latest Task Discussion missing");
    assert.equal(latest.value.comments.some(comment => comment.id === "older_comment_1"), false);
    const target = await f.attention.readStatus({ actorId: "attention_bob", items: [{
      kind: "task_discussion", scopeId: taskId, itemId: "older_comment_1",
    }] });
    if (!target.ok) assert.fail("Older authorized comment could not be located");
    assert.deepEqual(target.value.positions, [{ itemId: "older_comment_1", createSeq: 1 }]);
    const page = await f.discussion.getCommentPage({ actorId: "attention_bob", taskId,
      beforeCreateSeq: target.value.positions[0].createSeq + 1, limit: 100 });
    if (!page.ok) assert.fail("Older comment page refused");
    assert.equal(page.value.comments.find(comment => comment.id === "older_comment_1")?.body, "Comment 1");
    assert.deepEqual(await f.attention.readStatus({ actorId: "attention_foreign", items: [{
      kind: "task_discussion", scopeId: taskId, itemId: "older_comment_1",
    }] }), { ok: false, code: "unavailable" });
  } finally { f.client.close(); }
});
