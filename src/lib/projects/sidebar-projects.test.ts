import assert from "node:assert/strict";
import { test } from "node:test";

import { projectStatusMetaKey, projectTargetDateMetaKey } from "./project-hub";
import { buildConsole } from "./project-console";
import { sidebarProjectMarks } from "./sidebar-projects";

const TODAY = "2026-10-06";

function rows(entries: ReadonlyArray<readonly [string, string | null, string | null]>) {
  return entries.flatMap(([id, status, target]) => [
    ...(status ? [{ key: projectStatusMetaKey(id), value: status }] : []),
    ...(target ? [{ key: projectTargetDateMetaKey(id), value: target }] : []),
  ]);
}

test("a dot appears only for a late or at-risk Project", () => {
  const meta = rows([
    ["late", "on-track", "2026-10-01"],
    ["risk", "at-risk", "2026-12-01"],
    ["risk-and-late", "at-risk", "2026-09-01"],
    ["fine", "on-track", "2026-12-01"],
    ["paused", "paused", null],
    ["done-late", "complete", "2026-01-01"],
    ["due-today", "on-track", TODAY],
  ]);
  const ids = ["late", "risk", "risk-and-late", "fine", "paused", "done-late", "due-today", "unset"];
  assert.deepEqual(sidebarProjectMarks(ids, meta, TODAY), { late: "late", risk: "risk", "risk-and-late": "late" });
});

test("no status rows means no dots, never a guessed one", () => {
  assert.deepEqual(sidebarProjectMarks(["a", "b"], [], TODAY), {});
  assert.deepEqual(sidebarProjectMarks([], rows([["a", "at-risk", null]]), TODAY), {});
});

test("the sidebar agrees with the Projects console row for row", () => {
  const cases: ReadonlyArray<readonly [string, string | null, string | null]> = [
    ["p1", "on-track", "2026-10-01"],
    ["p2", "at-risk", null],
    ["p3", "paused", "2026-09-30"],
    ["p4", "complete", "2026-09-30"],
    ["p5", null, null],
    ["p6", "on-track", "2027-01-21"],
  ];
  const meta = rows(cases);
  const ids = cases.map(([id]) => id);
  const marks = sidebarProjectMarks(ids, meta, TODAY);
  const model = buildConsole(
    cases.map(([id, status, target]) => ({
      id,
      name: id,
      role: "owner" as const,
      selectable: true,
      blockedReason: null,
      openCount: 0,
      isOpen: false,
      stats: { status: status as never, targetDate: target, purpose: null, total: 0, complete: 0, overdue: 0 },
      facts: null,
    })) as never,
    TODAY,
  );
  for (const row of model.rows) {
    const expected = row.mark === "past_date" ? "late" : row.mark === "at_risk" ? "risk" : undefined;
    assert.equal(marks[row.id], expected, row.id);
  }
});
