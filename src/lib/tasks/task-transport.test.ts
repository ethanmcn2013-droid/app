import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Task } from "@/lib/data";
import { encodeTasksResponse } from "./task-wire";
import {
  createTask,
  editTask,
  readTaskSnapshot,
  TaskMutationOutcomeUnknownError,
  TaskMutationRefusedError,
  TaskMutationRequestRejectedError,
  TaskSnapshotUnavailableError,
  toggleTaskComplete,
} from "./task-transport";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function task(): Task {
  return {
    id: "task-1", title: "Task", lane: "todo", priority: "p1", assignees: [],
    parentTaskId: null, externalContactName: null, externalContactEmail: null, cents: null,
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  };
}

function success(projectId: string, status: "snapshot" | "applied" = "applied") {
  return Response.json({ ...encodeTasksResponse([task()]), status, scopeProjectId: projectId });
}

test("transport sends same-origin requests and revives versioned task dates", async () => {
  const calls: Array<{ url: unknown; init: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init: init ?? {} });
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    return success(body.projectId as string, body.operation === "snapshot" ? "snapshot" : "applied");
  };

  const row = task();
  const createRows = await createTask({ title: "New", dueAt: new Date("2026-10-02T00:00:00.000Z") }, "project-a");
  assert.equal(createRows[0]?.updatedAt instanceof Date, true);
  const createBody = JSON.parse(calls[0]!.init.body as string);
  assert.equal(createBody.input.dueAt, "2026-10-02T00:00:00.000Z");

  const patch = { title: undefined, dueAt: new Date("2026-10-03T00:00:00.000Z") };
  await editTask("task-1", patch, "project-a");
  const editBody = JSON.parse(calls[1]!.init.body as string);
  assert.deepEqual(editBody.patchKeys, ["title", "dueAt"]);
  assert.deepEqual(editBody.patch, { dueAt: "2026-10-03T00:00:00.000Z" });

  await editTask("task-1", { dueAt: null, startDay: null, durationDays: null }, "project-a");
  const clearBody = JSON.parse(calls[2]!.init.body as string);
  assert.deepEqual(clearBody.patchKeys, ["dueAt", "startDay", "durationDays"]);
  assert.deepEqual(clearBody.patch, { dueAt: null, startDay: null, durationDays: null });

  await toggleTaskComplete("task-1", "project-a");
  const snapshot = await readTaskSnapshot("project-a");
  assert.equal(snapshot.length, 1);
  assert.equal(calls[3]!.url, "/api/tasks/mutate");
  for (const { init } of calls) {
    assert.equal(init.method, "POST");
    assert.equal(init.credentials, "same-origin");
    assert.equal(init.cache, "no-store");
    assert.equal(init.redirect, "error");
  }
  assert.ok(row);
});

test("scope mismatch and malformed success never hydrate mutation state", async () => {
  globalThis.fetch = async () => Response.json({ ...encodeTasksResponse([task()]), status: "applied", scopeProjectId: "other-project" });
  await assert.rejects(editTask("task-1", { title: "changed" }, "project-a"), TaskMutationOutcomeUnknownError);
  globalThis.fetch = async () => Response.json({ version: 1, status: "applied", scopeProjectId: "project-a", tasks: {} });
  await assert.rejects(toggleTaskComplete("task-1", "project-a"), TaskMutationOutcomeUnknownError);
});

test("refusal, pre-dispatch rejection and uncertain mutation failure stay distinct without retries", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ version: 1, error: "mutation_refused" }, { status: 409 }); };
  await assert.rejects(toggleTaskComplete("task-1", "project-a"), TaskMutationRefusedError);
  assert.equal(calls, 1);

  globalThis.fetch = async () => { calls++; return Response.json({ version: 1, error: "request_rejected" }, { status: 403 }); };
  await assert.rejects(toggleTaskComplete("task-1", "project-a"), TaskMutationRequestRejectedError);
  assert.equal(calls, 2);

  globalThis.fetch = async () => { calls++; return new Response(null, { status: 500 }); };
  await assert.rejects(toggleTaskComplete("task-1", "project-a"), TaskMutationOutcomeUnknownError);
  assert.equal(calls, 3);

  globalThis.fetch = async () => { calls++; throw new TypeError("network failure"); };
  await assert.rejects(toggleTaskComplete("task-1", "project-a"), TaskMutationOutcomeUnknownError);
  assert.equal(calls, 4);
});

test("bare or malformed HTTP error responses never establish refusal or safe rejection", async () => {
  let calls = 0;
  const responses = [
    new Response(null, { status: 409 }),
    Response.json({ version: 2, error: "mutation_refused" }, { status: 409 }),
    Response.json({ version: 1, error: "mutation_refused", detail: "extra" }, { status: 409 }),
    new Response(JSON.stringify({ version: 1, error: "mutation_refused" }), { status: 409, headers: { "content-type": "text/plain" } }),
    new Response(null, { status: 403 }),
    Response.json({ version: 2, error: "request_rejected" }, { status: 403 }),
  ];
  globalThis.fetch = async () => { calls++; return responses.shift()!; };
  for (let index = 0; index < 6; index++) {
    await assert.rejects(toggleTaskComplete("task-1", "project-a"), TaskMutationOutcomeUnknownError);
  }
  assert.equal(calls, 6);
});

test("successful responses must be JSON before task data is hydrated", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ ...encodeTasksResponse([task()]), status: "applied", scopeProjectId: "project-a" }), {
    headers: { "content-type": "text/plain" },
  });
  await assert.rejects(toggleTaskComplete("task-1", "project-a"), TaskMutationOutcomeUnknownError);
});

test("invalid local identifiers are rejected before fetch", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return success("project-a"); };
  await assert.rejects(readTaskSnapshot(""), TaskMutationRequestRejectedError);
  await assert.rejects(toggleTaskComplete("", "project-a"), TaskMutationRequestRejectedError);
  assert.equal(calls, 0);
});

test("snapshot transport failures stay separate from mutation ambiguity", async () => {
  globalThis.fetch = async () => { throw new TypeError("network failure"); };
  await assert.rejects(readTaskSnapshot("project-a"), TaskSnapshotUnavailableError);
});
