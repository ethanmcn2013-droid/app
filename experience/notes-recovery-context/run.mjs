import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const mode = process.argv[2];
const suites = {
  server: ["server-check.mjs", "page-check.mjs", "followup-server.mjs"],
  browser: ["check.mjs", "followup-browser.mjs"],
}[mode];
if (!suites) throw new Error("Choose the server or browser Notes recovery suite");
const runId = new Date().toISOString().replaceAll(":", "-");
const destination = resolve(root, "experience/output/notes-recovery", `${mode}-${runId}`);

for (const suite of suites) {
  const output = resolve(destination, suite.replace(/\.mjs$/, ""));
  mkdirSync(output, { recursive: true });
  // Explicit fixture environment: no provider/database credentials, alternate
  // source checkout or inherited single-case filter can enter this gate.
  const env = { NODE_ENV: "test", NOTES_TEST_SOURCE_ROOT: root, NOTES_TEST_OUTPUT: output };
  for (const key of ["PATH", "SystemRoot", "TEMP", "TMP", "CI"])
    if (process.env[key]) env[key] = process.env[key];
  const result = spawnSync(process.execPath, [resolve(root, "experience/notes-recovery-context", suite)], {
    cwd: root, env, windowsHide: true, stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(`Notes recovery ${suite} failed (${result.signal ?? result.status})\n`);
    process.exit(result.status || 1);
  }
}
process.stdout.write(`Notes recovery ${mode} evidence: ${destination}\n`);
