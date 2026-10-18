import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { PERSONAL_CHAT_ATTACHMENT_LIMITS as LIMIT } from "@/lib/conversations/personal-chat-contracts";
import { accountDeletionTombstoneKey } from "@/server/account-deletion-key";
import { createLocalConversationDatabaseAdapter } from "./database";
import { createPersonalChatAttachmentService, type PersonalAttachmentStorage } from "./personal-chat-attachments";
import { createPersonalChatService } from "./personal-chat";
import { createPersonalChatHttp } from "./personal-chat-http";
import { createPersonalChatAttachmentHttp, createPersonalChatAttachmentDownload } from "./personal-chat-attachment-http";
import { erasePersonalChatAttachmentsWith } from "./personal-chat-attachment-erasure";
import { resolveConversationControls } from "@/lib/conversations/flags";

const fileBytes = new TextEncoder().encode("Private personal file\n");
async function fixture(withSchema = true) {
  const dir = await mkdtemp(join(tmpdir(), "signal-private-files-"));
  const client = createClient({ url: `file:${join(dir, "test.db").replaceAll("\\", "/")}` });
  const files = (await readdir("drizzle")).filter(name => /^\d{4}_.+\.sql$/.test(name) && name >= "0014_" && name <= (withSchema ? "0045_personal_chat_attachments.sql" : "0043_personal_chat.sql")).sort();
  for (const file of files) await client.executeMultiple(await readFile(join("drizzle", file), "utf8"));
  await client.execute("INSERT INTO users(id,clerk_id,handle,name,color,initials) VALUES('a','clerk-a','a','A','#444','AA'),('b','clerk-b','b','B','#444','BB')");
  const bytes = new Map<string, Uint8Array>();
  const removed: string[] = [];
  let failDelete = false;
  let time = 1_800_000_000_000;
  const storage: PersonalAttachmentStorage = {
    backend: () => "disk",
    put: async (key, data) => { bytes.set(key, Uint8Array.from(data)); return key; },
    remove: async (_backend, key) => { if (failDelete) throw new Error("injected delete failure"); removed.push(key); bytes.delete(key); },
  };
  const adapter = createLocalConversationDatabaseAdapter({ client });
  const attachments = createPersonalChatAttachmentService(adapter, { enabled: true, storage, now: () => time });
  const service = createPersonalChatService(adapter, undefined, attachments);
  const upload = (ownerId = "a", request = "upload_request_001") => attachments.upload({ ownerId, clientRequestId: request, filename: "private.txt", mimeType: "text/plain", bytes: fileBytes });
  return { client, adapter, storage, attachments, service, bytes, removed, upload, database: drizzle(client, { schema }),
    failDelete: (value: boolean) => { failDelete = value; }, advance: (ms: number) => { time += ms; }, now: () => time };
}

