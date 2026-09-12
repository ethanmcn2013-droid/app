import assert from "node:assert/strict";
import test from "node:test";
import { parseProjectId } from "@/lib/projects/project-ref";
import { conversationHeaders, draftKey, rememberDraft } from "./conversation-client-model";

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
