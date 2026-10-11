import assert from "node:assert/strict";
import test from "node:test";
import { normalizePingCommand } from "./command";

function placeholderCommand() {
  return { version: "ping.command.v1", commandId: "10000000-0000-4000-8000-000000000001",
    projectId: "synthetic-project", referenceInstant: "2026-10-06T09:00:00.000Z", timeZone: "Europe/Dublin",
    expectedColumnConfig: null, operation: { kind: "create_placeholders", count: 1, effects: {} } };
}

function selectedCommand() {
  return { ...placeholderCommand(), operation: { kind: "edit_selected", taskIds: ["task-b", "task-a"],
    effects: { selfAssignment: "add" }, expected: {
      "task-b": { assignees: ["bob", "alice"] },
      "task-a": { assignees: ["bob"] },
    } } };
}

test("command envelope rejects untrusted actor, finality, extra clauses and fields at every boundary", () => {
  const base = placeholderCommand();
  for (const key of ["actorId", "final", "finished", "deleteProject", "sql", "planHash"]) {
    assert.equal(normalizePingCommand({ ...base, [key]: "untrusted" }).ok, false, `top-level ${key}`);
  }
  for (const key of ["projectId", "taskIds", "effects", "description", "firstSequence"]) {
    assert.equal(normalizePingCommand({ ...base, operation: { ...base.operation, [key]: "untrusted" } }).ok, false, `operation ${key}`);
  }
  assert.equal(normalizePingCommand({ ...base, operation: { ...base.operation,
    effects: { selfAssignment: "add", ownerId: "synthetic-outsider" } } }).ok, false, "effect extra field");
  const selected = selectedCommand();
  assert.equal(normalizePingCommand({ ...selected, operation: { ...selected.operation,
    expected: { ...selected.operation.expected, "task-a": { assignees: ["bob"], revision: 99 } } } }).ok, false,
  "unexpected precondition field");
});

test("command envelope enforces UUID, canonical instant, bounded timezone and literal-title limits", () => {
  const base = placeholderCommand();
  const commandIds = ["not-a-uuid", "10000000-0000-0000-8000-000000000001", "10000000-0000-4000-7000-000000000001"];
  for (const commandId of commandIds) assert.equal(normalizePingCommand({ ...base, commandId }).ok, false, commandId);
  for (const referenceInstant of ["2026-10-06", "2026-10-06T09:00:00+00:00", "not-a-time"]) {
    assert.equal(normalizePingCommand({ ...base, referenceInstant }).ok, false, referenceInstant);
  }
  assert.equal(normalizePingCommand({ ...base, referenceInstant: "2000-01-01T00:00:00.000Z" }).ok, true);
  assert.equal(normalizePingCommand({ ...base, referenceInstant: "2100-12-31T23:59:59.999Z" }).ok, true);
  for (const title of ["", "  ", "bad\u0000title", "bad\nline", "x".repeat(201)]) {
    assert.equal(normalizePingCommand({ ...base, operation: { ...base.operation, title } }).ok, false, JSON.stringify(title));
  }
  const exactLimitTitle = "x".repeat(200);
  const accepted = normalizePingCommand({ ...base, operation: { ...base.operation, title: exactLimitTitle } });
  assert.equal(accepted.ok, true);
  if (accepted.ok && accepted.value.operation.kind === "create_placeholders") assert.equal(accepted.value.operation.title, exactLimitTitle);
});

test("selected command bounds unique targets and requires exactly the touched semantic read set", () => {
  const base = selectedCommand();
  const tenIds = Array.from({ length: 10 }, (_, index) => `task-${index}`);
  const expected = Object.fromEntries(tenIds.map(id => [id, { assignees: ["bob"] }]));
  assert.equal(normalizePingCommand({ ...base, operation: { ...base.operation, taskIds: tenIds, expected } }).ok, true);
  const elevenIds = [...tenIds, "task-10"];
  assert.equal(normalizePingCommand({ ...base, operation: { ...base.operation,
    taskIds: elevenIds, expected: { ...expected, "task-10": { assignees: [] } } } }).ok, false);
  assert.equal(normalizePingCommand({ ...base, operation: { ...base.operation,
    taskIds: ["task-a", "task-a"] } }).ok, false);
  assert.equal(normalizePingCommand({ ...base, operation: { ...base.operation,
    expected: { "task-a": { assignees: ["bob"] } } } }).ok, false);
  const normalized = normalizePingCommand(base);
  assert.equal(normalized.ok, true);
  if (normalized.ok && normalized.value.operation.kind === "edit_selected") {
    assert.deepEqual(normalized.value.operation.taskIds, ["task-a", "task-b"]);
    assert.deepEqual(normalized.value.operation.expected["task-b"].assignees, ["alice", "bob"]);
  }
});
