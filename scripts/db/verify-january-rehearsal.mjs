import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// This rehearsal never reads a database URL or credential from the environment.
// The runner's production receipt and target checks remain unchanged.
const directory = mkdtempSync(join(tmpdir(), "signal-january-rehearsal-"));
const databaseUrl = `file:${join(directory, "tasks.db").replaceAll("\\", "/")}`;
const releaseSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
try {
  // Windows libSQL may retain handles after client.close(). End the worker
  // process before the parent removes its disposable database.
  const worker = fileURLToPath(new URL("./verify-january-rehearsal-worker.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [worker, databaseUrl, releaseSha], { encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Migration rehearsal worker failed (${result.signal ?? result.status})`);
} finally {
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.ok(basename(directory).startsWith("signal-january-rehearsal-"));
  rmSync(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
}
