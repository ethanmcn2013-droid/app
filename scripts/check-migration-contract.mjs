import fs from "node:fs";
import { loadAndValidateLedger } from "./db/migration-ledger.mjs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const scripts = packageJson.scripts ?? {};
const dev = String(scripts.dev ?? "");
const bootstrap = String(scripts["db:bootstrap"] ?? "");
const migrate = String(scripts["db:migrate"] ?? "");
const adopt = String(scripts["db:adopt"] ?? "");
const contract = String(scripts["db:contract"] ?? "");
const timelineMigrate = String(scripts["timeline:db:migrate"] ?? "");
const timelineAdopt = String(scripts["timeline:db:adopt"] ?? "");
const timelineDryRun = String(scripts["timeline:db:dry-run"] ?? "");

if (/drizzle-kit\s+push/i.test(dev)) {
  console.error("migration-contract: dev must not run drizzle-kit push");
  process.exit(1);
}
if (migrate !== "node scripts/db/migrate.mjs migrate") {
  console.error("migration-contract: db:migrate must use the exact-row receipt-backed runner");
  process.exit(1);
}
if (!bootstrap.startsWith(`${migrate} &&`)) {
  console.error("migration-contract: db:bootstrap must apply the canonical baseline before seed");
  process.exit(1);
}
if (adopt !== "node scripts/db/migrate.mjs adopt") {
  console.error("migration-contract: db:adopt must use the receipt-backed adoption path");
  process.exit(1);
}
if (!contract.includes("scripts/db/migration-ledger.test.mjs")) {
  console.error("migration-contract: db:contract must run the fail-closed migration tests");
  process.exit(1);
}

// ── The Timeline runner (WP4) ────────────────────────────────────────────────
// Timeline is a second database with a second ledger, and it needs the same
// three properties as Tasks: one receipt-backed way in, one receipt-backed way
// to adopt an existing database, and a dry run that writes nothing. A
// `drizzle-kit push` hiding inside any of them is the failure this catches.
if (timelineMigrate !== "node scripts/db/timeline-migrate.mjs migrate") {
  console.error("migration-contract: timeline:db:migrate must use the receipt-backed Timeline runner");
  process.exit(1);
}
if (timelineAdopt !== "node scripts/db/timeline-migrate.mjs adopt") {
  console.error("migration-contract: timeline:db:adopt must use the receipt-backed adoption path");
  process.exit(1);
}
if (timelineDryRun !== "node scripts/db/timeline-migrate.mjs migrate --dry-run") {
  console.error("migration-contract: timeline:db:dry-run must be the runner's own dry run");
  process.exit(1);
}
for (const [name, command] of Object.entries(scripts)) {
  if (/^timeline:db:(migrate|adopt|status|dry-run)$/.test(name) && /drizzle-kit/.test(String(command))) {
    console.error(`migration-contract: ${name} must not shell out to drizzle-kit`);
    process.exit(1);
  }
}
for (const required of [
  "scripts/db/timeline-migrate.test.mjs",
  "scripts/db/timeline-inventory.test.mjs",
  "scripts/db/timeline-binding-classification.test.mjs",
  "scripts/db/timeline-backfill-bindings.test.mjs",
]) {
  if (!contract.includes(required)) {
    console.error(`migration-contract: db:contract must run ${required}`);
    process.exit(1);
  }
}
// The inventory runs against production by hand. Its inability to write is a
// property of the file, so it is checked as one.
const inventorySource = fs.readFileSync("scripts/db/timeline-inventory.mjs", "utf8");
if ((inventorySource.match(/\.execute\s*\(/g) ?? []).length !== 1) {
  console.error("migration-contract: the Timeline inventory must make every database call through readOnlyQuery");
  process.exit(1);
}

const context = loadAndValidateLedger();
const timeline = loadAndValidateLedger({ module: "timeline" });
console.log(`migration-contract: ok (tasks: ${context.entries.length} SQL files, baseline ${context.baseline.id}; timeline: ${timeline.entries.length} SQL files, baseline ${timeline.baseline.id})`);
