import assert from "node:assert/strict";
import test from "node:test";
import { createMessageAttentionHttp } from "./attention-http";
import type { createMessageAttentionService } from "./attention";

type Service = ReturnType<typeof createMessageAttentionService>;
const endpoint = "https://app.example.test/api/message-attention";
function fixture(options: { actor?: string | null; throwService?: boolean } = {}) {
  const calls: { action: string; input: unknown }[] = [];
  const service = Object.fromEntries(["listDirected", "readStatus", "observe", "markAllObserved"].map(action => [action, async (input: unknown) => {
    calls.push({ action, input });
    if (options.throwService) throw new Error("private SQL body and bearer token");
    return { ok: true, value: action === "listDirected" ? [] : { observedItems: 1 } };
  }])) as unknown as Service;
  const http = createMessageAttentionHttp({
    authenticate: async () => options.actor === undefined ? "canonical_actor" : options.actor,
    service: async () => service,
  });
  const post = (body: unknown, headers: Record<string, string> = {}) => http.POST(new Request(endpoint, {
    method: "POST", headers: { origin: "https://app.example.test", "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
  return { ...http, post, calls };
}

test("attention HTTP refuses missing identity, cross-origin writes and forged fields before the service", async () => {
  const anonymous = fixture({ actor: null });
  assert.equal((await anonymous.post({ action: "mark-all" })).status, 401);
  assert.equal(anonymous.calls.length, 0);
  const f = fixture();
  assert.equal((await f.post({ action: "mark-all" }, { origin: "https://foreign.example.test" })).status, 404);
  assert.equal((await f.post({ action: "observe", actorId: "foreign", items: [] })).status, 400);
  assert.equal((await f.post({ action: "mark-all", actorId: "foreign" })).status, 400);
  assert.equal(f.calls.length, 0);
});

test("attention HTTP passes only the canonical actor and bounded items with private no-store responses", async () => {
  const f = fixture();
  const items = [{ kind: "conversation", scopeId: "room", itemId: "message" }];
  const response = await f.post({ action: "observe", items });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /private, no-store/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.deepEqual(f.calls, [{ action: "observe", input: { actorId: "canonical_actor", items } }]);
  const status = await f.post({ action: "status", items });
  assert.equal(status.status, 200);
  assert.deepEqual(f.calls[1], { action: "readStatus", input: { actorId: "canonical_actor", items } });
  const list = await f.GET(new Request(`${endpoint}?action=list&limit=5`));
  assert.equal(list.status, 200);
  assert.deepEqual(f.calls[2], { action: "listDirected", input: { actorId: "canonical_actor", limit: 5 } });
});

test("attention HTTP neutralizes provider errors and oversized content without returning private text", async () => {
  const f = fixture({ throwService: true });
  for (const response of [await f.post({ action: "mark-all" }), await f.GET(new Request(`${endpoint}?action=list`))]) {
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, code: "temporarily_unavailable" });
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  }
  const calls = f.calls.length;
  const oversized = await f.post({ action: "observe", items: [], payload: "x".repeat(48_001) });
  assert.equal(oversized.status, 400);
  assert.equal(f.calls.length, calls);
});
