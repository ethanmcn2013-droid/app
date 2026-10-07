import { strict as assert } from "node:assert";
import { test } from "node:test";
import { contextObservations } from "./context-observations";
import type { TaskSignal } from "./types";

const NOW = Date.parse("2026-10-07T12:00:00Z");
const task = (patch: Partial<TaskSignal> = {}): TaskSignal => ({
  id: "visible", title: "Inspect the venue", lane: "next", priority: null, dueAt: null,
  idleDays: null, commentCount: 0, blockedBy: [], sourceLabel: "Tasks · Launch",
  movedToShippedAt: null, workspaceId: "owned", activityCoverage: "complete", ...patch,
});
const read = (signals: TaskSignal[]) => contextObservations(signals, NOW, "Europe/Dublin");

test("saved title and comment occurrences select newest deterministically; metadata is no progress", () => {
  const edited = task({ latestValidatedTitleEdit: { at: "2020-01-01T12:00:00Z", kind: "update", field: "title" },
    latestValidatedComment: { at: "2020-01-02T12:00:00Z", kind: "commentAdd" } });
  const metadata = task({ id: "metadata", latestValidatedMetadataEdit: { at: "2026-10-06T12:00:00Z", field: "tags" } });
  const result = read([edited, metadata]);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.detailOverride, "Comment added on 2 January 2020 at 12:00:00 (Europe/Dublin).");
  assert.deepEqual(read([metadata, edited]), result);
  assert.ok(result.coverageNotes.some(note => note.includes("Tags edited") && note.includes("13:00:00 (Europe/Dublin)") && note.includes("does not establish progress")));
  assert.equal(read([{ ...edited, latestValidatedComment: undefined }]).candidates[0]?.detailOverride, "Title edited on 1 January 2020 at 12:00:00 (Europe/Dublin).");
});

test("future, pre-epoch and malformed saved occurrences cannot surface", () => {
  for (const at of ["2027-01-01T12:00:00Z", "1969-01-01T12:00:00Z", "broken", "2026-02-30T12:00:00Z", "2026-10-01T12:00:00", "2026-10-01T24:00:00Z", "2026-10-01T12:60:00Z"]) {
    assert.deepEqual(read([task({ latestValidatedComment: { at, kind: "commentAdd" } })]).candidates, []);
  }
});

test("complete project inventory counts every open phase including unknown and excludes terminal", () => {
  const signals = [task({ taskCoverage: "complete" }), task({ id: "unknown", taskCoverage: "complete", lane: "shipped",
    stage: { key: "custom", label: "Custom", phase: "unknown", complete: false } }),
  task({ id: "done", taskCoverage: "complete", stage: { key: "done", label: "Done", phase: "shipped", complete: true } })];
  const result = read(signals);
  assert.deepEqual(result.candidates, []);
  assert.deepEqual(result.coverageNotes, ["2 tasks are currently open in this project (Tasks · Launch)."]);
  assert.ok(result.coverageNotes.every(note => !/unknown|visible|owned|done/.test(note)));
  const joined = read([...signals, task({ id: "garden", workspaceId: "garden-workspace", sourceLabel: "Tasks · Garden", taskCoverage: "complete" })]);
  assert.deepEqual(joined.candidates, []);
  assert.deepEqual(joined.coverageNotes, ["1 task is currently open in this project (Tasks · Garden).", "2 tasks are currently open in this project (Tasks · Launch)."]);
});

test("partial or omitted exact workspace coverage refuses summary without poisoning another workspace", () => {
  for (const taskCoverage of ["partial", undefined] as const) {
    const result = read([task({ taskCoverage: "complete" }), task({ id: "partial", taskCoverage }),
      task({ id: "other", workspaceId: "other", sourceLabel: "Tasks · Garden", taskCoverage: "complete" })]);
    assert.deepEqual(result.candidates, []);
    assert.deepEqual(result.coverageNotes, ["1 task is currently open in this project (Tasks · Garden)."]);
  }
});

test("deadline and history notes distinguish absent, unknown and earliest inspected evidence", () => {
  const result = read([task({ deadline: null, activityCoverage: "partial", activityHistoryStartAt: "2026-10-01T12:00:00Z" }),
    task({ id: "omitted", title: "Omitted date", activityCoverage: undefined }),
    task({ id: "closed", title: "Closed task", deadline: null, lane: "shipped" }),
    task({ id: "unknown", title: "Unknown date", deadline: { kind: "unknown" }, activityCoverage: "partial", hasRecordedTitleEdit: true }),
    task({ id: "malformed", title: "Malformed date", deadline: { kind: "date-only", date: "2026-02-30" } })]);
  assert.ok(result.coverageNotes.some(note => note.includes("has no saved date")));
  assert.ok(result.coverageNotes.every(note => !note.includes("Closed task")));
  assert.ok(result.coverageNotes.every(note => !note.includes("Omitted date")));
  assert.equal(result.coverageNotes.filter(note => note.includes("could not be established")).length, 2);
  assert.ok(result.coverageNotes.some(note => note.includes("earliest available inspected activity record") && note.includes("1 October 2026")));
  assert.ok(result.coverageNotes.some(note => note.includes("history for “Unknown date” is partial")));
  assert.ok(result.coverageNotes.some(note => note.startsWith("Activity history is incomplete.")));
  assert.ok(result.coverageNotes.some(note => note.includes("A recorded title edit does not establish meaningful work progress")));
  assert.deepEqual(result.candidates, []);
  assert.ok(result.coverageNotes.every(note => !/retention|inactive|no activity|owned/.test(note)));
});
