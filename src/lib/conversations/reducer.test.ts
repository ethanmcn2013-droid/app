import assert from "node:assert/strict";
import test from "node:test";
import { conversationReducer as reduce, emptyConversationState } from "./reducer";
import { parseProjectId } from "../projects/project-ref";
import type { MessageRecord, SendInput } from "./contracts";

const input: SendInput = { projectId: parseProjectId("project-a")!, conversationId: "room-a", clientRequestId: "request_reducer_00001", expectedAudienceEpoch: 1, body: "Original reviewed text", rootId: null, mentionUserIds: [] };
const receipt = { messageId: "message-a", clientRequestId: input.clientRequestId, createSeq: 1, changeSeq: 1, revision: 1, committedAt: 1000 };
const ready = () => reduce(emptyConversationState("alice", "project-a:room-a"), { type: "delta", generation: 0, delta: { audienceEpoch: 1, throughChangeSeq: 0, hasMore: false, messages: [] } });
test("unknown outcome retains the exact original request; duplicate submission cannot append another pending row", () => {
  let state = reduce(ready(), { type: "submit", input });
  state = reduce(state, { type: "uncertain", generation: 0, requestId: input.clientRequestId });
  state = reduce(state, { type: "submit", input });
  assert.equal(state.pending.length, 1); assert.deepEqual(state.pending[0].input, input); assert.equal(state.pending[0].state, "uncertain");
  state = reduce(state, { type: "receipt", generation: 0, receipt });
  assert.equal(state.pending.length, 0); assert.equal(state.messages.length, 1);
  assert.equal(reduce(state, { type: "receipt", generation: 0, receipt }), state);
});
test("a delayed receipt or earlier replay cannot resurrect a tombstone", () => {
  let state = reduce(ready(), { type: "submit", input });
  const deleted: MessageRecord = { id: receipt.messageId, authorId: "alice", rootId: null, createSeq: 1, revision: 3, body: null, createdAt: 1000, editedAt: 2000, deletedAt: 3000 };
  state = reduce(state, { type: "delta", generation: 0, delta: { audienceEpoch: 1, throughChangeSeq: 3, hasMore: false, messages: [deleted] } });
  state = reduce(state, { type: "receipt", generation: 0, receipt });
  state = reduce(state, { type: "delta", generation: 0, delta: { audienceEpoch: 1, throughChangeSeq: 1, hasMore: false, messages: [{ ...deleted, revision: 1, body: input.body, deletedAt: null }] } });
  assert.deepEqual(state.messages, [deleted]); assert.equal(state.cursor, 3);
});
test("revocation clears history, drafts and queued sends; stale responses cannot refill the screen", () => {
  let state = reduce(ready(), { type: "submit", input });
  state = reduce(state, { type: "draft", value: "Private unsent text" });
  state = reduce(state, { type: "refused", generation: 0, failure: { ok: false, code: "unavailable" } });
  assert.equal(state.status, "unavailable"); assert.equal(state.draft, ""); assert.deepEqual(state.pending, []);
  assert.equal(reduce(state, { type: "receipt", generation: 0, receipt }), state);
  const switched = reduce(state, { type: "reset", actorId: "bob", scopeKey: "project-b:room-b" });
  assert.equal(switched.actorId, "bob"); assert.deepEqual(switched.messages, []);
});
test("audience change prevents silently sending the previous draft epoch", () => {
  let state = reduce(ready(), { type: "draft", value: input.body });
  state = reduce(state, { type: "delta", generation: 0, delta: { audienceEpoch: 2, throughChangeSeq: 1, hasMore: false, messages: [] } });
  assert.equal(reduce(state, { type: "submit", input }), state);
  assert.equal(reduce(state, { type: "submit", input: { ...input, expectedAudienceEpoch: 2 } }), state);
  assert.equal(state.draft, input.body);
  state = reduce(state, { type: "review_audience", audienceEpoch: 2 });
  assert.equal(reduce(state, { type: "submit", input: { ...input, expectedAudienceEpoch: 2 } }).pending.length, 1);
});
