/**
 * The receipt-backed forward-migration runner for the TIMELINE database.
 *
 * ── WHY A SECOND RUNNER ────────────────────────────────────────────────────
 * `pnpm db:migrate` covers Tasks. Timeline is a separate libSQL database whose
 * only write paths were `timeline:db:generate` and `timeline:db:push:unsafe` —
 * a generator and a force-push. There was no way to move the Timeline schema
 * forward with a review receipt, a proof, or a record of what ran, which
 * DECISIONS.md D-009 records as a from-zero build and the plan (§12) calls a
 * release dependency.
 *
 * ── WHY IT CANNOT SIMPLY RUN THE BASELINE ──────────────────────────────────
 * `drizzle.timeline.config.ts:5-10`: production was migrated from another
 * repository as a standalone `0000–0007` chain, while this repository carries
 * one consolidated `0000` baseline. The two histories describe the same schema
 * and share not one hash. Replaying the consolidated baseline against
 * production would attempt CREATE TABLE over live couple data.
 *
 * So this is a runner build PLUS a ledger-adoption operation:
 *
 *   `adopt`   registers the exact observed production fingerprint — schema
 *             fingerprint, the foreign chain's own hashes, backup evidence —
 *             as `adopted_legacy` in a NAMESPACED ledger table of our own.
 *             It writes one metadata row and touches no schema.
 *   `migrate` then applies only entries after the baseline, each inside one
 *             atomic batch with its receipt's proofs as in-transaction guards.
 *
 * `__drizzle_migrations`, the foreign chain's high-water table, is READ and
 * fingerprinted and never written. Adopting somebody else's history is honest;
 * rewriting it is not.
 *
 * ── DRY RUN ────────────────────────────────────────────────────────────────
 * `migrate --dry-run` writes nothing to the target under any circumstances.
 * Against a local file it additionally rehearses the whole apply on a
 * `VACUUM INTO` copy — real statements, real proofs, then a second run to
 * prove no-op — and deletes the copy. Against a remote database it refuses to
 * rehearse and says so: the rehearsal target for production is an isolated
 * restored copy (plan §12 step 7), which is just another `--database-url`.
 *
 * Usage:
 *   node scripts/db/timeline-migrate.mjs status
 *   node scripts/db/timeline-migrate.mjs migrate --dry-run
 *   node scripts/db/timeline-migrate.mjs migrate
 *   node scripts/db/timeline-migrate.mjs adopt --receipt <file> --environment production --confirm-production=timeline
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { createClient } from "@libsql/client";
import {
  canonicalFileSha256,
  canonicalText,
  loadAndValidateLedger,
  sha256,
} from "./migration-ledger.mjs";
import { databaseIdentitySha256, isLocalDatabaseUrl, verifyProofs } from "./migrate.mjs";

export { databaseIdentitySha256, isLocalDatabaseUrl };

function invariant(condition, message) {
  if (!condition) throw new Error(`timeline:db:migrate: ${message}`);
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

export function loadTimelineLedger(options = {}) {
  return loadAndValidateLedger({ ...options, module: "timeline" });
}

const supportedEnvironments = new Set(["local", "test", "development", "preview", "staging", "production"]);

function validateEnvironment(environment) {
  invariant(supportedEnvironments.has(environment), `unsupported environment ${environment}`);
  return environment;
}

/** Every schema object except the two ledger tables, normalized and hashed. */
export async function timelineSchemaFingerprintSha256(executor, ledger) {
  const result = await executor.execute({
    sql: "SELECT type, name, tbl_name, COALESCE(sql, '') AS sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' AND name NOT IN (?, ?) ORDER BY type, name",
    args: [ledger.databaseLedgerTable, ledger.legacyDrizzleTable],
  });
  const rows = result.rows.map((row) => [
    String(row.type),
    String(row.name),
    String(row.tbl_name),
    String(row.sql).replace(/\s+/g, " ").trim(),
  ]);
  return sha256(JSON.stringify(rows));
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
    args: [ledger.databaseLedgerTable, ledger.legacyDrizzleTable],
  });
  return Number(firstScalar(result));
}

function metadataTableStatement(ledger) {
  return `
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
  `;
}

async function readLedgerRows(executor, ledger) {
  if (!(await tableExists(executor, ledger.databaseLedgerTable))) return [];
  const result = await executor.execute(`SELECT * FROM ${sqlIdentifier(ledger.databaseLedgerTable)}`);
  return result.rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeScalar(value)])));
}

