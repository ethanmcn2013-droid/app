import assert from "node:assert/strict";
import test from "node:test";
import { conversationReducer as reduce, emptyConversationState } from "./reducer";
import { parseProjectId } from "../projects/project-ref";
import type { MessagePage, MessageRecord, SendInput } from "./contracts";

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

test("a delayed initializing page preserves newer tombstones, cursor and audience while adding older history", () => {
  const deleted: MessageRecord = { id: "deleted", authorId: "alice", rootId: null, createSeq: 2, revision: 2, body: null, createdAt: 2, editedAt: null, deletedAt: 4 };
  let state = reduce(ready(), { type: "delta", generation: 0, delta: { audienceEpoch: 2, throughChangeSeq: 4, hasMore: false, messages: [deleted] } });
  const older: MessageRecord = { ...deleted, id: "older", createSeq: 1, revision: 1, body: "Earlier history", deletedAt: null };
  state = reduce(state, { type: "page", generation: 0, initialize: true, page: { audienceEpoch: 1, throughChangeSeq: 2, hasOlder: false, beforeCreateSeq: 1, messages: [older, { ...deleted, revision: 1, body: "Removed text", deletedAt: null }] } });
  assert.equal(state.cursor, 4); assert.equal(state.audienceEpoch, 2);
  assert.deepEqual(state.messages, [older, deleted]);
  // A deliberate server resync gets a fresh generation; its baseline can be lower.
  state = reduce(state, { type: "reset", actorId: "alice", scopeKey: "resync", generation: 1 });
  state = reduce(state, { type: "page", generation: 1, initialize: true, page: { audienceEpoch: 1, throughChangeSeq: 1, hasOlder: false, beforeCreateSeq: 1, messages: [older] } });
  assert.equal(state.cursor, 1); assert.deepEqual(state.messages, [older]);
  assert.equal(reduce(state, { type: "delta", generation: 0, delta: { audienceEpoch: 3, throughChangeSeq: 9, hasMore: false, messages: [deleted] } }), state);
});
test("revocation clears history, drafts and queued sends; stale responses cannot refill the screen", () => {
  let state = reduce(ready(), { type: "submit", input });
  state = reduce(state, { type: "draft", value: "Private unsent text" });
  state = reduce(state, { type: "refused", generation: 0, failure: { ok: false, code: "unavailable" } });
  assert.equal(state.status, "unavailable"); assert.equal(state.draft, ""); assert.deepEqual(state.pending, []);
  assert.equal(reduce(state, { type: "receipt", generation: 0, receipt }), state);
  const switched = reduce(state, { type: "reset", actorId: "bob", scopeKey: "project-b:room-b", generation: 1 });
  assert.equal(switched.actorId, "bob"); assert.deepEqual(switched.messages, []);
});
test("one monotonic generation rejects every stale callback and reset", () => {
  const state = reduce(ready(), { type: "reset", actorId: "alice", scopeKey: "project-a:room-b", generation: 4 });
  assert.equal(state.generation, 4);
  assert.equal(reduce(state, { type: "reset", actorId: "alice", scopeKey: "stale", generation: 3 }), state);
  assert.equal(reduce(state, { type: "delta", generation: 3, delta: { audienceEpoch: 9, throughChangeSeq: 9, hasMore: false, messages: [] } }), state);
  assert.equal(reduce(state, { type: "offline", generation: 3 }), state);
});
test("an absent old-audience request restores the exact body once", () => {
  let state = reduce(ready(), { type: "submit", input });
  state = reduce(state, { type: "uncertain", generation: 0, requestId: input.clientRequestId });
  state = reduce(state, { type: "restore_absent", generation: 0, requestId: input.clientRequestId });
  assert.equal(state.draft, input.body);
  assert.deepEqual(state.pending, []);
  assert.equal(state.error, "audience_changed");
  assert.equal(reduce(state, { type: "restore_absent", generation: 0, requestId: input.clientRequestId }), state);
});

test("an absent older send keeps the occupied composer and a separately recoverable earlier draft", () => {
  let state = reduce(ready(), { type: "submit", input });
  state = reduce(state, { type: "uncertain", generation: 0, requestId: input.clientRequestId });
  state = reduce(state, { type: "draft", value: "Newer composer text" });
  state = reduce(state, { type: "restore_absent", generation: 0, requestId: input.clientRequestId });
  assert.equal(state.draft, "Newer composer text"); assert.deepEqual(state.pending, []);
  assert.deepEqual(state.recoveredDrafts, [{ requestId: input.clientRequestId, body: input.body, mentionUserIds: input.mentionUserIds }]);
  assert.equal(reduce(state, { type: "restore_recovered", requestId: input.clientRequestId }), state);
  state = reduce(state, { type: "draft", value: "" });
  state = reduce(state, { type: "restore_recovered", requestId: input.clientRequestId });
  assert.equal(state.draft, input.body); assert.deepEqual(state.recoveredDrafts, []); assert.deepEqual(state.pending, []);
});

test("navigation restores outgoing work as uncertain without sending and revocation clears recovered text", () => {
  let state = reduce(ready(), { type: "resume_outgoing", generation: 0, pending: [{ input, state: "pending" }], recoveredDrafts: [{ requestId: "older", body: "Retained text" }] });
  assert.equal(state.pending[0].state, "uncertain"); assert.equal(state.recoveredDrafts.length, 1);
  state = reduce(state, { type: "refused", generation: 0, failure: { ok: false, code: "unavailable" } });
  assert.deepEqual(state.pending, []); assert.deepEqual(state.recoveredDrafts, []);
  assert.equal(reduce(state, { type: "resume_outgoing", generation: 0, pending: [{ input, state: "pending" }], recoveredDrafts: [] }), state);
});

