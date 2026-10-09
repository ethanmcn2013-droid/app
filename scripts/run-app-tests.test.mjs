import assert from "node:assert/strict";
import test from "node:test";
import { runAppTests, stages } from "./run-app-tests.mjs";

test("ordered direct processes preserve arguments and stop on a failed gate", () => {
  const calls = [];
  const code = runAppTests({ commands: [["node", "--test", "path with spaces.test.mjs"], ["pnpm", "test:truth"], ["node", "never.mjs"]],
    env: { npm_execpath: "C:/package manager/pnpm.cjs" }, write: () => {}, execute: (executable, args, options) => {
      calls.push({ executable, args, options }); return { status: calls.length === 2 ? 7 : 0 };
    } });
  assert.equal(code, 7); assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].args, ["--test", "path with spaces.test.mjs"]);
  assert.deepEqual(calls[1].args, ["C:/package manager/pnpm.cjs", "test:truth"]);
  assert.equal(calls[0].options.shell, false);
});

test("a signal or spawn failure cannot turn a failed gate into success", () => {
  assert.equal(runAppTests({ commands: [["node", "one.mjs"]], write: () => {}, execute: () => ({ status: null, signal: "SIGTERM" }) }), 1);
  assert.throws(() => runAppTests({ commands: [["node", "one.mjs"]], write: () => {}, execute: () => ({ error: new Error("unavailable") }) }), /unavailable/);
});

test("checked-in stages contain both domain and cross-boundary gates", () => {
  assert.ok(stages.some(stage => stage.includes("scripts/check-module-boundaries.mjs")));
  assert.ok(stages.some(stage => stage.includes("src/server/cross-tenant-isolation.test.mjs")));
  assert.ok(stages.some(stage => stage.includes("test:conversations")));
  assert.ok(stages.every(stage => stage[0] === "node" || stage[0] === "pnpm"));
});
