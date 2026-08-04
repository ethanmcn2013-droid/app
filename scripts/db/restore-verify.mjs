// Restore a logical backup into a throwaway database and verify it (E08.09).
//
// WHY THIS EXISTS
// ---------------
// The recovery runbook — `studio/docs/RECOVERY.md`, not a file in this repo —
// has said since 2026-06-19 that "a backup you have never restored is not a
// backup", and its rehearsal checkbox has never been ticked. This script is
// the rehearsal, as a command anyone can run and anyone can re-run.
//
// It does four things, in order, and fails loudly on any of them:
//   1. Rebuilds the schema from the DDL recorded in the backup — tables,
//      then rows, then indexes and triggers. Triggers land LAST because an
//      append-only trigger installed before the rows are inserted would
//      reject its own restore.
//   2. Replays every row.
//   3. Reads the RESTORED database back and recomputes, per table, the row
//      count and the content hash. This is the part that makes the check
//      meaningful: it verifies what is in the restored database, not what
//      is in the backup file.
//   4. Compares the recomputed values against the manifest and reports
//      every table that differs.
//
// USAGE
//   node scripts/db/restore-verify.mjs --backup=.db-backups/tasks-….jsonl
//   node scripts/db/restore-verify.mjs --backup=… --manifest=… --keep
//
// The restore target is always a fresh local file database in a temporary
// directory. This script cannot write to a remote database: it refuses any
// target that is not a local file, so a rehearsal can never become an
// accidental production overwrite.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { createClient } from "@libsql/client";
import { decodeValue, tableHash } from "./backup.mjs";

/**
 * Restore a backup body into a local file database.
 *
 * `targetUrl` must be a `file:` URL. Passing anything else throws — the
 * rehearsal must never be able to reach a real database.
 */
export async function restoreInto(targetUrl, body) {
  if (!/^file:/i.test(targetUrl)) {
    throw new Error(
      `restore target must be a local file: URL, refusing "${targetUrl}"`,
    );
  }
  const client = createClient({ url: targetUrl });
  const entries = body
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const meta = entries.find((entry) => entry.kind === "meta");
  if (!meta) throw new Error("backup has no meta line; refusing to restore");

  const ddl = entries.filter((entry) => entry.kind === "ddl");
  const rows = entries.filter((entry) => entry.kind === "row");

  // Foreign keys off for the duration: the dump is ordered alphabetically
  // by table, not topologically, so a child row can legitimately land
  // before its parent.
  await client.execute("PRAGMA foreign_keys = OFF");

  for (const entry of ddl) {
    if (entry.type !== "table") continue;
    await client.execute(entry.sql);
  }
  for (const entry of rows) {
    const quoted = entry.columns.map((c) => `"${c}"`).join(", ");
    const placeholders = entry.columns.map(() => "?").join(", ");
    await client.execute({
      sql: `INSERT INTO "${entry.table}" (${quoted}) VALUES (${placeholders})`,
      args: entry.values.map(decodeValue),
    });
  }
  for (const entry of ddl) {
    if (entry.type === "table") continue;
    await client.execute(entry.sql);
  }

  return { client, tables: meta.tables, restoredRows: rows.length };
}

/**
 * Recompute per-table counts and hashes from a live database handle.
 * Deliberately re-reads the database rather than trusting the backup file.
 */
export async function measure(client, tables) {
  const out = [];
  for (const table of tables) {
    const result = await client.execute(`SELECT * FROM "${table}"`);
    const columns = result.columns.slice();
    const values = result.rows.map((row) =>
      columns.map((_, index) => {
        const value = row[index];
        if (value === null || value === undefined) return null;
        if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
          const buffer = Buffer.from(
            value instanceof ArrayBuffer ? value : value.buffer,
          );
          return { $blob: buffer.toString("base64") };
        }
        if (typeof value === "bigint") return { $int: value.toString() };
        return value;
      }),
    );
    out.push({
      name: table,
      columns,
      rows: values.length,
      sha256: tableHash(columns, values),
    });
  }
  return out;
}

