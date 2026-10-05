/**
 * All projects: the read is catalog-scoped, and sample rows exist only in
 * demo and review.
 *
 * Run with: node --import tsx --import ./src/test/register-server-only.mjs --test
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

function withAccessMode<T>(mode: string, run: () => T): T {
  const previous = process.env.SIGNAL_ACCESS_MODE;
  process.env.SIGNAL_ACCESS_MODE = mode;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.SIGNAL_ACCESS_MODE;
    else process.env.SIGNAL_ACCESS_MODE = previous;
  }
}

test("sample rows are absent outside demo and review", async () => {
  const { reviewSampleRows, reviewPortfolioRows } = await import("./project-portfolio-review");
  for (const mode of ["production", "development"]) {
    withAccessMode(mode, () => {
      assert.deepEqual(reviewSampleRows(), [], `${mode} must never show a made-up Project`);
      assert.deepEqual(reviewPortfolioRows(), []);
    });
  }
});

test("review shows the review Project first, then six labelled samples that never navigate", async () => {
  const { reviewPortfolioRows, SAMPLE_ID_PREFIX } = await import("./project-portfolio-review");
  const { barGeometry, OPEN_ENDED_DAYS } = await import("@/lib/projects/project-portfolio");
  const { addDays, timeRange } = await import("@/lib/projects/project-portfolio-scale");
  const today = "2026-07-16";
  const rows = withAccessMode("review", () => reviewPortfolioRows());
  assert.equal(rows.length, 7);
  assert.equal(rows[0].sample, false);
  assert.equal(rows[0].name, "The Orchard, events");
  assert.equal(rows[0].timelineName, "Mara & Finn");
  const samples = rows.slice(1);
  assert.equal(samples.length, 6);
  for (const sample of samples) {
    assert.equal(sample.sample, true);
    assert.ok(sample.id.startsWith(SAMPLE_ID_PREFIX), "sample ids cannot collide with a real Project");
    assert.equal(sample.href, null, "a sample never navigates");
    assert.equal(sample.overviewHref, null);
  }
  // Every bar case the vocabulary names is present (spec 5.2).
  const statuses = new Set(rows.map((row) => row.status));
  for (const status of ["at-risk", "on-track", "paused", "complete", null]) assert.ok(statuses.has(status as never));
  assert.ok(rows.some((row) => row.target === null && row.status !== "paused"), "an open-ended bar");
  assert.ok(rows.some((row) => barGeometry(row, today).pastTarget), "a bar past its target");
  assert.ok(
    rows.some((row) => row.milestones.some((m) => !m.done && m.date < today)),
    "an overdue milestone",
  );
  const dates = rows.flatMap((row) => [row.start, row.target, ...row.milestones.map((m) => m.date)]);
  dates.push(addDays(today, OPEN_ENDED_DAYS));
  assert.ok(timeRange(dates, today, "months").clippedBefore, "a range clipped at its start");
});

test("the read takes its ids from the catalog only and is not a Server Function", () => {
  const source = readFileSync(here("./project-portfolio.ts"), "utf8");
  assert.doesNotMatch(source, /^["']use server["']/m, "a Server Function can be POSTed foreign ids");
  assert.match(source, /import "server-only";/);
  assert.match(source, /await loadProjectCatalogAction\(\)/, "the Project list is the catalog");
  assert.match(source, /const ids = active\.map\(\(row\) => row\.id\)/, "ids come from catalog rows");
  assert.match(source, /export async function loadProjectPortfolio\(\)/, "and the loader accepts no ids at all");
  // Every read filters on those ids.
  const reads = source.match(/inArray\((?:tasks\.workspaceId|workspaces\.id|meta\.key), \[?\.{0,3}(\w+)/g) ?? [];
  assert.ok(reads.length >= 5);
  for (const read of reads) assert.match(read, /(ids|keys)$/);
  // Review never reaches the database branch.
  const demoBranch = source.indexOf("if (isDemoMode())");
  assert.ok(demoBranch > 0 && demoBranch < source.indexOf("await readMeta("), "review returns before any read");
});
