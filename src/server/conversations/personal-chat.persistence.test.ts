import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { accountDeletionTombstoneKey } from "@/server/account-deletion-key";
import { PERSONAL_CHAT_LIMITS } from "@/lib/conversations/personal-chat-contracts";
import { eraseConversationUserFootprint } from "./account-lifecycle";
import { createLocalConversationDatabaseAdapter } from "./database";
import { createPersonalChatService } from "./personal-chat";
import { createPersonalChatHttp } from "./personal-chat-http";

const repoRoot = resolve(process.cwd());

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "signal-personal-chat-"));
  const dbPath = join(directory, "tasks.db").replaceAll("\\", "/");
  const client = createClient({ url: `file:${dbPath}` });
  await client.execute("PRAGMA foreign_keys=OFF");
  const migrations = (await readdir(join(repoRoot, "drizzle")))
    .filter(name => /^\d{4}_.+\.sql$/.test(name) && name >= "0014_" && name <= "0043_personal_chat.sql")
    .sort();
  for (const migration of migrations) await client.executeMultiple(await readFile(join(repoRoot, "drizzle", migration), "utf8"));
  await client.batch([
    { sql: "INSERT INTO users(id,clerk_id,handle,name,color,initials) VALUES('pc_alice','clerk_pc_alice','alice','Alice','#444','AA')" },
    { sql: "INSERT INTO users(id,clerk_id,handle,name,color,initials) VALUES('pc_bob','clerk_pc_bob','bob','Bob','#555','BB')" },
  ], "write");
  const adapter = createLocalConversationDatabaseAdapter({ client });
  return { directory, dbPath, client, service: createPersonalChatService(adapter) };
}

test("personal chat is owner-isolated and replays only the same normalized request", async () => {
  const f = await fixture();
  try {
    const first = await f.service.send({ ownerId: "pc_alice", clientRequestId: "request_alice_0001", body: "Hello\r\nthere" });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.value.message.body, "Hello\nthere");
    assert.deepEqual(await f.service.send({ ownerId: "pc_alice", clientRequestId: "request_alice_0001", body: "Hello\nthere" }), first);
    assert.deepEqual(await f.service.send({ ownerId: "pc_alice", clientRequestId: "request_alice_0001", body: "Different" }), { ok: false, code: "request_conflict" });
    const alice = await f.service.list({ ownerId: "pc_alice", limit: 50 });
    const bob = await f.service.list({ ownerId: "pc_bob", limit: 50 });
    assert.equal(alice.ok && alice.value.messages.length, 1);
    assert.deepEqual(bob.ok && bob.value.messages, []);
    const hiddenReceipt = await f.service.getReceipt({ ownerId: "pc_bob", clientRequestId: "request_alice_0001" });
    assert.deepEqual(hiddenReceipt, { ok: true, value: { message: null } });
  } finally { f.client.close(); }
});

test("committed sends remain discoverable and idempotent after process restart", async () => {
  const f = await fixture();
  try {
    const input = { ownerId: "pc_alice", clientRequestId: "request_restart_0001", body: "Persisted" };
    const committed = await f.service.send(input);
    assert.equal(committed.ok, true);
    f.client.close();
    const reopened: Client = createClient({ url: `file:${f.dbPath}` });
    try {
      const service = createPersonalChatService(createLocalConversationDatabaseAdapter({ client: reopened }));
      const receipt = await service.getReceipt({ ownerId: input.ownerId, clientRequestId: input.clientRequestId });
      assert.equal(receipt.ok && receipt.value.message?.body, "Persisted");
      assert.deepEqual(await service.send(input), committed);
      assert.equal(Number((await reopened.execute("SELECT COUNT(*) AS n FROM personal_chat_messages WHERE owner_id='pc_alice'")).rows[0].n), 1);
    } finally { reopened.close(); }
  } finally { try { f.client.close(); } catch {} }
});

