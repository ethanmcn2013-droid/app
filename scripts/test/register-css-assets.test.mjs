import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

const preload = new URL("./register-css-assets.mjs", import.meta.url).href;

test("CSS Module preload supports import and require without consuming global CSS", () => {
  const dir = mkdtempSync(join(tmpdir(), "signal-css-test-"));
  try {
    const css = join(dir, "fixture.module.css");
    writeFileSync(css, ".viewport { color: red; }");
    const run = (source) => spawnSync(process.execPath, ["--import", preload, "--input-type=module", "-e", source], { encoding: "utf8" });
    const result = run(`
      import assert from 'node:assert/strict';
      import { createRequire } from 'node:module';
      import styles from ${JSON.stringify(pathToFileURL(css).href)};
      assert.equal(styles.viewport, 'viewport');
      assert.equal(styles.then, undefined);
      assert.equal(createRequire(import.meta.url)(${JSON.stringify(css)}).viewport, 'viewport');
    `);
    assert.equal(result.status, 0, result.stderr);
    const globalCss = join(dir, "global.css");
    writeFileSync(globalCss, ".global { color: red; }");
    assert.notEqual(run(`import ${JSON.stringify(pathToFileURL(globalCss).href)}`).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the owning appearance stage explicitly preloads CSS Modules", () => {
  const stages = JSON.parse(readFileSync(new URL("../app-test-stages.json", import.meta.url), "utf8"));
  const owners = stages.filter(stage => stage.includes("src/components/app/settings/sections/appearance-radiogroup.test.ts"));
  assert.equal(owners.length, 1);
  const index = owners[0].indexOf("./scripts/test/register-css-assets.mjs");
  assert.ok(index > 0);
  assert.equal(owners[0][index - 1], "--import");
});
