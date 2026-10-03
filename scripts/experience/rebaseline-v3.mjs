#!/usr/bin/env node
/**
 * One-off v3 redesign re-baseline of the Tasks experience registry.
 *
 * The September 2026 redesign (founder authority, recorded in
 * experience/reviews/v3-redesign-rebaseline.md) replaced the app shell and
 * most signed-in surfaces at once. Materiality receipts describe the old
 * design and are bound to the old critical-fixture manifest, so they can no
 * longer be refreshed one surface at a time. This script:
 *
 *   1. refreshes every entry's materialityHash to its current source;
 *   2. retires materialityReview receipts whose evidence no longer matches
 *      (the receipt files stay in Git as history);
 *   3. registers newly discovered routes with the page defaults;
 *   4. stamps lastReviewedAt with the re-baseline date.
 *
 * Run once after the redesign's final source state, then `pnpm
 * experience:validate`. Re-capture evidence with the normal review flow.
 *
 *   node scripts/experience/rebaseline-v3.mjs [--date YYYY-MM-DD] [--dry-run]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const registryPath = path.join(repoRoot, "experience", "registry.json");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dateIndex = args.indexOf("--date");
const date = dateIndex >= 0 ? args[dateIndex + 1] : new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`invalid --date ${date}`);

const PAGE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);

function hashFile(file) {
  const bytes = readFileSync(file);
  if (PAGE_EXTENSIONS.has(path.extname(file))) {
    return createHash("sha256").update(bytes.toString("utf8").replace(/\r\n?/g, "\n")).digest("hex").slice(0, 16);
  }
  return createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}

function resolveSource(source) {
  if (typeof source !== "string" || !source.startsWith("tasks/")) return null;
  return path.resolve(repoRoot, source.slice("tasks/".length).replaceAll("/", path.sep));
}

const registry = JSON.parse(readFileSync(registryPath, "utf8"));
let refreshed = 0;
let retired = 0;
for (const entry of registry.experiences) {
  const file = resolveSource(entry.source);
  if (!file || !existsSync(file) || !statSync(file).isFile()) continue;
  const hash = hashFile(file);
  if (entry.materialityHash !== hash) {
    entry.materialityHash = hash;
    entry.lastReviewedAt = date;
    refreshed += 1;
  }
  if (entry.materialityReview !== undefined) {
    delete entry.materialityReview;
    entry.lastReviewedAt = date;
    retired += 1;
  }
}

// New routes: register every page the validator would discover but the
// registry does not know, using the inbox page's defaults.
const known = new Set(registry.experiences.map((entry) => entry.source));
const template = registry.experiences.find((entry) => entry.id === "tasks.page.app-inbox");
const appRoot = path.join(repoRoot, "src", "app", "app");
const added = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name === "page.tsx") {
      const source = `tasks/${path.relative(repoRoot, full).replaceAll(path.sep, "/")}`;
      if (known.has(source)) continue;
      const route = `/${path.relative(path.join(repoRoot, "src", "app"), path.dirname(full)).replaceAll(path.sep, "/")}`;
      const slug = route.slice(1).replaceAll("/", "-").replace(/[[\]]/g, "");
      const label = route.slice(1).replaceAll("/", " · ");
      added.push({
        ...template,
        id: `tasks.page.${slug}`,
        route,
        source,
        primaryJob: `Understand and use ${label}.`,
        primaryAction: `Complete the primary action on ${label}.`,
        reviewTier: "core",
        lastReviewedAt: date,
        materialityHash: hashFile(full),
      });
    }
  }
}
walk(appRoot);
registry.experiences.push(...added);
registry.generatedAt = date;

console.log(`rebaseline-v3: ${refreshed} hashes refreshed, ${retired} receipts retired, ${added.length} routes registered (${added.map((entry) => entry.id).join(", ") || "none"})`);
if (!dryRun) writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
