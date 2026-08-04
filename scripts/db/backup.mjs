// Logical backup for any Signal Studio module database (E08.09).
//
// WHY THIS EXISTS
// ---------------
// The only backup path in this workspace before this script was the
// pre-migration dump inside `scripts/db/execute-production-migration.mjs`.
// That dump is real and it is verified, but it has three limits: it runs
// only when a migration runs, it covers only the tasks database, and its
// bytes live as a 90-day GitHub Actions artifact. Nothing takes a backup
// on a schedule, and nothing covers notes, timeline, signal or
// entitlements.
//
// This script takes the same dump shape and makes it callable for any
// module, on demand, from anywhere that holds the credentials. It writes
// two files: the JSONL backup itself and a manifest that records what the
// backup is supposed to contain, per table. `restore-verify.mjs` reads
// the manifest back out of a RESTORED database, which is what turns a
// dump into a backup you can trust.
//
// USAGE
//   node scripts/db/backup.mjs --module=tasks
//   node scripts/db/backup.mjs --url=file:tasks.db --label=local
//   node scripts/db/backup.mjs --module=entitlements --out=.db-backups
//
// Credentials: <MODULE>_DATABASE_URL and <MODULE>_AUTH_TOKEN, matching the
// workspace env convention in studio/docs/INFRASTRUCTURE.md. This script
// never prints a URL or a token; the manifest carries a hash of the
// database identity, never the identity itself.
//
// This script only reads. It issues no DDL and no writes against the
// source database.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseArgs } from "node:util";
import { createClient } from "@libsql/client";

export const BACKUP_SCHEMA_VERSION = "signal-db-backup/1";

/** Modules that own a database, per studio/docs/INFRASTRUCTURE.md. */
export const KNOWN_MODULES = Object.freeze([
  "tasks",
  "notes",
  "timeline",
  "signal",
  "entitlements",
  "studio",
]);

export function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * A stable, non-reversible identifier for the database a backup came from.
 * Hashing means a manifest can be committed or pasted into evidence
 * without leaking a hostname or a token.
 */
export function databaseIdentity(url) {
  return sha256(`signal-db-identity:v1:${url}`).slice(0, 16);
}

/** libSQL returns Buffers and BigInts; JSONL has neither. */
export function encodeValue(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const buffer = Buffer.from(
      value instanceof ArrayBuffer ? value : value.buffer,
    );
    return { $blob: buffer.toString("base64") };
  }
  if (typeof value === "bigint") return { $int: value.toString() };
  return value;
}

export function decodeValue(value) {
  if (value && typeof value === "object" && "$blob" in value) {
    return Buffer.from(value.$blob, "base64");
  }
  if (value && typeof value === "object" && "$int" in value) {
    return BigInt(value.$int);
  }
  return value;
}

/**
 * Content hash for one table.
 *
 * Rows are canonicalised and SORTED before hashing, so the hash is a
 * property of the SET of rows and not of the order a particular engine
 * happened to return them in. That matters: a restore into a fresh
 * database does not reproduce source rowids, so an order-sensitive hash
 * would report a false mismatch on a correct restore.
 */
export function tableHash(columns, rows) {
  const lines = rows
    .map((values) => JSON.stringify(values))
    .sort();
  return sha256(JSON.stringify(columns) + "\n" + lines.join("\n"));
}

/** Read the full schema of a libSQL/SQLite database, tables first. */
export async function readSchema(client) {
  const result = await client.execute(
    "SELECT type, name, tbl_name, sql FROM sqlite_schema " +
      "WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' " +
      "ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 " +
      "WHEN 'trigger' THEN 2 ELSE 3 END, name",
  );
  return result.rows.map((row) => ({
    type: String(row.type),
    name: String(row.name),
    tblName: row.tbl_name === null ? null : String(row.tbl_name),
    sql: String(row.sql),
  }));
}

/**
 * Take a logical backup. Returns { lines, manifest } without touching the
 * filesystem, so tests can exercise the whole path in memory.
 */
