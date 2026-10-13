import assert from "node:assert/strict";
import test from "node:test";
import { boundedServerDiagnostics } from "./server-diagnostics";

test("private values and key/email/session patterns redact across stdout chunks", () => {
  const log = boundedServerDiagnostics();
  log.append("stderr", Buffer.from("failure sk_test_fix"));
  assert.equal(log.finish([], true).contents.length, 0);
  log.append("stderr", Buffer.from("ture_secret a@example.invalid user_fixtureA project_fixture eyJabc.def.ghi\n"));
  const result = log.finish(["project_fixture"]);
  const text = result.contents.toString();
  for (const value of ["sk_test_fixture_secret", "a@example.invalid", "user_fixtureA", "project_fixture", "eyJabc.def.ghi"]) assert(!text.includes(value));
  assert.match(text, /failure/); assert.equal(result.truncated, false); assert.equal(result.sha256.length, 64);
});
test("diagnostics remain bounded and discard truncated incomplete private lines", () => {
  const log = boundedServerDiagnostics(32);
  log.append("stdout", Buffer.from("ready\n")); log.append("stderr", Buffer.from("sk_test_" + "a".repeat(1000)));
  const result = log.finish([]);
  assert.equal(result.truncated, true); assert.equal(result.contents.toString(), "ready\n"); assert(result.bytes <= 32); assert.equal(result.rawBytes.stderr, 1008);
});
