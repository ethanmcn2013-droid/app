// Tasks theme contract: every colour on the Tasks surface is a v3 token.
//
// Replaces the retired Floor stylesheet check (the Floor lab master and its
// generated CSS are gone). The v3 Tasks styles live in CSS modules beside
// their components; this asserts they name no raw hex colour, so light and
// dark both come from src/ds/v3.css and nothing drifts from the palette.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const tasksDir = "src/components/tasks/";
const files = [
  ...readdirSync(new URL(tasksDir, root)).filter((name) => name.endsWith(".module.css")).map((name) => tasksDir + name),
  "src/components/app/detail-panel/task-sheet.module.css",
  "src/components/app/add-task/composer.module.css",
];

test("the Tasks stylesheets exist", () => {
  assert.ok(files.length >= 8, `expected the Tasks modules, found ${files.length}`);
});

for (const file of files) {
  test(`${file} uses v3 tokens, never raw hex colours`, () => {
    const css = read(file);
    const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    assert.deepEqual(hex, [], `${file} names raw colours`);
    assert.match(css, /var\(--v3-/, `${file} reads the v3 tokens`);
  });
}

test("motion on the Tasks surface stands still under reduced motion", () => {
  for (const file of files) {
    const css = read(file);
    if (/animation:|transition:/.test(css)) {
      assert.match(css, /prefers-reduced-motion: (reduce|no-preference)/, `${file} animates without a reduced-motion rule`);
    }
  }
});
