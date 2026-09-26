import assert from "node:assert/strict";
import test from "node:test";
import { demoTasks } from "../../../server/demo/tasks-demo";
import { demoMessagesSnapshot } from "../../../server/demo/messages-demo";
import { demoReducer, initDemoState, rootMessages, threadReplies, type DemoMessagesSnapshot } from "./demo-messages-model";

const snapshot = demoMessagesSnapshot();
const room = snapshot.conversations.find((conversation) => conversation.kind === "project")!;
const request = snapshot.conversations.find((conversation) => conversation.request)!;

test("the seed is one coherent story on the review clock", () => {
  const people = new Set(snapshot.people.map((person) => person.id));
  const conversations = new Set(snapshot.conversations.map((conversation) => conversation.id));
  assert.equal(conversations.size, snapshot.conversations.length, "conversation ids are unique");
  assert.equal(new Set(snapshot.messages.map((message) => message.id)).size, snapshot.messages.length, "message ids are unique");
  assert.ok(people.has(snapshot.actorId));
  for (const conversation of snapshot.conversations) {
    assert.ok(conversation.memberIds.every((id) => people.has(id)), `${conversation.id} members are people`);
    assert.ok(conversation.memberIds.includes(snapshot.actorId), `${conversation.id} includes the viewer`);
  }
  for (const message of snapshot.messages) {
    assert.ok(conversations.has(message.conversationId), `${message.id} belongs to a conversation`);
    assert.ok(message.authorId && people.has(message.authorId), `${message.id} has a known author`);
    assert.ok(message.createdAt <= snapshot.clock.nowMs, `${message.id} is not in the future`);
    if (message.rootId) assert.ok(snapshot.messages.some((root) => root.id === message.rootId && root.conversationId === message.conversationId), `${message.id} replies inside its conversation`);
  }
  assert.equal(snapshot.messages.filter((message) => message.conversationId === request.id).length, 0, "a request carries no messages");
});

test("seeded copy keeps the product voice", () => {
  const copy = [...snapshot.messages.map((message) => message.body ?? ""), ...snapshot.conversations.map((conversation) => conversation.about)];
  for (const text of copy) {
    assert.doesNotMatch(text, /!/, `no exclamation marks: ${text}`);
    assert.doesNotMatch(text, /—/, `no em dashes: ${text}`);
    assert.doesNotMatch(text, /\bworkspace\b/i, `the noun is Project: ${text}`);
  }
});

test("task threads agree with the Tasks demo's comment counts", () => {
  const tasks = new Map(demoTasks().map((task) => [task.id, task]));
  for (const conversation of snapshot.conversations.filter((item) => item.kind === "task")) {
    const task = tasks.get(conversation.task!.id);
    assert.ok(task, `${conversation.task!.id} exists in Tasks`);
    assert.equal(conversation.task!.title, task.title);
    const count = snapshot.messages.filter((message) => message.conversationId === conversation.id).length;
    assert.equal(count, task.comments ?? 0, `${task.title} shows the same comment count`);
  }
  for (const message of snapshot.messages.filter((item) => item.linkedTask)) {
    assert.equal(tasks.get(message.linkedTask!.id)?.title, message.linkedTask!.title);
  }
});

test("opening a conversation marks where new messages start and clears its count", () => {
  const state = demoReducer(initDemoState(snapshot), { type: "open", conversationId: room.id });
  const roots = rootMessages(state, room.id);
  assert.equal(state.newSince[room.id], roots[roots.length - room.unread].id);
  const opened = state.conversations.find((item) => item.id === room.id)!;
  assert.equal(opened.unread, 0);
  assert.equal(opened.mentions, 0);
  assert.equal(demoReducer(state, { type: "open", conversationId: room.id }), state, "reopening is a no-op");
});

test("reply summaries come from the replies themselves", () => {
  const state = initDemoState(snapshot);
  const root = rootMessages(state, room.id).find((message) => message.replyCount)!;
  const replies = threadReplies(state, root.id);
  assert.equal(root.replyCount, replies.length);
  assert.equal(root.lastReplyAt, replies[replies.length - 1].createdAt);
  assert.deepEqual([...root.replyAuthorIds!].sort(), [...new Set(replies.map((reply) => reply.authorId))].sort());
});

test("sending stays in memory: pending, then sent, and a reply updates its thread", () => {
  let state = initDemoState(snapshot);
  const root = rootMessages(state, room.id).find((message) => message.replyCount)!;
  state = demoReducer(state, { type: "send", conversationId: room.id, rootId: null, id: "local-1", body: "Marquee sides are booked.\r\nThanks all.", createdAt: snapshot.clock.nowMs + 1 });
  const sent = state.messages.find((message) => message.id === "local-1")!;
  assert.equal(sent.delivery, "sending");
  assert.equal(sent.body, "Marquee sides are booked.\nThanks all.");
  assert.equal(sent.authorId, snapshot.actorId);
  state = demoReducer(state, { type: "settle", id: "local-1" });
  assert.equal(state.messages.find((message) => message.id === "local-1")!.delivery, "sent");
  state = demoReducer(state, { type: "send", conversationId: room.id, rootId: root.id, id: "local-2", body: "Confirmed in writing.", createdAt: snapshot.clock.nowMs + 2 });
  const updated = state.messages.find((message) => message.id === root.id)!;
  assert.equal(updated.replyCount, root.replyCount! + 1);
  assert.equal(updated.lastReplyAt, snapshot.clock.nowMs + 2);
  assert.equal(demoReducer(state, { type: "send", conversationId: room.id, rootId: null, id: "local-3", body: "   ", createdAt: 1 }), state, "blank messages are not sent");
});

test("a private request must be accepted before anyone can message", () => {
  let state = initDemoState(snapshot);
  assert.equal(demoReducer(state, { type: "send", conversationId: request.id, rootId: null, id: "local-1", body: "Hello", createdAt: 1 }), state);
  state = demoReducer(state, { type: "accept", conversationId: request.id });
  assert.equal(state.conversations.find((item) => item.id === request.id)!.request, null);
  state = demoReducer(state, { type: "send", conversationId: request.id, rootId: null, id: "local-1", body: "Hello", createdAt: 1 });
  assert.equal(rootMessages(state, request.id).length, 1);
  const declined = demoReducer(initDemoState(snapshot), { type: "decline", conversationId: request.id });
  assert.equal(declined.conversations.some((item) => item.id === request.id), false);
});

test("only your own messages can be edited or removed", () => {
  const custom: DemoMessagesSnapshot = { ...snapshot };
  let state = initDemoState(custom);
  const mine = state.messages.find((message) => message.authorId === snapshot.actorId && message.body)!;
  const theirs = state.messages.find((message) => message.authorId !== snapshot.actorId && message.body)!;
  state = demoReducer(state, { type: "edit", id: theirs.id, body: "Changed", editedAt: 5 });
  state = demoReducer(state, { type: "remove", id: theirs.id });
  assert.equal(state.messages.find((message) => message.id === theirs.id)!.body, theirs.body);
  state = demoReducer(state, { type: "edit", id: mine.id, body: "Changed", editedAt: 5 });
  assert.equal(state.messages.find((message) => message.id === mine.id)!.editedAt, 5);
  state = demoReducer(state, { type: "remove", id: mine.id });
  assert.equal(state.messages.find((message) => message.id === mine.id)!.body, null);
});
