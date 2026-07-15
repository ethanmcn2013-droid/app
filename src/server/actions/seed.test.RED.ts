/**
 * RED test, proves the bug with the original (unfixed) allowlists.
 * These use the exact values that were in settings.ts + seed.ts before
 * the RW-1 fix. Should fail on "trades" being absent.
 * Delete this file after capturing RED output.
 */

import { strict as assert } from "node:assert";
import { DOMAIN_ORDER, type DomainId } from "../../lib/domains.js";

// BUGGY values, as they existed before the fix:
const VALID_DOMAINS_BUGGY = new Set<DomainId>([
  "marketing",
  "student",
  "freelance",
  "wedding",
  // "trades" INTENTIONALLY OMITTED to reproduce bug
]);

const DOMAIN_IDS_BUGGY = new Set<DomainId>([
  "marketing",
  "student",
  "freelance",
  "wedding",
  // "trades" INTENTIONALLY OMITTED to reproduce bug
]);

interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
}
const tests: TestCase[] = [];
function test(name: string, fn: () => void | Promise<void>): void {
  tests.push({ name, fn });
}

test("[RED] every pack in DOMAIN_ORDER is present in VALID_DOMAINS (settings.ts guard)", () => {
  const missing = DOMAIN_ORDER.filter((id) => !VALID_DOMAINS_BUGGY.has(id));
  assert.deepEqual(
    missing,
    [],
    `VALID_DOMAINS is missing: ${missing.join(", ")}, clicking these cards throws "Unknown domain pack"`,
  );
});

test("[RED] every pack in DOMAIN_ORDER is present in DOMAIN_IDS (seed.ts guard)", () => {
  const missing = DOMAIN_ORDER.filter((id) => !DOMAIN_IDS_BUGGY.has(id));
  assert.deepEqual(
    missing,
    [],
    `DOMAIN_IDS is missing: ${missing.join(", ")}, seedDomainAction throws for these packs`,
  );
});

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
