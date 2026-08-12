import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COLUMN_COLORS,
  COLUMN_PICKER_ORDER,
  DEFAULT_SYSTEM_COLORS,
  boardColumnColor,
  isColumnColorKey,
} from "@/lib/board-colors";

test("standard columns get the required default semantic colours", () => {
  // Wave 5 hue contract — one hue, one meaning. This assertion previously
  // pinned the defect: `doing` was "sky", which resolves to --status-review,
  // a cyan the design system never ratified; and `review` was
  // "amber", so amber meant the Review lane AND High priority AND due-today
  // at the same time. Both are corrected here, and both defaults are now DS
  // status tokens used for the single thing that token means.
  assert.equal(DEFAULT_SYSTEM_COLORS.todo, "neutral"); // a backlog is not a state
  assert.equal(DEFAULT_SYSTEM_COLORS.doing, "amber"); // --status-flight IS "in progress"
  assert.equal(DEFAULT_SYSTEM_COLORS.review, "neutral"); // no DS token means "waiting on a check"
  assert.equal(DEFAULT_SYSTEM_COLORS.done, "emerald"); // --x-status-done, the one green
});

test("no board default reaches for an off-system hue", () => {
  // Every default resolves to a design-system status token or to no hue at
  // all. "sky" keeps its place in the picker but rides the suite indigo now
  // rather than the unratified cyan.
  const defaults = Object.values(DEFAULT_SYSTEM_COLORS);
  for (const key of defaults) {
    const entry = COLUMN_COLORS[key];
    assert.ok(
      entry.var === null ||
        entry.var === "var(--x-col-amber)" ||
        entry.var === "var(--x-col-emerald)" ||
        entry.var === "var(--x-col-rose)",
      `${key} default must be a DS status token or neutral, got ${entry.var}`,
    );
  }
  assert.equal(COLUMN_COLORS.sky.var, "var(--x-col-indigo)");
});

test("boardColumnColor applies the system default when no colour is saved", () => {
  assert.equal(boardColumnColor("todo", undefined, true), "neutral");
  assert.equal(boardColumnColor("done", undefined, true), "emerald");
});

test("boardColumnColor never overwrites a saved owner choice", () => {
  assert.equal(boardColumnColor("todo", "violet", true), "violet");
  // An explicit "neutral" overrides the system default back to no tint.
  assert.equal(boardColumnColor("todo", "neutral", true), "neutral");
});

test("custom columns default to neutral, honour a saved colour", () => {
  assert.equal(boardColumnColor("col-x", undefined, false), "neutral");
  assert.equal(boardColumnColor("col-x", "teal", false), "teal");
});

test("the colour picker offers the eight required hues", () => {
  const labels = COLUMN_PICKER_ORDER.map((k) => COLUMN_COLORS[k].label);
  for (const required of ["Red", "Blue", "Amber", "Green", "Purple", "Teal", "Pink", "Neutral"]) {
    assert.ok(labels.includes(required), `picker should include ${required}`);
  }
});

test("isColumnColorKey guards the persisted palette", () => {
  assert.equal(isColumnColorKey("teal"), true);
  assert.equal(isColumnColorKey("neutral"), true);
  assert.equal(isColumnColorKey("chartreuse"), false);
  assert.equal(isColumnColorKey(42), false);
});
