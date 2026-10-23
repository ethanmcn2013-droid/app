import assert from "node:assert/strict";
import test from "node:test";
import { ConversationAttachmentCache } from "./conversation-attachment-drafts";
import { draftKey, hasDraftCapacity, listSavedDrafts, forgetConversationDrafts } from "./conversation-client-model";
import { parseProjectId } from "@/lib/projects/project-ref";

const attachment = (n: number) => ({ id: `ca_${String(n).padStart(32, "0")}`, filename: `${n}.txt`, mimeType: "text/plain", sizeBytes: 1, href: `/api/conversations/attachments/ca_${String(n).padStart(32, "0")}` });
const item = (n: number) => ({ scopeKind: "project" as const, localId: `local_${n}`, requestId: `file_${n}`, file: new File(["x"], `${n}.txt`, { type: "text/plain" }), audienceEpoch: 1, status: "ready" as const, attachment: attachment(n) });

test("file reservations preserve ordered identity across scopes and need explicit release or receipt consumption", () => {
  const cache = new ConversationAttachmentCache(); const a = "alice/project/room/root"; const b = "alice/project/dm/root";
  cache.set(a, [item(1), item(2)]); cache.set(b, [item(3)]);
  const original = cache.get(a)!;
  assert.equal(cache.reserve(a, [attachment(2).id, attachment(1).id], "send_1"), true);
  assert.equal(original[0].reservedFor, undefined);
  assert.deepEqual(cache.get(a)?.map(file => file.reservedFor), ["send_1", "send_1"]);
  assert.equal(cache.reserve(a, [attachment(1).id], "different_send"), false);
  assert.equal(cache.reserve(a, [attachment(1).id, attachment(1).id], "duplicate"), false);
  cache.release(a, "send_1");
  assert.deepEqual(cache.get(a)?.map(file => file.attachment?.id), [attachment(1).id, attachment(2).id]);
  assert.equal(cache.reserve(a, [attachment(2).id, attachment(1).id], "send_2"), true);
  cache.consume(a, "send_2");
  assert.equal(cache.has(a), false); assert.equal(cache.get(b)?.[0].file.name, "3.txt");
});

test("file-only drafts occupy the existing bounded session inventory and revocation clears only its scoped actor", () => {
  const cache = new ConversationAttachmentCache(); const drafts = new Map<string, string>(); const outgoing = new Map();
  const project = parseProjectId("p1")!; const key = draftKey("alice", project, "room", null); const other = draftKey("bob", project, "room", null);
  cache.set(key, [item(1)]); cache.set(other, [item(2)]);
  assert.equal(hasDraftCapacity(drafts, outgoing, "third", 2, cache), false);
  assert.equal(hasDraftCapacity(drafts, outgoing, key, 2, cache), true);
  const saved = listSavedDrafts("alice", drafts, outgoing, cache);
  assert.equal(saved.length, 1); assert.equal(saved[0].files, 1); assert.deepEqual(saved[0].bodies, []);
  forgetConversationDrafts(cache, "alice", project, "room");
  assert.equal(cache.has(key), false); assert.equal(cache.has(other), true);
});

test("disposed or removed scopes cannot be refilled by delayed upload completion", () => {
  const cache = new ConversationAttachmentCache(); let notifications = 0;
  const unsubscribe = cache.subscribe(() => notifications++);
  cache.set("scope", [item(1)]); cache.clear();
  assert.equal(cache.update("scope", "local_1", file => ({ ...file, status: "ready" })), false);
  assert.equal(cache.size, 0); assert.equal(notifications, 2); unsubscribe();
});

test("file-only private reply drafts reopen the exact DM and root without a text cache entry", () => {
  const cache = new ConversationAttachmentCache(); const drafts = new Map(); const outgoing = new Map();
  const project = parseProjectId("project-a")!;
  const key = draftKey("alice", project, "private-room", "root-17");
  cache.set(key, [{ ...item(1), scopeKind: "dm" }]);
  const saved = listSavedDrafts("alice", drafts, outgoing, cache);
  assert.deepEqual(saved[0].scope, { projectId: project, conversationId: "private-room", rootId: "root-17", kind: "dm" });
  assert.equal(saved[0].files, 1); assert.equal(drafts.size, 0); assert.equal(outgoing.size, 0);
});
