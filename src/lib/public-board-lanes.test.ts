import assert from "node:assert/strict";
import test from "node:test";
import type { PublicTask } from "./data";
import { emptyConfig } from "./board-config";
import { publicBoardColumns, publicColumnTasks } from "./public-board-lanes";

/**
 * Guest-facing surfaces must not silently drop work, and must agree with
 * the operator's screen. T·116 taught them to render every lane the data
 * contains; T·121 hands them the column config itself, with a neutral
 * appended column for any orphaned key so nothing a guest was sent can
 * vanish.
 */

const task = (id: string, lane: string, boardColumnKey?: string): PublicTask =>
  ({ id, title: id, lane, priority: "p2", ...(boardColumnKey ? { boardColumnKey } : {}) }) as PublicTask;

test("no config: guests see the shipped five columns, operator names included", () => {
  const columns = publicBoardColumns(null, []);
  assert.deepEqual(
    columns.map((column) => column.id),
    ["todo", "doing", "review", "waiting", "done"],
  );
  assert.deepEqual(
    columns.map((column) => column.name),
    ["Queued", "In progress", "Review", "Waiting", "Done"],
  );
  // Working states carry a tint; the resting states — Queued (T·132: a
  // backlog is not an alarm) and Waiting — are neutral by default, and a
  // null accent is a first-class value guests must render.
  assert.ok(columns[1].accent);
  assert.equal(columns[0].accent, null);
  assert.equal(columns[3].accent, null);
  // Only the Done column reads as finished (T·122 default doneKeys).
  assert.deepEqual(
    columns.map((column) => column.isDone),
    [false, false, false, false, true],
  );
});

test("a workspace config drives guest columns: rename, order, custom", () => {
  const columns = publicBoardColumns(
    {
      ...emptyConfig(),
      system: { done: "Handed over" },
      custom: [{ key: "col-pay", name: "Paid" }],
      order: ["doing", "col-pay", "todo", "review", "done"],
    },
    [],
  );
  assert.deepEqual(
    columns.map((column) => column.name),
    ["In progress", "Paid", "Queued", "Review", "Handed over"],
  );
});

test("an orphaned key still present in data renders as a neutral column, never drops", () => {
  const tasks = [task("a", "doing"), task("b", "on_hold"), task("c", "doing", "col-gone")];
  const columns = publicBoardColumns(null, tasks);
  const ids = columns.map((column) => column.id);
  assert.ok(ids.includes("on_hold"));
  assert.ok(ids.includes("col-gone"));
  assert.equal(columns.find((column) => column.id === "on_hold")?.name, "On hold");
  assert.equal(columns.find((column) => column.id === "on_hold")?.accent, null);
  // Orphaned/extra columns never read as done.
  assert.equal(columns.find((column) => column.id === "on_hold")?.isDone, false);
  assert.equal(columns.find((column) => column.id === "col-gone")?.isDone, false);
});

test("column membership honours claims over lanes, and raw waiting text", () => {
  const tasks = [
    task("claimed", "doing", "col-pay"),
    task("laned", "doing"),
    task("legacy", "waiting"),
  ];
  assert.deepEqual(publicColumnTasks(tasks, "col-pay").map((t) => t.id), ["claimed"]);
  assert.deepEqual(publicColumnTasks(tasks, "doing").map((t) => t.id), ["laned"]);
  assert.deepEqual(publicColumnTasks(tasks, "waiting").map((t) => t.id), ["legacy"]);
});
