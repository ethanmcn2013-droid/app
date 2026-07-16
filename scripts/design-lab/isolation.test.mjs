import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve("src/components/design-lab/tasks");

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(absolute));
    else if (/\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) files.push(absolute);
  }
  return files;
}

test("design-lab client source has no production data or persistence path", async () => {
  const files = await filesBelow(root);
  assert.ok(files.length > 8, "expected a coded design lab");
  const forbidden = [
    /@\/server\/actions/,
    /@\/server\/db/,
    /drizzle-orm/,
    /@libsql\/client/,
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /document\.cookie/,
    /\bfetch\s*\(/,
  ];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, `${path.relative(root, file)} violates isolation`);
  }
});

test("server route guards before dynamically importing the lab", async () => {
  const source = await readFile(path.resolve("src/app/%5F%5Fdesign-lab/tasks/page.tsx"), "utf8");
  const guard = source.indexOf("isTasksDesignLabEnabled");
  const notFound = source.indexOf("notFound();", guard);
  const dynamicImport = source.indexOf("await import", notFound);
  assert.ok(guard >= 0 && notFound > guard && dynamicImport > notFound, "lab import must occur after the fail-closed guard");
  assert.match(source, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
});
