/**
 * Test support for the MyWorkProjection contract tests. NOT the implementation.
 *
 * Wave 1 is a contract wave: this directory contains a sealed document
 * (`docs/projects/home-operating-layer/contracts/MY_WORK_PROJECTION.md`) and the
 * failing tests that hold it. Nothing here reads a database, renders a surface,
 * or groups a real row. If you are looking for the projection, it does not
 * exist yet, and the tests next to this file are the record of that.
 *
 * Two kinds of assertion live here.
 *
 * 1. Module assertions. The contract requires a module the repository does not
 *    have. `requireContractModule` imports it by absolute file URL, so
 *    TypeScript never resolves the specifier statically and `pnpm typecheck`
 *    stays green while the test stays red.
 * 2. Source assertions. The contract requires a fact about shipped source that
 *    is not true yet. `readRepoFile` reads the file and the test asserts the
 *    fact directly, so the failure names the file and the line rather than a
 *    stack.
 *
 * Both are meant to fail at base `78021c5`. That is the deliverable.
 */

import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * The repository root, taken from the working directory the harness runs in
 * (every `node --test` invocation in `package.json` runs from the repo root).
 * Verified rather than assumed, so a wrong cwd fails loudly instead of turning
 * every source assertion into a false red.
 */
export function repoRoot(): string {
  const root = process.cwd();
  assert.ok(
    existsSync(resolve(root, "package.json")) &&
      existsSync(resolve(root, "src", "server", "db", "schema.ts")),
    `these tests must run from the repository root; cwd is ${root}`,
  );
  return root;
}

/** Read a repo-relative source file. A missing file is an assertion, not a throw. */
export function readRepoFile(relativePath: string): string {
  const absolute = resolve(repoRoot(), relativePath);
  assert.ok(existsSync(absolute), `expected ${relativePath} to exist`);
  return readFileSync(absolute, "utf8");
}

export function repoFileExists(relativePath: string): boolean {
  return existsSync(resolve(repoRoot(), relativePath));
}

/** 1-indexed line numbers on which `needle` appears. */
export function linesContaining(source: string, needle: string): number[] {
  const out: number[] = [];
  source.split(/\r?\n/).forEach((line, index) => {
    if (line.includes(needle)) out.push(index + 1);
  });
  return out;
}

export function countOccurrences(source: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const at = source.indexOf(needle, from);
    if (at === -1) return count;
    count += 1;
    from = at + needle.length;
  }
}

/**
 * Import a module the contract requires. When it does not exist the failure
 * says so in the contract's own terms, and names the section that requires it,
 * rather than surfacing ERR_MODULE_NOT_FOUND from somewhere inside node.
 *
 * The specifier is built at runtime, so TypeScript never tries to resolve it.
 */
export async function requireContractModule(
  relativePath: string,
  section: string,
): Promise<Record<string, unknown>> {
  const absolute = resolve(repoRoot(), relativePath);
  if (!existsSync(absolute)) {
    assert.fail(
      `${relativePath} does not exist. MY_WORK_PROJECTION.md ${section} requires it. ` +
        `This test is expected to fail until Wave 7 creates it.`,
    );
  }
  const specifier = pathToFileURL(absolute).href;
  const loaded: unknown = await import(specifier);
  return loaded as Record<string, unknown>;
}

/** Assert a module exports every named symbol the contract depends on. */
export function requireExports(
  module: Record<string, unknown>,
  names: readonly string[],
  where: string,
): void {
  const missing = names.filter((name) => !(name in module));
  assert.deepEqual(
    missing,
    [],
    `${where} is missing required exports: ${missing.join(", ")}`,
  );
}
