import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseProjectId } from "@/lib/projects/project-ref";
import { draftKey, hasDraftCapacity, listSavedDrafts, type OutgoingCache } from "./conversation-client-model";
import { SavedDraftsPanel } from "./saved-drafts-panel";

test("twenty outgoing-only scopes all have a visible route to resolve their capacity", () => {
  const project = parseProjectId("synthetic_project_a")!;
  const outgoing: OutgoingCache = new Map();
  for (let index = 0; index < 20; index++) outgoing.set(draftKey("alice", project, "room", `root_${index}`), {
    pending: [], recoveredDrafts: index % 2 ? [{ requestId: `request_${index}`, body: `Earlier text ${index}`, mentionUserIds: ["bob"] }] : [],
    draftMentionUserIds: index % 2 ? [] : ["bob"], reviewedAudienceEpoch: 1, scopeKind: "project",
  });
  const drafts = new Map<string, string>();
  assert.equal(hasDraftCapacity(drafts, outgoing, draftKey("alice", project, "room", null)), false);
  const entries = listSavedDrafts("alice", drafts, outgoing);
  assert.equal(entries.length, 20);
  assert.equal(entries.filter((entry) => entry.unresolved).length, 10);
  assert.deepEqual(entries.map((entry) => entry.scope.rootId), Array.from({ length: 20 }, (_, index) => `root_${index}`));
  assert.equal(listSavedDrafts("bob", drafts, outgoing).length, 0);
  const html = renderToStaticMarkup(createElement(SavedDraftsPanel, { entries, onOpen: () => {}, onDiscard: () => {} }));
  assert.equal((html.match(/<details>/g) ?? []).length, 20);
  assert.equal((html.match(/Open saved conversation /g) ?? []).length, 20);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 10);
  assert.match(html, /Earlier text 19/);
  assert.match(html, /1 person selected/);
});