/** Compare a measured restore against its manifest. Pure. */
export function compare(manifest, measured) {
  const byName = new Map(measured.map((entry) => [entry.name, entry]));
  const differences = [];

  for (const expected of manifest.tables) {
    const actual = byName.get(expected.name);
    if (!actual) {
      differences.push({
        table: expected.name,
        reason: "missing from restored database",
        expected: `${expected.rows} rows`,
        actual: "table absent",
      });
      continue;
    }
    if (actual.rows !== expected.rows) {
      differences.push({
        table: expected.name,
        reason: "row count differs",
        expected: expected.rows,
        actual: actual.rows,
      });
      continue;
    }
    if (actual.sha256 !== expected.sha256) {
      differences.push({
        table: expected.name,
        reason: "content hash differs",
        expected: expected.sha256.slice(0, 16),
        actual: actual.sha256.slice(0, 16),
      });
    }
  }

  const expectedNames = new Set(manifest.tables.map((entry) => entry.name));
  for (const actual of measured) {
    if (!expectedNames.has(actual.name)) {
      differences.push({
        table: actual.name,
        reason: "present in restore but not in manifest",
        expected: "absent",
        actual: `${actual.rows} rows`,
      });
    }
  }

  return { ok: differences.length === 0, differences };
}

/**
 * Verify that every DDL object the manifest recorded exists in the
 * restored database. Reported separately from row content because a
 * missing trigger is a lost invariant, not lost data, and the two failures
 * need different responses.
 */
export async function compareDdl(client, manifest) {
  const result = await client.execute(
    "SELECT type, name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'",
  );
  const present = new Set(result.rows.map((row) => `${row.type}:${row.name}`));
  const missing = [];
  for (const [type, names] of [
    ["table", manifest.ddl?.tables ?? []],
    ["index", manifest.ddl?.indexes ?? []],
    ["trigger", manifest.ddl?.triggers ?? []],
    ["view", manifest.ddl?.views ?? []],
  ]) {
    for (const name of names) {
      if (!present.has(`${type}:${name}`)) missing.push({ type, name });
    }
  }
  return { ok: missing.length === 0, missing };
}

export async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      backup: { type: "string" },
      manifest: { type: "string" },
      keep: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  if (!values.backup) throw new Error("pass --backup=<path to .jsonl>");
  const backupPath = path.resolve(process.cwd(), values.backup);
  const manifestPath = values.manifest
    ? path.resolve(process.cwd(), values.manifest)
    : backupPath.replace(/\.jsonl$/, ".manifest.json");

  if (!fs.existsSync(backupPath)) throw new Error(`no backup at ${backupPath}`);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `no manifest at ${manifestPath}. A backup without its manifest cannot ` +
        `be verified, only replayed.`,
    );
  }

  const body = fs.readFileSync(backupPath, "utf8");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  const startedAt = Date.now();
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "signal-restore-"));
  const targetPath = path.join(workDir, "restored.db");

  const { client } = await restoreInto(`file:${targetPath}`, body);
  let report;
  try {
    const measured = await measure(client, manifest.tables.map((t) => t.name));
    const data = compare(manifest, measured);
    const ddl = await compareDdl(client, manifest);
    report = {
      ok: data.ok && ddl.ok,
      backup: path.relative(process.cwd(), backupPath),
      label: manifest.label,
      databaseIdentity: manifest.databaseIdentity,
      takenAt: manifest.takenAt,
      restoredAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      tablesVerified: manifest.tables.length,
      rowsVerified: manifest.totalRows,
      dataDifferences: data.differences,
      missingDdl: ddl.missing,
      restoredTo: values.keep ? targetPath : "(deleted)",
    };
  } finally {
    client.close();
  }

  console.log(JSON.stringify(report, null, 2));

  if (!values.keep) {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch (error) {
      // Windows can hold a SQLite handle briefly after close. A leftover
      // uniquely-named temp directory is preferable to failing a restore
      // that actually succeeded.
      if (error?.code !== "EPERM") throw error;
    }
  }

  if (!report.ok) {
    console.error(
      "\nrestore-verify: FAILED. The restored database does not match its " +
        "manifest. Treat this backup as unusable until the difference is " +
        "explained.",
    );
    return 1;
  }
  console.log(
    `\nrestore-verify: PASSED. ${report.rowsVerified} rows across ` +
      `${report.tablesVerified} tables restored and verified in ` +
      `${report.elapsedMs} ms.`,
  );
  return 0;
}

const invokedDirectly =
  process.argv[1] &&
  process.argv[1].endsWith(path.join("db", "restore-verify.mjs"));
if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(`db:restore-verify: ${error.message}`);
      process.exit(1);
    },
  );
}
