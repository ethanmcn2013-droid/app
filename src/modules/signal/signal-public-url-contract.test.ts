import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * S5 URL contract — asserts that no Signal module file contains:
 *   1. The hardcoded external URL "tasks.signalstudio.ie" (must use /app/board).
 *   2. A process.env.NEXT_PUBLIC_SITE_URL reference for in-module links.
 *
 * Excluded: this test file itself.
 */

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(ts|tsx|css|json)$/.test(e.name)) {
      files.push(full);
    }
  }
  return files;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("S5 URL contract: no hardcoded external URLs in Signal module", () => {
  const files = walk(MODULE_DIR).filter(
    (f) => !f.includes("signal-public-url-contract.test"),
  );

  test("no file contains tasks.signalstudio.ie", () => {
    const hits: string[] = [];
    for (const file of files) {
      const content = stripComments(readFileSync(file, "utf8"));
      if (content.includes("tasks.signalstudio.ie")) {
        hits.push(path.relative(MODULE_DIR, file));
      }
    }
    assert.deepEqual(
      hits,
      [],
      `Found hardcoded tasks.signalstudio.ie in: ${hits.join(", ")} — use /app/board instead (S5)`,
    );
  });

  test("no file references process.env.NEXT_PUBLIC_SITE_URL for in-module links", () => {
    const hits: string[] = [];
    for (const file of files) {
      const content = stripComments(readFileSync(file, "utf8"));
      if (/process\.env\.NEXT_PUBLIC_SITE_URL/.test(content)) {
        hits.push(path.relative(MODULE_DIR, file));
      }
    }
    assert.deepEqual(
      hits,
      [],
      `Found process.env.NEXT_PUBLIC_SITE_URL in: ${hits.join(", ")} — use relative paths in Signal module (S5)`,
    );
  });
});
