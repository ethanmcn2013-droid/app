import fs from "node:fs";
import { loadAndValidateLedger } from "./db/migration-ledger.mjs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const scripts = packageJson.scripts ?? {};
const dev = String(scripts.dev ?? "");
const bootstrap = String(scripts["db:bootstrap"] ?? "");
const migrate = String(scripts["db:migrate"] ?? "");
const adopt = String(scripts["db:adopt"] ?? "");
const contract = String(scripts["db:contract"] ?? "");

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

const context = loadAndValidateLedger();
console.log(`migration-contract: ok (${context.entries.length} SQL files, ${context.entries.length} receipts, baseline ${context.baseline.id})`);
