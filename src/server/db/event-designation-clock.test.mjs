import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const selectedTest = "expired/revoked/future independent grants do not override an archive; missing local purchase behind a positive mirror is verification-unavailable";

function runClockCase(namePattern) {
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
    `--test-name-pattern=${namePattern}`,
    "src/server/db/event-designation.test.ts",
  ], {
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    env,
    encoding: "utf8",
    timeout: 55_000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  return result;
}

function assertNamedCasePassed(result) {
  const output = result.stdout ?? "";
  const diagnostics = `${output}${result.stderr ?? ""}`;
  assert.ifError(result.error);
  assert.equal(result.signal, null, diagnostics);
  assert.equal(result.status, 0, diagnostics);
  // Node 22 reports an empty selection as one passing file-level test. Require
  // this exact case's successful stdout record; SKIP/TODO suffixes cannot match.
  const lines = output.split(/\r?\n/);
  assert.ok(lines.includes(`# Subtest: ${selectedTest}`) && lines.includes(`ok 1 - ${selectedTest}`),
    `Expected successful TAP record for the selected Event SQLite test\n${output}`);
  assert.match(output, /^# tests 1\r?$/m);
  assert.match(output, /^# pass 1\r?$/m);
  assert.match(output, /^# fail 0\r?$/m);
}

test("Event future-grant SQLite control remains future under the January 2027 launch clock", { timeout: 60_000 }, () => {
  assertNamedCasePassed(runClockCase(selectedTest));
});

test("Event clock guard rejects an empty selection despite a passing Node file wrapper", { timeout: 60_000 }, () => {
  const result = runClockCase("INDEPENDENT_NONEXISTENT_TEST_CONTROL");
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /^# tests 1\r?$/m);
  assert.match(result.stdout, /^# pass 1\r?$/m);
  assert.throws(() => assertNamedCasePassed(result), /Expected successful TAP record for the selected Event SQLite test/);
});

test("Event clock guard rejects a different passing SQLite test", { timeout: 60_000 }, () => {
  const otherTest = "boundary equality is read-only; malformed/foreign/removed identities return neutral unavailable; local read failure is explicit";
  const result = runClockCase(otherTest);
  assert.equal(result.status, 0, result.stdout);
  assert.ok(result.stdout.split(/\r?\n/).includes(`ok 1 - ${otherTest}`));
  assert.throws(() => assertNamedCasePassed(result), /Expected successful TAP record for the selected Event SQLite test/);
});