/**
 * The foreign chain, observed and never touched.
 *
 * Its hashes belong to `timeline.git`, not to this repository, so they can
 * never be validated against anything here. What CAN be validated is that they
 * have not changed since the operator fingerprinted them — which is exactly
 * what an adoption receipt is for.
 */
export async function readLegacyDrizzleChain(executor, ledger) {
  if (!(await tableExists(executor, ledger.legacyDrizzleTable))) {
    return { present: false, rowCount: 0, hashesSha256: sha256("[]") };
  }
  const result = await executor.execute(
    `SELECT hash, created_at FROM ${sqlIdentifier(ledger.legacyDrizzleTable)} ORDER BY created_at, hash`,
  );
  const rows = result.rows.map((row) => [String(row.hash), Number(row.created_at)]);
  return {
    present: true,
    rowCount: rows.length,
    hashesSha256: sha256(JSON.stringify(rows)),
  };
}

/**
 * Order the database's ledger rows by the SOURCE ledger, not by their own
 * `applied_at`.
 *
 * The Tasks runner sorts by timestamp, which is safe there because its rows
 * are always written in ledger order by one process. Timeline's first row is
 * written by `adopt` — an operator act at an operator's clock — and its later
 * rows by a deployment. Two clocks, and a ledger that reads "gap or unknown
 * migration" the moment they disagree. Ordering by the source ledger removes
 * the clock from the correctness argument entirely: a row is valid because the
 * ledger names it at that position, not because a timestamp happened to sort.
 */
function orderRowsByLedger(context, rows) {
  const runtimeEntries = [context.baseline, ...context.forward];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = [];
  for (const entry of runtimeEntries) {
    const row = byId.get(entry.id);
    if (!row) break;
    byId.delete(entry.id);
    ordered.push(row);
  }
  invariant(byId.size === 0, `database ledger gap or unknown migration at ${[...byId.keys()].sort().join(", ")}`);
  return ordered;
}

function validateRuntimeRows(context, rows) {
  const runtimeEntries = [context.baseline, ...context.forward];
  invariant(rows.length <= runtimeEntries.length, "database ledger contains more rows than the source ledger");
  orderRowsByLedger(context, rows).forEach((row, ordinal) => {
    const entry = runtimeEntries[ordinal];
    invariant(row.id === entry.id, `database ledger gap or unknown migration at ${row.id}`);
    invariant(row.sha256 === entry.sha256, `database ledger hash mismatch for ${row.id}`);
    invariant(row.review_receipt_id === entry.receipt.document.id, `database review receipt id mismatch for ${row.id}`);
    invariant(row.review_receipt_sha256 === entry.receipt.sha256, `database review receipt hash mismatch for ${row.id}`);
    invariant(ordinal > 0 ? row.status === "applied" : ["applied", "adopted_legacy"].includes(row.status), `database ledger status is invalid for ${row.id}`);
  });
  return runtimeEntries.slice(rows.length);
}

async function verifyAppliedEntryProofs(executor, context, appliedRuntimeCount) {
  const appliedEntries = [context.baseline, ...context.forward].slice(0, appliedRuntimeCount);
  const results = [];
  for (const entry of appliedEntries) {
    const continuousProofs = entry.continuousProofIds === undefined
      ? entry.receipt.record.proofs
      : entry.receipt.record.proofs.filter((proof) => entry.continuousProofIds.includes(proof.id));
    results.push(...await verifyProofs(executor, continuousProofs));
  }
  return results;
}

function ledgerInsertStatement(context, entry, {
  status,
  executionReceiptId,
  executionReceiptSha256,
  releaseSha,
  environment,
  appliedAt,
}) {
  return {
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
  };
}