test("pagination stays owner-scoped across more than 50 messages and export remains complete", async () => {
  const f = await fixture();
  try {
    const writes = Array.from({ length: 53 }, (_, index) => ({
      sql: "INSERT INTO personal_chat_messages(id,owner_id,body,client_request_id,request_hash,created_at,edited_at) VALUES(?,?,?,?,?,?,?)",
      args: [`pc_message_${String(index).padStart(3, "0")}`, "pc_alice", `private-history-${index}`, `request_history_${String(index).padStart(3, "0")}`, "a".repeat(64), 1_800_000_000_000 + index, index === 0 ? 1_800_000_000_100 : null],
    }));
    writes.push({ sql: "INSERT INTO personal_chat_messages(id,owner_id,body,client_request_id,request_hash,created_at,edited_at) VALUES(?,?,?,?,?,?,NULL)",
      args: ["pc_bob_private", "pc_bob", "bob-only-private", "request_bob_private_0001", "b".repeat(64), 1_800_000_000_999] });
    await f.client.batch(writes, "write");
    const first = await f.service.list({ ownerId: "pc_alice", limit: 50 });
    assert.equal(first.ok && first.value.messages.length, 50);
    assert.ok(first.ok && first.value.nextCursor);
    if (!first.ok || !first.value.nextCursor) return;
    const second = await f.service.list({ ownerId: "pc_alice", limit: 50, before: first.value.nextCursor });
    assert.equal(second.ok && second.value.messages.length, 3);
    assert.equal(second.ok && second.value.nextCursor, null);
    const foreignCursor = await f.service.list({ ownerId: "pc_alice", limit: 50, before: "pc_bob_private" });
    assert.deepEqual(foreignCursor, { ok: false, code: "invalid_input" });
    const exported = await f.service.exportMarkdown({ ownerId: "pc_alice" });
    assert.equal(exported.ok && (exported.value.markdown.match(/private-history-/g) ?? []).length, 53);
    assert.ok(exported.ok && exported.value.markdown.includes("· You"));
    assert.ok(exported.ok && exported.value.markdown.includes("*Edited.*"));
    assert.ok(exported.ok && !exported.value.markdown.includes("bob-only-private"));
  } finally { f.client.close(); }
});

test("send rate limit is owner-scoped and same-request replay bypasses the limit", async () => {
  const f = await fixture();
  try {
    const limited = createPersonalChatService(createLocalConversationDatabaseAdapter({ client: f.client }), {
      ...PERSONAL_CHAT_LIMITS, sendsPerMinute: 2,
    });
    const firstInput = { ownerId: "pc_alice", clientRequestId: "request_rate_first_0001", body: "First" };
    const first = await limited.send(firstInput);
    assert.equal(first.ok, true);
    const now = Date.now();
    await f.client.execute({ sql: "INSERT INTO personal_chat_messages(id,owner_id,body,client_request_id,request_hash,created_at) VALUES(?,?,?,?,?,?)",
      args: ["pc_rate_second", "pc_alice", "Second", "request_rate_second_0001", "b".repeat(64), now] });
    assert.deepEqual(await limited.send(firstInput), first);
    assert.deepEqual(await limited.send({ ownerId: "pc_alice", clientRequestId: "request_rate_third_0001", body: "Third" }),
      { ok: false, code: "rate_limited", retryAfterSeconds: 60 });
    assert.equal((await limited.send({ ownerId: "pc_bob", clientRequestId: "request_rate_bob_0001", body: "Bob" })).ok, true);

    const handle = createPersonalChatHttp({ authenticate: async () => "pc_alice", controls: () => ({
      internalEnabled: true, sendsEnabled: true, deliveryEnabled: false, directMessagesEnabled: false,
      allowedActorIds: new Set(["pc_alice"]), guestsEnabled: false, attachmentsEnabled: false, aiEnabled: false,
    }), service: async () => limited });
    const response = await handle(new Request("https://app.signalstudio.ie/api/personal-chat", {
      method: "POST", headers: { origin: "https://app.signalstudio.ie", "content-type": "application/json" },
      body: JSON.stringify({ clientRequestId: "request_rate_http_0001", body: "HTTP rate limited" }),
    }));
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "60");
  } finally { f.client.close(); }
});

test("export rejects message, body-byte, and generated-Markdown overages without truncation", async () => {
  const f = await fixture();
  try {
    await f.client.batch([
      { sql: "INSERT INTO personal_chat_messages(id,owner_id,body,client_request_id,request_hash,created_at) VALUES('pc_cap_one','pc_alice','large-body-one','request_cap_one_0001',?,?)", args: ["a".repeat(64), Date.now()] },
      { sql: "INSERT INTO personal_chat_messages(id,owner_id,body,client_request_id,request_hash,created_at) VALUES('pc_cap_two','pc_alice','large-body-two','request_cap_two_0001',?,?)", args: ["b".repeat(64), Date.now() + 1] },
    ], "write");
    const adapter = createLocalConversationDatabaseAdapter({ client: f.client });
    const countLimited = createPersonalChatService(adapter, { ...PERSONAL_CHAT_LIMITS, exportMessagesMaximum: 1 });
    const bytesLimited = createPersonalChatService(adapter, { ...PERSONAL_CHAT_LIMITS, exportBytesMaximum: 10 });
    const markdownLimited = createPersonalChatService(adapter, { ...PERSONAL_CHAT_LIMITS, exportBytesMaximum: 100 });
    assert.deepEqual(await countLimited.exportMarkdown({ ownerId: "pc_alice" }), { ok: false, code: "export_too_large" });
    assert.deepEqual(await bytesLimited.exportMarkdown({ ownerId: "pc_alice" }), { ok: false, code: "export_too_large" });
    assert.deepEqual(await markdownLimited.exportMarkdown({ ownerId: "pc_alice" }), { ok: false, code: "export_too_large" });
    const http = createPersonalChatHttp({ authenticate: async () => "pc_alice", controls: () => ({
      internalEnabled: true, sendsEnabled: true, deliveryEnabled: false, directMessagesEnabled: false,
      allowedActorIds: new Set(["pc_alice"]), guestsEnabled: false, attachmentsEnabled: false, aiEnabled: false,
    }), service: async () => countLimited });
    const response = await http(new Request("https://app.signalstudio.ie/api/personal-chat?format=markdown"));
    assert.equal(response.status, 413);
  } finally { f.client.close(); }
});

