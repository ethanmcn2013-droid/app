import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runBoardFidelityTests } from "./test-board-fidelity.mjs";

test("parent removes only its fresh fixture after the child exits", () => {
  const root = join(tmpdir(), "signal-board-fidelity-run-synthetic");
  const events = [];
  const status = runBoardFidelityTests({
    create: () => root,
    execute: (_binary, args, options) => {
      events.push("child-exited");
      assert.equal(options.env.BOARD_FIDELITY_TEST_ROOT, root);
      assert.deepEqual(args.slice(-2), ["--test", "src/server/actions/board-fidelity.persisted.test.mjs"]);
      return { status: 0 };
    },
    remove: path => { assert.equal(path, root); events.push("removed"); },
  });
  assert.equal(status, 0);
  assert.deepEqual(events, ["child-exited", "removed"]);
});

test("child failure and cleanup failure cannot report success", () => {
  const root = join(tmpdir(), "signal-board-fidelity-run-failed");
  assert.equal(runBoardFidelityTests({
    create: () => root,
    execute: () => ({ status: 7 }),
    remove: () => {},
  }), 7);
  assert.throws(() => runBoardFidelityTests({
    create: () => root,
    execute: () => ({ status: 0 }),
    remove: () => { throw new Error("synthetic cleanup failure"); },
  }), /cleanup failed after child exit/);
});

test("an unowned fixture path is refused before execution or removal", () => {
  let called = false;
  assert.throws(() => runBoardFidelityTests({
    create: () => join(tmpdir(), "outside-target"),
    execute: () => { called = true; return { status: 0 }; },
    remove: () => { called = true; },
  }), /outside the system temp directory/);
  assert.equal(called, false);
});
