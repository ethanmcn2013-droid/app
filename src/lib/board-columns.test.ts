import assert from "node:assert/strict";
import test from "node:test";
import {
  columnDisplayName,
  columnPersistence,
  defaultColumnConfig,
  effectiveColumnKey,
  resolveBoardColumns,
  WAITING_COLUMN_KEY,
} from "./board-columns";
import { emptyConfig, parseColumnConfig, serializeColumnConfig } from "./board-config";

test("no stored config resolves to the five shipped columns", () => {
  const columns = resolveBoardColumns(null);
  assert.deepEqual(
    columns.map((c) => c.key),
    ["todo", "doing", "review", WAITING_COLUMN_KEY, "done"],
  );
  assert.deepEqual(
    columns.map((c) => c.name),
    ["Queued", "In progress", "Review", "Waiting", "Done"],
  );
  const waiting = columns[3];
  assert.equal(waiting.isSystem, false);
  assert.equal(waiting.color, "neutral");
  assert.ok(waiting.description);
});

test("a stored config drives order, names, colours, descriptions and limits", () => {
  const config = {
    ...emptyConfig(),
    system: { todo: "Backlog-free intake", done: "Handed over" },
    custom: [{ key: "col-a1", name: "Staging" }],
    order: ["doing", "col-a1", "todo", "review", "done"],
    colors: { "col-a1": "teal" as const, done: "neutral" as const },
    descriptions: { doing: "", "col-a1": "On the staging site." },
    limits: { doing: 4 },
  };
  const columns = resolveBoardColumns(config);
  assert.deepEqual(
    columns.map((c) => c.key),
    ["doing", "col-a1", "todo", "review", "done"],
  );
  assert.equal(columns[0].limit, 4);
  assert.equal(columns[0].description, undefined); // explicit "" clears the default
  assert.equal(columns[1].color, "teal");
  assert.equal(columns[1].description, "On the staging site.");
  assert.equal(columnDisplayName(columns, "done"), "Handed over");
  // An explicit neutral wins over the system default for done.
  assert.equal(columns[4].color, "neutral");
});

test("system lanes and configured customs can never vanish through a bad order", () => {
  const config = {
    ...emptyConfig(),
    custom: [{ key: "col-b2", name: "Paid" }],
    order: ["done", "ghost-key"],
  };
  const keys = resolveBoardColumns(config).map((c) => c.key);
  assert.deepEqual(keys, ["done", "todo", "doing", "review", "col-b2"]);
});

test("effective column key honours claims and legacy raw lane text alike", () => {
  assert.equal(effectiveColumnKey({ lane: "doing", boardColumnKey: "col-a1" }), "col-a1");
  assert.equal(effectiveColumnKey({ lane: "review", boardColumnKey: null }), "review");
  // Pre-migration rows: raw "waiting" lane text is the waiting column.
  assert.equal(effectiveColumnKey({ lane: "waiting" }), WAITING_COLUMN_KEY);
});

test("moves persist canonically into system lanes and as claims into customs", () => {
  assert.deepEqual(columnPersistence({ key: "review", isSystem: true }), {
    lane: "review",
    boardColumnKey: null,
  });
  assert.deepEqual(columnPersistence({ key: WAITING_COLUMN_KEY, isSystem: false }), {
    lane: "doing",
    boardColumnKey: WAITING_COLUMN_KEY,
  });
});

test("orphaned keys still read honestly", () => {
  const columns = resolveBoardColumns(null);
  assert.equal(columnDisplayName(columns, "on_hold"), "On hold");
});

test("limits round-trip through serialize and parse; junk is dropped", () => {
  const config = { ...defaultColumnConfig(), limits: { doing: 8 } };
  const parsed = parseColumnConfig(serializeColumnConfig(config));
  assert.equal(parsed?.limits.doing, 8);
  const dirty = parseColumnConfig(
    JSON.stringify({ order: ["todo"], limits: { todo: 0, doing: -2, review: 3.5, done: "9", waiting: 12 } }),
  );
  assert.deepEqual(dirty?.limits, { waiting: 12 });
});

test("legacy flat configs still parse and carry empty limits", () => {
  const parsed = parseColumnConfig(JSON.stringify({ todo: "Intake" }));
  assert.equal(parsed?.system.todo, "Intake");
  assert.deepEqual(parsed?.limits, {});
});
