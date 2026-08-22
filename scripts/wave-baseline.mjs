#!/usr/bin/env node
// Records untouched-baseline results for every required repository check.
// Purpose: any failure recorded here is PRE-EXISTING and may never be attributed
// to the Active Project / Analytics wave. Written to docs/wave/BASELINE.json.
import { spawnSync } from "node:child_process";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// `build` runs FIRST: perf:budgets reads .next/build-manifest.json and exits 3
// ("refusing to report a measurement of zero") when no build output exists.
// Running it before a build produces a false failure.
const CHECKS = [
  "build",
  "typecheck",
  "lint",
  "test",
  "test:suite-url-and-switcher",
  "test:timeline-owner",
  "test:truth",
  "test:smoke",
  "db:check",
  "db:contract",
  "db:integrity",
  "first-contact:language",
  "journey:coverage",
  "perf:budgets",
  "experience:fixtures",
  "experience:validate",
  "experience:test",
  "experience:quality",
];

const sha = execSync("git rev-parse HEAD").toString().trim();
const branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
const results = [];

for (const check of CHECKS) {
  const startedAt = Date.now();
  process.stdout.write(`\n=== pnpm ${check} ===\n`);
  const run = spawnSync("pnpm", [check], {
    shell: true,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 15 * 60 * 1000,
  });
  const durationMs = Date.now() - startedAt;
  const stdout = run.stdout ?? "";
  const stderr = run.stderr ?? "";
  const tail = (stdout + stderr).split("\n").slice(-40).join("\n");
  results.push({
    command: `pnpm ${check}`,
    exitCode: run.status,
    timedOut: run.error?.code === "ETIMEDOUT",
    durationMs,
    tail,
  });
  process.stdout.write(`--> exit ${run.status} in ${Math.round(durationMs / 1000)}s\n`);
}

const out = resolve("docs/wave/BASELINE.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  JSON.stringify({ sha, branch, recordedAt: new Date().toISOString(), results }, null, 2),
);

const failed = results.filter((r) => r.exitCode !== 0);
process.stdout.write(`\n\n===== BASELINE SUMMARY =====\n`);
process.stdout.write(`sha ${sha}\n`);
for (const r of results) {
  process.stdout.write(
    `${r.exitCode === 0 ? "PASS" : "FAIL"}  ${r.command}  (exit ${r.exitCode}, ${Math.round(r.durationMs / 1000)}s)\n`,
  );
}
process.stdout.write(`\n${failed.length} of ${results.length} checks fail on untouched baseline.\n`);
