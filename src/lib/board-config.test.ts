import { test } from "node:test";
import assert from "node:assert/strict";
import {
  configRemoveColumn,
  configReorder,
  emptyConfig,
  normaliseOrder,
  parseColumnConfig,
  serializeColumnConfig,
  type ColumnConfig,
} from "@/lib/board-config";

test("emptyConfig has all four system lanes in canonical order", () => {
  const c = emptyConfig();
  assert.deepEqual(c.order, ["todo", "doing", "review", "done"]);
  assert.deepEqual(c.custom, []);
  assert.deepEqual(c.colors, {});
  assert.deepEqual(c.descriptions, {});
});

test("safe mapping: legacy Record<LaneId,string> parses to a system-only config", () => {
  // An older board stored only lane-name overrides. It must map forward
  // without losing data (no tasks, no columns dropped).
  const legacy = JSON.stringify({ todo: "Backlog", done: "Shipped" });
  const cfg = parseColumnConfig(legacy);
  assert.ok(cfg);
  assert.equal(cfg!.system.todo, "Backlog");
  assert.equal(cfg!.system.done, "Shipped");
  assert.deepEqual(cfg!.custom, []);
  assert.deepEqual(cfg!.order, ["todo", "doing", "review", "done"]);
});

test("new format parses custom columns, colours (incl neutral), descriptions", () => {
  const stored = JSON.stringify({
    system: { review: "QA" },
    custom: [{ key: "col-staging-ab12", name: "Staging" }],
    order: ["todo", "doing", "review", "col-staging-ab12", "done"],
    colors: { todo: "neutral", "col-staging-ab12": "teal" },
    descriptions: { done: "", "col-staging-ab12": "Pre-prod" },
  });
  const cfg = parseColumnConfig(stored);
  assert.ok(cfg);
  assert.equal(cfg!.system.review, "QA");
  assert.equal(cfg!.custom[0].name, "Staging");
  // Explicit "neutral" is preserved so a system default can be overridden.
  assert.equal(cfg!.colors.todo, "neutral");
  assert.equal(cfg!.colors["col-staging-ab12"], "teal");
  // Empty-string description (cleared) is preserved distinctly from absent.
  assert.equal(cfg!.descriptions.done, "");
  assert.equal(cfg!.descriptions["col-staging-ab12"], "Pre-prod");
});

test("parse rejects unknown colour keys and non-string descriptions", () => {
  const stored = JSON.stringify({
    colors: { todo: "chartreuse" },
    descriptions: { doing: 42 },
  });
  const cfg = parseColumnConfig(stored);
  assert.ok(cfg);
  assert.equal(cfg!.colors.todo, undefined);
  assert.equal(cfg!.descriptions.doing, undefined);
});

test("parse returns null on garbage / empty / foreign shapes", () => {
  assert.equal(parseColumnConfig("not json"), null);
  assert.equal(parseColumnConfig("[]"), null);
  assert.equal(parseColumnConfig(JSON.stringify({ unrelated: true })), null);
});

test("serialize round-trips a config and normalises missing system lanes", () => {
  const cfg: ColumnConfig = {
    system: { todo: "Blocked" },
    custom: [{ key: "col-x", name: "X" }],
    order: ["doing", "col-x"], // deliberately missing todo/review/done
    colors: { doing: "sky" },
    descriptions: { "col-x": "notes" },
  };
  const round = parseColumnConfig(serializeColumnConfig(cfg));
  assert.ok(round);
  // Missing system lanes are appended so all four always render.
  for (const id of ["todo", "doing", "review", "done"]) {
    assert.ok(round!.order.includes(id), `order should include ${id}`);
  }
  assert.equal(round!.colors.doing, "sky");
  assert.equal(round!.descriptions["col-x"], "notes");
});

test("normaliseOrder appends only the missing system lanes, once", () => {
  const cfg = { ...emptyConfig(), order: ["review", "done"] };
  const order = normaliseOrder(cfg);
  assert.deepEqual(order, ["review", "done", "todo", "doing"]);
});

test("configReorder accepts a full valid order and rejects incomplete/unknown", () => {
  const cfg: ColumnConfig = {
    ...emptyConfig(),
    custom: [{ key: "col-a", name: "A" }],
    order: ["todo", "doing", "review", "done", "col-a"],
  };
  const ok = configReorder(cfg, ["col-a", "todo", "doing", "review", "done"]);
  assert.deepEqual(ok.order, ["col-a", "todo", "doing", "review", "done"]);
  assert.throws(() => configReorder(cfg, ["todo", "doing", "review", "done"])); // missing col-a
  assert.throws(() => configReorder(cfg, ["todo", "doing", "review", "done", "col-a", "ghost"]));
});

test("configRemoveColumn drops the column and its colour + description", () => {
  const cfg: ColumnConfig = {
    system: {},
    custom: [{ key: "col-a", name: "A" }],
    order: ["todo", "doing", "review", "done", "col-a"],
    colors: { "col-a": "pink", done: "emerald" },
    descriptions: { "col-a": "temp" },
  };
  const next = configRemoveColumn(cfg, "col-a");
  assert.equal(next.custom.length, 0);
  assert.ok(!next.order.includes("col-a"));
  assert.equal(next.colors["col-a"], undefined);
  assert.equal(next.descriptions["col-a"], undefined);
  // Unrelated config is untouched.
  assert.equal(next.colors.done, "emerald");
});