test("account-erasure tombstone fences sends, history, receipts, and export", async () => {
  const f = await fixture();
  try {
    const input = { ownerId: "pc_alice", clientRequestId: "request_fenced_0001", body: "Before erasure" };
    assert.equal((await f.service.send(input)).ok, true);
    await f.client.execute({ sql: "INSERT INTO meta(key,value) VALUES (?,'erasure-requested:v1')",
      args: [accountDeletionTombstoneKey("clerk_pc_alice")] });
    assert.deepEqual(await f.service.send({ ...input, clientRequestId: "request_fenced_0002" }), { ok: false, code: "unavailable" });
    assert.deepEqual(await f.service.list({ ownerId: "pc_alice", limit: 50 }), { ok: false, code: "unavailable" });
    assert.deepEqual(await f.service.getReceipt({ ownerId: "pc_alice", clientRequestId: input.clientRequestId }), { ok: false, code: "unavailable" });
    assert.deepEqual(await f.service.exportMarkdown({ ownerId: "pc_alice" }), { ok: false, code: "unavailable" });
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM personal_chat_messages WHERE owner_id='pc_alice'")).rows[0].n), 1);
  } finally { f.client.close(); }
});

test("account erasure explicitly removes private chat rows and leaves another owner's history", async () => {
  const f = await fixture();
  try {
    await f.service.send({ ownerId: "pc_alice", clientRequestId: "request_erase_a_0001", body: "Erase Alice" });
    await f.service.send({ ownerId: "pc_bob", clientRequestId: "request_erase_b_0001", body: "Keep Bob" });
    const database = drizzle(f.client, { schema });
    await eraseConversationUserFootprint(database, "pc_alice");
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM personal_chat_messages WHERE owner_id='pc_alice'")).rows[0].n), 0);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM personal_chat_messages WHERE owner_id='pc_bob'")).rows[0].n), 1);
  } finally { f.client.close(); }
});

test("HTTP boundary enforces same-origin writes, availability, and no-store responses", async () => {
  const f = await fixture();
  try {
    const controls = {
      internalEnabled: true, sendsEnabled: true, deliveryEnabled: false, directMessagesEnabled: false,
      allowedActorIds: new Set(["pc_alice"]), guestsEnabled: false as const,
      attachmentsEnabled: false as const, aiEnabled: false as const,
    };
    const handle = createPersonalChatHttp({ authenticate: async () => "pc_alice", controls: () => controls, service: async () => f.service });
    const foreign = await handle(new Request("https://app.signalstudio.ie/api/personal-chat", {
      method: "POST", headers: { origin: "https://attacker.invalid", "content-type": "application/json" },
      body: JSON.stringify({ clientRequestId: "request_http_0001", body: "Blocked" }),
    }));
    assert.equal(foreign.status, 404);
    const forged = await handle(new Request("https://app.signalstudio.ie/api/personal-chat", {
      method: "POST", headers: { origin: "https://app.signalstudio.ie", "content-type": "application/json" },
      body: JSON.stringify({ clientRequestId: "request_http_0001", body: "Blocked", ownerId: "pc_bob", actorId: "pc_bob" }),
    }));
    assert.equal(forged.status, 400);
    const unauthenticated = createPersonalChatHttp({ authenticate: async () => null, controls: () => controls, service: async () => f.service });
    assert.equal((await unauthenticated(new Request("https://app.signalstudio.ie/api/personal-chat"))).status, 401);
    const sendsDisabled = createPersonalChatHttp({
      authenticate: async mode => mode === "read" ? "pc_alice" : null,
      controls: () => ({ ...controls, sendsEnabled: false }), service: async () => f.service,
    });
    assert.equal((await sendsDisabled(new Request("https://app.signalstudio.ie/api/personal-chat", {
      method: "POST", headers: { origin: "https://app.signalstudio.ie", "content-type": "application/json" },
      body: JSON.stringify({ clientRequestId: "request_http_0002", body: "Blocked" }),
    }))).status, 404);
    const read = await handle(new Request("https://app.signalstudio.ie/api/personal-chat"));
    assert.equal(read.status, 200);
    assert.equal(read.headers.get("cache-control"), "private, no-store, max-age=0, must-revalidate");
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM personal_chat_messages")).rows[0].n), 0);
  } finally { f.client.close(); }
});
