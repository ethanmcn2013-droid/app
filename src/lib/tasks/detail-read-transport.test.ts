import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { readSubtasks, readTaskResources, readTaskConversation } from "./detail-read-transport";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("Task date roundtrip keeps date, null and absent fields", async () => {
  const calls: Array<{ url: unknown; init: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init: init ?? {} });
    return Response.json({ value: [{ id: "task-1", updatedAt: "2026-10-01T01:02:03.000Z", dueAt: "2026-10-02T00:00:00.000Z", archivedAt: null }] });
  };
  const [row] = await readSubtasks("task-1");
  assert.equal(row.updatedAt.toISOString(), "2026-10-01T01:02:03.000Z");
  assert.equal(row.dueAt?.toISOString(), "2026-10-02T00:00:00.000Z");
  assert.equal(row.archivedAt, null);
  assert.equal(Object.hasOwn(row, "completedAt"), false);
  assert.equal(calls[0]?.url, "/api/tasks/detail-read");
  assert.equal(calls[0]?.init.cache, "no-store");
  assert.equal(calls[0]?.init.credentials, "same-origin");
  assert.deepEqual(JSON.parse(calls[0]?.init.body as string), { section: "subtasks", taskId: "task-1" });
});

test("resource and conversation sections preserve independent values and failures", async () => {
  globalThis.fetch = async (_url, init) => {
    const section = JSON.parse(init?.body as string).section;
    if (section === "resources") return Response.json({ value: [{ id: "res-1", addedAt: 17 }] });
    return Response.json({ value: { ok: false, code: "unauthenticated" } });
  };
  assert.equal((await readTaskResources("task-1"))[0]?.addedAt, 17);
  assert.deepEqual(await readTaskConversation("task-1"), { ok: false, code: "unauthenticated" });
  globalThis.fetch = async () => new Response(null, { status: 500 });
  await assert.rejects(readTaskResources("task-1"), /unavailable/);
});
