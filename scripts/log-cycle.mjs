#!/usr/bin/env node
/**
 * Wrapper around the canonical log-cycle.ts that lives in the
 * portfolio repo. Posts a "Cycle N shipped" row into the shared
 * Turso roadmap DB so /roadmap (on ethanmcnamara.com) stays
 * truthful across all three products.
 *
 * Forward args verbatim:
 *   node scripts/log-cycle.mjs \
 *     --cycle 46 \
 *     --title "Whatever just shipped" \
 *     --date 2026-05-08 \
 *     [--description "..."]
 *
 * --project is forced to "tasks" — don't pass it.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const PORTFOLIO_PATH =
  "/Users/ethanmcnamara/Projects/personal/ethanmcnamara";
const PROJECT = "tasks";

if (!existsSync(PORTFOLIO_PATH)) {
  console.error(
    `log-cycle: portfolio repo not found at ${PORTFOLIO_PATH}. ` +
      `Either clone ethanmcnamara repo there, or update PORTFOLIO_PATH ` +
      `in this wrapper.`,
  );
  process.exit(1);
}

const passed = process.argv.slice(2);
if (passed.includes("--project")) {
  console.error(
    "log-cycle: don't pass --project from this wrapper; it's forced to 'tasks'.",
  );
  process.exit(1);
}

const result = spawnSync(
  "npx",
  ["tsx", "scripts/log-cycle.ts", "--project", PROJECT, ...passed],
  { cwd: PORTFOLIO_PATH, stdio: "inherit" },
);
process.exit(result.status ?? 1);
