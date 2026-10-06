import assert from "node:assert/strict";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { pingTypedTarget } from "./runtime";

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
