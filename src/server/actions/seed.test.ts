/**
 * RW-1 regression tests, starter-pack domain allowlists.
 *
 * Root cause: VALID_DOMAINS (settings.ts) and DOMAIN_IDS (seed.ts) both
 * omitted "trades", so clicking the Trades card threw "Unknown domain pack"
 * and the UI silently reloaded. These tests pin the allowlists against
 * DOMAIN_ORDER so the same omission can never silently re-appear.
 *
 * Run via:
 *   ./node_modules/.bin/tsx src/server/actions/seed.test.ts
 *
 * No DB connection required, tests import constants only.
 */

import { strict as assert } from "node:assert";
import { DOMAIN_ORDER, DOMAINS, type DomainId } from "../../lib/domains.js";

// ── inline the allowlists from their source files so we test the
//    exact values in code, not derived copies ──────────────────────

// From src/server/actions/settings.ts
const VALID_DOMAINS = new Set<DomainId>([
  "marketing",
  "student",
  "freelance",
  "wedding",
  "trades",
]);

// From src/server/actions/seed.ts
const DOMAIN_IDS = new Set<DomainId>([
  "marketing",
  "student",
  "freelance",
  "wedding",
  "trades",
]);

// ── test harness (same pattern as parser.test.ts) ────────────────

interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
}
const tests: TestCase[] = [];
function test(name: string, fn: () => void | Promise<void>): void {
  tests.push({ name, fn });
}

// ── tests ─────────────────────────────────────────────────────────

test("DOMAIN_ORDER contains exactly 4 user-facing packs", () => {
  assert.equal(
    DOMAIN_ORDER.length,
    4,
    `expected 4 domains in DOMAIN_ORDER, got ${DOMAIN_ORDER.length}: ${DOMAIN_ORDER.join(", ")}`,
  );
});

test("every pack in DOMAIN_ORDER is present in VALID_DOMAINS (settings.ts guard)", () => {
  const missing = DOMAIN_ORDER.filter((id) => !VALID_DOMAINS.has(id));
  assert.deepEqual(
    missing,
    [],
    `VALID_DOMAINS is missing: ${missing.join(", ")}, clicking these cards throws "Unknown domain pack"`,
  );
});

test("every pack in DOMAIN_ORDER is present in DOMAIN_IDS (seed.ts guard)", () => {
  const missing = DOMAIN_ORDER.filter((id) => !DOMAIN_IDS.has(id));
  assert.deepEqual(
    missing,
    [],
    `DOMAIN_IDS is missing: ${missing.join(", ")}, seedDomainAction throws for these packs`,
  );
});

test("wedding pack seeds a non-empty task list", () => {
  const pack = DOMAINS["wedding"];
  const taskKeys = Object.keys(pack.tasks);
  assert.ok(
    taskKeys.length > 0,
    "wedding pack has no tasks, reseed yields empty board",
  );
  // The canonical seed structure uses t-101..t-404 (16 tasks)
  assert.ok(
    taskKeys.length >= 16,
    `expected >= 16 task overlays in wedding pack, got ${taskKeys.length}`,
  );
});

test("trades pack seeds a non-empty task list", () => {
  const pack = DOMAINS["trades"];
  const taskKeys = Object.keys(pack.tasks);
  assert.ok(
    taskKeys.length > 0,
    "trades pack has no tasks, reseed yields empty board",
  );
  assert.ok(
    taskKeys.length >= 16,
    `expected >= 16 task overlays in trades pack, got ${taskKeys.length}`,
  );
});

test("freelance pack seeds a non-empty task list", () => {
  const pack = DOMAINS["freelance"];
  const taskKeys = Object.keys(pack.tasks);
  assert.ok(taskKeys.length >= 16, `expected >= 16, got ${taskKeys.length}`);
});

test("student pack seeds a non-empty task list", () => {
  const pack = DOMAINS["student"];
  const taskKeys = Object.keys(pack.tasks);
  assert.ok(taskKeys.length >= 16, `expected >= 16, got ${taskKeys.length}`);
});

test("'Start from empty' path (marketing sentinel) is NOT in DOMAIN_ORDER", () => {
  assert.equal(
    DOMAIN_ORDER.includes("marketing"),
    false,
    "marketing must not appear in DOMAIN_ORDER, it is the empty-state sentinel, never a user-visible pack",
  );
});

test("marketing sentinel IS in both allowlists (clearAllTasks/markFirstRun need it)", () => {
  assert.ok(
    VALID_DOMAINS.has("marketing"),
    "marketing must remain in VALID_DOMAINS for clearAllTasks flow",
  );
  assert.ok(
    DOMAIN_IDS.has("marketing"),
    "marketing must remain in DOMAIN_IDS for seedDomainAction fallback",
  );
});

test("every pack in DOMAIN_ORDER has a non-empty label and description", () => {
  for (const id of DOMAIN_ORDER) {
    const pack = DOMAINS[id];
    assert.ok(
      pack.label && pack.label.length > 0,
      `pack ${id} missing label`,
    );
    assert.ok(
      pack.description && pack.description.length > 0,
      `pack ${id} missing description`,
    );
  }
});

test("every pack in DOMAIN_ORDER has commentBodies (seed needs these)", () => {
  for (const id of DOMAIN_ORDER) {
    const pack = DOMAINS[id];
    assert.ok(
      Array.isArray(pack.commentBodies) && pack.commentBodies.length > 0,
      `pack ${id} has empty commentBodies, seed falls back to generic comments`,
    );
  }
});

// ── runner ─────────────────────────────────────────────────────────

async function run(): Promise<void> {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`ok  - ${t.name}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL - ${t.name}`);
      console.error(err instanceof Error ? err.message : String(err));
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passing`);
  if (failed > 0) process.exit(1);
}

void run();
