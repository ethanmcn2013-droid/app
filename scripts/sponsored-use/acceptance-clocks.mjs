import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const index = process.argv.indexOf("--studio-root");
assert.ok(index >= 0 && process.argv[index + 1], "Supply the paired Studio checkout with --studio-root");
const studioRoot = resolve(process.argv[index + 1]);
const root = fileURLToPath(new URL("../../", import.meta.url));
const env = { NODE_ENV: "test" };
for (const [key, value] of Object.entries(process.env)) {
  if (/^(path|systemroot|windir|comspec|temp|tmp|tmpdir|pathext|lang|lc_all|tz)$/i.test(key)) env[key] = value;
}

// Cover the old passing hour, the exact Dublin summer rollover that exposed
// the defect, the failing evening, and the January launch year's winter clock.
for (const clock of [
  "2026-09-05T08:00:00.000Z",
  "2026-09-05T15:00:00.000Z",
  "2026-09-05T21:00:00.000Z",
  "2027-01-21T21:00:00.000Z",
]) {
  const preload = `
    import http from 'node:http'; import https from 'node:https'; import net from 'node:net';
    const deny=()=>{throw new Error('Paired acceptance forbids real network');};
    globalThis.fetch=async()=>deny(); http.request=deny; http.get=deny;
    https.request=deny; https.get=deny; net.connect=deny; net.createConnection=deny;
    const OriginalDate=globalThis.Date; const epoch=OriginalDate.parse(${JSON.stringify(clock)});
    globalThis.Date=class extends OriginalDate {
      constructor(...args){super(...(args.length?args:[epoch]));}
      static now(){return epoch;}
    };
  `;
  const result = spawnSync(process.execPath, [
    "--import", `data:text/javascript,${encodeURIComponent(preload)}`,
    "scripts/sponsored-use/acceptance.cjs", "--studio-root", studioRoot,
  ], { cwd: root, env, encoding: "utf8", timeout: 120_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  process.stdout.write(`Fixture clock ${clock}\n${output}`);
  assert.ifError(result.error);
  assert.equal(result.signal, null, output);
  assert.equal(result.status, 0, output);
  const reports = (result.stdout ?? "").split(/\r?\n/).filter(line => line.startsWith('{"passed":'));
  assert.equal(reports.length, 1, "Require one completed actual acceptance report");
  const report = JSON.parse(reports[0]);
  assert.equal(report.passed, 9); assert.equal(report.checks.length, 9);
  assert.equal(report.providers, false); assert.equal(report.network, "local Request only");
}
