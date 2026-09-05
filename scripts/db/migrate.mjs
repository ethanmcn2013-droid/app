import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createClient } from "@libsql/client";
import {
  canonicalFileSha256,
  canonicalText,
  loadAndValidateLedger,
  sha256,
} from "./migration-ledger.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(`db:migrate: ${message}`);
}

function sqlIdentifier(value) {
  invariant(/^[a-z_][a-z0-9_]*$/i.test(value), `unsafe SQL identifier ${value}`);
  return `"${value}"`;
}

function normalizeScalar(value) {
  if (typeof value === "bigint") return Number(value);
  return value;
}

function firstScalar(result) {
  invariant(result.rows.length > 0, "proof query returned no rows");
  const row = result.rows[0];
  const key = Object.hasOwn(row, "value") ? "value" : Object.keys(row)[0];
  return normalizeScalar(row[key]);
}

export function databaseIdentitySha256(databaseUrl) {
  const parsed = new URL(databaseUrl);
  parsed.username = "";
  parsed.password = "";
  parsed.search = "";
  parsed.hash = "";
  return sha256(`${parsed.protocol}//${parsed.host}${parsed.pathname}`.toLowerCase());
}

const supportedEnvironments = new Set(["local", "test", "development", "preview", "staging", "production"]);
export const SCHEMA_FINGERPRINT_VERSION = "sqlite-schema/2";

export function isLocalDatabaseUrl(databaseUrl) {
  return databaseUrl === ":memory:" || /^file:/i.test(databaseUrl);
}

function validateEnvironment(environment) {
  invariant(supportedEnvironments.has(environment), `unsupported environment ${environment}`);
  return environment;
}

export async function schemaFingerprintSha256(executor) {
  const result = await executor.execute("SELECT type, name, tbl_name, COALESCE(sql, '') AS sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' AND name NOT IN ('signal_schema_migrations', '__drizzle_migrations') ORDER BY type, name");
  const rows = result.rows.map((row) => [
    String(row.type),
    String(row.name),
    String(row.tbl_name),
    String(row.sql).replace(/\s+/g, " ").trim(),
  ]);
  return sha256(JSON.stringify(rows));
}

// Historical coverage only: call after validating an already-recorded adoption's
// exact immutable receipt. Never use for new adoption, status or backup evidence.
async function historicalAdoptionFingerprintSha256(executor) {
  const result = await executor.execute("SELECT type, name, tbl_name, COALESCE(sql, '') AS sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name NOT IN ('signal_schema_migrations', '__drizzle_migrations') ORDER BY type, name");
  return sha256(JSON.stringify(result.rows.map(row => [
    String(row.type), String(row.name), String(row.tbl_name),
    String(row.sql).replace(/\s+/g, " ").trim(),
  ])));
}

export async function verifyProofs(executor, proofs) {
  const results = [];
  for (const proof of proofs) {
    invariant(/^(SELECT|PRAGMA)\b/i.test(proof.sql.trim()) && !proof.sql.includes(";"), `proof ${proof.id} is not a single read-only statement`);
    const actual = firstScalar(await executor.execute(proof.sql));
    invariant(actual === proof.expected, `proof ${proof.id} expected ${JSON.stringify(proof.expected)} but received ${JSON.stringify(actual)}`);
    results.push({ id: proof.id, actual });
  }
  return results;
}

async function tableExists(executor, table) {
  const result = await executor.execute({
    sql: "SELECT COUNT(*) AS value FROM sqlite_schema WHERE type = 'table' AND name = ?",
    args: [table],
  });
  return Number(firstScalar(result)) === 1;
}

async function applicationObjectCount(executor, ledger) {
  const result = await executor.execute({
    sql: "SELECT COUNT(*) AS value FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' AND name NOT IN (?, ?)",
    args: [ledger.databaseLedgerTable, ledger.drizzleHighWaterTable],
  });
  return Number(firstScalar(result));
}

