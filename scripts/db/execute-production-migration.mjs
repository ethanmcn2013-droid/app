// Receipt-backed production migration executor (MIGRATIONS.md §6-7).
//
// Produces, in order, inside the CI job that holds the credentials:
//   1. A logical backup of the target database (schema DDL + every row of
//      every user table, JSONL), hashed for the execution receipt. The
//      bytes are uploaded as a CI artifact; only the hash enters evidence.
//   2. An isolated-copy dry run: the backup is restored into a local file
//      database and the pending forward migrations are applied to it by
//      the ordinary runner (local URLs take the non-production path), so
//      the exact SQL and every receipt proof pass once before production
//      is touched.
//   3. A `tasks-migration-execution/1` receipt binding the target database
//      identity, environment, ledger hash, backup hash, dry-run result,
//      and the pending migration ids/hashes.
//   4. The real apply through `migrate.mjs migrate --environment=production
//      --confirm-production=tasks --receipt=<receipt>`, which re-validates
//      all of the above and executes inside its transactional envelope.
//
// Usage (CI): node scripts/db/execute-production-migration.mjs
//   env: TASKS_DATABASE_URL, TASKS_AUTH_TOKEN
//   out: DB_EVIDENCE_DIR (default .db-evidence/) with backup + receipt.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import {
  canonicalFileSha256,
  loadAndValidateLedger,
  sha256,
} from "./migration-ledger.mjs";
import { databaseIdentitySha256, schemaFingerprintSha256 } from "./migrate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

function invariant(condition, message) {
  if (!condition) {
    console.error(`db:execute: ${message}`);
    process.exit(1);
  }
}

const databaseUrl = process.env.TASKS_DATABASE_URL;
const authToken = process.env.TASKS_AUTH_TOKEN;
invariant(databaseUrl, "TASKS_DATABASE_URL is required");
invariant(!/^file:/i.test(databaseUrl) && databaseUrl !== ":memory:",
  "this executor is for remote databases; use `pnpm db:migrate` locally");

const evidenceDir = path.resolve(root, process.env.DB_EVIDENCE_DIR ?? ".db-evidence");
fs.mkdirSync(evidenceDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(evidenceDir, `backup-${stamp}.jsonl`);
const receiptPath = path.join(evidenceDir, `execution-${stamp}.json`);
const dryRunDbPath = path.join(evidenceDir, `dryrun-${stamp}.db`);

const context = loadAndValidateLedger({ root });
const remote = createClient({ url: databaseUrl, authToken });

// ── 1. Logical backup ────────────────────────────────────────────────────
const schemaRows = (await remote.execute(
  "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END, name",
)).rows;

const tables = schemaRows.filter((row) => row.type === "table").map((row) => String(row.name));
const lines = [JSON.stringify({ kind: "meta", url: "redacted", takenAt: new Date().toISOString(), tables })];
for (const row of schemaRows) {
  lines.push(JSON.stringify({ kind: "ddl", type: row.type, name: row.name, sql: row.sql }));
}

function encodeValue(value) {
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const buffer = Buffer.from(value instanceof ArrayBuffer ? value : value.buffer);
    return { $blob: buffer.toString("base64") };
  }
  if (typeof value === "bigint") return { $int: value.toString() };
  return value;
}

let totalRows = 0;
for (const table of tables) {
  const result = await remote.execute(`SELECT * FROM "${table}" ORDER BY rowid`);
  for (const row of result.rows) {
    const values = result.columns.map((_, index) => encodeValue(row[index]));
    lines.push(JSON.stringify({ kind: "row", table, columns: result.columns, values }));
    totalRows += 1;
  }
}
fs.writeFileSync(backupPath, lines.join("\n") + "\n");
const backupSha256 = sha256(fs.readFileSync(backupPath));
console.log(`db:execute: backup ${totalRows} rows across ${tables.length} tables -> ${path.basename(backupPath)} (${backupSha256})`);

