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

test("prospective completion digest preserves distinct durable times without suggestion rows", () => {
  const completed = task({ id: "closed", title: "Closed work", lane: "shipped", movedToShippedAt: NOW - 3600000 });
  const result = read([completed, completed, task({ id: "future", lane: "shipped", movedToShippedAt: NOW + 1 }),
    task({ id: "open", movedToShippedAt: NOW - 1000 }), task({ id: "old", lane: "shipped", movedToShippedAt: NOW - 86400001 })]);
  const digest = result.coverageNotes.filter(note => note.includes("past 24 hours"));
  assert.equal(digest.length, 1);
  assert.match(digest[0]!, /1 task.*Closed work.*2026-10-07T11:00:00.000Z/);
  assert.doesNotMatch(digest[0]!, /future|old|progress|all complete|today/);
  assert.equal(result.candidates.length, 0);
});

test("prospective completion digest respects reason and wildcard dismissal", () => {
  const completed = task({ lane: "shipped", movedToShippedAt: NOW - 1000 });
  for (const key of ["just-shipped:visible", "*:visible"]) {
    const result = contextObservations([completed], NOW, "UTC", { suppressed: new Set([key]) });
    assert.ok(!result.coverageNotes.some(note => note.includes("past 24 hours")));
  }
  const other = task({ id: "other", title: "Other completion", lane: "shipped", movedToShippedAt: NOW - 2000, taskCoverage: "partial" });
  const subset = contextObservations([completed, other], NOW, "UTC", { suppressed: new Set(["just-shipped:visible"]) });
  const digest = subset.coverageNotes.find(note => note.includes("past 24 hours"))!;
  assert.match(digest, /1 task.*Other completion.*included in this read/);
  assert.doesNotMatch(digest, /Inspect the venue|all tasks|complete project/);
});

test("durable canonical state and inclusive completion window win over stale lane and timestamps", () => {
  const inputs = [task({ id: "boundary", title: "Boundary completion", lane: "next", movedToShippedAt: NOW - 86400000,
    stage: { key: "custom", label: "Custom", phase: "shipped", complete: true } }),
    task({ id: "reopened", lane: "shipped", movedToShippedAt: NOW - 1000,
      stage: { key: "active", label: "Active", phase: "next", complete: false } }),
    task({ id: "invalid", lane: "shipped", movedToShippedAt: NaN })];
  const note = read(inputs).coverageNotes.find(note => note.includes("past 24 hours"))!;
  assert.match(note, /1 task.*Boundary completion.*6 October 2026.*Europe\/Dublin.*2026-10-06T12:00:00.000Z/);
  assert.doesNotMatch(note, /reopened|invalid/);
});

test("prospective prerequisite uncertainty is task-bound and co-locates incomplete history", () => {
  const dependent = task({ blockedBy: ["restricted"], dependencyCoverage: "partial", activityCoverage: "partial" });
  const result = read([dependent]);
  const note = result.coverageNotes.find(note => note.includes("prerequisites could not be fully verified"));
  assert.ok(note);
  assert.match(note, /Inspect the venue.*unverified.*state is unknown.*Activity history.*incomplete/);
  assert.doesNotMatch(note, /restricted|is blocked|are complete/);
});

test("readiness limitation uses only the open dependent's own partial dependency read", () => {
  const dependent = task({ id: "dependent", title: "Prepare the room", dependencyCoverage: "partial", blockedBy: ["unavailable"] });
  const result = read([dependent]);
  assert.ok(result.coverageNotes.includes("Readiness for “Prepare the room” could not be fully verified from its listed prerequisites."));
  assert.ok(result.coverageNotes.some(note => note.startsWith("Inspected listed prerequisite state for “Prepare the room”")), "the original complete relation note remains");
  assert.deepEqual(result.candidates, []);
  for (const dependencyCoverage of ["complete", undefined] as const) {
    assert.ok(!read([{ ...dependent, dependencyCoverage }]).coverageNotes.some(note => note.startsWith("Readiness for")));
  }
  for (const dependencyCoverage of ["unknown", "unavailable", null]) {
    assert.ok(!read([{ ...dependent, dependencyCoverage: dependencyCoverage as TaskSignal["dependencyCoverage"] }]).coverageNotes.some(note => note.startsWith("Readiness for")), "only the explicitly captured partial value is sufficient");
  }
  const sibling = task({ id: "sibling", title: "Other work", dependencyCoverage: "partial" });
  const notes = read([{ ...dependent, dependencyCoverage: "complete" }, sibling]).coverageNotes;
  assert.ok(!notes.some(note => note.startsWith("Readiness for “Prepare the room”")));
  assert.ok(notes.some(note => note.startsWith("Readiness for “Other work”")));
  assert.ok(!read([{ ...dependent, stage: { key: "done", label: "Done", phase: "shipped", complete: true } }]).coverageNotes.some(note => note.startsWith("Readiness for")));
});

