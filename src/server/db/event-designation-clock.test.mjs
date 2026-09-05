import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

test("Event future-grant SQLite control remains future under the January 2027 launch clock", { timeout: 60_000 }, () => {
  // Set the clock before importing the actual fixture: its term is derived at
  // module load. Only the child clock changes; the writer/evaluator remain real.
  const clock = `
    const OriginalDate = globalThis.Date;
    const epoch = OriginalDate.parse("2027-01-21T12:00:00.000Z");
    globalThis.Date = class extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : [epoch])); }
      static now() { return epoch; }
    };
  `;
  // In particular, do not inherit credentials, NODE_OPTIONS or the parent Node
  // test-worker context. The actual fixture sets review mode and blocks fetch.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(path|systemroot|windir|comspec|temp|tmp|tmpdir|pathext|lang|lc_all|tz)$/i.test(key)));
  const result = spawnSync(process.execPath, [
    "--import", `data:text/javascript,${encodeURIComponent(clock)}`,
    "--import", "tsx",
    "--import", "./src/test/register-server-only.mjs",
    "--test", "--test-reporter=tap",
    "--test-name-pattern=expired/revoked/future independent grants",
    "src/server/db/event-designation.test.ts",
  ], {
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    env,
    encoding: "utf8",
    timeout: 55_000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert.ifError(result.error);
  assert.equal(result.signal, null, output);
  assert.equal(result.status, 0, output);
  // A renamed/missing test must not turn this regression into an empty pass.
  assert.match(output, /^# tests 1\r?$/m);
  assert.match(output, /^# pass 1\r?$/m);
  assert.match(output, /^# fail 0\r?$/m);
});