function validateExecutionReceipt(file, context, pending, { databaseUrl, environment }) {
  invariant(file, "remote or production database has pending migrations but no --receipt was supplied");
  const absolute = path.resolve(file);
  invariant(fs.existsSync(absolute), `execution receipt is missing: ${absolute}`);
  const receipt = JSON.parse(fs.readFileSync(absolute, "utf8"));
  invariant(receipt.schemaVersion === "timeline-migration-execution/1", "unsupported timeline execution receipt");
  invariant(typeof receipt.id === "string" && receipt.id.length > 0, "execution receipt is missing id");
  invariant(receipt.environment === environment, "execution receipt environment does not match");
  invariant(receipt.databaseIdentitySha256 === databaseIdentitySha256(databaseUrl), "execution receipt targets a different database");
  invariant(receipt.ledgerSha256 === context.ledgerSha256, "execution receipt ledger hash does not match source");
  invariant(/^[a-f0-9]{64}$/.test(receipt.backupSha256 ?? ""), "execution receipt is missing backupSha256");
  invariant(receipt.dryRun?.status === "passed" && /^[a-f0-9]{64}$/.test(receipt.dryRun?.databaseSha256 ?? ""), "execution receipt is missing a passed dry run");
  invariant(receipt.dryRun?.secondRun === "no-op", "execution receipt must record a second-run no-op proof");
  invariant(Array.isArray(receipt.migrations) && receipt.migrations.length === pending.length, "execution receipt does not cover every pending migration");
  pending.forEach((entry, ordinal) => {
    invariant(receipt.migrations[ordinal]?.id === entry.id && receipt.migrations[ordinal]?.sha256 === entry.sha256, `execution receipt does not match ${entry.id}`);
  });
  return { id: receipt.id, sha256: canonicalFileSha256(absolute), document: receipt };
}

function validateAdoptionReceipt(file, context, { databaseUrl, environment }) {
  invariant(file, "adopt requires --receipt");
  const absolute = path.resolve(file);
  invariant(fs.existsSync(absolute), `adoption receipt is missing: ${absolute}`);
  const receipt = JSON.parse(fs.readFileSync(absolute, "utf8"));
  invariant(receipt.schemaVersion === "timeline-production-adoption/1", "unsupported adoption receipt");
  invariant(typeof receipt.id === "string" && receipt.id.length > 0, "adoption receipt is missing id");
  invariant(receipt.environment === environment, "adoption receipt environment does not match");
  invariant(receipt.databaseIdentitySha256 === databaseIdentitySha256(databaseUrl), "adoption receipt targets a different database");
  invariant(receipt.baseline?.id === context.baseline.id && receipt.baseline?.sha256 === context.baseline.sha256, "adoption receipt baseline does not match source");
  invariant(receipt.ledgerSha256 === context.ledgerSha256, "adoption receipt ledger hash does not match source");
  invariant(/^[a-f0-9]{64}$/.test(receipt.schemaFingerprintSha256 ?? ""), "adoption receipt is missing schemaFingerprintSha256");
  // Two independent pieces of operator evidence: the backup and its verified
  // restore (plan §12 step 1). One is a claim; two is a procedure.
  invariant(Array.isArray(receipt.operatorEvidence) && receipt.operatorEvidence.length >= 2, "adoption receipt is missing operator evidence");
  invariant(receipt.operatorEvidence.every((item) => /^[a-f0-9]{64}$/.test(item.receiptSha256 ?? "") && /^[a-f0-9]{64}$/.test(item.backupSha256 ?? "")), "adoption receipt has invalid operator evidence hashes");
  // The foreign chain is part of the fingerprint being adopted, not a detail.
  invariant(receipt.legacyLedger?.table === context.ledger.legacyDrizzleTable, "adoption receipt does not name the legacy Drizzle table");
  invariant(Number.isSafeInteger(receipt.legacyLedger?.rowCount) && receipt.legacyLedger.rowCount >= 0, "adoption receipt legacy row count is invalid");
  invariant(/^[a-f0-9]{64}$/.test(receipt.legacyLedger?.hashesSha256 ?? ""), "adoption receipt legacy chain hash is invalid");
  invariant(Array.isArray(receipt.proofs) && receipt.proofs.length > 0, "adoption receipt has no database proofs");
  for (const proof of receipt.proofs) {
    invariant(typeof proof.id === "string" && /^SELECT\b/i.test(proof.sql?.trim() ?? "") && !proof.sql.includes(";"), `adoption proof ${proof.id ?? "unknown"} is invalid`);
    invariant(Object.hasOwn(proof, "expected"), `adoption proof ${proof.id} is missing expected`);
  }
  return { id: receipt.id, sha256: canonicalFileSha256(absolute), document: receipt };
}