function metadataTableStatements(ledger) {
  return [`
    CREATE TABLE IF NOT EXISTS ${sqlIdentifier(ledger.databaseLedgerTable)} (
      id TEXT PRIMARY KEY NOT NULL,
      sha256 TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('applied', 'adopted_legacy')),
      review_receipt_id TEXT NOT NULL,
      review_receipt_sha256 TEXT NOT NULL,
      execution_receipt_id TEXT NOT NULL,
      execution_receipt_sha256 TEXT NOT NULL,
      release_sha TEXT NOT NULL,
      environment TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `, `
    CREATE TABLE IF NOT EXISTS ${sqlIdentifier(ledger.drizzleHighWaterTable)} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at NUMERIC NOT NULL
    )
  `];
}

async function readLedgerRows(executor, ledger) {
  if (!(await tableExists(executor, ledger.databaseLedgerTable))) return [];
  const result = await executor.execute(`SELECT * FROM ${sqlIdentifier(ledger.databaseLedgerTable)} ORDER BY applied_at, id`);
  return result.rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeScalar(value)])));
}

async function readDrizzleRows(executor, ledger) {
  if (!(await tableExists(executor, ledger.drizzleHighWaterTable))) return [];
  const result = await executor.execute(`SELECT hash, created_at FROM ${sqlIdentifier(ledger.drizzleHighWaterTable)} ORDER BY created_at`);
  return result.rows.map((row) => ({ hash: String(row.hash), created_at: Number(row.created_at) }));
}

function validateRuntimeRows(context, rows) {
  const runtimeEntries = [context.baseline, ...context.forward];
  invariant(rows.length <= runtimeEntries.length, "database ledger contains more rows than the source ledger");
  rows.forEach((row, ordinal) => {
    const entry = runtimeEntries[ordinal];
    invariant(row.id === entry.id, `database ledger gap or unknown migration at ${row.id}`);
    invariant(row.sha256 === entry.sha256, `database ledger hash mismatch for ${row.id}`);
    invariant(row.review_receipt_id === entry.receipt.document.id, `database review receipt id mismatch for ${row.id}`);
    invariant(row.review_receipt_sha256 === entry.receipt.sha256, `database review receipt hash mismatch for ${row.id}`);
    invariant(ordinal > 0 ? row.status === "applied" : ["applied", "adopted_legacy"].includes(row.status), `database ledger status is invalid for ${row.id}`);
  });
  return runtimeEntries.slice(rows.length);
}

function validateHighWaterRows(context, rows, appliedRuntimeCount) {
  invariant(rows.length <= appliedRuntimeCount, "Drizzle high-water has migrations absent from the exact ledger");
  rows.forEach((row, ordinal) => {
    const entry = [context.baseline, ...context.forward][ordinal];
    invariant(row.hash === entry.sha256 && row.created_at === entry.when, `Drizzle high-water mismatch at ${entry.id}`);
  });
  invariant(rows.length === appliedRuntimeCount, "Drizzle high-water and exact ledger are out of sync");
}

async function verifyAppliedEntryProofs(executor, context, appliedRuntimeCount) {
  const appliedEntries = [context.baseline, ...context.forward].slice(
    0,
    appliedRuntimeCount,
  );
  const results = [];
  for (const entry of appliedEntries) {
    const continuousProofs = entry.continuousProofIds === undefined
      ? entry.receipt.record.proofs
      : entry.receipt.record.proofs.filter((proof) => entry.continuousProofIds.includes(proof.id));
    results.push(...await verifyProofs(executor, continuousProofs));
  }
  return results;
}

