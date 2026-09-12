import assert from "node:assert/strict";
import test from "node:test";
import { parseProjectId } from "@/lib/projects/project-ref";
import { anchoredScrollTop, resolveScrollAnchor, audienceResponseMatches, conversationHeaders, draftKey, forgetProjectDrafts, needsFreshAudienceSend, rememberDraft, shouldSendComposerKey } from "./conversation-client-model";

const project = parseProjectId("synthetic_project_a")!;

test("draft identities include actor, Project, room and thread", () => {
  assert.notEqual(draftKey("alice", project, "room_a", null), draftKey("bob", project, "room_a", null));
  assert.notEqual(draftKey("alice", project, "room_a", null), draftKey("alice", project, "room_b", null));
  assert.notEqual(draftKey("alice", project, "room_a", null), draftKey("alice", project, "room_a", "root_a"));
});

test("draft cache keeps the twenty most recently touched nonempty scopes", () => {
  const cache = new Map<string, string>();
  for (let index = 0; index < 22; index++) rememberDraft(cache, `scope_${index}`, `draft_${index}`);
  assert.equal(cache.size, 20);
  assert.equal(cache.has("scope_0"), false);
  rememberDraft(cache, "scope_2", "updated");
  rememberDraft(cache, "scope_2", "");
  assert.equal(cache.has("scope_2"), false);
});

test("fixture identity header is absent from the default same-origin transport", () => {
  assert.equal(conversationHeaders(undefined, false).has("x-fixture-actor"), false);
  assert.equal(conversationHeaders("alice", true).get("x-fixture-actor"), "alice");
  assert.equal(conversationHeaders("alice", true).get("content-type"), "application/json");
});

test("revocation removes only the affected actor and Project drafts", () => {
  const cache = new Map<string, string>([
    [draftKey("alice", project, "room_a", null), "remove"],
    [draftKey("alice", parseProjectId("synthetic_project_b")!, "room_b", null), "keep project"],
    [draftKey("bob", project, "room_a", null), "keep actor"],
  ]);
  forgetProjectDrafts(cache, "alice", project);
  assert.deepEqual([...cache.values()], ["keep project", "keep actor"]);
});

test("audience responses require the captured session and current history epoch", () => {
  assert.equal(audienceResponseMatches(3, 3, 7, 7, 7), true);
  assert.equal(audienceResponseMatches(2, 3, 7, 7, 7), false);
  assert.equal(audienceResponseMatches(3, 3, 6, 7, 6), false);
  assert.equal(audienceResponseMatches(3, 3, 7, 7, 6), false);
  assert.equal(needsFreshAudienceSend(6, 7), true);
  assert.equal(needsFreshAudienceSend(7, 7), false);
});

test("composer Enter and scroll anchoring follow desktop and mobile interaction rules", () => {
  assert.equal(shouldSendComposerKey({ key: "Enter", shiftKey: false, composing: false, mobileReturn: false }), true);
  assert.equal(shouldSendComposerKey({ key: "Enter", shiftKey: true, composing: false, mobileReturn: false }), false);
  assert.equal(shouldSendComposerKey({ key: "Enter", shiftKey: false, composing: true, mobileReturn: false }), false);
  assert.equal(shouldSendComposerKey({ key: "Enter", shiftKey: false, composing: false, mobileReturn: true }), false);
  assert.equal(anchoredScrollTop(1_400, 600, 75), 725);
});

test("live arrivals preserve the current reading position while prepends preserve the visible content anchor", () => {
  // Initial viewport: height 600 in a 2000px feed, reader at y=500.
  const reader = { top: 500, bottomDistance: 900, mode: "live" as const };
  assert.equal(resolveScrollAnchor(2100, 600, reader), 500);
  assert.equal(resolveScrollAnchor(2300, 600, { ...reader, mode: "prepend" }), 800);
  assert.equal(resolveScrollAnchor(2100, 600, { top: 1380, bottomDistance: 20, mode: "live" }), 1500);
});

test("losing one DM clears only its root and thread drafts, preserving other rooms and actors", async () => {
  const { forgetConversationDrafts } = await import("./conversation-client-model");
  const cache = new Map<string, string>([
    [draftKey("alice", project, "dm_a", null), "clear root"],
    [draftKey("alice", project, "dm_a", "thread"), "clear reply"],
    [draftKey("alice", project, "project_room", null), "keep project"],
    [draftKey("alice", project, "dm_b", null), "keep other DM"],
    [draftKey("bob", project, "dm_a", null), "keep other actor"],
  ]);
  forgetConversationDrafts(cache, "alice", project, "dm_a");
  assert.deepEqual([...cache.values()], ["keep project", "keep other DM", "keep other actor"]);
});
