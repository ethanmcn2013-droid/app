import assert from "node:assert/strict";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { pingTypedTarget, pingNewWorkAllowed } from "./runtime";

test("isolated runtime stays off without exact explicit local target and rejects hosted/demo/remote/mismatch", () => {
  const target = pathToFileURL(join(tmpdir(), "synthetic-target", "synthetic.db")).href;
  const configured = { PING_TYPED_ENABLED: "1", PING_TYPED_DATABASE_URL: target, TASKS_DATABASE_URL: target };
  assert.equal(pingTypedTarget({}, false), null);
  assert.equal(pingTypedTarget(configured, false), target);
  assert.equal(pingTypedTarget(configured, true), null);
  assert.equal(pingTypedTarget({ ...configured, VERCEL: "1" }, false), null);
  assert.equal(pingTypedTarget({ ...configured, TASKS_DATABASE_URL: "file:tasks.db" }, false), null);
  assert.equal(pingTypedTarget({ ...configured, PING_TYPED_ENABLED: "0" }, false), null);
  assert.equal(pingTypedTarget({ ...configured, TASKS_DATABASE_URL: "libsql://invalid", PING_TYPED_DATABASE_URL: "libsql://invalid" }, false), null);
});

test("dynamic pause admits only absent or exact zero and does not remove strict target/auth configuration", () => {
  const env: Record<string, string | undefined> = {};
  assert.equal(pingNewWorkAllowed(env), true);
  env.PING_NEW_WORK_PAUSED = "0"; assert.equal(pingNewWorkAllowed(env), true);
  for (const value of ["1", "", "false", "true", "00", " 0", "0 "]) {
    env.PING_NEW_WORK_PAUSED = value; assert.equal(pingNewWorkAllowed(env), false);
  }
  assert.equal(pingNewWorkAllowed({ get PING_NEW_WORK_PAUSED(): string { throw Error("synthetic private error"); } }), false);
  const target = pathToFileURL(join(tmpdir(), "synthetic-target", "synthetic.db")).href;
  assert.equal(pingTypedTarget({ PING_TYPED_ENABLED: "1", PING_TYPED_DATABASE_URL: target, TASKS_DATABASE_URL: target,
    PING_NEW_WORK_PAUSED: "1" }, false), target);
  env.PING_NEW_WORK_PAUSED = "0"; assert.equal(pingNewWorkAllowed(env), true);
});