function ledgerInsertStatements(context, entry, {
  status,
  executionReceiptId,
  executionReceiptSha256,
  releaseSha,
  environment,
  appliedAt,
}) {
  return [{
    sql: `INSERT INTO ${sqlIdentifier(context.ledger.databaseLedgerTable)} (
      id, sha256, status, review_receipt_id, review_receipt_sha256,
      execution_receipt_id, execution_receipt_sha256, release_sha,
      environment, applied_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      entry.id,
      entry.sha256,
      status,
      entry.receipt.document.id,
      entry.receipt.sha256,
      executionReceiptId,
      executionReceiptSha256,
      releaseSha,
      environment,
      appliedAt,
    ],
  }, {
    sql: `INSERT INTO ${sqlIdentifier(context.ledger.drizzleHighWaterTable)} (hash, created_at) VALUES (?, ?)`,
    args: [entry.sha256, entry.when],
  }];
}

function validateProductionExecutionReceipt(file, context, pending, { databaseUrl, environment }) {
  invariant(file, "remote or production database has pending migrations but no --receipt was supplied");
  const absolute = path.resolve(file);
  invariant(fs.existsSync(absolute), `execution receipt is missing: ${absolute}`);
  const receipt = JSON.parse(fs.readFileSync(absolute, "utf8"));
  invariant(receipt.schemaVersion === "tasks-migration-execution/1", "unsupported production execution receipt");
  invariant(typeof receipt.id === "string" && receipt.id.length > 0, "production execution receipt is missing id");
  invariant(receipt.environment === environment, "production execution receipt environment does not match");
  invariant(receipt.databaseIdentitySha256 === databaseIdentitySha256(databaseUrl), "production execution receipt targets a different database");
  invariant(receipt.ledgerSha256 === context.ledgerSha256, "production execution receipt ledger hash does not match source");
  invariant(/^[a-f0-9]{64}$/.test(receipt.backupSha256 ?? ""), "production execution receipt is missing backupSha256");
  invariant(receipt.dryRun?.status === "passed" && /^[a-f0-9]{64}$/.test(receipt.dryRun?.databaseSha256 ?? ""), "production execution receipt is missing a passed dry run");
  invariant(Array.isArray(receipt.migrations) && receipt.migrations.length === pending.length, "production execution receipt does not cover every pending migration");
  pending.forEach((entry, ordinal) => {
    invariant(receipt.migrations[ordinal]?.id === entry.id && receipt.migrations[ordinal]?.sha256 === entry.sha256, `production execution receipt does not match ${entry.id}`);
  });
  return {
    id: receipt.id,
    sha256: canonicalFileSha256(absolute),
    document: receipt,
  };
}

function validateAdoptionReceipt(file, context, { databaseUrl, environment }) {
  invariant(file, "adopt requires --receipt");
  const absolute = path.resolve(file);
  invariant(fs.existsSync(absolute), `adoption receipt is missing: ${absolute}`);
  const receipt = JSON.parse(fs.readFileSync(absolute, "utf8"));
  invariant(receipt.schemaVersion === "tasks-production-adoption/1", "unsupported adoption receipt");
  invariant(receipt.schemaFingerprintVersion === undefined || receipt.schemaFingerprintVersion === SCHEMA_FINGERPRINT_VERSION, "unsupported adoption schema fingerprint version");
  invariant(typeof receipt.id === "string" && receipt.id.length > 0, "adoption receipt is missing id");
  invariant(receipt.environment === environment, "adoption receipt environment does not match");
  invariant(receipt.databaseIdentitySha256 === databaseIdentitySha256(databaseUrl), "adoption receipt targets a different database");
  invariant(receipt.baseline?.id === context.baseline.id && receipt.baseline?.sha256 === context.baseline.sha256, "adoption receipt baseline does not match source");
  invariant(receipt.ledgerSha256 === context.ledgerSha256, "adoption receipt ledger hash does not match source");
  invariant(Array.isArray(receipt.operatorEvidence) && receipt.operatorEvidence.length >= 2, "adoption receipt is missing operator evidence");
  invariant(receipt.operatorEvidence.every((item) => /^[a-f0-9]{64}$/.test(item.receiptSha256 ?? "") && /^[a-f0-9]{64}$/.test(item.backupSha256 ?? "")), "adoption receipt has invalid operator evidence hashes");
  invariant(Array.isArray(receipt.proofs) && receipt.proofs.length > 0, "adoption receipt has no database proofs");
  for (const proof of receipt.proofs) {
    invariant(typeof proof.id === "string" && /^SELECT\b/i.test(proof.sql?.trim() ?? "") && !proof.sql.includes(";"), `adoption proof ${proof.id ?? "unknown"} is invalid`);
    invariant(Object.hasOwn(proof, "expected"), `adoption proof ${proof.id} is missing expected`);
  }
  return {
    id: receipt.id,
    sha256: canonicalFileSha256(absolute),
    document: receipt,
  };
}

function migrationStatements(sql) {
  return canonicalText(sql)
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function proofGuardStatements(proofs) {
  const table = "__signal_migration_proofs";
  const statements = [
    `DROP TABLE IF EXISTS temp.${table}`,
    `CREATE TEMP TABLE ${table} (
      id TEXT PRIMARY KEY NOT NULL,
      actual TEXT NOT NULL,
      expected TEXT NOT NULL,
      CHECK (actual = expected)
    )`,
  ];
  for (const proof of proofs) {
    invariant(/^SELECT\b/i.test(proof.sql.trim()) && !proof.sql.includes(";"), `proof ${proof.id} cannot be used as an atomic guard`);
    statements.push({
      sql: `INSERT INTO temp.${table} (id, actual, expected)
        VALUES (?, COALESCE(CAST((SELECT value FROM (${proof.sql}) LIMIT 1) AS TEXT), '__NO_ROW__'), ?)`,
      args: [proof.id, String(proof.expected)],
    });
  }
  statements.push(`DROP TABLE temp.${table}`);
  return statements;
}

async function atomicWrite(client, { sql = [], proofs = [], metadata = [] }) {
  const guards = proofGuardStatements(proofs);
  try {
    await client.batch([
      ...sql,
      ...guards,
      ...metadata,
    ], "write");
  } catch (error) {
    const proofIndex = Number(error.statementIndex) - sql.length - 2;
    if (Number.isInteger(proofIndex) && proofIndex >= 0 && proofIndex < proofs.length) {
      throw new Error(`db:migrate: proof ${proofs[proofIndex].id} failed atomically`, { cause: error });
    }
    throw error;
  }
  return verifyProofs(client, proofs);
}

export async function runMigrations({
  client,
  context = loadAndValidateLedger(),
  environment = "local",
  databaseUrl = ":memory:",
  releaseSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "local",
  executionReceiptPath,
  now = () => Date.now(),
}) {
  validateEnvironment(environment);
  const requiresExecutionReceipt = !isLocalDatabaseUrl(databaseUrl) || environment === "production";
  const objects = await applicationObjectCount(client, context.ledger);
  const existingRows = await readLedgerRows(client, context.ledger);

  if (objects > 0 && existingRows.length === 0) {
    throw new Error("db:migrate: existing database has no exact migration ledger; run receipt-backed adopt instead of executing legacy SQL");
  }

  if (objects === 0 && existingRows.length === 0) {
    const pending = [context.baseline, ...context.forward];
    const productionReceipt = requiresExecutionReceipt
      ? validateProductionExecutionReceipt(executionReceiptPath, context, pending, { databaseUrl, environment })
      : null;
    const applied = [];
    const proofs = [];
    const baselineProofs = await atomicWrite(client, {
      sql: migrationStatements(context.baseline.sql),
      proofs: context.baseline.receipt.record.proofs,
      metadata: [
        ...metadataTableStatements(context.ledger),
        ...ledgerInsertStatements(context, context.baseline, {
        status: "applied",
        executionReceiptId: productionReceipt?.id ?? "fresh-database-bootstrap",
        executionReceiptSha256: productionReceipt?.sha256 ?? context.baseline.receipt.sha256,
        releaseSha,
        environment,
        appliedAt: now(),
        }),
      ],
    });
    applied.push(context.baseline.id);
    proofs.push(...baselineProofs);

    for (const entry of context.forward) {
      const result = await atomicWrite(client, {
        sql: migrationStatements(entry.sql),
        proofs: entry.receipt.record.proofs,
        metadata: ledgerInsertStatements(context, entry, {
          status: "applied",
          executionReceiptId: productionReceipt?.id ?? "fresh-database-bootstrap",
          executionReceiptSha256: productionReceipt?.sha256 ?? entry.receipt.sha256,
          releaseSha,
          environment,
          appliedAt: now(),
        }),
      });
      applied.push(entry.id);
      proofs.push(...result);
    }
    return { status: "applied", applied, proofs };
  }

  const pending = validateRuntimeRows(context, existingRows);
  const drizzleRows = await readDrizzleRows(client, context.ledger);
  validateHighWaterRows(context, drizzleRows, existingRows.length);
  await verifyAppliedEntryProofs(client, context, existingRows.length);

  if (pending.length === 0) return { status: "no-op", applied: [] };
  invariant(existingRows.length > 0, "baseline is missing from an initialized database");
  invariant(pending.every((entry) => entry.policy === "forward"), "legacy or baseline SQL cannot be replayed on an initialized database");

  const productionReceipt = requiresExecutionReceipt
    ? validateProductionExecutionReceipt(executionReceiptPath, context, pending, { databaseUrl, environment })
    : null;
  const applied = [];
  const proofs = [];
  for (const entry of pending) {
    const result = await atomicWrite(client, {
      sql: migrationStatements(entry.sql),
      proofs: entry.receipt.record.proofs,
      metadata: ledgerInsertStatements(context, entry, {
        status: "applied",
        executionReceiptId: productionReceipt?.id ?? "non-production-execution",
        executionReceiptSha256: productionReceipt?.sha256 ?? entry.receipt.sha256,
        releaseSha,
        environment,
        appliedAt: now(),
      }),
    });
    applied.push(entry.id);
    proofs.push(...result);
  }
  return { status: "applied", applied, proofs };
}

export async function adoptExistingDatabase({
  client,
  databaseUrl,
  receiptPath,
  context = loadAndValidateLedger(),
  environment = "production",
  releaseSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "operator",
  now = () => Date.now(),
}) {
  invariant((await applicationObjectCount(client, context.ledger)) > 0, "adopt refuses an empty database; run migrate to apply the fresh baseline");
  const receipt = validateAdoptionReceipt(receiptPath, context, { databaseUrl, environment });
  const currentFingerprint = await schemaFingerprintSha256(client);
  const proofs = await verifyProofs(client, [
    ...context.baseline.receipt.record.proofs,
    ...receipt.document.proofs,
  ]);

  const existingRows = await readLedgerRows(client, context.ledger);
  if (existingRows.length > 0) {
    const pending = validateRuntimeRows(context, existingRows);
    invariant(
      pending.every((entry) => entry.policy === "forward"),
      "adopt found an invalid partial database ledger",
    );
    const row = existingRows[0];
    invariant(row.status === "adopted_legacy", "existing baseline was not adopted as legacy state");
    invariant(row.execution_receipt_id === receipt.id && row.execution_receipt_sha256 === receipt.sha256, "existing adoption receipt differs from the requested receipt");
    validateHighWaterRows(context, await readDrizzleRows(client, context.ledger), existingRows.length);
    const historicalReplay = receipt.document.schemaFingerprintSha256 !== currentFingerprint;
    if (historicalReplay) {
      invariant(receipt.document.schemaFingerprintVersion === undefined, "adoption receipt schema fingerprint does not match the target database");
      invariant(receipt.document.schemaFingerprintSha256 === await historicalAdoptionFingerprintSha256(client), "adoption receipt schema fingerprint does not match the target database");
    }
    return { status: "no-op", adopted: context.baseline.id, proofs, schemaFingerprintSha256: currentFingerprint,
      ...(historicalReplay ? {
        receiptFingerprintMode: "legacy-like-replay",
        receiptFingerprintSha256: receipt.document.schemaFingerprintSha256,
        notice: "Historical receipt replay only. Its fingerprint excluded ordinary sqlite-like names; the complete current fingerprint is reported separately.",
      } : {}),
    };
  }

  invariant(receipt.document.schemaFingerprintSha256 === currentFingerprint, "adoption receipt schema fingerprint does not match the target database");
  invariant(receipt.document.schemaFingerprintVersion === SCHEMA_FINGERPRINT_VERSION, "new adoption requires schemaFingerprintVersion sqlite-schema/2");
  const drizzleRows = await readDrizzleRows(client, context.ledger);
  invariant(drizzleRows.length === 0, "adopt refuses an unreceipted Drizzle high-water history");

  await atomicWrite(client, {
    proofs: [
      ...context.baseline.receipt.record.proofs,
      ...receipt.document.proofs,
    ],
    metadata: [
      ...metadataTableStatements(context.ledger),
      ...ledgerInsertStatements(context, context.baseline, {
      status: "adopted_legacy",
      executionReceiptId: receipt.id,
      executionReceiptSha256: receipt.sha256,
      releaseSha,
      environment,
      appliedAt: now(),
      }),
    ],
  });
  return { status: "adopted", adopted: context.baseline.id, proofs, schemaFingerprintSha256: currentFingerprint };
}

export async function migrationStatus({ client, context = loadAndValidateLedger() }) {
  const objects = await applicationObjectCount(client, context.ledger);
  const rows = await readLedgerRows(client, context.ledger);
  const drizzleRows = await readDrizzleRows(client, context.ledger);
  let state = "fresh";
  let pending = [context.baseline.id, ...context.forward.map((entry) => entry.id)];
  if (objects > 0 && rows.length === 0) state = "adoption-required";
  if (rows.length > 0) {
    pending = validateRuntimeRows(context, rows).map((entry) => entry.id);
    validateHighWaterRows(context, drizzleRows, rows.length);
    await verifyAppliedEntryProofs(client, context, rows.length);
    state = pending.length === 0 ? "current" : "pending";
  }
  return {
    state,
    baseline: context.baseline.id,
    registeredSqlFiles: context.entries.length,
    applied: rows.map((row) => ({ id: row.id, status: row.status, releaseSha: row.release_sha })),
    pending,
  };
}

function resolveConnection(values) {
  // One canonical pair since the 2026-07-31 reset; the TURSO_* and
  // TASKS_DATABASE_AUTH_TOKEN aliases are retired.
  const databaseUrl = values["database-url"] || process.env.TASKS_DATABASE_URL || "file:tasks.db";
  const authToken = values["auth-token"] || process.env.TASKS_AUTH_TOKEN;
  return { databaseUrl, authToken };
}

export async function main(argv = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      environment: { type: "string" },
      receipt: { type: "string" },
      "release-sha": { type: "string" },
      "database-url": { type: "string" },
      "auth-token": { type: "string" },
      "confirm-production": { type: "string" },
    },
  });
  const command = positionals[0] ?? "migrate";
  invariant(["migrate", "adopt", "status"].includes(command), `unknown command ${command}`);
  const { databaseUrl, authToken } = resolveConnection(values);
  const localDatabase = isLocalDatabaseUrl(databaseUrl);
  const environment = validateEnvironment(values.environment ?? (localDatabase ? "local" : "production"));
  if (!localDatabase) {
    invariant(["preview", "staging", "production"].includes(environment), "remote database requires an explicit preview, staging, or production environment");
    invariant(values["confirm-production"] === "tasks", "production command requires --confirm-production=tasks");
  }
  if (environment === "production") {
    invariant(!localDatabase, "production command cannot target a local database");
  }
  const client = createClient({ url: databaseUrl, authToken });
  try {
    let result;
    if (command === "status") result = await migrationStatus({ client });
    if (command === "migrate") {
      result = await runMigrations({
        client,
        environment,
        databaseUrl,
        releaseSha: values["release-sha"],
        executionReceiptPath: values.receipt,
      });
    }
    if (command === "adopt") {
      result = await adoptExistingDatabase({
        client,
        databaseUrl,
        receiptPath: values.receipt,
        environment,
        releaseSha: values["release-sha"],
      });
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    client.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
