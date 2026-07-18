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
  // Board order is [todo, doing, review, done] = Blocked · In Progress ·
  // Reviewing · Done, so red · blue · amber · green.
  assert.equal(DEFAULT_SYSTEM_COLORS.todo, "rose"); // red
  assert.equal(DEFAULT_SYSTEM_COLORS.doing, "sky"); // blue
  assert.equal(DEFAULT_SYSTEM_COLORS.review, "amber");
  assert.equal(DEFAULT_SYSTEM_COLORS.done, "emerald"); // green
});

test("boardColumnColor applies the system default when no colour is saved", () => {
  assert.equal(boardColumnColor("todo", undefined, true), "rose");
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
