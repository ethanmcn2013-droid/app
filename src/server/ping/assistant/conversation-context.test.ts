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
import { createAssistantConversationContext, createAssistantConversationContextFromServices } from "./conversation-context";
import { assistantConversationPlannerContext } from "./planner-context";

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
    ...([['cara','Cara'],['dee','Dee'],['eve','Eve'],['finn','Finn']] as const).map(([id,name]) => ({
      sql: "INSERT INTO users(id,clerk_id,handle,name,color,initials) VALUES(?,?,?,?,'#777','XX')",
      args: [`ping_ctx_${id}`,`clerk_ping_ctx_${id}`,id,name],
    })),
    { sql: "INSERT INTO workspaces(id,slug,name,owner_user_id,context_type,created_at,updated_at) VALUES(?,'ping-context','Ping Context','ping_ctx_alice','project',?,?)", args: [projectId, now, now] },
    { sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES(?,'ping_ctx_alice','owner',?)", args: [projectId, now] },
    { sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES(?,'ping_ctx_bob','member',?)", args: [projectId, now] },
    ...(['cara','dee','eve','finn'] as const).map(id => ({sql:"INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES(?,?,'member',?)",args:[projectId,`ping_ctx_${id}`,now]})),
    { sql: "INSERT INTO tasks(id,workspace_id,title,lane,priority,assignees,created_at,updated_at) VALUES(?,?,'Kitchen service times','backlog','p2','[]',?,?)", args: [taskId, projectId, now, now] },
  ], "write");
  const adapter = createLocalConversationDatabaseAdapter({ client });
  const conversation = createConversationService(adapter);
  const taskDiscussion = createTaskDiscussionService(adapter);
  const attention = createMessageAttentionService(adapter);
  const context = createAssistantConversationContext(adapter);
  return { client, adapter, conversation, taskDiscussion, attention, context };
}

