import assert from "node:assert/strict";
import test from "node:test";
import { normalizePingCommand, pingProofDueAtSeconds, validPingCalendarDate } from "./command";

const command = () => ({ version: "ping.command.v1", commandId: "00000000-0000-4000-8000-000000000001",
  projectId: "synthetic-project", referenceInstant: "2026-10-06T09:00:00.000Z", timeZone: "Europe/Dublin",
  expectedColumnConfig: null, operation: { kind: "create_placeholders", count: 1, effects: {} } });

test("unnamed placeholders use the canonical literal title; bounds are not clamped", () => {
  const result = normalizePingCommand(command());
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value.operation, { kind: "create_placeholders", count: 1,
    title: "Untitled task", effects: {} });
  for (const count of [0, 11, 1.5, NaN, Infinity, "1"]) {
    const input = command(); Object.assign(input.operation, { count });
    assert.equal(normalizePingCommand(input).ok, false);
  }
  const maximum = command(); maximum.operation.count = 10;
  assert.equal(normalizePingCommand(maximum).ok, true);
});

test("literal supplied text is preserved without template expansion; blank names reject", () => {
  const input = command(); Object.assign(input.operation, { title: "Follow up {n}" });
  const result = normalizePingCommand(input);
  assert.equal(result.ok, true);
  if (result.ok && result.value.operation.kind === "create_placeholders") {
    assert.equal(result.value.operation.title, "Follow up {n}");
  }
  for (const title of ["", "   ", "bad\nname", "a".repeat(201), undefined]) {
    Object.assign(input.operation, { title });
    assert.equal(normalizePingCommand(input).ok, false);
  }
});

test("model actor, finality, sequence and arbitrary clauses are forbidden", () => {
  for (const key of ["actorId", "final", "sql", "publish", "delete", "planHash"]) {
    assert.equal(normalizePingCommand({ ...command(), [key]: "extra" }).ok, false);
  }
  for (const key of ["firstSequence", "descriptions", "assigneeId", "extraOperation"]) {
    const input = command(); Object.assign(input.operation, { [key]: "extra" });
    assert.equal(normalizePingCommand(input).ok, false);
  }
});

test("dates validate real calendar days and retain a Dublin Hybrid projection across DST", () => {
  for (const invalid of ["2026-02-30", "2025-02-29", "20 October 2026", "2026-1-01", "1900-01-01"]) {
    assert.equal(validPingCalendarDate(invalid), false);
  }
  const format = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit" });
  for (const date of ["2024-02-29", "2026-03-29", "2026-10-25", "2026-12-31"]) {
    assert.equal(validPingCalendarDate(date), true);
    const instant = new Date(pingProofDueAtSeconds(date)! * 1000);
    assert.equal(format.format(instant), date);
  }
  assert.equal(pingProofDueAtSeconds(null), null);
  assert.throws(() => pingProofDueAtSeconds("2026-02-30"), /invalid_ping_date/);
});

test("non-proof timezone, invalid context and non-canonical identities reject", () => {
  for (const patch of [{ timeZone: "America/New_York" }, { referenceInstant: "2026-10-06" },
    { commandId: "same-id" }, { projectId: "https://foreign" }, { version: "ping.command.v2" },
    { expectedColumnConfig: undefined }]) {
    assert.equal(normalizePingCommand({ ...command(), ...patch }).ok, false);
  }
});

test("selected compound requires exact semantic read set and normalizes stable IDs/assignee sets", () => {
  const input = { ...command(), operation: { kind: "edit_selected", taskIds: ["task-b", "task-a"],
    effects: { selfAssignment: "add", dueDate: "2026-10-20", statusColumnKey: "review" },
    expected: {
      "task-b": { assignees: ["bob", "alice"], due: null, dueAtSeconds: null, startDay: null, durationDays: null,
        lane: "doing", boardColumnKey: null, completedAtSeconds: null },
      "task-a": { assignees: ["bob"], due: null, dueAtSeconds: null, startDay: null, durationDays: null,
        lane: "todo", boardColumnKey: null, completedAtSeconds: null },
    } } };
  const result = normalizePingCommand(input);
  assert.equal(result.ok, true);
  if (!result.ok || result.value.operation.kind !== "edit_selected") return;
  assert.deepEqual(result.value.operation.taskIds, ["task-a", "task-b"]);
  assert.deepEqual(result.value.operation.expected["task-b"].assignees, ["alice", "bob"]);
  const missingDue = structuredClone(input); delete (missingDue.operation.expected["task-a"] as Partial<typeof input.operation.expected["task-a"]>).dueAtSeconds;
  assert.equal(normalizePingCommand(missingDue).ok, false);
  const duplicate = structuredClone(input); duplicate.operation.taskIds = ["task-a", "task-a"];
  assert.equal(normalizePingCommand(duplicate).ok, false);
  const arbitraryActor = structuredClone(input); Object.assign(arbitraryActor.operation.effects, { assigneeId: "mallory" });
  assert.equal(normalizePingCommand(arbitraryActor).ok, false);
  const missingTarget = structuredClone(input); missingTarget.operation.taskIds = ["task-a", "missing"];
  assert.equal(normalizePingCommand(missingTarget).ok, false);
});

test("unsupported custom columns and contradictory self removal on creation reject", () => {
  const input = command(); Object.assign(input.operation.effects, { statusColumnKey: "custom-paid" });
  assert.equal(normalizePingCommand(input).ok, false);
  input.operation.effects = { selfAssignment: "remove" } as never;
  assert.equal(normalizePingCommand(input).ok, false);
});
