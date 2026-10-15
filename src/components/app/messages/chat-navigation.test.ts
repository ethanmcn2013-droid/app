import assert from "node:assert/strict";
import test from "node:test";
import { assertProjectId } from "@/lib/projects/project-ref";
import { conversationReducer, emptyConversationState } from "@/lib/conversations/reducer";
import { chatNavigationKey, parseFloatingChatTarget, shouldFocusChatTarget } from "./chat-navigation";
import { draftKey, retainConversationState, type DraftCache, type OutgoingCache } from "./conversation-client-model";

test("floating target parsing refuses ambiguous or unbounded scopes before interception", () => {
  assert.deepEqual(parseFloatingChatTarget(new URLSearchParams("projectId=project_a&rootId=root_1&messageId=message_2&messageSeq=123")), {
    projectId: "project_a", rootId: "root_1", messageId: "message_2", messageSeq: 123,
  });
  for (const query of ["projectId=a&projectId=b", "projectId=", "projectId=../bad", "rootId=root", "messageSeq=3&projectId=a", "messageId=m&projectId=a&messageSeq=0",
    "messageId=m&projectId=a&messageSeq=1e3", "messageId=m&projectId=a&messageSeq=9999999999999999", "projectId=a&messageId=" + "a".repeat(129), "c=a&projectId=a", "projectId=a&actorId=b", "c=a&c=b"]) {
    assert.equal(parseFloatingChatTarget(new URLSearchParams(query)), null, query);
  }
});

test("each target request has its own generation even inside the same Project and thread", () => {
  const target = { projectId: assertProjectId("project_a"), rootId: "root_1", messageId: "message_1", messageSeq: 100 };
  assert.notEqual(chatNavigationKey(1, target), chatNavigationKey(2, target));
  assert.notEqual(chatNavigationKey(1, target), chatNavigationKey(1, { ...target, messageId: "message_2", messageSeq: 500 }));
  const focus = { visible: true, ready: true, found: true, targetId: "message_2", alreadyFocused: false, requestedRoot: "root_1", currentRoot: "root_1" };
  assert.equal(shouldFocusChatTarget(focus), true);
  assert.equal(shouldFocusChatTarget({ ...focus, visible: false }), false);
  assert.equal(shouldFocusChatTarget({ ...focus, currentRoot: null }), false);
  assert.equal(shouldFocusChatTarget({ ...focus, alreadyFocused: true }), false);
});

test("a fresh target window retains the exact uncertain send and draft without replaying it", () => {
  const projectId = assertProjectId("project_a"); const key = draftKey("alice", projectId, "room_a", "root_1");
  const drafts: DraftCache = new Map(); const outgoing: OutgoingCache = new Map();
  const page = { audienceEpoch: 3, throughChangeSeq: 100, messages: [], hasOlder: true, beforeCreateSeq: 50 };
  let state = conversationReducer(emptyConversationState("alice", "room_a", 4), { type: "page", generation: 4, page, initialize: true });
  const input = { projectId, conversationId: "room_a", rootId: "root_1", clientRequestId: "request_original_0001", expectedAudienceEpoch: 3, body: "Exact pending text", mentionUserIds: ["bob"] };
  state = conversationReducer(state, { type: "submit", input });
  state = conversationReducer(state, { type: "draft", value: "Keep this next draft" });
  retainConversationState(drafts, outgoing, key, state, "project");
  state = conversationReducer(state, { type: "reset", actorId: "alice", scopeKey: "room_a", generation: 5 });
  state = conversationReducer(state, { type: "draft", value: drafts.get(key)! });
  state = conversationReducer(state, { type: "resume_outgoing", generation: 5, ...outgoing.get(key)! });
  state = conversationReducer(state, { type: "page", generation: 5, initialize: true, page: { ...page, throughChangeSeq: 500, beforeCreateSeq: 450,
    messages: [{ id: "message_2", authorId: "bob", rootId: "root_1", createSeq: 500, revision: 1, body: "Second requested target", createdAt: 1, editedAt: null, deletedAt: null }] } });
  const beforeLateReceipt = state;
  state = conversationReducer(state, { type: "receipt", generation: 4, receipt: { messageId: "late_message", clientRequestId: input.clientRequestId, createSeq: 90, changeSeq: 90, revision: 1, committedAt: 1 } });
  assert.equal(state, beforeLateReceipt);
  assert.equal(state.cursor, 500); assert.equal(state.messages[0].id, "message_2");
  assert.equal(state.draft, "Keep this next draft"); assert.deepEqual(state.pending[0].input, input); assert.equal(state.pending[0].state, "uncertain");
  assert.equal(outgoing.size, 1);
});