async function acceptedDm(f: Awaited<ReturnType<typeof fixture>>, peerId: string, clientKey: string, body: string, count = 1) {
  const dm = createConversationService(f.adapter, { directMessagesEnabled: true });
  const requested = await dm.requestDirectMessage({ actorId: "ping_ctx_alice", projectId, recipientId: peerId, clientRequestId: `${clientKey}_request` });
  if (!requested.ok) assert.fail(`DM request failed: ${requested.code}`);
  const peerScope = await dm.getDirectMessage({ actorId: peerId, projectId, conversationId: requested.value.scope.conversationId });
  if (!peerScope.ok) assert.fail("DM peer scope unavailable");
  const accepted = await dm.transitionDirectMessage({ actorId: peerId, projectId, conversationId: requested.value.scope.conversationId,
    clientRequestId: `${clientKey}_accept`, expectedAudienceEpoch: peerScope.value.audienceEpoch, operation: "accept" });
  if (!accepted.ok) assert.fail(`DM consent failed: ${accepted.code}`);
  let epoch = accepted.value.scope.audienceEpoch;
  const ids: string[] = [];
  for (let index = 0; index < count; index++) {
    const sent = await dm.sendMessage({ actorId: peerId, input: { projectId, conversationId: requested.value.scope.conversationId,
      clientRequestId: `${clientKey}_message_${index}`, expectedAudienceEpoch: epoch, body: `${body} ${index + 1}`, rootId: null, mentionUserIds: [] } });
    if (!sent.ok) assert.fail(`DM message failed: ${sent.code}`);
    ids.push(sent.value.messageId);
    const latest = await dm.getDirectMessage({ actorId: "ping_ctx_alice", projectId, conversationId: requested.value.scope.conversationId });
    if (!latest.ok) assert.fail("DM readback unavailable");
    epoch = latest.value.audienceEpoch;
  }
  return { conversationId: requested.value.scope.conversationId, ids };
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
    assert.equal(loaded.needsYou, undefined, "an in-conversation Ping mention does not claim an unrelated Needs-you list");
    assert.equal(loaded.needsYouState, "not_checked");
    assert.equal(loaded.needsYouTotal, undefined, "an unqueried list is not an empty list");
    assert.equal(await f.context.validate("ping_ctx_alice", [source]), true);
    const fallback = await f.context.load("ping_ctx_alice", request());
    assert.equal(fallback.sources.some(item => item.itemId === sent.id), true);
    await assert.rejects(f.context.load("ping_ctx_other", request(projectId, { kind: "conversation", conversationId: room.value.conversationId })),
      { name: "AssistantContextUnavailableError" });
    assert.equal(fallback.needsYouState, "checked");
    assert.equal(fallback.needsYou?.some(item => item.ref === source.ref), true);
    assert.equal((await f.context.load("ping_ctx_bob", request())).needsYou?.length ?? 0, 0);

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
    assert.equal(loaded.needsYou?.length ?? 0, 0);
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
   const resolved=(loaded.needsYou??[]).map(item=>{const source=loaded.sources.find(source=>source.ref===item.ref);assert.ok(source);return {id:source.itemId,unseen:item.unseen};});
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
    assert.deepEqual(loaded.selectedSource, { kind: "task_discussion", label: "Task discussion: Kitchen service times" });
    assert.equal(loaded.needsYouState, "not_checked");
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
    assert.deepEqual(loaded.selectedSource, { kind: "conversation", label: "Direct message with Bob", participants: ["You", "Bob"] });
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

test("project Ping searches a small, authorized set of active consented direct messages", async () => {
  const f = await fixture();
  try {
    const context = createAssistantConversationContext(f.adapter, { directMessagesEnabled: true });
    const bob = await acceptedDm(f, "ping_ctx_bob", "ping_ctx_named_bob", "I told you the Saturday forecast is on file");
    const cara = await acceptedDm(f, "ping_ctx_cara", "ping_ctx_recent_cara", "The Saturday service plan is ready", 8);
    const dee = await acceptedDm(f, "ping_ctx_dee", "ping_ctx_recent_dee", "The Friday menu is ready", 8);
    const pending = await createConversationService(f.adapter, { directMessagesEnabled: true }).requestDirectMessage({ actorId: "ping_ctx_alice", projectId,
      recipientId: "ping_ctx_eve", clientRequestId: "ping_ctx_pending_eve_request" });
    if (!pending.ok) assert.fail("pending DM setup failed");

    const loaded = await context.load("ping_ctx_alice", request(projectId));
    assert.ok(loaded.sources.some(source => bob.ids.includes(source.itemId)), "a named eligible peer's conversation is prioritized even when older");
    assert.ok(loaded.sources.length <= 12, "three selected DMs are capped at four recent messages each");
    assert.ok(loaded.sources.every(source => source.scopeId !== pending.value.scope.conversationId), "pending, nonconsented DMs are excluded");
    assert.equal(loaded.needsYouState, "checked");
    assert.match(loaded.coverage, /30 recent direct-message candidates/);
    const outsider = await context.load("ping_ctx_other", request(projectId));
    const knownDirectMessageScopes = new Set([bob.conversationId, cara.conversationId, dee.conversationId, pending.value.scope.conversationId]);
    assert.equal(outsider.sources.some(source => knownDirectMessageScopes.has(source.scopeId)), false,
      "a project nonparticipant cannot enumerate or read consented DMs");
  } finally { f.client.close(); }
});

test("direct-message coverage never says candidates were searched when the feature is disabled or lookup fails", async () => {
  const f = await fixture();
  try {
    const disabled = await f.context.load("ping_ctx_alice", request(projectId));
    assert.match(disabled.coverage, /direct-message search is disabled/);
    assert.doesNotMatch(disabled.coverage, /direct-message candidates were (?:searched|checked)/);

    const unavailable = createAssistantConversationContextFromServices({
      conversation: { ...f.conversation, listDirectMessages: async () => ({ ok: false, code: "temporarily_unavailable" as const }) },
      taskDiscussion: f.taskDiscussion,
      attention: f.attention,
    }, { directMessagesEnabled: true });
    const failedLookup = await unavailable.load("ping_ctx_alice", request(projectId));
    assert.match(failedLookup.coverage, /direct-message search was unavailable/);
    assert.doesNotMatch(failedLookup.coverage, /direct-message candidates were (?:searched|checked)/);
  } finally { f.client.close(); }
});

test("project factual search includes a bounded recent consented DM without requiring a named person", async () => {
  const f = await fixture();
  try {
    const context = createAssistantConversationContext(f.adapter, { directMessagesEnabled: true });
    const niamh = await acceptedDm(f, "ping_ctx_bob", "ping_ctx_saturday_forecast", "Met Éireann says rain likely after 3pm on Saturday");
    const loaded = await context.load("ping_ctx_alice", { ...request(), text: "What is the Saturday forecast?" });
    assert.ok(loaded.sources.some(source => niamh.ids.includes(source.itemId)));
    assert.ok(loaded.sources.length <= 5);
    assert.equal(loaded.needsYouState, "checked");
  } finally { f.client.close(); }
});

test("the class caps retain both project-room facts and an explicitly named DM under long-message pressure", async () => {
  const f = await fixture();
  try {
    const context = createAssistantConversationContext(f.adapter, { directMessagesEnabled: true });
    const room = await f.conversation.ensureProjectConversation({ actorId: "ping_ctx_alice", projectId });
    if (!room.ok) assert.fail("project conversation unavailable");
    let epoch = room.value.audienceEpoch;
    const filler = "x".repeat(3_800);
    for (let index = 0; index < 3; index++) {
      const sent = await f.conversation.sendMessage({ actorId: "ping_ctx_alice", input: { projectId, conversationId: room.value.conversationId,
        clientRequestId: `ping_ctx_room_pressure_${index}`, expectedAudienceEpoch: epoch,
        body: `Project calendar fact: kitchen opens at ${index + 1}. ${filler}`, rootId: null, mentionUserIds: [] } });
      if (!sent.ok) assert.fail(`project message failed: ${sent.code}`);
      const latest = await f.conversation.getProjectConversation({ actorId: "ping_ctx_alice", projectId });
      if (!latest.ok || !latest.value) assert.fail("project room readback unavailable");
      epoch = latest.value.audienceEpoch;
    }
    const dm = await acceptedDm(f, "ping_ctx_bob", "ping_ctx_named_pressure_bob", `Aoife chose Spritz ${filler}`, 3);
    const loaded = await context.load("ping_ctx_alice", request(projectId));
    assert.ok(loaded.sources.some(source => source.scopeId === room.value.conversationId && source.body.includes("Project calendar fact")));
    assert.ok(loaded.sources.some(source => dm.ids.includes(source.itemId) && source.body.includes("Spritz")));
    assert.ok(loaded.sources.reduce((sum, source) => sum + source.body.length, 0) <= 24_000);
    assert.ok(loaded.sources.length <= 30);
    assert.match(loaded.coverage, /up to 8/);
  } finally { f.client.close(); }
});

test("selected-source labels stay bounded for long canonical task and participant names", async () => {
  const f = await fixture();
  try {
    await f.client.execute({ sql: "UPDATE tasks SET title=? WHERE id=?", args: ["Kitchen service times " + "long ".repeat(90), taskId] });
    const opened = await f.taskDiscussion.openTaskDiscussion({ actorId: "ping_ctx_alice", taskId });
    if (!opened.ok) assert.fail("discussion setup failed");
    const comment = await f.taskDiscussion.sendComment({ actorId: "ping_ctx_bob", input: { taskId, clientRequestId: "ping_context_long_title_comment",
      expectedAudienceEpoch: opened.value.audienceEpoch, body: "Final service details.", rootCommentId: null, mentionUserIds: [] } });
    if (!comment.ok) assert.fail("discussion comment failed");
    const taskContext = await f.context.load("ping_ctx_alice", request(projectId, { kind: "task_discussion", taskId }));
    assert.ok(taskContext.selectedSource);
    assert.ok(taskContext.selectedSource.label.length <= 300);
    assert.ok(taskContext.selectedSource.label.endsWith("…"));

    await f.client.execute({ sql: "UPDATE users SET name=? WHERE id='ping_ctx_bob'", args: ["Bob " + "Longname ".repeat(20)] });
    const dm = await acceptedDm(f, "ping_ctx_bob", "ping_context_long_peer_name", "A note about Saturday");
    const dmContext = await createAssistantConversationContext(f.adapter, { directMessagesEnabled: true }).load("ping_ctx_alice", request(projectId, { kind: "conversation", conversationId: dm.conversationId }));
    assert.ok(dmContext.selectedSource);
    assert.ok(dmContext.selectedSource.participants?.every(name => name.length <= 120));
    assert.ok(dmContext.selectedSource.participants?.some(name => name.endsWith("…")));
  } finally { f.client.close(); }
});

test("planner receives display-only selected-source identity and explicit unqueried Needs-you state", () => {
  const projected = assistantConversationPlannerContext({ actorName: "Alice", projectName: "Ping Context", projects: [], members: [{ name: "Unrelated member" }],
    selectedTaskCount: 0, previousTaskCount: 0, referenceDate: "2026-10-21", timeZone: "UTC", sources: [],
    selectedSource: { kind: "conversation", label: "Direct message with Bob", participants: ["You", "Bob"] }, needsYouState: "not_checked" });
  assert.deepEqual(projected.selectedSource, { kind: "conversation", label: "Direct message with Bob", participants: ["You", "Bob"] });
  assert.equal(projected.needsYouState, "not_checked");
  assert.equal(projected.needsYouTotal, undefined);
  assert.throws(() => assistantConversationPlannerContext({ actorName: "Alice", projectName: null, projects: [], members: [],
    selectedTaskCount: 0, previousTaskCount: 0, referenceDate: "2026-10-21", timeZone: "UTC", selectedSource: {
      kind: "conversation", label: "x", participants: Array.from({ length: 21 }, () => "Person"),
    } }));
});