test("private file upload/send/reload/open is owner-only and preserves ordered receipt identity", async () => {
  const f = await fixture();
  try {
    const first = await f.upload(); const second = await f.upload("a", "upload_request_002");
    assert.ok(first.ok && second.ok); if (!first.ok || !second.ok) return;
    assert.equal((await f.upload()).ok, true); assert.equal(f.bytes.size, 2);
    assert.deepEqual(await f.attachments.read({ ownerId: "a", id: first.value.attachment.id }), { ok: false, code: "unavailable" }, "drafts have no download permission");
    const ids = [second.value.attachment.id, first.value.attachment.id];
    const input = { ownerId: "a", clientRequestId: "message_request_001", body: "", attachmentIds: ids };
    const sent = await f.service.send(input); assert.ok(sent.ok); if (!sent.ok) return;
    assert.deepEqual(sent.value.message.attachments?.map(file => file.id), ids);
    const retry = await f.service.send(input); assert.deepEqual(retry, sent);
    assert.deepEqual(await f.service.send({ ...input, attachmentIds: [...ids].reverse() }), { ok: false, code: "request_conflict" });
    const reopened = createPersonalChatService(f.adapter, undefined, f.attachments);
    const history = await reopened.list({ ownerId: "a", limit: 50 });
    assert.ok(history.ok); assert.deepEqual(history.ok && history.value.messages[0].attachments, sent.value.message.attachments);
    assert.deepEqual(await reopened.getReceipt({ ownerId: "a", clientRequestId: input.clientRequestId }), sent);
    assert.equal((await f.attachments.read({ ownerId: "a", id: ids[0] })).ok, true);
    assert.deepEqual(await f.attachments.read({ ownerId: "b", id: ids[0] }), { ok: false, code: "unavailable" });
    assert.deepEqual(await f.attachments.cancel({ ownerId: "b", id: ids[0] }), { ok: false, code: "unavailable" });
    assert.equal((await f.service.send({ ownerId: "b", clientRequestId: "message_request_002", body: "", attachmentIds: ids })).ok, false);
    assert.equal((await f.service.send({ ...input, clientRequestId: "message_request_003" })).ok, false, "bound files cannot be reused by another message");
    assert.equal((await f.service.list({ ownerId: "b", limit: 50 })).ok, true);
    const exportResult = await f.service.exportMarkdown({ ownerId: "a" });
    assert.ok(exportResult.ok && exportResult.value.markdown.includes("private.txt") &&
      exportResult.value.markdown.includes("/api/personal-chat/attachments/") && !exportResult.value.markdown.includes([...f.bytes.keys()][0]));
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM personal_chat_messages")).rows[0].n), 1);
  } finally { f.client.close(); }
});