test("readiness limitation retains reason/wildcard dismissal and never names foreign endpoints", () => {
  const dependent = task({ dependencyCoverage: "partial", blockedBy: ["private-endpoint"] });
  const foreign = task({ id: "private-endpoint", title: "Private work", workspaceId: "foreign", lane: "shipped" });
  const result = read([dependent, foreign]);
  const ownNote = result.coverageNotes.find(note => note.startsWith("Readiness for"))!;
  assert.equal(ownNote, "Readiness for “Inspect the venue” could not be fully verified from its listed prerequisites.");
  assert.doesNotMatch(ownNote, /private-endpoint|Private work|foreign|complete|all|unknown/);
  for (const key of ["prerequisites-unverified:visible", "*:visible"]) {
    assert.ok(!contextObservations([dependent], NOW, "UTC", { suppressed: new Set([key]) }).coverageNotes.some(note => note.startsWith("Readiness for")));
  }
  assert.ok(contextObservations([dependent], NOW, "UTC", { suppressed: new Set(["idle:visible"]) }).coverageNotes.some(note => note.startsWith("Readiness for")));
});

test("identical readiness text remains deduplicated without an invented public identity", () => {
  const first = task({ id: "first", dependencyCoverage: "partial" });
  const second = task({ id: "second", dependencyCoverage: "partial" });
  const result = read([second, first, first]);
  assert.equal(result.coverageNotes.filter(note => note.startsWith("Readiness for")).length, 1);
  assert.deepEqual(result, read([first, second]));
});

test("prospective neutral inventory names complete members and canonical assignee count", () => {
  const signals = [task({ taskCoverage: "complete", assignees: [{ id: "canonical-reader" }] }),
    task({ id: "second", title: "Other work", taskCoverage: "complete", assignees: [] })];
  const result = contextObservations(signals, NOW, "UTC", { canonicalUserId: "canonical-reader" });
  assert.equal(result.candidates.length, 0);
  assert.ok(result.coverageNotes.some(note => /2 tasks.*currently open/.test(note) && note.includes("Inspect the venue") && note.includes("Other work")));
  assert.ok(result.coverageNotes.some(note => /1.*assigned to you.*Inspect the venue/.test(note)));
  const unknown = contextObservations(signals, NOW, "UTC");
  assert.ok(!unknown.coverageNotes.some(note => note.includes("assigned to you")));
  const incomplete = contextObservations([{ ...signals[0]!, assignees: undefined }, signals[1]!], NOW, "UTC", { canonicalUserId: "canonical-reader" });
  assert.ok(!incomplete.coverageNotes.some(note => note.includes("assigned to you")));
  const deduplicated = contextObservations([signals[0]!, signals[0]!, signals[1]!], NOW, "UTC", { canonicalUserId: "canonical-reader" });
  assert.deepEqual(deduplicated, result);
});

test("saved title and comment occurrences select newest deterministically; metadata is no progress", () => {
  const edited = task({ latestValidatedTitleEdit: { at: "2020-01-01T12:00:00Z", kind: "update", field: "title" },
    latestValidatedComment: { at: "2020-01-02T12:00:00Z", kind: "commentAdd" } });
  const metadata = task({ id: "metadata", latestValidatedMetadataEdit: { at: "2026-10-06T12:00:00Z", field: "tags" } });
  const result = read([edited, metadata]);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.detailOverride, "Comment added on 2 January 2020 at 12:00:00 (Europe/Dublin).");
  assert.deepEqual(read([metadata, edited]), result);
  assert.ok(result.coverageNotes.some(note => note === "Title edited for “Inspect the venue” on 1 January 2020 at 12:00:00 (Europe/Dublin); this does not establish meaningful work progress."));
  assert.ok(result.coverageNotes.some(note => note.includes("Tags edited") && note.includes("13:00:00 (Europe/Dublin)") && note.includes("does not establish progress")));
  const titleOnly = read([{ ...edited, latestValidatedComment: undefined }]);
  assert.deepEqual(titleOnly.candidates, []);
  assert.ok(titleOnly.coverageNotes.some(note => note.includes("Title edited for “Inspect the venue” on 1 January 2020 at 12:00:00 (Europe/Dublin)")));
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
  assert.deepEqual(result.coverageNotes, ["2 tasks are currently open in this project (Tasks · Launch). Open tasks: “Inspect the venue”; “Inspect the venue”."]);
  assert.ok(result.coverageNotes.every(note => !/unknown|visible|owned|done/.test(note)));
  const joined = read([...signals, task({ id: "garden", workspaceId: "garden-workspace", sourceLabel: "Tasks · Garden", taskCoverage: "complete" })]);
  assert.deepEqual(joined.candidates, []);
  assert.deepEqual(joined.coverageNotes, ["1 task is currently open in this project (Tasks · Garden). Open tasks: “Inspect the venue”.", "2 tasks are currently open in this project (Tasks · Launch). Open tasks: “Inspect the venue”; “Inspect the venue”."]);
});

test("partial or omitted exact workspace coverage refuses summary without poisoning another workspace", () => {
  for (const taskCoverage of ["partial", undefined] as const) {
    const result = read([task({ taskCoverage: "complete" }), task({ id: "partial", taskCoverage }),
      task({ id: "other", workspaceId: "other", sourceLabel: "Tasks · Garden", taskCoverage: "complete" })]);
    assert.deepEqual(result.candidates, []);
    assert.deepEqual(result.coverageNotes, ["1 task is currently open in this project (Tasks · Garden). Open tasks: “Inspect the venue”."]);
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