function migrationStatements(sql) {
  return canonicalText(sql)
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

/**
 * The proofs, restated as a CHECK constraint inside the same transaction.
 *
 * Verifying afterwards proves the migration ran; verifying INSIDE proves it
 * ran correctly, because a failed CHECK rolls the whole batch back — schema,
 * ledger row and all. A postcondition checked after the commit is a report,
 * not a guard.
 */
function proofGuardStatements(proofs) {
  const table = "__signal_timeline_migration_proofs";
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
    await client.batch([...sql, ...guards, ...metadata], "write");
  } catch (error) {
    const proofIndex = Number(error.statementIndex) - sql.length - 2;
    if (Number.isInteger(proofIndex) && proofIndex >= 0 && proofIndex < proofs.length) {
      throw new Error(`timeline:db:migrate: proof ${proofs[proofIndex].id} failed atomically`, { cause: error });
    }
    throw error;
  }
  return verifyProofs(client, proofs);
}

export async function timelineMigrationStatus({ client, context = loadTimelineLedger() }) {
  const objects = await applicationObjectCount(client, context.ledger);
  const rows = await readLedgerRows(client, context.ledger);
  const legacy = await readLegacyDrizzleChain(client, context.ledger);
  let state = "fresh";
  let pending = [context.baseline.id, ...context.forward.map((entry) => entry.id)];
  if (objects > 0 && rows.length === 0) state = "adoption-required";
  if (rows.length > 0) {
    pending = validateRuntimeRows(context, rows).map((entry) => entry.id);
    await verifyAppliedEntryProofs(client, context, rows.length);
    state = pending.length === 0 ? "current" : "pending";
  }
  return {
    module: "timeline",
    state,
    baseline: context.baseline.id,
    registeredSqlFiles: context.entries.length,
    legacyDrizzleChain: legacy,
    applied: rows.map((row) => ({ id: row.id, status: row.status, releaseSha: row.release_sha })),
    pending,
  };
}

