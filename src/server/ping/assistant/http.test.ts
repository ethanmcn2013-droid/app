import assert from "node:assert/strict";
import test from "node:test";
import { createAssistantHttp, type AssistantHttpService } from "./http";
import { ASSISTANT_VERSION, type AssistantRunView } from "@/lib/ping/assistant/contract";

const run: AssistantRunView = { id: "run_12345678", requestId: "request_123", text: "Create tasks", scope: { kind: "account" }, mode: "execute", status: "completed", steps: [], createdAt: "2026-10-18T00:00:00Z", updatedAt: "2026-10-18T00:00:00Z" };
const command = { operation: "submit", request: { requestId: "request_123", text: "Create tasks", scope: { kind: "account" }, mode: "execute" } };
function fixture(actor: string | null = "actor-a") {
  const calls: unknown[][] = [];
  const called = (method: string) => async (...args: unknown[]) => { calls.push([method, ...args]); return run; };
  const service = { submit: called("submit"), view: called("view"), lookup: called("lookup"), history: async (...args: unknown[]) => { calls.push(["history", ...args]); return [run]; }, resume: called("resume"), apply: called("apply"), cancel: called("cancel") } satisfies AssistantHttpService;
  return { calls, service, http: createAssistantHttp({ authenticate: async () => actor, service: async () => service }) };
}
const post = (value: unknown = command, extra: Record<string, string> = {}) => new Request("http://localhost/api/ping/assistant", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json", ...extra }, body: JSON.stringify(value) });

test("server identity owns every operation and recovery never resubmits", async () => {
  const f = fixture();
  for (const request of [post(), new Request("http://localhost/api/ping/assistant?clientRequestId=request_123"), new Request("http://localhost/api/ping/assistant?runId=run_12345678"), post({ operation: "apply", runId: run.id }), post({ operation: "resume", runId: run.id }), post({ operation: "cancel", runId: run.id })]) {
    const result = await f.http(request); assert.equal(result.status, 200); assert.match(result.headers.get("cache-control")!, /no-store/); assert.equal((await result.json()).version, ASSISTANT_VERSION);
  }
  assert.deepEqual(f.calls.map(c => c.slice(0, 2)), [["submit", "actor-a"], ["lookup", "actor-a"], ["view", "actor-a"], ["apply", "actor-a"], ["resume", "actor-a"], ["cancel", "actor-a"]]);
});

test("foreign origins, malformed input and unauthenticated calls never execute", async () => {
  const f = fixture();
  for (const request of [post(command, { origin: "https://foreign.example" }), post({ ...command, actorId: "other" }), post(command, { "content-encoding": "gzip" }), post(command, { "content-length": "80000" }), new Request("http://localhost/api/ping/assistant?runId=run_12345678&clientRequestId=request_123"), new Request("http://localhost/api/ping/assistant?runId=short"), new Request("http://localhost/api/ping/assistant?runId=run_12345678&runId=run_87654321")]) assert.equal((await f.http(request)).ok, false);
  assert.equal(f.calls.length, 0);
  const denied = fixture(null); assert.equal((await denied.http(post())).status, 401); assert.equal(denied.calls.length, 0);
});

test("disabled service is distinct from missing original request", async () => {
  const disabled = createAssistantHttp({ authenticate: async () => "actor", service: async () => null });
  assert.deepEqual(await (await disabled(post())).json(), { version: ASSISTANT_VERSION, ok: true, available: false });
  const f = fixture(); f.service.lookup = async () => null as never;
  assert.deepEqual(await (await f.http(new Request("http://localhost/api/ping/assistant?clientRequestId=request_123"))).json(), { version: ASSISTANT_VERSION, ok: true, available: true });
});

test("unexpected errors redact secrets and advise original-result check", async () => {
  const f = fixture(); f.service.submit = async () => { throw new Error("sk-private credential and raw prompt"); };
  const result = await f.http(post()); assert.equal(result.status, 503); const body = await result.text(); assert.doesNotMatch(body, /sk-private|raw prompt/); assert.match(body, /original request/);
  f.service.submit = async () => { throw { code: "request_conflict" }; };
  assert.equal((await f.http(post())).status, 409);
});