test("disabled and old-schema deployments retain ordinary text chat and historical receipt hashes", async () => {
  const f = await fixture(false);
  try {
    const plain = createPersonalChatService(f.adapter);
    assert.equal(await plain.attachmentsEnabled(), false);
    assert.equal(await f.service.attachmentsEnabled(), false, "enabled but absent schema fails closed");
    const input = { ownerId: "a", clientRequestId: "legacy_request_0001", body: "Hello\r\nprivate" };
    const sent = await plain.send(input); assert.ok(sent.ok);
    assert.deepEqual(await f.service.send(input), sent);
    assert.equal((await f.service.list({ ownerId: "a", limit: 10 })).ok, true);
    assert.equal((await f.service.send({ ...input, clientRequestId: "files_request_0001", body: "", attachmentIds: [`pca_${"a".repeat(32)}`] })).ok, false);
    const controls = resolveConversationControls({ SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true", SIGNAL_CONVERSATION_SEND_ENABLED: "true", SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS: "a" });
    const handle = createPersonalChatHttp({ authenticate: async () => "a", controls: () => controls, service: async () => plain });
    const result = await handle(new Request("http://localhost/api/personal-chat"));
    assert.equal(result.status, 200); assert.equal((await result.json()).attachmentsEnabled, false);
  } finally { f.client.close(); }
});

test("bounded types, request conflicts and three-file admission reject without leaking or partial binding", async () => {
  const f = await fixture();
  try {
    assert.deepEqual(await f.attachments.upload({ ownerId: "a", clientRequestId: "unsupported_0001", filename: "x.svg", mimeType: "image/svg+xml", bytes: fileBytes }), { ok: false, code: "unsupported_file" });
    assert.deepEqual(await f.attachments.upload({ ownerId: "a", clientRequestId: "mismatch_000001", filename: "x.png", mimeType: "image/png", bytes: fileBytes }), { ok: false, code: "unsupported_file" });
    assert.deepEqual(await f.attachments.upload({ ownerId: "a", clientRequestId: "oversize_000001", filename: "x.txt", mimeType: "text/plain", bytes: new Uint8Array(LIMIT.fileBytes + 1) }), { ok: false, code: "upload_too_large" });
    const ready = await f.upload(); assert.ok(ready.ok); if (!ready.ok) return;
    const id = ready.value.attachment.id;
    assert.deepEqual(await f.attachments.upload({ ownerId: "a", clientRequestId: "upload_request_001", filename: "different.txt", mimeType: "text/plain", bytes: fileBytes }), { ok: false, code: "request_conflict" });
    const send = (ids: string[]) => f.service.send({ ownerId: "a", clientRequestId: "bad_binding_0001", body: "", attachmentIds: ids });
    assert.equal((await send([id, id])).ok, false);
    assert.equal((await send([id, `pca_${"f".repeat(32)}`])).ok, false);
    assert.equal(String((await f.client.execute({ sql: "SELECT state FROM personal_chat_attachments WHERE id=?", args: [id] })).rows[0].state), "ready");
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM personal_chat_messages")).rows[0].n), 0);
  } finally { f.client.close(); }
});

test("concurrent quota reservations and cancelled uploads cannot bypass private quotas or rate admission", async () => {
  const f = await fixture();
  try {
    const large = new Uint8Array(LIMIT.fileBytes).fill(65);
    const result = await f.attachments.upload({ ownerId: "a", clientRequestId: "quota_seed_0001", filename: "x.txt", mimeType: "text/plain", bytes: large });
    assert.ok(result.ok);
    // Existing private files reserve the owner's quota before either concurrent write.
    await f.client.execute("UPDATE personal_chat_attachments SET size_bytes=2097152,created_at=0");
    const seed = (await f.client.execute("SELECT * FROM personal_chat_attachments LIMIT 1")).rows[0];
    for (let index = 0; index < 23; index++) await f.client.execute({ sql: "INSERT INTO personal_chat_attachments SELECT ?,owner_id,NULL,NULL,?,request_hash,filename,mime_type,size_bytes,backend,?,stored_path,state,writer_settled,custody_until,expires_at,created_at FROM personal_chat_attachments WHERE id=?", args: [`seed_${index}`, `quota_seed_${index}`, `exact_seed_${index}`, String(seed.id)] });
    const simultaneous = await Promise.all([0, 1].map(index => f.attachments.upload({ ownerId: "a", clientRequestId: `quota_parallel_00${index}`, filename: "x.txt", mimeType: "text/plain", bytes: large })));
    assert.equal(simultaneous.filter(result => result.ok).length, 1);
    assert.ok(simultaneous.some(result => !result.ok && result.code === "quota_exceeded"));
    for (let index = 0; index < 10; index++) {
      const uploaded = await f.upload("b", `cancel_rate_00${index}`); assert.ok(uploaded.ok);
      if (uploaded.ok) assert.equal((await f.attachments.cancel({ ownerId: "b", id: uploaded.value.attachment.id })).ok, true);
    }
    assert.deepEqual(await f.upload("b", "cancel_rate_0010"), { ok: false, code: "rate_limited" });
  } finally { f.client.close(); }
});

test("expiry and failed exact-byte cleanup remain retryable; erasure clears owner-only custody", async () => {
  const f = await fixture();
  try {
    const ready = await f.upload(); assert.ok(ready.ok); if (!ready.ok) return;
    await f.upload("b", "other_owner_0001");
    f.failDelete(true); f.advance(LIMIT.draftMilliseconds + 1);
    assert.deepEqual(await f.attachments.repair("a"), { pending: 1 }); assert.equal(f.bytes.size, 2);
    await assert.rejects(erasePersonalChatAttachmentsWith(f.database, "a", f.storage, f.now()), /erasure deferred/);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM personal_chat_attachments WHERE owner_id='a'")).rows[0].n), 1);
    f.failDelete(false);
    await erasePersonalChatAttachmentsWith(f.database, "a", f.storage, f.now());
    assert.equal(f.bytes.size, 1); assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM personal_chat_attachments WHERE owner_id='a'")).rows[0].n), 0);
  } finally { f.client.close(); }
});

test("account erasure during an admitted upload fences finalization and cannot finish before bytes settle", async () => {
  const f = await fixture();
  try {
    let entered!: () => void; const started = new Promise<void>(resolve => { entered = resolve; });
    let finish!: () => void; const release = new Promise<void>(resolve => { finish = resolve; });
    const storage = { ...f.storage, put: async (key: string, bytes: Uint8Array) => { entered(); await release; f.bytes.set(key, bytes); return key; } };
    const service = createPersonalChatAttachmentService(f.adapter, { enabled: true, storage, now: f.now });
    const upload = service.upload({ ownerId: "a", clientRequestId: "inflight_upload_01", filename: "x.txt", mimeType: "text/plain", bytes: fileBytes });
    await started;
    await f.client.execute({ sql: "INSERT INTO meta(key,value) VALUES(?, 'deleting')", args: [accountDeletionTombstoneKey("clerk-a")] });
    await assert.rejects(erasePersonalChatAttachmentsWith(f.database, "a", storage, f.now()), /erasure deferred/);
    assert.equal(f.bytes.size, 0);
    finish(); assert.equal((await upload).ok, false);
    await erasePersonalChatAttachmentsWith(f.database, "a", storage, f.now());
    assert.equal(f.bytes.size, 0); assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM personal_chat_attachments")).rows[0].n), 0);
  } finally { f.client.close(); }
});

test("multipart HTTP checks admission, origin, envelope and returns safe owner descriptors", async () => {
  const f = await fixture();
  try {
    const controls = resolveConversationControls({ SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true", SIGNAL_CONVERSATION_SEND_ENABLED: "true", SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS: "a" });
    const handle = createPersonalChatAttachmentHttp({ authenticate: async () => "a", controls: () => controls, service: async () => f.attachments });
    const form = new FormData(); form.set("clientRequestId", "http_upload_0001"); form.set("file", new Blob([fileBytes], { type: "text/plain" }), "note.txt");
    const result = await handle(new Request("http://localhost/api/personal-chat/attachments", { method: "POST", body: form, headers: { origin: "http://localhost" } }));
    assert.equal(result.status, 200); const data = await result.json();
    assert.match(data.attachment.href, /^\/api\/personal-chat\/attachments\/pca_/); assert.equal(data.attachment.storedPath, undefined);
    const cross = await handle(new Request("http://localhost/api/personal-chat/attachments?id=" + data.attachment.id, { method: "DELETE", headers: { origin: "http://other" } }));
    assert.equal(cross.status, 404);
    const oversized = await handle(new Request("http://localhost/api/personal-chat/attachments", { method: "POST", body: "x", headers: { origin: "http://localhost", "content-type": "multipart/form-data; boundary=abc", "content-length": String(LIMIT.multipartBytes + 1) } }));
    assert.equal(oversized.status, 413);
  } finally { f.client.close(); }
});

test("authenticated download returns exact bytes, forced attachment headers and neutral foreign denial", async () => {
  const f = await fixture();
  try {
    const uploaded = await f.upload(); assert.ok(uploaded.ok); if (!uploaded.ok) return;
    const id = uploaded.value.attachment.id;
    await f.service.send({ ownerId: "a", clientRequestId: "download_message_01", body: "", attachmentIds: [id] });
    const controls = resolveConversationControls({ SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true", SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS: "a,b" });
    let actor = "a"; let opens = 0;
    const download = createPersonalChatAttachmentDownload({ authenticate: async () => actor, controls: () => controls, service: async () => f.attachments,
      open: async row => { opens++; const bytes = f.bytes.get(String(row.storage_key)); return bytes ? new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }) : null; } });
    const request = new Request("http://localhost/api/personal-chat/attachments/" + id);
    const response = await download(request, { params: Promise.resolve({ id }) });
    assert.equal(response.status, 200); assert.deepEqual(new Uint8Array(await response.arrayBuffer()), fileBytes);
    assert.match(response.headers.get("content-disposition")!, /^attachment;/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff"); assert.match(response.headers.get("cache-control")!, /private, no-store/);
    actor = "b"; const foreign = await download(request, { params: Promise.resolve({ id }) });
    assert.equal(foreign.status, 404); assert.equal(opens, 1, "authorization precedes byte opening");
  } finally { f.client.close(); }
});

test("the additive migration satisfies its owning receipt postconditions", async () => {
  const f = await fixture();
  try {
    const receipt = JSON.parse(await readFile("drizzle/receipts/personal-chat-attachments-2026-10-18.json", "utf8")) as { migrations: { proofs: { id: string; sql: string; expected: number | string }[] }[] };
    for (const proof of receipt.migrations[0].proofs) assert.equal((await f.client.execute(proof.sql)).rows[0].value, proof.expected, proof.id);
  } finally { f.client.close(); }
});
