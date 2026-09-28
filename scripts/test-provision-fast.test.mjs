import assert from "node:assert/strict";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {test} from "node:test";
import {runProvisionFastTests} from "./test-provision-fast.mjs";

test("parent removes only its fresh fixture root after child exit", () => {
  const root = join(tmpdir(), "signal-provision-fast-run-test-synthetic");
  const events = [];
  const result = runProvisionFastTests({
    create: () => root,
    execute: (_binary, args, options) => {
      events.push("child-exited");
      assert.equal(options.env.SIGNAL_PROVISION_FAST_TEST_ROOT, root);
      assert.deepEqual(args.slice(-2), ["--test", "src/server/db/ensure-user-fast-path.test.ts"]);
      return {status: 0};
    },
    remove: (path, options) => {
      events.push("removed");
      assert.equal(path, root);
      assert.deepEqual(options, {recursive: true, force: true});
    },
  });
  assert.equal(result, 0);
  assert.deepEqual(events, ["child-exited", "removed"]);
});

test("child failure remains failed and its fresh fixture still gets removed", () => {
  const root = join(tmpdir(), "signal-provision-fast-run-test-failed");
  let removed = false;
  const result = runProvisionFastTests({
    create: () => root,
    execute: () => ({status: 7}),
    remove: path => {assert.equal(path, root); removed = true;},
  });
  assert.equal(result, 7);
  assert.equal(removed, true);
});

test("an unowned target is refused before spawning or removing", () => {
  let called = false;
  assert.throws(() => runProvisionFastTests({
    create: () => join(tmpdir(), "outside-target"),
    execute: () => {called = true; return {status: 0};},
    remove: () => {called = true;},
  }), /outside the system temp directory/);
  assert.equal(called, false);
});

test("cleanup failure cannot turn an exited child into a successful result", () => {
  const cleanupError = new Error("synthetic cleanup failure");
  assert.throws(() => runProvisionFastTests({
    create: () => join(tmpdir(), "signal-provision-fast-run-test-cleanup"),
    execute: () => ({status: 0}),
    remove: () => {throw cleanupError;},
  }), error => error.message === "Provision test fixture cleanup failed after child exit" && error.cause === cleanupError);
});
