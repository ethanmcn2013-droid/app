import assert from "node:assert/strict";
import { test } from "node:test";
import { reorderColumn } from "./column-order";

test("column moves preserve every key, including Done and custom columns", () => {
  const keys = ["todo", "doing", "custom", "done"];
  assert.deepEqual(reorderColumn(keys, "todo", "done"), ["doing", "custom", "done", "todo"]);
  assert.deepEqual(reorderColumn(keys, "done", "todo"), ["done", "todo", "doing", "custom"]);
  assert.deepEqual(keys, ["todo", "doing", "custom", "done"]);
  assert.equal(reorderColumn(keys, "unknown", "done"), null);
  assert.equal(reorderColumn(keys, "todo", "todo"), null);
});
