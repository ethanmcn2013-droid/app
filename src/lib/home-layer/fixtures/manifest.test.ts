/**
 * The committed manifest is the fixture universe's receipt.
 *
 * If a record changes and a derived number moves, this test fails and the
 * only way to make it pass is to regenerate the manifest — which puts the
 * moved number in the pull-request diff where a reviewer sees it. That is the
 * whole point: a derived number nobody wrote down can change silently.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/fixtures/manifest.test.ts
 */

import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MANIFEST_PATH, buildManifest, serialiseManifest } from "./emit-manifest";
import { SCENARIO_IDS } from "./scenarios";

describe("the manifest", () => {
  it("has been generated and committed", () => {
    assert.ok(
      existsSync(MANIFEST_PATH),
      `${MANIFEST_PATH} is missing. Run: node --import tsx src/lib/home-layer/fixtures/emit-manifest.ts`,
    );
  });

  it("matches the fixture universe byte for byte", () => {
    // Line endings are normalised on both sides before comparing. The emitter writes LF, git
    // stores LF, but a Windows checkout hands this file back as CRLF — so a raw comparison
    // fails on Windows and passes in CI for a reason that has nothing to do with the fixtures.
    // Content is still compared exactly; only the newline convention is allowed to differ.
    const lf = (s: string) => s.replace(/\r\n/g, "\n");
    const committed = readFileSync(MANIFEST_PATH, "utf8");
    assert.equal(
      lf(committed),
      lf(serialiseManifest()),
      "The fixture records changed and the manifest was not regenerated. Run: node --import tsx src/lib/home-layer/fixtures/emit-manifest.ts",
    );
  });

  it("builds identically when built twice", () => {
    assert.equal(JSON.stringify(buildManifest()), JSON.stringify(buildManifest()));
  });

  it("records all thirteen scenarios with their derived numbers", () => {
    const manifest = buildManifest();
    assert.equal(manifest.scenarios.length, SCENARIO_IDS.length);
    for (const entry of manifest.scenarios) {
      assert.ok(entry.proves && entry.proves.length > 0, `${entry.id} proves nothing`);
      assert.ok(entry.urls.lab.today.includes(`scenario=${entry.id}`));
      assert.ok(entry.urls.home.today.startsWith("/app/home"));
      assert.equal(entry.analytics.claims.length, 7);
    }
  });

  it("records the canonical review story exactly as the brief states it", () => {
    const manifest = buildManifest();
    assert.equal(manifest.story.user, "Orla");
    assert.equal(manifest.story.activeProject, "Mara & Finn");
    assert.deepEqual(manifest.story.projects, [
      "Mara & Finn",
      "Nora & Cian",
      "Aisling & Tom",
    ]);
  });

  it("records a capture matrix of four directions by five modes by thirteen scenarios", () => {
    const manifest = buildManifest();
    assert.equal(manifest.captureMatrix.total, 4 * 5 * 13);
  });
});
