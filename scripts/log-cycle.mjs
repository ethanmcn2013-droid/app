#!/usr/bin/env node
/**
 * Wrapper around the canonical log-cycle.ts that lives in this
 * repo at scripts/log-cycle.ts. Posts a "Cycle N shipped" row
 * into the shared Turso roadmap DB so /roadmap (on
 * ethanmcnamara.com) stays truthful across all three products.
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
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_PATH = resolve(REPO_ROOT, "scripts/log-cycle.ts");
const PROJECT = "tasks";

if (!existsSync(SCRIPT_PATH)) {
  console.error(
    `log-cycle: canonical script not found at ${SCRIPT_PATH}. ` +
      `This wrapper expects scripts/log-cycle.ts to live alongside it.`,
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
  { cwd: REPO_ROOT, stdio: "inherit" },
);
process.exit(result.status ?? 1);
