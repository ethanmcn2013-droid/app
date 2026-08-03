#!/usr/bin/env node
/**
 * E08.10 — performance budgets that are actually measured.
 *
 * Why this exists. `contracts/launch-budgets.v1.json` in the studio repo has
 * carried numeric budgets since June 2026. Nothing measured them: the only
 * consumer, `check-launch-budgets.mjs`, reads a measurements file that has
 * said `"source": "pending browser/provider measurement"` and four nulls the
 * whole time, and it is not in any CI workflow. A budget nobody measures is
 * not a budget.
 *
 * What this measures, for real, from a production build:
 *   shared_runtime   the client JS every App Router route loads
 *                    (build-manifest rootMainFiles + polyfillFiles)
 *   total_client_js  every emitted client chunk
 *   largest_chunk    the single heaviest chunk
 *   repo_images      the heaviest image checked into the public directory
 *
 * What it does NOT measure, and says so rather than reporting a pass:
 *   LCP / INP / CLS  no RUM provider is wired in either repo (verified
 *                    2026-08-03: no @vercel/speed-insights, no
 *                    useReportWebVitals, no web-vitals dependency)
 *   per-route first-load JS
 *                    Next 16 with Turbopack no longer prints the Size /
 *                    First Load JS columns in the build route table, and
 *                    emits no app-build-manifest.json, so per-route client
 *                    weight cannot be derived from build output alone
 *   server p75/p95   requires production traffic
 *
 * Two numbers per budget, deliberately.
 *   `budget`  the target. Where one already existed in launch-budgets.v1.json
 *             it is carried over unchanged rather than reinvented.
 *   `ceiling` the ratchet: today's measured value. THIS is what fails the
 *             build. It may only ever be lowered, in the same way
 *             `.ds-grandfather.json` ratchets design-system debt. That lets
 *             the check run in CI from day one on a codebase that is already
 *             over budget, instead of being switched off until someone has
 *             time to fix the bundle.
 *
 * EVERY BUDGET CARRIES ITS POPULATION, and an empty population is never a
 * pass. This is the failure mode that made the script this one replaces
 * worthless: it reported `built: false, gzipBytes: 0` for four repositories
 * and exited 0, so "nothing was measured" and "everything is within budget"
 * produced the same green. Here, a budget whose population is zero exits 3
 * unless the contract declares the emptiness with a reason, and even then it
 * prints `no data (declared)` rather than `ok`.
 *
 * Exit codes:
 *   0  pass
 *   2  a ceiling was exceeded
 *   3  nothing was measured, or the contract and the script disagree
 *
 * Usage:
 *   node scripts/check-performance-budgets.mjs             check
 *   node scripts/check-performance-budgets.mjs --report    print only, never fails
 *   node scripts/check-performance-budgets.mjs --receipt <path>   write a JSON receipt
 *   node scripts/check-performance-budgets.mjs --self-test  prove the rules, no build needed
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const CONTRACT = "contracts/venue-surface-performance-budgets.v1.json";
const NEXT_DIR = ".next";
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif"]);

// ── The rules, as a pure function ────────────────────────────────────────────
// Extracted so `--self-test` can prove them without a production build. A
// checker whose own logic is never exercised is the same class of thing as a
// budget nobody measures.

export const NO_DATA = "no data (declared)";

/**
 * @param {object} contract  the parsed budget contract
 * @param {Record<string, number>} measured    id -> measured value
 * @param {Record<string, number>} populations id -> how many things that value was computed over
 * @returns {{rows: object[], breaches: string[], errors: string[]}}
 */
export function evaluate(contract, measured, populations) {
  const rows = [];
  const breaches = [];
  const errors = [];

  for (const [id, spec] of Object.entries(contract.measured)) {
    const value = measured[id];
    const population = populations[id];

    if (value == null) {
      errors.push(`contract names a measured budget "${id}" this script does not produce`);
      continue;
    }
    if (population == null) {
      errors.push(`budget "${id}" was produced without a population count`);
      continue;
    }

    if (population === 0) {
      const declared = spec.emptyPopulation;
      if (!declared?.expected || !declared.reason) {
        errors.push(
          `budget "${id}" measured nothing (population 0) and the contract does not declare that. ` +
            `Refusing to report a green from an empty set. Either the measurement is broken, or ` +
            `add "emptyPopulation": { "expected": true, "reason": "..." } to the contract entry.`,
        );
        continue;
      }
      rows.push({
        id,
        unit: spec.unit,
        measured: value,
        population,
        ceiling: spec.ceiling,
        budget: spec.budget,
        state: NO_DATA,
        surfaces: spec.surfaces,
      });
      continue;
    }

    const overCeiling = value > spec.ceiling;
    const overBudget = value > spec.budget;
    rows.push({
      id,
      unit: spec.unit,
      measured: value,
      population,
      ceiling: spec.ceiling,
      budget: spec.budget,
      state: overCeiling ? "BREACH" : overBudget ? "over-budget (ratcheted)" : "ok",
      surfaces: spec.surfaces,
    });
    if (overCeiling) {
      breaches.push(`${id}: ${value}${spec.unit} exceeds ceiling ${spec.ceiling}${spec.unit}`);
    }
  }

  return { rows, breaches, errors };
}

