import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { pingTypedTarget, pingNewWorkAllowed } from "./runtime";

test("loaded Next config compiles only exact typed Ping opt-in and leaves voice opt-in independent", () => {
  const configUrl = new URL("../../../next.config.ts", import.meta.url).href;
  const script = `const m=await import(${JSON.stringify(configUrl)}); const c=m.default.default??m.default; console.log(JSON.stringify([c.env.NEXT_PUBLIC_PROJECT_PING_TYPED_ENABLED,c.env.NEXT_PUBLIC_PROJECT_PING_VOICE_ENABLED??null]));`;
  for (const value of [undefined, "0", "1", "true", " 1", "1 "]) {
    const env: NodeJS.ProcessEnv = { ...process.env, NEXT_PUBLIC_PROJECT_PING_VOICE_ENABLED: "1" };
    delete env.NEXT_PUBLIC_PROJECT_PING_TYPED_ENABLED;
    if (value !== undefined) env.NEXT_PUBLIC_PROJECT_PING_TYPED_ENABLED = value;
    const actual = JSON.parse(execFileSync(process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      { env, encoding: "utf8", windowsHide: true }));
    assert.deepEqual(actual, [value === "1" ? "1" : "0", null]);
  }
});

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
