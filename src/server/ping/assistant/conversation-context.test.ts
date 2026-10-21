import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { assertProjectId } from "@/lib/projects/project-ref";
import { createLocalConversationDatabaseAdapter } from "@/server/conversations/database";
import { createConversationService } from "@/server/conversations/service";
import { createTaskDiscussionService } from "@/server/conversations/task-discussion";
import { createMessageAttentionService } from "@/server/conversations/attention";
import { createAssistantConversationContext } from "./conversation-context";

const projectId = assertProjectId("ping_context_project");
const taskId = "ping_context_task";

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "ping-context-r2-"));
  const client = createClient({ url: `file:${join(directory, "tasks.db").replaceAll("\\", "/")}` });
  await client.execute("PRAGMA foreign_keys=OFF");
  const migrations = (await readdir(resolve("drizzle"))).filter(name => /^\d{4}_.+\.sql$/.test(name) && name >= "0014_").sort();
  for (const migration of migrations) await client.executeMultiple(await readFile(join("drizzle", migration), "utf8"));
  const now = Math.floor(Date.now() / 1000);
  await client.batch([
    { sql: "INSERT INTO users(id,clerk_id,handle,name,color,initials) VALUES('ping_ctx_alice','clerk_ping_ctx_alice','alice','Alice','#444','AA')" },
    { sql: "INSERT INTO users(id,clerk_id,handle,name,color,initials) VALUES('ping_ctx_bob','clerk_ping_ctx_bob','bob','Bob','#555','BB')" },
    { sql: "INSERT INTO users(id,clerk_id,handle,name,color,initials) VALUES('ping_ctx_other','clerk_ping_ctx_other','other','Other','#666','OO')" },
    { sql: "INSERT INTO workspaces(id,slug,name,owner_user_id,context_type,created_at,updated_at) VALUES(?,'ping-context','Ping Context','ping_ctx_alice','project',?,?)", args: [projectId, now, now] },
    { sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES(?,'ping_ctx_alice','owner',?)", args: [projectId, now] },
    { sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES(?,'ping_ctx_bob','member',?)", args: [projectId, now] },
    { sql: "INSERT INTO tasks(id,workspace_id,title,lane,priority,assignees,created_at,updated_at) VALUES(?,?,'Kitchen service times','backlog','p2','[]',?,?)", args: [taskId, projectId, now, now] },
  ], "write");
  const adapter = createLocalConversationDatabaseAdapter({ client });
  const conversation = createConversationService(adapter);
  const taskDiscussion = createTaskDiscussionService(adapter);
  const attention = createMessageAttentionService(adapter);
  const context = createAssistantConversationContext(adapter);
  return { client, adapter, conversation, taskDiscussion, attention, context };
}

function request(project: string = projectId, source?: { kind: "conversation"; conversationId: string } | { kind: "task_discussion"; taskId: string }) {
  return { requestId: "ping_context_request_001", text: "What did Bob say?", scope: { kind: "project" as const, projectId: assertProjectId(project) }, mode: "draft" as const,
    ...(source ? { source } : {}) } as const;
}

async function say(f: Awaited<ReturnType<typeof fixture>>, actorId: string, conversationId: string, body: string, clientRequestId: string) {
  const scope = await f.conversation.getProjectConversation({ actorId, projectId });
  if (!scope.ok || !scope.value) assert.fail("conversation scope unavailable");
  const result = await f.conversation.sendMessage({ actorId, input: { projectId, conversationId, clientRequestId,
    expectedAudienceEpoch: scope.value.audienceEpoch, body, rootId: null, mentionUserIds: ["ping_ctx_alice"] } });
  if (!result.ok) assert.fail(`message send failed: ${result.code}`);
  return { id: result.value.messageId, seq: result.value.createSeq };
}

test("Ping context is project-scoped, bounded, cites current sources, and follows actor-specific Needs-you", async () => {
  const f = await fixture();
  try {
    const room = await f.conversation.ensureProjectConversation({ actorId: "ping_ctx_alice", projectId });
    if (!room.ok) assert.fail("project conversation unavailable");
    const sent = await say(f, "ping_ctx_bob", room.value.conversationId, "The kitchen service times are confirmed for Friday.", "ping_context_send_0001");
    const loaded = await f.context.load("ping_ctx_alice", request(projectId, { kind: "conversation", conversationId: room.value.conversationId }));
    const source = loaded.sources.find(item => item.itemId === sent.id);
    assert.ok(source);
    assert.equal(source.authorName, "Bob");
    assert.equal(source.projectId, projectId);
    assert.match(source.href, /messageId=/);
    assert.match(source.body, /confirmed for Friday/);
    assert.equal(loaded.needsYou.length, 0, "an in-conversation Ping mention must not receive unrelated Needs-you items");
    assert.equal(await f.context.validate("ping_ctx_alice", [source]), true);
    const fallback = await f.context.load("ping_ctx_alice", request());
    assert.equal(fallback.sources.some(item => item.itemId === sent.id), true);
    await assert.rejects(f.context.load("ping_ctx_other", request(projectId, { kind: "conversation", conversationId: room.value.conversationId })),
      { name: "AssistantContextUnavailableError" });
    assert.equal(fallback.needsYou.some(item => item.ref === source.ref), true);
    assert.equal((await f.context.load("ping_ctx_bob", request())).needsYou.length, 0);

    const oversized = await say(f, "ping_ctx_bob", room.value.conversationId, "x".repeat(4_001), "ping_context_send_0002");
    const bounded = await f.context.load("ping_ctx_alice", request(projectId, { kind: "conversation", conversationId: room.value.conversationId }));
    assert.equal(bounded.sources.some(item => item.itemId === oversized.id), false);
    assert.ok(bounded.sources.every(item => item.body.length <= 4_000));
    assert.ok(bounded.sources.reduce((sum, item) => sum + item.body.length, 0) <= 24_000);

    // A source that changes after planning is withheld when the saved answer is viewed.
    await f.client.execute({ sql: "UPDATE conversation_messages SET body=?,revision=revision+1,edited_at=? WHERE id=?",
      args: ["The kitchen service time has changed.", Date.now(), sent.id] });
    assert.equal(await f.context.validate("ping_ctx_alice", [source]), false);
  } finally { f.client.close(); }
});

test("account Ping can search recent authorized project chat without an unread attention item", async () => {
  const f = await fixture();
  try {
    const room = await f.conversation.ensureProjectConversation({ actorId: "ping_ctx_alice", projectId });
    if (!room.ok) assert.fail("project conversation unavailable");
    const sent = await f.conversation.sendMessage({ actorId: "ping_ctx_alice", input: {
      projectId, conversationId: room.value.conversationId, clientRequestId: "ping_context_own_msg_001",
      expectedAudienceEpoch: room.value.audienceEpoch, body: "I told Aoife we would meet at seven.", rootId: null, mentionUserIds: [],
    } });
    if (!sent.ok) assert.fail(`message send failed: ${sent.code}`);
    await f.client.execute({ sql: "DELETE FROM conversation_attention WHERE recipient_id='ping_ctx_alice'" });
    const accountRequest = { requestId: "ping_context_account_001", text: "What did I tell Aoife?", scope: { kind: "account" as const }, mode: "draft" as const };
    const loaded = await f.context.load("ping_ctx_alice", accountRequest);
    assert.equal(loaded.needsYou.length, 0);
    assert.ok(loaded.sources.some(source => source.itemId === sent.value.messageId && source.body.includes("meet at seven")));
    assert.match(loaded.coverage, /recent messages from 1 of up to 1 authorized active projects/);
  } finally { f.client.close(); }
});

test('Catch up and first-action context match canonical Needs-you order, count and observed state',async()=>{
 const f=await fixture();try{
  const room=await f.conversation.ensureProjectConversation({actorId:'ping_ctx_alice',projectId});
  if(!room.ok)assert.fail('project conversation unavailable');
  const sent=[];
  for(let index=0;index<3;index++)sent.push(await say(f,'ping_ctx_bob',room.value.conversationId,`Decision ${index+1}: please confirm the service detail.`,`ping_needs_parity_${index}`));
  const assertParity=async(text:string)=>{
   const canonical=await f.attention.listDirected({actorId:'ping_ctx_alice',limit:50});if(!canonical.ok)assert.fail('attention unavailable');
   const loaded=await f.context.load('ping_ctx_alice',{...request(),text});
   const resolved=loaded.needsYou.map(item=>{const source=loaded.sources.find(source=>source.ref===item.ref);assert.ok(source);return {id:source.itemId,unseen:item.unseen};});
   assert.deepEqual(resolved,canonical.value.map(item=>({id:item.itemId,unseen:item.seenAt===null})));
   assert.equal(loaded.needsYouTotal,canonical.value.length);assert.equal(loaded.needsYouComplete,true);
   return resolved;
  };
  const catchUp=await assertParity('Catch me up');assert.equal(catchUp.length,3);assert.ok(catchUp.every(item=>item.unseen));
  assert.deepEqual(await assertParity('What should I do first?'),catchUp);
  const observed=await f.attention.observe({actorId:'ping_ctx_alice',items:[{kind:'conversation',scopeId:room.value.conversationId,itemId:sent[0].id}]});assert.equal(observed.ok,true);
  const after=await assertParity('What should I do first?');assert.equal(after.filter(item=>item.unseen).length,2);
  assert.equal(after.at(-1)?.id,sent[0].id);assert.equal(after.at(-1)?.unseen,false);
 }finally{f.client.close();}
});

test("task discussion context is project-bound and does not create a discussion as a side effect", async () => {
  const f = await fixture();
  try {
    const before = await f.client.execute({ sql: "SELECT COUNT(*) AS count FROM task_discussion_state WHERE task_id=?", args: [taskId] });
    await assert.rejects(f.context.load("ping_ctx_alice", request(projectId, { kind: "task_discussion", taskId })),
      { name: "AssistantContextUnavailableError" });
    const after = await f.client.execute({ sql: "SELECT COUNT(*) AS count FROM task_discussion_state WHERE task_id=?", args: [taskId] });
    assert.equal(Number(before.rows[0].count), Number(after.rows[0].count));

    const opened = await f.taskDiscussion.openTaskDiscussion({ actorId: "ping_ctx_alice", taskId });
    if (!opened.ok) assert.fail("discussion setup failed");
    const comment = await f.taskDiscussion.sendComment({ actorId: "ping_ctx_bob", input: {
      taskId, clientRequestId: "ping_context_comment_0001", expectedAudienceEpoch: opened.value.audienceEpoch,
      body: "Kitchen service times are confirmed.", rootCommentId: null, mentionUserIds: ["ping_ctx_alice"],
    } });
    if (!comment.ok) assert.fail(`comment send failed: ${comment.code}`);
    const loaded = await f.context.load("ping_ctx_alice", request(projectId, { kind: "task_discussion", taskId }));
    const source = loaded.sources.find(item => item.itemId === comment.value.commentId);
    assert.ok(source);
    assert.equal(source.kind, "task_discussion");
    assert.match(source.href, /comment-/);
    assert.equal(await f.context.validate("ping_ctx_alice", [source]), true);
    await assert.rejects(f.context.load("ping_ctx_alice", request("another_project", { kind: "task_discussion", taskId })),
      { name: "AssistantContextUnavailableError" });
  } finally { f.client.close(); }
});

test("Ping reads a direct conversation only after consent and only for an enabled participant", async () => {
  const f = await fixture();
  try {
    const gated = createAssistantConversationContext(f.adapter, { directMessagesEnabled: true });
    const dmConversation = createConversationService(f.adapter, { directMessagesEnabled: true });
    const requested = await dmConversation.requestDirectMessage({ actorId: "ping_ctx_alice", projectId, recipientId: "ping_ctx_bob",
      clientRequestId: "ping_context_dm_request_001" });
    if (!requested.ok) assert.fail(`DM request failed: ${requested.code}`);
    const source = { kind: "conversation" as const, conversationId: requested.value.scope.conversationId };
    await assert.rejects(gated.load("ping_ctx_alice", request(projectId, source)), { name: "AssistantContextUnavailableError" });
    await assert.rejects(gated.load("ping_ctx_other", request(projectId, source)), { name: "AssistantContextUnavailableError" });

    const bobScope = await dmConversation.getDirectMessage({ actorId: "ping_ctx_bob", projectId, conversationId: source.conversationId });
    if (!bobScope.ok) assert.fail("DM recipient scope unavailable");
    const accepted = await dmConversation.transitionDirectMessage({ actorId: "ping_ctx_bob", projectId, conversationId: source.conversationId,
      clientRequestId: "ping_context_dm_accept_001", expectedAudienceEpoch: bobScope.value.audienceEpoch, operation: "accept" });
    if (!accepted.ok) assert.fail(`DM consent failed: ${accepted.code}`);
    const sent = await dmConversation.sendMessage({ actorId: "ping_ctx_bob", input: { projectId, conversationId: source.conversationId,
      clientRequestId: "ping_context_dm_send_0001", expectedAudienceEpoch: accepted.value.scope.audienceEpoch,
      body: "The private tasting is at six.", rootId: null, mentionUserIds: [] } });
    if (!sent.ok) assert.fail(`DM send failed: ${sent.code}`);

    const loaded = await gated.load("ping_ctx_alice", request(projectId, source));
    const cited = loaded.sources.find(item => item.itemId === sent.value.messageId);
    assert.ok(cited);
    assert.equal(cited.authorName, "Bob");
    assert.equal(await gated.validate("ping_ctx_alice", [cited]), true);
    assert.equal(await gated.validate("ping_ctx_other", [cited]), false);
    assert.equal(new URL(cited.href,'https://app.signalstudio.ie').searchParams.get('conversationId'),source.conversationId);
    const blocked=await dmConversation.transitionDirectMessage({actorId:'ping_ctx_bob',projectId,conversationId:source.conversationId,
      clientRequestId:'ping_context_dm_block_001',expectedAudienceEpoch:accepted.value.scope.audienceEpoch,operation:'block'});
    assert.equal(blocked.ok,true);
    assert.equal(await gated.validate('ping_ctx_alice',[cited]),false,'remaining a Project member must not retain private DM context after consent is withdrawn');
  } finally { f.client.close(); }
});
