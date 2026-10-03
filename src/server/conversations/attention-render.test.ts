import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConversationAttentionSection } from "../../components/app/inbox/conversation-attention";
import type { DirectedAttention } from "./attention";

test("Inbox renders source-scoped unread links without message bodies or another reader's state", () => {
  const items: DirectedAttention[] = [{
    eventId: "event_1", kind: "conversation", projectId: "project_1", projectName: "Owned Project",
    scopeId: "room_1", itemId: "message_1", rootId: null, createSeq: 3, createdAt: 1,
    seenAt: null, href: "/app/messages?projectId=project_1&messageId=message_1&messageSeq=3",
  }, {
    eventId: "event_2", kind: "task_discussion", projectId: "project_1", projectName: "Owned Project",
    scopeId: "task_1", itemId: "comment_1", rootId: null, createSeq: 1, createdAt: 2,
    seenAt: 2, href: "/app/task/task_1#comment-comment_1",
  }];
  const html = renderToStaticMarkup(createElement(ConversationAttentionSection, { initial: items, available: true }));
  assert.match(html, /1 message for you/);
  assert.match(html, /Mark all seen/);
  assert.match(html, /href="\/app\/messages\?projectId=project_1&amp;messageId=message_1&amp;messageSeq=3"/);
  assert.match(html, /href="\/app\/task\/task_1#comment-comment_1"/);
  assert.equal((html.match(/>New</g) ?? []).length, 1);
  assert.doesNotMatch(html, /message body|foreign reader/i);
});

test("unavailable attention renders recovery instead of a false empty state", () => {
  const html = renderToStaticMarkup(createElement(ConversationAttentionSection, { initial: [], available: false }));
  assert.match(html, /Attention needs a fresh check/);
  assert.match(html, /Try again/);
  assert.doesNotMatch(html, /No new Project messages/);
});
