import assert from "node:assert/strict";
import { test } from "node:test";
import type { Task } from "@/lib/data";
import { decodeTasksResponse, encodeTasksResponse } from "./task-wire";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Prepare a clear plan",
    lane: "doing",
    priority: "p1",
    assignees: ["user_123"],
    due: "2026-10-02",
    parentTaskId: null,
    externalContactName: null,
    externalContactEmail: null,
    cents: null,
    updatedAt: new Date("2026-10-01T12:34:56.789Z"),
    ...overrides,
  };
}

function jsonRoundTrip(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

test("Task[] codec preserves date presence, nullability, recurrence and metadata", () => {
  const sparse = Object.assign(task({
    dueAt: undefined,
    archivedAt: undefined,
    completedAt: null,
    recurrence: { kind: "weekly", weekday: 2 },
    workspaceId: "project-1",
    seq: 14,
    isMilestone: true,
    sourceNoteId: "owner:note-7",
    sourceNoteExtractBody: "The approved wording stays separate.",
  }), { customReceipt: { revision: 3, labels: ["kept", "whole"] } });
  const absent = task({ id: "task-2" });
  const dated = task({
    id: "task-3",
    dueAt: new Date("2026-10-03T09:45:12.345Z"),
    archivedAt: new Date("2026-10-04T00:00:00.000Z"),
    completedAt: new Date("2026-10-05T23:59:59.999Z"),
  });

  const decoded = decodeTasksResponse(jsonRoundTrip(encodeTasksResponse([sparse, absent, dated])));
  assert.equal(decoded.length, 3);
  assert.equal(Object.hasOwn(decoded[0]!, "dueAt"), true);
  assert.equal(decoded[0]!.dueAt, undefined);
  assert.equal(Object.hasOwn(decoded[0]!, "archivedAt"), true);
  assert.equal(decoded[0]!.archivedAt, undefined);
  assert.equal(decoded[0]!.completedAt, null);
  assert.equal(Object.hasOwn(decoded[1]!, "dueAt"), false);
  assert.equal(Object.hasOwn(decoded[1]!, "archivedAt"), false);
  assert.equal(Object.hasOwn(decoded[1]!, "completedAt"), false);
  assert.equal(decoded[2]!.dueAt?.toISOString(), "2026-10-03T09:45:12.345Z");
  assert.equal(decoded[2]!.archivedAt?.toISOString(), "2026-10-04T00:00:00.000Z");
  assert.equal(decoded[2]!.completedAt?.toISOString(), "2026-10-05T23:59:59.999Z");
  assert.equal(decoded[0]!.updatedAt.toISOString(), "2026-10-01T12:34:56.789Z");
  assert.equal(decoded[0]!.due, "2026-10-02");
  assert.deepEqual(decoded[0]!.recurrence, { kind: "weekly", weekday: 2 });
  assert.deepEqual(Reflect.get(decoded[0]!, "customReceipt"), { revision: 3, labels: ["kept", "whole"] });
  assert.equal(decoded[0]!.sourceNoteExtractBody, "The approved wording stays separate.");
});

test("Task[] codec preserves nullable date values through actual JSON", () => {
  const original = task({ archivedAt: null, completedAt: null });
  const [decoded] = decodeTasksResponse(jsonRoundTrip(encodeTasksResponse([original])));
  assert.equal(decoded?.archivedAt, null);
  assert.equal(decoded?.completedAt, null);
});

test("Task[] codec safely preserves an own __proto__ metadata key", () => {
  const original = task();
  Object.defineProperty(original, "__proto__", {
    value: { retained: true },
    enumerable: true,
    configurable: true,
  });
  const [decoded] = decodeTasksResponse(jsonRoundTrip(encodeTasksResponse([original])));
  assert.equal(Object.hasOwn(decoded!, "__proto__"), true);
  assert.deepEqual(Reflect.get(decoded!, "__proto__"), { retained: true });
  assert.equal(Object.getPrototypeOf(decoded), Object.prototype);
});

test("Task[] envelope has an explicit version and has no arbitrary row limit", () => {
  const rows = Array.from({ length: 2_005 }, (_, index) => task({ id: `task-${index}` }));
  const encoded = encodeTasksResponse(rows);
  assert.equal(encoded.version, 1);
  assert.equal(decodeTasksResponse(jsonRoundTrip(encoded)).length, 2_005);
});

test("decoder validates the envelope, required Task fields, recurrence and date tags", () => {
  const valid = jsonRoundTrip(encodeTasksResponse([task()])) as Record<string, unknown>;
  assert.throws(() => decodeTasksResponse(null), /envelope/);
  assert.throws(() => decodeTasksResponse({ version: 2, tasks: [] }), /envelope/);
  assert.throws(() => decodeTasksResponse({ version: 1, tasks: {} }), /envelope/);

  const row = (valid.tasks as unknown[])[0] as Record<string, unknown>;
  const badPayload = structuredClone(valid) as { version: number; tasks: Array<{ data: Record<string, unknown>; dates: Record<string, unknown> }> };
  delete badPayload.tasks[0]!.data.title;
  assert.throws(() => decodeTasksResponse(badPayload), /row/);

  const inheritedPayload = structuredClone(valid) as { version: number; tasks: Array<{ data: Record<string, unknown>; dates: Record<string, unknown> }> };
  delete inheritedPayload.tasks[0]!.data.title;
  Object.setPrototypeOf(inheritedPayload.tasks[0]!.data, { title: "inherited title" });
  assert.throws(() => decodeTasksResponse(inheritedPayload), /row/);

  const arrayLane = structuredClone(valid) as { version: number; tasks: Array<{ data: Record<string, unknown>; dates: Record<string, unknown> }> };
  arrayLane.tasks[0]!.data.lane = ["todo"];
  assert.throws(() => decodeTasksResponse(arrayLane), /row/);

  const arrayPriority = structuredClone(valid) as { version: number; tasks: Array<{ data: Record<string, unknown>; dates: Record<string, unknown> }> };
  arrayPriority.tasks[0]!.data.priority = ["p1"];
  assert.throws(() => decodeTasksResponse(arrayPriority), /row/);

  const badRecurrence = structuredClone(valid) as { version: number; tasks: Array<{ data: Record<string, unknown>; dates: Record<string, unknown> }> };
  badRecurrence.tasks[0]!.data.recurrence = { kind: "weekly", weekday: 7 };
  assert.throws(() => decodeTasksResponse(badRecurrence), /row/);

  const badDueAt = structuredClone(valid) as { version: number; tasks: Array<{ data: Record<string, unknown>; dates: Record<string, unknown> }> };
  badDueAt.tasks[0]!.dates.dueAt = { state: "null" };
  assert.throws(() => decodeTasksResponse(badDueAt), /dueAt/);

  const badUpdatedAt = structuredClone(valid) as { version: number; tasks: Array<{ data: Record<string, unknown>; dates: Record<string, unknown> }> };
  badUpdatedAt.tasks[0]!.dates.updatedAt = { state: "date", value: "not-a-date" };
  assert.throws(() => decodeTasksResponse(badUpdatedAt), /date/);

  const badDateTag = structuredClone(valid) as { version: number; tasks: Array<{ data: Record<string, unknown>; dates: Record<string, unknown> }> };
  badDateTag.tasks[0]!.dates.archivedAt = { state: "null", value: "unexpected" };
  assert.throws(() => decodeTasksResponse(badDateTag), /date state/);
  assert.ok(row);
});

test("encoder rejects invalid or schema-incompatible date inputs", () => {
  assert.throws(() => encodeTasksResponse([task({ updatedAt: new Date("invalid") })]), /updatedAt/);
  assert.throws(() => encodeTasksResponse([task({ dueAt: new Date("invalid") })]), /dueAt/);
  const dueAtNull = task();
  Object.defineProperty(dueAtNull, "dueAt", { value: null, enumerable: true });
  assert.throws(() => encodeTasksResponse([dueAtNull]), /dueAt/);
});
