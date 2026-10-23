import assert from "node:assert/strict";
import test from "node:test";
import { conversationFileProblem, conversationFilesAvailable, discardConversationFile, uploadConversationFile } from "./conversation-attachment-client";

const scope = { kind: "dm" as const, projectId: "project-a", conversationId: "private-room", rootId: "root-a", expectedAudienceEpoch: 7 };
const attachment = { id: "ca_00000000000000000000000000000001", filename: "note.txt", mimeType: "text/plain", sizeBytes: 4, href: "/api/conversations/attachments/ca_00000000000000000000000000000001" };

test("upload transmits only the exact agreed scope fields and ordered claim request, with no ambient fixture identity", async () => {
  const original = globalThis.fetch; const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return Response.json({ attachment }); };
  try {
    const file = new File(["note"], "note.txt", { type: "text/plain" });
    assert.deepEqual(await uploadConversationFile(file, "file_exact_request", scope), attachment);
    assert.equal(calls.length, 1); assert.equal(calls[0].url, "/api/conversations/attachments");
    assert.equal(calls[0].init?.method, "POST"); assert.equal(calls[0].init?.credentials, "same-origin");
    assert.equal(calls[0].init?.cache, "no-store"); assert.equal(calls[0].init?.headers, undefined);
    const body = calls[0].init?.body as FormData;
    assert.deepEqual([...body.keys()].sort(), ["clientRequestId", "conversationId", "expectedAudienceEpoch", "file", "projectId", "rootId"]);
    assert.equal(body.get("rootId"), "root-a"); assert.equal(body.get("expectedAudienceEpoch"), "7"); assert.equal(body.get("clientRequestId"), "file_exact_request");
    assert.equal(body.get("actorId"), null); assert.equal(body.get("kind"), null);
  } finally { globalThis.fetch = original; }
});

test("capability is scoped to the root and epoch; discard carries only its exact upload id", async () => {
  const original = globalThis.fetch; const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return Response.json({ available: true, cancelled: true }); };
  try {
    assert.equal(await conversationFilesAvailable({ ...scope, rootId: null }, new AbortController().signal), true);
    const parsed = new URL(calls[0].url, "https://fixture.invalid");
    assert.equal(parsed.searchParams.get("rootId"), ""); assert.equal(parsed.searchParams.get("expectedAudienceEpoch"), "7");
    await discardConversationFile(attachment.id);
    assert.equal(calls[1].url, `/api/conversations/attachments?id=${attachment.id}`); assert.equal(calls[1].init?.method, "DELETE");
  } finally { globalThis.fetch = original; }
});

test("unavailable capability and upload outcome never substitute another request or automatically retry", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: "audience_changed" }, { status: 409 }); };
  try {
    assert.equal(await conversationFilesAvailable(scope, new AbortController().signal), false);
    await assert.rejects(uploadConversationFile(new File(["x"], "note.txt"), "file_same_request", scope), /audience changed/);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test("file validation enforces the shared 2 MiB boundary before upload", () => {
  assert.equal(conversationFileProblem({ name: "clipboard.png", size: 2 * 1024 * 1024 }), null);
  assert.match(conversationFileProblem({ name: "clipboard.png", size: 2 * 1024 * 1024 + 1 })!, /2 MiB/);
  assert.match(conversationFileProblem({ name: "empty.txt", size: 0 })!, /not empty/);
  assert.match(conversationFileProblem({ name: "program.exe", size: 1 })!, /JPEG/);
});