export async function runTimelineMigrations({
  client,
  context = loadTimelineLedger(),
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

  // The seam this runner exists for. A Timeline database that already has
  // objects is production's standalone 0000–0007 chain, and the consolidated
  // baseline must never be replayed onto it (plan §12 step 3).
  if (objects > 0 && existingRows.length === 0) {
    throw new Error("timeline:db:migrate: existing database has no Timeline migration ledger; run receipt-backed adopt instead of executing the consolidated baseline");
  }

  if (objects === 0 && existingRows.length === 0) {
    const pending = [context.baseline, ...context.forward];
    const executionReceipt = requiresExecutionReceipt
      ? validateExecutionReceipt(executionReceiptPath, context, pending, { databaseUrl, environment })
      : null;
    const applied = [];
    const proofs = [];
    const baselineProofs = await atomicWrite(client, {
      sql: migrationStatements(context.baseline.sql),
      proofs: context.baseline.receipt.record.proofs,
      metadata: [
        metadataTableStatement(context.ledger),
        ledgerInsertStatement(context, context.baseline, {
          status: "applied",
          executionReceiptId: executionReceipt?.id ?? "fresh-database-bootstrap",
          executionReceiptSha256: executionReceipt?.sha256 ?? context.baseline.receipt.sha256,
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
        metadata: [ledgerInsertStatement(context, entry, {
          status: "applied",
          executionReceiptId: executionReceipt?.id ?? "fresh-database-bootstrap",
          executionReceiptSha256: executionReceipt?.sha256 ?? entry.receipt.sha256,
          releaseSha,
          environment,
          appliedAt: now(),
        })],
      });
      applied.push(entry.id);
      proofs.push(...result);
    }
    return { status: "applied", applied, proofs };
  }

  const pending = validateRuntimeRows(context, existingRows);
  await verifyAppliedEntryProofs(client, context, existingRows.length);

  if (pending.length === 0) return { status: "no-op", applied: [] };
  invariant(existingRows.length > 0, "baseline is missing from an initialized database");
  invariant(pending.every((entry) => entry.policy === "forward"), "the consolidated baseline cannot be replayed on an initialized database");

  const executionReceipt = requiresExecutionReceipt
    ? validateExecutionReceipt(executionReceiptPath, context, pending, { databaseUrl, environment })
    : null;
  const applied = [];
  const proofs = [];
  for (const entry of pending) {
    const result = await atomicWrite(client, {
      sql: migrationStatements(entry.sql),
      proofs: entry.receipt.record.proofs,
      metadata: [ledgerInsertStatement(context, entry, {
        status: "applied",
        executionReceiptId: executionReceipt?.id ?? "non-production-execution",
        executionReceiptSha256: executionReceipt?.sha256 ?? entry.receipt.sha256,
        releaseSha,
        environment,
        appliedAt: now(),
      })],
    });
    applied.push(entry.id);
    proofs.push(...result);
  }
  return { status: "applied", applied, proofs };
}

export async function adoptTimelineDatabase({
  client,
  databaseUrl,
  receiptPath,
  context = loadTimelineLedger(),
  environment = "production",
  releaseSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "operator",
  now = () => Date.now(),
}) {
  invariant((await applicationObjectCount(client, context.ledger)) > 0, "adopt refuses an empty database; run migrate to apply the fresh baseline");
  const receipt = validateAdoptionReceipt(receiptPath, context, { databaseUrl, environment });
  const currentFingerprint = await timelineSchemaFingerprintSha256(client, context.ledger);
  invariant(receipt.document.schemaFingerprintSha256 === currentFingerprint, "adoption receipt schema fingerprint does not match the target database");

  const legacy = await readLegacyDrizzleChain(client, context.ledger);
  invariant(
    legacy.rowCount === receipt.document.legacyLedger.rowCount && legacy.hashesSha256 === receipt.document.legacyLedger.hashesSha256,
    "the legacy Drizzle chain has changed since the adoption receipt was written",
  );

  const proofs = await verifyProofs(client, [
    ...context.baseline.receipt.record.proofs,
    ...receipt.document.proofs,
  ]);

  const existingRows = await readLedgerRows(client, context.ledger);
  if (existingRows.length > 0) {
    const pending = validateRuntimeRows(context, existingRows);
    invariant(pending.every((entry) => entry.policy === "forward"), "adopt found an invalid partial database ledger");
    const row = existingRows[0];
    invariant(row.status === "adopted_legacy", "existing baseline was not adopted as legacy state");
    invariant(row.execution_receipt_id === receipt.id && row.execution_receipt_sha256 === receipt.sha256, "existing adoption receipt differs from the requested receipt");
    return { status: "no-op", adopted: context.baseline.id, proofs, schemaFingerprintSha256: currentFingerprint, legacyDrizzleChain: legacy };
  }

  await atomicWrite(client, {
    proofs: [...context.baseline.receipt.record.proofs, ...receipt.document.proofs],
    metadata: [
      metadataTableStatement(context.ledger),
      ledgerInsertStatement(context, context.baseline, {
        status: "adopted_legacy",
        executionReceiptId: receipt.id,
        executionReceiptSha256: receipt.sha256,
        releaseSha,
        environment,
        appliedAt: now(),
      }),
    ],
  });
  return { status: "adopted", adopted: context.baseline.id, proofs, schemaFingerprintSha256: currentFingerprint, legacyDrizzleChain: legacy };
}

// ── Dry run ──────────────────────────────────────────────────────────────────

function localFilePath(databaseUrl) {
  if (!/^file:/i.test(databaseUrl)) return null;
  try {
    return fileURLToPath(databaseUrl);
  } catch {
    return path.resolve(databaseUrl.replace(/^file:/i, ""));
  }
}

/**
 * Rehearse the whole apply on a consistent copy of a LOCAL database.
 *
 * `VACUUM INTO` is a read of the source and a write of a brand-new file, so
 * the target is never touched — which is the entire contract of a dry run.
 * The rehearsal then runs the migration twice: once to prove it applies and
 * its proofs hold, once to prove the second run is a no-op (plan §12 step 8).
 */
async function rehearseOnCopy({ client, context, databaseUrl, releaseSha, now }) {
  const source = localFilePath(databaseUrl);
  if (!source) {
    return {
      status: "skipped",
      reason: "remote-target",
      guidance: "A remote database is never rehearsed in place. Restore the verified backup into an isolated copy and point --database-url at that copy (plan §12 step 7).",
    };
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "timeline-dry-run-"));
  const copyPath = path.join(dir, "rehearsal.db");
  let rehearsal = null;
  try {
    await client.execute({ sql: "VACUUM INTO ?", args: [copyPath] });
    rehearsal = createClient({ url: pathToFileURL(copyPath).href });
    const first = await runTimelineMigrations({
      client: rehearsal,
      context,
      environment: "test",
      databaseUrl: pathToFileURL(copyPath).href,
      releaseSha,
      now,
    });
    const second = await runTimelineMigrations({
      client: rehearsal,
      context,
      environment: "test",
      databaseUrl: pathToFileURL(copyPath).href,
      releaseSha,
      now,
    });
    const fingerprint = await timelineSchemaFingerprintSha256(rehearsal, context.ledger);
    rehearsal.close();
    rehearsal = null;
    return {
      status: "passed",
      applied: first.applied,
      proofsVerified: first.proofs.length,
      secondRun: second.status,
      schemaFingerprintSha256: fingerprint,
      databaseSha256: sha256(fs.readFileSync(copyPath)),
    };
  } finally {
    rehearsal?.close();
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Best effort. libSQL can hold the copy's file handle past close() on
      // Windows, and a rehearsal that succeeded must not be reported as a
      // failure because a scratch file outlived it. The copy contains no data
      // the source does not already have, and the OS reclaims the temp dir.
    }
  }
}

export async function dryRunTimelineMigrations({
  client,
  context = loadTimelineLedger(),
  environment = "local",
  databaseUrl = ":memory:",
  releaseSha = "dry-run",
  now = () => Date.now(),
}) {
  validateEnvironment(environment);
  const objects = await applicationObjectCount(client, context.ledger);
  const existingRows = await readLedgerRows(client, context.ledger);
  const legacy = await readLegacyDrizzleChain(client, context.ledger);

  if (objects > 0 && existingRows.length === 0) {
    return {
      status: "adoption-required",
      wouldApply: [],
      legacyDrizzleChain: legacy,
      schemaFingerprintSha256: await timelineSchemaFingerprintSha256(client, context.ledger),
      note: "This database predates the Timeline ledger. Run `adopt` with a receipt before any forward migration; the consolidated baseline is never replayed.",
    };
  }

  const pending = existingRows.length === 0
    ? [context.baseline, ...context.forward]
    : validateRuntimeRows(context, existingRows);
  if (existingRows.length > 0) await verifyAppliedEntryProofs(client, context, existingRows.length);

  const plan = pending.map((entry) => ({
    id: entry.id,
    sha256: entry.sha256,
    policy: entry.policy,
    statements: migrationStatements(entry.sql).length,
    proofs: entry.receipt.record.proofs.map((proof) => proof.id),
    postconditions: entry.receipt.record.postconditions.length,
  }));

  return {
    status: pending.length === 0 ? "no-op" : "would-apply",
    wouldApply: plan,
    legacyDrizzleChain: legacy,
    schemaFingerprintSha256: await timelineSchemaFingerprintSha256(client, context.ledger),
    rehearsal: pending.length === 0
      ? { status: "skipped", reason: "nothing-pending" }
      : await rehearseOnCopy({ client, context, databaseUrl, releaseSha, now }),
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function resolveConnection(values) {
  const databaseUrl = values["database-url"] || process.env.TIMELINE_DATABASE_URL || "file:roadmap.db";
  const authToken = values["auth-token"] || process.env.TIMELINE_AUTH_TOKEN;
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
      "dry-run": { type: "boolean" },
    },
  });
  const command = positionals[0] ?? "status";
  invariant(["migrate", "adopt", "status"].includes(command), `unknown command ${command}`);
  const { databaseUrl, authToken } = resolveConnection(values);
  const localDatabase = isLocalDatabaseUrl(databaseUrl);
  const environment = validateEnvironment(values.environment ?? (localDatabase ? "local" : "production"));
  if (!localDatabase) {
    invariant(["preview", "staging", "production"].includes(environment), "remote database requires an explicit preview, staging, or production environment");
    invariant(values["confirm-production"] === "timeline", "a remote Timeline command requires --confirm-production=timeline");
  }
  if (environment === "production") {
    invariant(!localDatabase, "production command cannot target a local database");
  }
  const client = createClient({ url: databaseUrl, authToken });
  try {
    let result;
    if (command === "status") result = await timelineMigrationStatus({ client });
    if (command === "migrate") {
      result = values["dry-run"]
        ? await dryRunTimelineMigrations({ client, environment, databaseUrl, releaseSha: values["release-sha"] })
        : await runTimelineMigrations({
            client,
            environment,
            databaseUrl,
            releaseSha: values["release-sha"],
            executionReceiptPath: values.receipt,
          });
    }
    if (command === "adopt") {
      result = await adoptTimelineDatabase({
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