// ── Self-test ────────────────────────────────────────────────────────────────

function selfTest() {
  const assert = (condition, message) => {
    if (!condition) {
      console.error(`  FAIL  ${message}`);
      process.exitCode = 1;
    } else {
      console.log(`  ok    ${message}`);
    }
  };

  const spec = (extra = {}) => ({
    unit: "KB gzip",
    budget: 100,
    ceiling: 120,
    surfaces: ["x"],
    ...extra,
  });

  console.log("check-performance-budgets --self-test");

  {
    const c = { measured: { a: spec() } };
    const { rows, breaches, errors } = evaluate(c, { a: 90 }, { a: 5 });
    assert(errors.length === 0 && breaches.length === 0, "a value under budget passes");
    assert(rows[0].state === "ok", "a value under budget reads ok");
  }
  {
    const c = { measured: { a: spec() } };
    const { rows, breaches } = evaluate(c, { a: 110 }, { a: 5 });
    assert(breaches.length === 0, "over budget but under ceiling does not fail the build");
    assert(rows[0].state === "over-budget (ratcheted)", "over budget is stated, not hidden");
  }
  {
    const c = { measured: { a: spec() } };
    const { breaches } = evaluate(c, { a: 121 }, { a: 5 });
    assert(breaches.length === 1, "over the ceiling is a breach");
  }
  {
    const c = { measured: { a: spec() } };
    const { breaches } = evaluate(c, { a: 120 }, { a: 5 });
    assert(breaches.length === 0, "exactly at the ceiling is not a breach");
  }
  {
    // The whole reason this function exists.
    const c = { measured: { a: spec() } };
    const { errors, rows } = evaluate(c, { a: 0 }, { a: 0 });
    assert(errors.length === 1, "an empty population is an error, not a pass");
    assert(rows.length === 0, "an undeclared empty population produces no green row");
  }
  {
    const c = {
      measured: {
        a: spec({ emptyPopulation: { expected: true, reason: "there are none, and that is known" } }),
      },
    };
    const { errors, rows } = evaluate(c, { a: 0 }, { a: 0 });
    assert(errors.length === 0, "a declared empty population is allowed");
    assert(rows[0].state === NO_DATA, "a declared empty population never reads ok");
  }
  {
    const c = { measured: { a: spec(), ghost: spec() } };
    const { errors } = evaluate(c, { a: 1 }, { a: 1 });
    assert(errors.length === 1, "a contract budget the script cannot produce is an error");
  }
  {
    const c = { measured: { a: spec() } };
    const { errors } = evaluate(c, { a: 1 }, {});
    assert(errors.length === 1, "a measurement with no population count is an error");
  }

  if (process.exitCode) {
    console.error("\ncheck-performance-budgets: SELF-TEST FAILED");
    process.exit(1);
  }
  console.log("\ncheck-performance-budgets: self-test ok");
  process.exit(0);
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.includes("--self-test")) selfTest();

const reportOnly = args.includes("--report");
const receiptIndex = args.indexOf("--receipt");
const receiptPath = receiptIndex >= 0 ? args[receiptIndex + 1] : null;

function fail(message, code) {
  console.error(`performance-budgets: ${message}`);
  process.exit(code);
}

if (!fs.existsSync(CONTRACT)) {
  fail(`missing budget contract at ${CONTRACT}`, 3);
}
const contract = JSON.parse(fs.readFileSync(CONTRACT, "utf8"));

/**
 * Hard failure, not a zero reading. The script this replaces reported
 * `built: false, gzipBytes: 0` for four repositories that had been merged
 * into one, and exited 0 — so "no build" and "a perfect build" produced the
 * same green.
 */