test("restored draft audience consent remains tied to the previously reviewed epoch", () => {
  let state = emptyConversationState("alice", "project-a:room-a");
  state = reduce(state, { type: "resume_outgoing", generation: 0, pending: [], recoveredDrafts: [], reviewedAudienceEpoch: 1 });
  state = reduce(state, { type: "draft", value: "Draft written for the old audience" });
  state = reduce(state, { type: "page", generation: 0, initialize: true, page: { audienceEpoch: 2, throughChangeSeq: 2, hasOlder: false, beforeCreateSeq: null, messages: [] } });
  assert.equal(state.reviewedAudienceEpoch, 1); assert.equal(state.audienceEpoch, 2);
  assert.equal(reduce(state, { type: "submit", input: { ...input, expectedAudienceEpoch: 2 } }), state);
});
test("older message pages merge without moving the live delta cursor or dropping requested history", () => {
  const recent = ready();
  const olderMessages = Array.from({ length: 205 }, (_, index): MessageRecord => ({ id: `older-${index}`, authorId: "alice", rootId: null, createSeq: index + 1, revision: 1, body: `message ${index}`, createdAt: index, editedAt: null, deletedAt: null }));
  const page: MessagePage = { audienceEpoch: 1, throughChangeSeq: 999, messages: olderMessages, hasOlder: false, beforeCreateSeq: 1 };
  const state = reduce(recent, { type: "page", generation: 0, page, initialize: false });
  assert.equal(state.cursor, recent.cursor);
  assert.equal(state.messages.length, 205);
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


test("reply counts merge independently from body revision and old pages cannot regress them", () => {
  const root = { id: "root", authorId: "alice", rootId: null, createSeq: 1, revision: 1, body: "Question", createdAt: 1, editedAt: null, deletedAt: null, replyCount: 0, replyCountChangeSeq: 1 };
  let state = reduce(ready(), { type: "delta", generation: 0, delta: { audienceEpoch: 1, throughChangeSeq: 1, hasMore: false, messages: [root] } });
  state = reduce(state, { type: "delta", generation: 0, delta: { audienceEpoch: 1, throughChangeSeq: 5, hasMore: false, messages: [{ ...root, replyCount: 3, replyCountChangeSeq: 5 }] } });
  assert.equal((state.messages[0] as typeof root).replyCount, 3);
  state = reduce(state, { type: "page", generation: 0, initialize: false, page: { audienceEpoch: 1, throughChangeSeq: 3, hasOlder: false, beforeCreateSeq: null, messages: [{ ...root, revision: 2, body: null, deletedAt: 3, replyCount: 1, replyCountChangeSeq: 3 }] } });
  assert.equal(state.messages[0].body, null);
  assert.equal((state.messages[0] as typeof root).replyCount, 3);
  state = reduce(state, { type: "delta", generation: 0, delta: { audienceEpoch: 1, throughChangeSeq: 6, hasMore: false, messages: [{ ...root, replyCount: 2, replyCountChangeSeq: 6 }] } });
  assert.equal(state.messages[0].body, null);
  assert.equal((state.messages[0] as typeof root).replyCount, 2);
});

test("an uncertain directed message retains selected member IDs in its separately recovered draft", () => {
  const directed = { ...input, mentionUserIds: ["bob"] };
  let state = reduce(ready(), { type: "submit", input: directed });
  state = reduce(state, { type: "draft", value: "New draft" });
  state = reduce(state, { type: "restore_absent", generation: 0, requestId: directed.clientRequestId });
  assert.equal(state.draft, "New draft");
  assert.deepEqual(state.recoveredDrafts[0].mentionUserIds, ["bob"]);
});

test("identical text with a different notification audience is a distinct draft during recovery", () => {
  const pending = { ...input, mentionUserIds: ["bob"] };
  let state = reduce(ready(), { type: "submit", input: pending });
  state = reduce(state, { type: "draft", value: input.body });
  state = reduce(state, { type: "draft_mentions", ids: ["maya"] });
  state = reduce(state, { type: "restore_absent", generation: 0, requestId: input.clientRequestId });
  assert.equal(state.draft, input.body);
  assert.deepEqual(state.draftMentionUserIds, ["maya"]);
  assert.deepEqual(state.recoveredDrafts[0].mentionUserIds, ["bob"]);
  state = reduce(state, { type: "draft", value: "" });
  // Clearing text alone does not discard a newly selected audience.
  assert.equal(reduce(state, { type: "restore_recovered", requestId: input.clientRequestId }), state);
  state = reduce(state, { type: "draft_mentions", ids: [] });
  state = reduce(state, { type: "restore_recovered", requestId: input.clientRequestId });
  assert.equal(state.draft, input.body);
  assert.deepEqual(state.draftMentionUserIds, ["bob"]);
});

test("draft audience normalization ignores ordering and restores body plus IDs atomically", () => {
  const pending = { ...input, mentionUserIds: ["maya", "bob"] };
  let state = reduce(ready(), { type: "submit", input: pending });
  state = reduce(state, { type: "draft", value: input.body });
  state = reduce(state, { type: "draft_mentions", ids: ["bob", "maya", "bob"] });
  state = reduce(state, { type: "restore_absent", generation: 0, requestId: input.clientRequestId });
  assert.deepEqual(state.recoveredDrafts, []);
  assert.deepEqual(state.draftMentionUserIds, ["bob", "maya"]);
});