// ── 2. Isolated-copy dry run ─────────────────────────────────────────────
function decodeValue(value) {
  if (value && typeof value === "object" && "$blob" in value) return Buffer.from(value.$blob, "base64");
  if (value && typeof value === "object" && "$int" in value) return BigInt(value.$int);
  return value;
}

const copy = createClient({ url: `file:${dryRunDbPath}` });
// The dump orders tables alphabetically, not topologically, so referential
// enforcement must wait until the whole restore is in: FKs off for this
// connection, and the guard triggers (which read across tables) are created
// only after every row has landed. The migration dry run that follows runs
// on its own connection with the runner's ordinary settings.
await copy.execute("PRAGMA foreign_keys = OFF");
for (const row of schemaRows) {
  if (row.type === "trigger") continue;
  await copy.execute(String(row.sql));
}
for (const line of fs.readFileSync(backupPath, "utf8").trim().split("\n")) {
  const entry = JSON.parse(line);
  if (entry.kind !== "row") continue;
  const placeholders = entry.columns.map(() => "?").join(", ");
  const quoted = entry.columns.map((column) => `"${column}"`).join(", ");
  await copy.execute({
    sql: `INSERT INTO "${entry.table}" (${quoted}) VALUES (${placeholders})`,
    args: entry.values.map(decodeValue),
  });
}
for (const row of schemaRows) {
  if (row.type !== "trigger") continue;
  await copy.execute(String(row.sql));
}
copy.close();

const dryRun = spawnSync(process.execPath, [
  path.join(here, "migrate.mjs"), "migrate", "--database-url", `file:${dryRunDbPath}`,
], { stdio: "inherit" });
invariant(dryRun.status === 0, "dry run failed; production untouched");

const migrated = createClient({ url: `file:${dryRunDbPath}` });
const dryRunFingerprint = await schemaFingerprintSha256(migrated);
migrated.close();
console.log(`db:execute: dry run passed; migrated-copy schema fingerprint ${dryRunFingerprint}`);

// ── 3. Execution receipt ─────────────────────────────────────────────────
const pending = context.forward;
// The runner recomputes true pending against the DB; the receipt must cover
// exactly what it will find. Read the database ledger to subtract applied.
const appliedIds = new Set(
  (await remote.execute("SELECT id FROM signal_schema_migrations")).rows.map((row) => String(row.id)),
);
const pendingNow = pending.filter((entry) => !appliedIds.has(entry.id));
invariant(pendingNow.length > 0, "nothing pending; refusing to write an empty execution receipt");

const receipt = {
  schemaVersion: "tasks-migration-execution/1",
  id: `tasks-migration-execution-${stamp}`,
  environment: "production",
  databaseIdentitySha256: databaseIdentitySha256(databaseUrl),
  ledgerSha256: canonicalFileSha256(path.join(root, "drizzle", "migration-ledger.json")),
  backupSha256,
  backupRows: totalRows,
  dryRun: { status: "passed", databaseSha256: dryRunFingerprint },
  migrations: pendingNow.map((entry) => ({ id: entry.id, sha256: entry.sha256 })),
};
fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
console.log(`db:execute: execution receipt ${path.basename(receiptPath)} covers ${pendingNow.map((entry) => entry.id).join(", ")}`);

// ── 4. Receipt-backed production apply ───────────────────────────────────
const apply = spawnSync(process.execPath, [
  path.join(here, "migrate.mjs"), "migrate",
  "--environment=production",
  "--confirm-production=tasks",
  `--receipt=${receiptPath}`,
], { stdio: "inherit", env: process.env });
invariant(apply.status === 0, "production apply failed");

const status = spawnSync(process.execPath, [
  path.join(here, "migrate.mjs"), "status", "--confirm-production=tasks",
], { stdio: "inherit", env: process.env });
invariant(status.status === 0, "post-apply status failed");
console.log("db:execute: production migration complete");
