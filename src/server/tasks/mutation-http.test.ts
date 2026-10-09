import assert from "node:assert/strict";
import { test } from "node:test";
import type { Task } from "@/lib/data";
import { createTaskMutationHttp } from "./mutation-http";

const origin = "https://signal.example";

function task(): Task {
  return {
    id: "task-1", title: "Task", lane: "todo", priority: "p1", assignees: [],
    parentTaskId: null, externalContactName: null, externalContactEmail: null, cents: null,
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  };
}

function request(body: unknown, headers: Record<string, string> = {}, url = `${origin}/api/tasks/mutate`) {
  return new Request(url, {
    method: "POST",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function streamedRequest(chunks: Uint8Array[]) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Request(`${origin}/api/tasks/mutate`, {
    method: "POST",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit);
}

test("snapshot and confirmed mutations dispatch only to their existing actions", async () => {
  const calls: unknown[][] = [];
  const row = task();
  const handle = createTaskMutationHttp({
    read: async (projectId) => { calls.push(["read", projectId]); return [row]; },
    create: async (input, expected) => { calls.push(["create", input, expected]); return [row]; },
    edit: async (id, patch, expected) => { calls.push(["edit", id, patch, expected]); return [row]; },
    toggleComplete: async (id, expected) => { calls.push(["toggle", id, expected]); return [row]; },
  }, () => false);

  const snapshot = await handle(request({ version: 1, operation: "snapshot", projectId: "project-a" }));
  assert.equal(snapshot.status, 200);
  const snapshotBody = await snapshot.json() as Record<string, unknown>;
  assert.equal(snapshotBody.status, "snapshot");
  assert.equal(snapshotBody.scopeProjectId, "project-a");
  assert.equal(snapshot.headers.get("cache-control"), "private, no-store, max-age=0");

  const create = await handle(request({
    version: 1, operation: "create", projectId: "project-a",
    input: { title: "New", dueAt: "2026-10-02T03:04:05.000Z" },
  }));
  assert.equal(create.status, 200);
  assert.equal((calls[1]![1] as { dueAt: Date }).dueAt.toISOString(), "2026-10-02T03:04:05.000Z");
  assert.equal(calls[1]![2], "project-a");

  const edit = await handle(request({
    version: 1, operation: "edit", projectId: "project-a", id: "task-1",
    patchKeys: ["title", "dueAt"], patch: { title: "Changed", dueAt: "2026-10-03T00:00:00.000Z" },
  }));
  assert.equal(edit.status, 200);
  const editPatch = calls[2]![2] as Record<string, unknown>;
  assert.equal(editPatch.title, "Changed");
  assert.equal(editPatch.dueAt instanceof Date, true);
  assert.equal(Object.hasOwn(editPatch, "dueAt"), true);

  const undefinedEdit = await handle(request({
    version: 1, operation: "edit", projectId: "project-a", id: "task-1",
    patchKeys: ["title"], patch: {},
  }));
  assert.equal(undefinedEdit.status, 200);
  assert.equal(Object.hasOwn(calls[3]![2] as object, "title"), true);
  assert.equal((calls[3]![2] as Record<string, unknown>).title, undefined);

  const cleared = await handle(request({
    version: 1, operation: "edit", projectId: "project-a", id: "task-1",
    patchKeys: ["dueAt", "startDay", "durationDays"], patch: { dueAt: null, startDay: null, durationDays: null },
  }));
  assert.equal(cleared.status, 200);
  assert.deepEqual({ ...(calls[4]![2] as Record<string, unknown>) }, { dueAt: null, startDay: null, durationDays: null });

  assert.equal((await handle(request({ version: 1, operation: "toggleComplete", projectId: "project-a", id: "task-1" }))).status, 200);
  assert.deepEqual(calls.map(([name]) => name), ["read", "create", "edit", "edit", "edit", "toggle"]);
  assert.equal(calls[5]![2], "project-a");
});

test("strict request and same-origin gates run before every action", async () => {
  let calls = 0;
  const noop = async () => { calls++; return [task()]; };
  const handle = createTaskMutationHttp({
    read: noop,
    create: noop,
    edit: noop,
    toggleComplete: noop,
  }, () => false);
  const valid = { version: 1, operation: "snapshot", projectId: "project-a" };
  const cases = [
    request(valid, { origin: "https://evil.example" }),
    request(valid, { "sec-fetch-site": "cross-site" }),
    request({ ...valid, actorId: "forged" }),
    request({ ...valid, version: 2 }),
    request({ version: 1, operation: "create", projectId: "project-a", input: { title: "x", workspaceId: "forged" } }),
    request({ version: 1, operation: "edit", projectId: "project-a", id: "t", patchKeys: ["parentTaskId"], patch: {} }),
    request({ version: 1, operation: "edit", projectId: "project-a", id: "t", patchKeys: ["title"], patch: { title: null } }),
    request(valid, { "content-type": "text/plain" }),
    request(valid, {}, `${origin}/api/tasks/mutate?actor=forged`),
    request(valid, { "content-length": "1048577" }),
  ];
  for (const input of cases) assert.notEqual((await handle(input)).status, 200);
  assert.equal(calls, 0);
});

test("streamed body cap accepts the exact limit and rejects oversize or invalid UTF-8 before dispatch", async () => {
  const payload = JSON.stringify({ version: 1, operation: "snapshot", projectId: "project-a" });
  const encoded = new TextEncoder().encode(payload);
  const exactLimit = new Uint8Array(1_048_576);
  exactLimit.set(encoded);
  exactLimit.fill(0x20, encoded.byteLength);
  let calls = 0;
  const handle = createTaskMutationHttp({
    read: async () => { calls++; return []; },
    create: async () => { calls++; return []; },
    edit: async () => { calls++; return []; },
    toggleComplete: async () => { calls++; return []; },
  }, () => false);

  const exact = await handle(streamedRequest([exactLimit.subarray(0, 123), exactLimit.subarray(123)]));
  assert.equal(exact.status, 200);
  assert.equal(calls, 1);

  const oversized = new Uint8Array(1_048_577);
  oversized.set(encoded);
  oversized.fill(0x20, encoded.byteLength);
  const tooLarge = await handle(streamedRequest([oversized.subarray(0, 500_000), oversized.subarray(500_000)]));
  assert.equal(tooLarge.status, 413);
  assert.equal(calls, 1);

  const invalidUtf8 = await handle(streamedRequest([new Uint8Array([0xc3, 0x28])]));
  assert.equal(invalidUtf8.status, 400);
  assert.equal(calls, 1);
});

test("known refusal is distinct from unknown action failure and neither is retried", async () => {
  let dispatches = 0;
  const known = new Error("private details");
  const handle = createTaskMutationHttp({
    read: async () => [],
    create: async () => { dispatches++; throw known; },
    edit: async () => { dispatches++; throw known; },
    toggleComplete: async () => { dispatches++; throw known; },
  }, (error) => error === known);
  const body = { version: 1, operation: "toggleComplete", projectId: "project-a", id: "task-1" };
  const refused = await handle(request(body));
  assert.equal(refused.status, 409);
  assert.deepEqual(await refused.json(), { version: 1, error: "mutation_refused" });
  assert.equal(await refused.text().catch(() => "already consumed"), "already consumed");
  assert.equal(dispatches, 1);

  const uncertain = createTaskMutationHttp({
    read: async () => [],
    create: async () => { dispatches++; throw new Error("private details"); },
    edit: async () => { dispatches++; throw new Error("private details"); },
    toggleComplete: async () => { dispatches++; throw new Error("private details"); },
  }, () => false);
  const failed = await uncertain(request(body));
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { version: 1, error: "outcome_unknown" });
  assert.equal(dispatches, 2);
});
