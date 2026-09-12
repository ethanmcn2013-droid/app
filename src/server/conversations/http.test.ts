import assert from "node:assert/strict";
import test from "node:test";
import { createConversationHttp } from "./http";
import { resolveConversationControls } from "../../lib/conversations/flags";

const base = "https://app.example.test/api/conversations";
const input = { action: "send", projectId: "project-a", conversationId: "room-a", clientRequestId: "request_http_00000001", expectedAudienceEpoch: 1, body: "Reviewed message", rootId: null, mentionUserIds: [] };
function fixture(options: { actor?: string | null; sends?: boolean; enabled?: boolean; throwService?: boolean } = {}) {
  const calls: { method: string; value: unknown }[] = [];
  const service = Object.fromEntries(["ensureProjectConversation", "getProjectConversation", "listProjectAudience", "sendMessage", "getReceipt", "getHistory", "getMessagePage", "editMessage", "tombstoneMessage"].map((method) => [method, async (value: unknown) => {
    calls.push({ method, value });
    if (options.throwService) throw new Error("SQL secret message body and bearer token");
    return { ok: true, value: { marker: method } };
  }])) as unknown as Awaited<ReturnType<Parameters<typeof createConversationHttp>[0]["service"]>>;
  const taskOutcomes = Object.fromEntries(["promoteMessageToTask", "getTaskReceipt", "getTaskOutcome", "getTaskDestination"].map((method) => [method, async (value: unknown) => {
    calls.push({ method, value });
    if (options.throwService) throw new Error("private task source and SQL text");
    return { ok: true, value: { marker: method } };
  }])) as unknown as Awaited<ReturnType<NonNullable<Parameters<typeof createConversationHttp>[0]["taskOutcomes"]>>>;
  const handle = createConversationHttp({
    authenticate: async () => options.actor === undefined ? "canonical-alice" : options.actor,
    controls: () => resolveConversationControls({ SIGNAL_CONVERSATION_INTERNAL_ENABLED: options.enabled === false ? "false" : "true", SIGNAL_CONVERSATION_SEND_ENABLED: options.sends === false ? "false" : "true", SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS: "canonical-alice" }),
    service: async () => service,
    taskOutcomes: async () => taskOutcomes,
  });
  return { handle, calls };
}
function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request(base, { method: "POST", headers: { origin: "https://app.example.test", "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
}

test("session and allowlist failures never reach the service and are uncacheable", async () => {
  for (const options of [{ actor: null }, { actor: "canonical-bob" }, { enabled: false }]) {
    const f = fixture(options); const result = await f.handle(post(input));
    assert.equal(result.status, options.actor === null ? 401 : 404);
    assert.match(result.headers.get("cache-control")!, /private, no-store/);
    assert.equal(f.calls.length, 0);
  }
});
test("cross-origin writes, forged actor fields and malformed bodies are refused without side effects", async () => {
  const requests = [post(input, { origin: "https://evil.example" }), post(input, { "sec-fetch-site": "cross-site" }), post({ ...input, actorId: "canonical-bob" }), post({ ...input, userId: "canonical-bob" }), post("{broken"), post(input, { "content-type": "text/plain" }), post({ ...input, body: "x".repeat(48_001) }), post({ ...input, expectedAudienceEpoch: 0 })];
  for (const request of requests) { const f = fixture(); assert.ok((await f.handle(request)).status >= 400); assert.equal(f.calls.length, 0); }
});
test("valid sends use the authenticated canonical actor and retain the original request", async () => {
  const f = fixture(); const result = await f.handle(post(input));
  assert.equal(result.status, 200);
  assert.deepEqual(f.calls, [{ method: "sendMessage", value: { actorId: "canonical-alice", input: { projectId: input.projectId, conversationId: input.conversationId, clientRequestId: input.clientRequestId, expectedAudienceEpoch: 1, body: input.body, rootId: null, mentionUserIds: [] } } }]);
});
test("send rollback preserves entitled history and receipt recovery while refusing creation", async () => {
  const f = fixture({ sends: false });
  assert.equal((await f.handle(post(input))).status, 403);
  assert.equal((await f.handle(post({ action: "ensure", projectId: "project-a" }))).status, 403);
  for (const query of ["action=project&projectId=project-a", "action=history&projectId=project-a&conversationId=room-a", "action=receipt&projectId=project-a&conversationId=room-a&clientRequestId=request_http_00000001"]) assert.equal((await f.handle(new Request(`${base}?${query}`))).status, 200);
  assert.deepEqual(f.calls.map((call) => call.method), ["getProjectConversation", "getHistory", "getReceipt"]);
});
test("task reads use only the canonical actor and task receipts remain readable with sends off", async () => {
  const f = fixture({ sends: false });
  for (const query of [
    "action=task-destination&projectId=project-a",
    "action=task-receipt&clientRequestId=request_http_00000001",
    "action=task-outcome&taskId=t-task_0001",
  ]) assert.equal((await f.handle(new Request(`${base}?${query}`))).status, 200);
  assert.deepEqual(f.calls, [
    { method: "getTaskDestination", value: { actorId: "canonical-alice", projectId: "project-a" } },
    { method: "getTaskReceipt", value: { actorId: "canonical-alice", clientRequestId: "request_http_00000001" } },
    { method: "getTaskOutcome", value: { actorId: "canonical-alice", taskId: "t-task_0001" } },
  ]);
});
test("promotion maps explicit reviewed fields and sends-off refuses new work", async () => {
  const promotion = { action: "promote-task", projectId: "project-a", conversationId: "room-a", messageId: "message-a",
    clientRequestId: "promotion_http_000001", expectedRevision: 2, expectedAudienceEpoch: 3,
    destinationProjectId: "project-b", title: "Publish the reviewed page", ownerUserId: "canonical-alice", dueDate: "2026-10-25" };
  const f = fixture();
  assert.equal((await f.handle(post(promotion))).status, 200);
  assert.deepEqual(f.calls, [{ method: "promoteMessageToTask", value: { actorId: "canonical-alice", input: {
    clientRequestId: promotion.clientRequestId, sourceProjectId: "project-a", conversationId: "room-a", messageId: "message-a",
    expectedRevision: 2, expectedAudienceEpoch: 3, destinationProjectId: "project-b", title: promotion.title,
    ownerUserId: "canonical-alice", dueDate: "2026-10-25",
  } } }]);
  const paused = fixture({ sends: false });
  assert.equal((await paused.handle(post(promotion))).status, 403);
  assert.equal(paused.calls.length, 0);
  assert.equal((await paused.handle(new Request(`${base}?action=task-receipt&clientRequestId=${promotion.clientRequestId}`))).status, 200);
  assert.deepEqual(paused.calls.map((call) => call.method), ["getTaskReceipt"]);
});
test("promotion rejects forged fields and task-specific bounds before the service", async () => {
  const valid = { action: "promote-task", projectId: "project-a", conversationId: "room-a", messageId: "message-a",
    clientRequestId: "promotion_http_000001", expectedRevision: 1, expectedAudienceEpoch: 1,
    destinationProjectId: "project-b", title: "Reviewed title", ownerUserId: "canonical-alice", dueDate: "2026-10-25" };
  const invalid = [
    { ...valid, actorId: "canonical-bob" }, { ...valid, sourceProjectId: "project-b" },
    { ...valid, title: "x".repeat(1_001) }, { ...valid, title: "line\nbreak" },
    { ...valid, dueDate: "2026-02-30" }, { ...valid, expectedRevision: 0 },
    { ...valid, destinationProjectId: "../foreign" }, { ...valid, ownerUserId: "" },
  ];
  for (const body of invalid) { const f = fixture(); assert.equal((await f.handle(post(body))).status, 400); assert.equal(f.calls.length, 0); }
});
test("cursor and page bounds cannot be widened or silently normalized", async () => {
  for (const query of ["afterChangeSeq=-1", "afterChangeSeq=1e3", "afterChangeSeq=9007199254740993", "limit=101", "limit=0", "limit=1.5"]) {
    const f = fixture(); const result = await f.handle(new Request(`${base}?action=history&projectId=project-a&conversationId=room-a&${query}`));
    assert.equal(result.status, 400); assert.equal(f.calls.length, 0);
  }
});
test("recent-message pages retain exact bounds and remain readable with sends off", async () => {
  const f = fixture({ sends: false });
  const query = `${base}?action=messages&projectId=project-a&conversationId=room-a`;
  for (const suffix of ["&limit=101", "&beforeCreateSeq=0", "&beforeCreateSeq=-1", "&beforeCreateSeq=1e2"]) assert.equal((await f.handle(new Request(query + suffix))).status, 400);
  assert.equal(f.calls.length, 0);
  const response = await f.handle(new Request(query + "&limit=20&beforeCreateSeq=80"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.deepEqual(f.calls, [{ method: "getMessagePage", value: { actorId: "canonical-alice", projectId: "project-a", conversationId: "room-a", limit: 20, beforeCreateSeq: 80 } }]);
});

test("operational failure returns a neutral retryable response without content or exception details", async () => {
  const f = fixture({ throwService: true }); const result = await f.handle(post(input));
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { ok: false, code: "temporarily_unavailable" });
  assert.equal(result.headers.get("vercel-cdn-cache-control"), "no-store");
});
