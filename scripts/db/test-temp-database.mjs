/**
 * Scratch databases for the migration tests, and the three things about them
 * that have to be true on every platform.
 *
 * ── THE BUG THIS EXISTS TO PREVENT ─────────────────────────────────────────
 * The first version of `withTempDir` was SYNCHRONOUS and its callers were not:
 *
 *   function withTempDir(operation) {
 *     const dir = mkdtempSync(…);
 *     try { return operation(dir); }        // ← returns a promise
 *     finally { rmSync(dir, …); }           // ← runs NOW, not when it settles
 *   }
 *
 * So the fixture deleted its own database directory before the test body had
 * done anything with it. `createClient` opens a local file SYNCHRONOUSLY,
 * before the body's first `await`, which is what made the two platforms
 * disagree:
 *
 *   Windows — `rmSync` throws EPERM because the file is open, the catch
 *     swallows it, the directory survives, every assertion passes, and a temp
 *     directory leaks on every run.
 *   Linux   — `rmSync` succeeds, because POSIX is happy to unlink an open
 *     file. The database is then a deleted inode in a directory that no longer
 *     exists, and the next write fails with
 *     `SQLITE_READONLY: attempt to write a readonly database`.
 *
 * Four adoption and dry-run tests passed locally and failed in CI for exactly
 * that reason. Those four are the guarantees that stop a consolidated baseline
 * being replayed over a populated production database, so "green on the
 * author's machine" was worth nothing.
 *
 * ── WHAT IS ASSERTED, AND WHY IN THE TEST RATHER THAN IN A COMMENT ─────────
 * A comment saying "use a temp directory" is not enforcement. These three are:
 *
 *   1. the path is ABSOLUTE, so it cannot be resolved against a `cwd` that
 *      differs between a local run and an Actions checkout;
 *   2. it is OUTSIDE the repository, because a test that writes into the tree
 *      is wrong whether or not the checkout's permissions happen to allow it;
 *   3. its directory EXISTS at the moment the client is created — which is the
 *      assertion that would have failed loudly on Windows for the bug above,
 *      instead of only in CI.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { defaultRoot } from "./migration-ledger.mjs";

const repositoryRoot = path.resolve(defaultRoot);

/**
 * Assert a scratch database path is portable, and return its `file:` URL.
 *
 * Call this for every database a test creates. `pathToFileURL` is the only
 * correct way to build the URL: hand-assembling `file:${p}` yields
 * `file:C:/…` on Windows and `file:/tmp/…` on Linux, two different shapes
 * that happen to work for different reasons.
 */
export function testDatabaseUrl(dir, filename) {
  const resolved = path.resolve(dir, filename);

  assert.ok(
    path.isAbsolute(resolved),
    `a test database path must be absolute so it cannot follow cwd: ${resolved}`,
  );
  assert.ok(
    !resolved.startsWith(`${repositoryRoot}${path.sep}`),
    `a test database must never be created inside the repository: ${resolved}`,
  );
  assert.ok(
    fs.existsSync(path.dirname(resolved)),
    `the scratch directory must exist when the client is created — a fixture ` +
      `that removes its own database mid-test passes on Windows and fails on ` +
      `Linux with SQLITE_READONLY: ${path.dirname(resolved)}`,
  );

  return pathToFileURL(resolved).href;
}

/**
 * A scratch directory that outlives the whole operation, including an async one.
 *
 * `await operation(dir)` is the entire repair: the `finally` cannot run until
 * the body has settled. The cleanup stays guarded for the reason recorded
 * beside the WP1 harness — libSQL can hold the file handle past `close()` on
 * Windows, and a stale temp directory is not a test failure.
 */
export async function withTempDatabaseDir(operation) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "signal-db-test-"));
  try {
    return await operation(dir);
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* the OS can have it */
    }
  }
}

/** Read a repository file without depending on the process's cwd. */
export function readRepositoryFile(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

export { repositoryRoot };
