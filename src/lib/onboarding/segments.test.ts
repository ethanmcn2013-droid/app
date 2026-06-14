/**
 * Segment config integrity tests.
 *
 * Run: ./node_modules/.bin/tsx src/lib/onboarding/segments.test.ts
 */

import { strict as assert } from "node:assert";
import {
  SEGMENTS,
  SEGMENT_ORDER,
  buildSignUpUrl,
  buildWelcomeUrl,
  isPrimaryUseCase,
  segmentFromParam,
  type PrimaryUseCase,
} from "./segments.js";
// Domain ids from seed.ts / domains.ts
const VALID_DOMAIN_IDS = new Set([
  "marketing",
  "student",
  "freelance",
  "wedding",
  "trades",
]);

interface TestCase {
  name: string;
  fn: () => void;
}
const tests: TestCase[] = [];
function test(name: string, fn: () => void): void {
  tests.push({ name, fn });
}

test("SEGMENT_ORDER lists every segment exactly once", () => {
  const ids = Object.keys(SEGMENTS) as PrimaryUseCase[];
  assert.equal(SEGMENT_ORDER.length, ids.length);
  for (const id of ids) {
    assert.ok(SEGMENT_ORDER.includes(id), `missing ${id} in SEGMENT_ORDER`);
  }
});

test("every segment maps to a valid domainId", () => {
  for (const id of SEGMENT_ORDER) {
    const cfg = SEGMENTS[id];
    assert.ok(
      VALID_DOMAIN_IDS.has(cfg.domainId),
      `${id} has invalid domainId ${cfg.domainId}`,
    );
  }
});

test("every segment has non-empty copy", () => {
  for (const id of SEGMENT_ORDER) {
    const cfg = SEGMENTS[id];
    assert.ok(cfg.label.length > 0, `${id} missing label`);
    assert.ok(cfg.description.length > 0, `${id} missing description`);
    assert.ok(cfg.emptyState.headline.length > 0, `${id} missing headline`);
    assert.ok(cfg.starterItems.length >= 3, `${id} needs starter items`);
  }
});

test("context segments have matching options", () => {
  for (const id of SEGMENT_ORDER) {
    const cfg = SEGMENTS[id];
    if (cfg.contextQuestion) {
      assert.ok(
        cfg.contextOptions.length >= 2,
        `${id} has question but no options`,
      );
    } else {
      assert.equal(
        cfg.contextOptions.length,
        0,
        `${id} has options without question`,
      );
    }
  }
});

test("isPrimaryUseCase guards unknown values", () => {
  assert.ok(isPrimaryUseCase("venue"));
  assert.ok(!isPrimaryUseCase("unknown-segment"));
});

test("segmentFromParam resolves marketing aliases", () => {
  assert.equal(segmentFromParam("venues"), "venue");
  assert.equal(segmentFromParam("students"), "student");
  assert.equal(segmentFromParam(null), null);
});

test("buildSignUpUrl and buildWelcomeUrl encode use param", () => {
  assert.equal(buildSignUpUrl("venue"), "/sign-up?use=venue");
  assert.equal(buildWelcomeUrl("student"), "/welcome?use=student");
  assert.equal(buildSignUpUrl(null), "/sign-up");
});

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    passed++;
    console.log(`  ✓ ${t.name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${t.name}`);
    console.error(e);
  }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