export async function takeBackup(client, { label, url }) {
  const schemaRows = await readSchema(client);
  const tables = schemaRows
    .filter((row) => row.type === "table")
    .map((row) => row.name);

  const takenAt = new Date().toISOString();
  const lines = [
    JSON.stringify({
      kind: "meta",
      schemaVersion: BACKUP_SCHEMA_VERSION,
      label,
      takenAt,
      tables,
    }),
  ];
  for (const row of schemaRows) {
    lines.push(
      JSON.stringify({
        kind: "ddl",
        type: row.type,
        name: row.name,
        tblName: row.tblName,
        sql: row.sql,
      }),
    );
  }

  const tableManifest = [];
  let totalRows = 0;
  for (const table of tables) {
    const result = await client.execute(`SELECT * FROM "${table}"`);
    const columns = result.columns.slice();
    const encoded = result.rows.map((row) =>
      columns.map((_, index) => encodeValue(row[index])),
    );
    for (const values of encoded) {
      lines.push(JSON.stringify({ kind: "row", table, columns, values }));
    }
    totalRows += encoded.length;
    tableManifest.push({
      name: table,
      columns,
      rows: encoded.length,
      sha256: tableHash(columns, encoded),
    });
  }

  const body = lines.join("\n") + "\n";
  const manifest = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    label,
    takenAt,
    databaseIdentity: databaseIdentity(url),
    tableCount: tables.length,
    totalRows,
    tables: tableManifest,
    // DDL objects the restore must be able to recreate. Triggers are
    // listed explicitly because a table restored without its triggers
    // looks correct and silently loses an enforced invariant — that is
    // exactly the defect recorded against the entitlements audit ledger.
    ddl: {
      tables: schemaRows.filter((r) => r.type === "table").map((r) => r.name),
      indexes: schemaRows.filter((r) => r.type === "index").map((r) => r.name),
      triggers: schemaRows.filter((r) => r.type === "trigger").map((r) => r.name),
      views: schemaRows.filter((r) => r.type === "view").map((r) => r.name),
    },
    backupSha256: sha256(body),
  };

  return { body, manifest };
}

function resolveTarget(values) {
  if (values.url) {
    return { url: values.url, authToken: values.token, label: values.label ?? "custom" };
  }
  const moduleName = values.module;
  if (!moduleName) {
    throw new Error("pass --module=<name> or --url=<libsql url>");
  }
  if (!KNOWN_MODULES.includes(moduleName)) {
    throw new Error(
      `unknown module "${moduleName}"; expected one of ${KNOWN_MODULES.join(", ")}`,
    );
  }
  const prefix = moduleName.toUpperCase();
  const url = process.env[`${prefix}_DATABASE_URL`];
  const authToken = process.env[`${prefix}_AUTH_TOKEN`];
  if (!url) {
    throw new Error(
      `${prefix}_DATABASE_URL is not set. This script never invents a ` +
        `connection; set the variable or pass --url explicitly.`,
    );
  }
  return { url, authToken, label: values.label ?? moduleName };
}

export async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      module: { type: "string" },
      url: { type: "string" },
      token: { type: "string" },
      label: { type: "string" },
      out: { type: "string" },
    },
    allowPositionals: false,
  });

  const target = resolveTarget(values);
  const outDir = path.resolve(process.cwd(), values.out ?? ".db-backups");
  fs.mkdirSync(outDir, { recursive: true });

  const client = createClient({ url: target.url, authToken: target.authToken });
  let result;
  try {
    result = await takeBackup(client, { label: target.label, url: target.url });
  } finally {
    client.close();
  }

  const stamp = result.manifest.takenAt.replace(/[:.]/g, "-");
  const base = `${target.label}-${stamp}`;
  const backupPath = path.join(outDir, `${base}.jsonl`);
  const manifestPath = path.join(outDir, `${base}.manifest.json`);
  fs.writeFileSync(backupPath, result.body);
  fs.writeFileSync(manifestPath, JSON.stringify(result.manifest, null, 2) + "\n");

  console.log(
    JSON.stringify(
      {
        ok: true,
        label: target.label,
        databaseIdentity: result.manifest.databaseIdentity,
        tables: result.manifest.tableCount,
        rows: result.manifest.totalRows,
        triggers: result.manifest.ddl.triggers.length,
        backupSha256: result.manifest.backupSha256,
        backup: path.relative(process.cwd(), backupPath),
        manifest: path.relative(process.cwd(), manifestPath),
      },
      null,
      2,
    ),
  );
  console.log(
    "\nA backup is not a backup until it has been restored. Run:\n" +
      `  node scripts/db/restore-verify.mjs --backup=${path.relative(process.cwd(), backupPath)}`,
  );
  return 0;
}

const invokedDirectly =
  process.argv[1] && process.argv[1].endsWith(path.join("db", "backup.mjs"));
if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(`db:backup: ${error.message}`);
      process.exit(1);
    },
  );
}