if (!fs.existsSync(path.join(NEXT_DIR, "build-manifest.json"))) {
  fail(
    `no production build found (${NEXT_DIR}/build-manifest.json). Run \`pnpm build\` first. ` +
      `Refusing to report a measurement of zero.`,
    3,
  );
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const gzipKb = (buffer) => zlib.gzipSync(buffer, { level: 9 }).length / 1024;
const round = (value) => Math.round(value * 10) / 10;

const manifest = JSON.parse(fs.readFileSync(path.join(NEXT_DIR, "build-manifest.json"), "utf8"));
const sharedFiles = [...(manifest.rootMainFiles ?? []), ...(manifest.polyfillFiles ?? [])];
if (sharedFiles.length === 0) {
  fail("build-manifest.json declared no rootMainFiles — the manifest shape changed", 3);
}

let sharedGzip = 0;
const missingShared = [];
for (const file of sharedFiles) {
  const full = path.join(NEXT_DIR, file);
  if (!fs.existsSync(full)) {
    missingShared.push(file);
    continue;
  }
  sharedGzip += gzipKb(fs.readFileSync(full));
}
if (missingShared.length > 0) {
  fail(`build manifest references ${missingShared.length} chunk(s) that do not exist on disk`, 3);
}

const chunks = walk(path.join(NEXT_DIR, "static", "chunks")).filter((file) => file.endsWith(".js"));
let totalGzip = 0;
let largest = { gzipKb: 0, file: null };
for (const file of chunks) {
  const size = gzipKb(fs.readFileSync(file));
  totalGzip += size;
  if (size > largest.gzipKb) largest = { gzipKb: size, file: path.basename(file) };
}

const publicDir = contract.imageRoot ?? "public";
if (!fs.existsSync(publicDir)) {
  fail(
    `imageRoot "${publicDir}" does not exist. A missing directory would otherwise be measured ` +
      `as zero bytes and reported as within budget.`,
    3,
  );
}
let heaviestImage = { kb: 0, file: null };
let imageCount = 0;
for (const file of walk(publicDir)) {
  if (!IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
  imageCount += 1;
  const kb = fs.statSync(file).size / 1024;
  if (kb > heaviestImage.kb) heaviestImage = { kb, file: path.relative(publicDir, file) };
}

const measured = {
  shared_runtime: round(sharedGzip),
  total_client_js: round(totalGzip),
  largest_chunk: round(largest.gzipKb),
  repo_images: round(heaviestImage.kb),
};

/**
 * How many things each number was computed over. A budget with a population of
 * zero is not within budget; it is unmeasured, and it says so.
 */
const populations = {
  shared_runtime: sharedFiles.length,
  total_client_js: chunks.length,
  largest_chunk: chunks.length,
  repo_images: imageCount,
};

const detail = {
  sharedChunkCount: sharedFiles.length,
  clientChunkCount: chunks.length,
  largestChunkFile: largest.file,
  repoImageCount: imageCount,
  heaviestImageFile: heaviestImage.file,
};

const { rows, breaches, errors } = evaluate(contract, measured, populations);

const receipt = {
  schema: "signal-performance-budgets/2",
  measuredAt: new Date().toISOString(),
  repo: contract.repo,
  contractVersion: contract.version,
  measured,
  populations,
  detail,
  rows,
  unmeasured: contract.unmeasured,
  breaches,
  errors,
  ok: breaches.length === 0 && errors.length === 0,
};

const pad = (value, width) => String(value).padEnd(width);
console.log(`performance budgets · ${contract.repo} · contract v${contract.version}`);
console.log("");
console.log(
  `  ${pad("budget", 20)}${pad("measured", 16)}${pad("over", 10)}${pad("ceiling", 16)}${pad("target", 16)}state`,
);
for (const row of rows) {
  console.log(
    `  ${pad(row.id, 20)}${pad(`${row.measured} ${row.unit}`, 16)}${pad(row.population, 10)}${pad(`${row.ceiling} ${row.unit}`, 16)}${pad(`${row.budget} ${row.unit}`, 16)}${row.state}`,
  );
}
console.log("");
console.log(`  largest chunk: ${detail.largestChunkFile ?? "none"}`);
console.log(
  `  images in ${publicDir}: ${detail.repoImageCount} (heaviest ${detail.heaviestImageFile ?? "none"})`,
);
console.log("");
console.log("  NOT measured here, and not claimed as passing:");
for (const item of contract.unmeasured) {
  console.log(`    ${pad(item.id, 24)}${item.reason}`);
}

if (receiptPath) {
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`\n  receipt written to ${receiptPath}`);
}

if (reportOnly) process.exit(0);

if (errors.length > 0) {
  console.error("\nperformance-budgets: NOTHING MEASURED");
  for (const error of errors) console.error(`  ${error}`);
  process.exit(3);
}

if (breaches.length > 0) {
  console.error("\nperformance-budgets: FAILED");
  for (const breach of breaches) console.error(`  ${breach}`);
  console.error(
    "\nThe ceiling is a ratchet. Reduce the bundle, or bring the change to the founder — " +
      "raising a ceiling is a decision, not an edit.",
  );
  process.exit(2);
}

console.log("\nperformance-budgets: ok");
