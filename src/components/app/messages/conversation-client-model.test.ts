import assert from "node:assert/strict";
import test from "node:test";
import { parseProjectId } from "@/lib/projects/project-ref";
import { audienceResponseMatches, conversationHeaders, draftKey, forgetProjectDrafts, needsFreshAudienceSend, rememberDraft } from "./conversation-client-model";

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
