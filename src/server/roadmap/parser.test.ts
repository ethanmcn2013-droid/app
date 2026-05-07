/**
 * Unit tests for `parsePlan()`.
 *
 * Run via:
 *   npx tsx --conditions=react-server src/server/roadmap/parser.test.ts
 *
 * The `--conditions=react-server` flag is required because the
 * parser imports `server-only`, whose default entry throws on
 * import — the `react-server` condition resolves to an empty stub.
 *
 * The parser reads `docs/gtm-plan.md` from the cwd, so this file
 * assumes you run it from the project root.
 */
import { strict as assert } from "node:assert";

import { parsePlan, type ParsedItem } from "./parser";

interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
}

const tests: TestCase[] = [];

function test(name: string, fn: () => void | Promise<void>): void {
  tests.push({ name, fn });
}

const result = parsePlan();
const items: ParsedItem[] = result.items;

test("parsePlan() returns at least 140 items (sanity)", () => {
  assert.ok(
    items.length >= 140,
    `expected >= 140 items, got ${items.length}`,
  );
});

test("every item has a non-empty id, kind, and (body || format)", () => {
  for (const it of items) {
    assert.ok(
      typeof it.id === "string" && it.id.length > 0,
      `missing id on item ord=${it.ord} kind=${it.kind}`,
    );
    assert.ok(
      typeof it.kind === "string" && it.kind.length > 0,
      `missing kind on id=${it.id}`,
    );
    const hasBodyOrFormat =
      (typeof it.body === "string" && it.body.length > 0) ||
      (typeof it.format === "string" && it.format.length > 0);
    assert.ok(
      hasBodyOrFormat,
      `id=${it.id} has neither body nor format`,
    );
  }
});

test("ids are unique across the result set", () => {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const it of items) {
    if (seen.has(it.id)) dupes.push(it.id);
    seen.add(it.id);
  }
  assert.equal(
    dupes.length,
    0,
    `found duplicate ids: ${dupes.slice(0, 5).join(", ")}`,
  );
});

test("date-bearing items are normalized to YYYY-MM-DD with year 2026", () => {
  const dated = items.filter((it) => it.date !== null);
  assert.ok(dated.length > 0, "expected at least one dated item");
  for (const it of dated) {
    assert.match(
      it.date as string,
      /^2026-\d{2}-\d{2}$/,
      `id=${it.id} has malformed date=${it.date}`,
    );
  }
});

test("week numbers are in 0..8", () => {
  for (const it of items) {
    assert.ok(
      Number.isInteger(it.week) && it.week >= 0 && it.week <= 8,
      `id=${it.id} has out-of-range week=${it.week}`,
    );
  }
});

test("the Show HN row (06-16, bolded) is flagged isLaunch=true", () => {
  // The plan's Week 6 calendar row for HN Show HN uses bold across
  // the whole row — the parser should pick that up. There is also a
  // 14-day-Gantt row dated 2026-06-16 with a bolded date column.
  const showHn = items.filter(
    (it) =>
      it.date === "2026-06-16" &&
      /show hn|hn show hn/i.test(`${it.channel ?? ""} ${it.format ?? ""}`),
  );
  assert.ok(
    showHn.length > 0,
    "expected at least one Show HN item on 2026-06-16",
  );
  assert.ok(
    showHn.some((it) => it.isLaunch === true),
    "expected at least one Show HN item to have isLaunch=true",
  );
});

test("asset checklist items have kind=asset and week=0", () => {
  const assets = items.filter((it) => it.kind === "asset");
  assert.ok(
    assets.length > 0,
    "expected at least one asset checklist item",
  );
  for (const a of assets) {
    assert.equal(a.week, 0, `asset id=${a.id} has week=${a.week}, want 0`);
  }
});

test("itemCountByKind sums to total items", () => {
  const summed = Object.values(result.itemCountByKind).reduce(
    (a, b) => a + b,
    0,
  );
  assert.equal(summed, items.length);
});

// ------- runner -------

async function run(): Promise<void> {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      // eslint-disable-next-line no-console
      console.log(`ok  - ${t.name}`);
    } catch (err) {
      failed += 1;
      // eslint-disable-next-line no-console
      console.error(`FAIL - ${t.name}`);
      // eslint-disable-next-line no-console
      console.error(err instanceof Error ? err.message : String(err));
    }
  }
  // eslint-disable-next-line no-console
  console.log(
    `\n${tests.length - failed}/${tests.length} passing` +
      ` (${items.length} parsed items)`,
  );
  if (failed > 0) process.exit(1);
}

void run();
