import assert from "node:assert/strict";
import test from "node:test";
import { isTasksDesignLabEnabled } from "./tasks-lab-guard";

test("tasks lab opens only for explicit development review mode", () => {
  assert.equal(isTasksDesignLabEnabled({ nodeEnv: "development", flag: "true", reviewMode: true }), true);
  assert.equal(isTasksDesignLabEnabled({ nodeEnv: "development", flag: undefined, reviewMode: true }), false);
  assert.equal(isTasksDesignLabEnabled({ nodeEnv: "development", flag: "true", reviewMode: false }), false);
});

test("production fails closed even when the lab flag is maliciously enabled", () => {
  assert.equal(isTasksDesignLabEnabled({ nodeEnv: "production", flag: "true", reviewMode: true }), false);
  assert.equal(isTasksDesignLabEnabled({ nodeEnv: "production", flag: "true", reviewMode: false }), false);
});
