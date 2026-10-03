import assert from "node:assert/strict";
import test from "node:test";
import {
  formatProjectDate,
  formatProjectDateTime,
  openTaskLabel,
  parseProjectStatus,
  progressPercent,
  projectColumnsMetaKey,
  projectPurposeMetaKey,
  projectStatusMetaKey,
  projectStatusOption,
  projectTargetDateMetaKey,
  summarizeProjectCards,
  targetDatePassed,
  taskProgressLabel,
  trailingSpan,
} from "./project-hub";

test("meta keys are the overview's own keys", () => {
  assert.equal(projectStatusMetaKey("p1"), "project-status:p1");
  assert.equal(projectTargetDateMetaKey("p1"), "project-target-date:p1");
  assert.equal(projectPurposeMetaKey("p1"), "room:p1:purpose");
  assert.equal(projectColumnsMetaKey("p1"), "board:p1:columns");
});

test("status is allow-listed; anything else reads as not set", () => {
  assert.equal(parseProjectStatus("at-risk"), "at-risk");
  assert.equal(parseProjectStatus("done"), null);
  assert.equal(parseProjectStatus(""), null);
  assert.equal(parseProjectStatus(null), null);
  assert.equal(projectStatusOption(null).label, "No status");
  assert.equal(projectStatusOption("on-track").tone, "success");
});

test("cards count done by the board's done columns, per Project", () => {
  const stats = summarizeProjectCards(
    ["a", "b"],
    [
      { key: "project-status:a", value: "at-risk" },
      { key: "project-target-date:a", value: "2026-10-03" },
      { key: "room:a:purpose", value: "  Launch the spring menu  " },
      // Project b treats its custom "shipped" column as done as well.
      { key: "board:b:columns", value: JSON.stringify({ doneKeys: ["done", "shipped"] }) },
    ],
    [
      { workspaceId: "a", lane: "todo", boardColumnKey: null, total: 3, overdue: 1 },
      { workspaceId: "a", lane: "done", boardColumnKey: null, total: "2", overdue: 2 },
      { workspaceId: "b", lane: "doing", boardColumnKey: "shipped", total: 4, overdue: 4 },
      { workspaceId: "b", lane: "doing", boardColumnKey: null, total: 1, overdue: null },
      // A Project nobody asked about is never reported.
      { workspaceId: "z", lane: "todo", boardColumnKey: null, total: 9, overdue: 9 },
    ],
  );

  assert.deepEqual(stats.get("a"), {
    status: "at-risk",
    targetDate: "2026-10-03",
    purpose: "Launch the spring menu",
    total: 5,
    complete: 2,
    // Done tasks are never overdue, whatever their date.
    overdue: 1,
  });
  assert.equal(stats.get("b")?.complete, 4);
  assert.equal(stats.get("b")?.overdue, 0);
  assert.equal(stats.get("b")?.status, null);
  assert.equal(stats.has("z"), false);
});

test("a Project with no tasks still gets an honest empty record", () => {
  const stats = summarizeProjectCards(["empty"], [], []);
  assert.deepEqual(stats.get("empty"), {
    status: null,
    targetDate: null,
    purpose: null,
    total: 0,
    complete: 0,
    overdue: 0,
  });
});

test("card copy", () => {
  assert.equal(progressPercent(5, 13), 38);
  assert.equal(progressPercent(0, 0), 0);
  assert.equal(taskProgressLabel(0, 0), "No tasks yet");
  assert.equal(taskProgressLabel(1, 1), "1 of 1 task done");
  assert.equal(taskProgressLabel(5, 13), "5 of 13 tasks done");
  assert.equal(openTaskLabel(0), "Nothing open");
  assert.equal(openTaskLabel(8), "8 open");
  assert.equal(formatProjectDate("2026-10-03"), "3 Oct 2026");
  assert.equal(formatProjectDate("not a date"), "not a date");
  // Fixed locale and zone, so server and browser render the same title.
  assert.match(formatProjectDateTime("2026-09-22T15:16:49.000Z"), /^22 Sept? 2026, 15:16 UTC$/);
});

test("a passed target date only counts while the work is not complete", () => {
  assert.equal(targetDatePassed("2026-07-01", "on-track", "2026-07-16"), true);
  assert.equal(targetDatePassed("2026-07-01", "complete", "2026-07-16"), false);
  assert.equal(targetDatePassed("2026-07-16", null, "2026-07-16"), false);
  assert.equal(targetDatePassed(null, null, "2026-07-16"), false);
});

test("the New project tile fills the rest of the last row", () => {
  assert.equal(trailingSpan(1, 3), 2);
  assert.equal(trailingSpan(2, 3), 1);
  assert.equal(trailingSpan(3, 3), 3);
  assert.equal(trailingSpan(0, 3), 3);
  assert.equal(trailingSpan(1, 2), 1);
  assert.equal(trailingSpan(2, 2), 2);
});
