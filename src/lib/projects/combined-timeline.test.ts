import assert from "node:assert/strict";
import test from "node:test";
import type { PortfolioRow } from "@/lib/projects/project-portfolio";
import { COMBINED_LIMIT, combinedMarks, parseCombined, serializeCombined, tightestWeek, toggleCombined } from "./combined-timeline";

function row(id: string, name: string, milestones: Array<[string, string, boolean?]>): PortfolioRow {
  return {
    id,
    name,
    milestones: milestones.map(([date, title, done], i) => ({ id: `${id}-${i}`, title, date, done: done ?? false })),
  } as unknown as PortfolioRow;
}

test("the address keeps the choice: unique, ordered, capped", () => {
  assert.deepEqual(parseCombined(null), []);
  assert.deepEqual(parseCombined(" a, b ,a,,c"), ["a", "b", "c"]);
  assert.equal(parseCombined("1,2,3,4,5,6,7,8").length, COMBINED_LIMIT);
  assert.equal(serializeCombined([]), null);
  assert.equal(serializeCombined(["a", "b"]), "a,b");
});

test("toggling adds and removes, and a full choice refuses one more", () => {
  assert.deepEqual(toggleCombined(["a"], "b"), ["a", "b"]);
  assert.deepEqual(toggleCombined(["a", "b"], "a"), ["b"]);
  const full = Array.from({ length: COMBINED_LIMIT }, (_, i) => `p${i}`);
  assert.deepEqual(toggleCombined(full, "extra"), full);
});

test("only the chosen projects' dates still to come, oldest first; unknown ids are absent", () => {
  const rows = [
    row("wed", "Wedding", [["2026-10-03", "The day"], ["2026-07-01", "Past one"], ["2026-08-01", "Done one", true]]),
    row("barn", "Barn", [["2026-10-01", "Slates"]]),
    row("other", "Other", [["2026-10-02", "Not chosen"]]),
  ];
  const marks = combinedMarks(rows, ["wed", "barn", "missing"], "2026-07-16");
  assert.deepEqual(marks.map((m) => [m.projectId, m.title]), [["barn", "Slates"], ["wed", "The day"]]);
});

test("the tightest week is the Monday-to-Sunday week with the most dates; ties go to the earliest", () => {
  const rows = [
    row("a", "A", [["2026-10-05", "a1"], ["2026-10-06", "a2"], ["2026-10-20", "a3"]]),
    row("b", "B", [["2026-10-11", "b1"], ["2026-10-21", "b2"], ["2026-10-22", "b3"]]),
  ];
  const week = tightestWeek(combinedMarks(rows, ["a", "b"], "2026-10-01"));
  // 5 to 11 Oct holds three (a1, a2, b1); 19 to 25 Oct also holds three. The earlier wins.
  assert.deepEqual(week, { start: "2026-10-05", end: "2026-10-11", count: 3, projectIds: ["a", "b"] });
});

test("no week holds two dates: no tightest week", () => {
  const rows = [row("a", "A", [["2026-10-05", "a1"]]), row("b", "B", [["2026-10-20", "b1"]])];
  assert.equal(tightestWeek(combinedMarks(rows, ["a", "b"], "2026-10-01")), null);
});
