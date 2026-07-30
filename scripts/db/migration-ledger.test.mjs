import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import {
  canonicalFileSha256,
  canonicalText,
  defaultRoot,
  loadAndValidateLedger,
  sha256,
} from "./migration-ledger.mjs";
import {
  adoptExistingDatabase,
  databaseIdentitySha256,
  migrationStatus,
  runMigrations,
  schemaFingerprintSha256,
} from "./migrate.mjs";

function copyContractFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tasks-migration-contract-"));
  fs.cpSync(path.join(defaultRoot, "drizzle"), path.join(root, "drizzle"), { recursive: true });
  fs.copyFileSync(path.join(defaultRoot, ".gitattributes"), path.join(root, ".gitattributes"));
  return root;
}

function withFixture(operation) {
  const root = copyContractFixture();
  try {
    return operation(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function withClient(operation) {
  const client = createClient({ url: ":memory:" });
  try {
    return await operation(client);
  } finally {
    client.close();
  }
}

test("authoritative ledger registers every SQL file with receipt and journal parity", () => {
  const context = loadAndValidateLedger();
  assert.equal(context.entries.length, 23);
  assert.equal(context.baseline.id, "0014_current_schema_baseline");
  assert.deepEqual(context.forward.map((entry) => entry.id), [
    "0015_notes_extract_exact_identity",
    "0016_tasks_archived_at",
    "0017_resources",
    "0018_notification_prefs_nudges",
    "0019_invites_and_workspace_events",
    "0020_user_preferences_theme_mode",
    "0021_tasks_seq",
    "0022_workspaces_description",
  ]);
  assert.equal(context.entries.filter((entry) => entry.policy === "legacy-adopt-only").length, 14);
});

test("an unregistered SQL file fails the contract", () => withFixture((root) => {
  fs.writeFileSync(path.join(root, "drizzle", "9999_unregistered.sql"), "SELECT 1;\n");
  assert.throws(() => loadAndValidateLedger({ root }), /registered exactly once/);
}));

test("a modified SQL file fails the content-addressed contract", () => withFixture((root) => {
  fs.appendFileSync(path.join(root, "drizzle", "0012_suite_outbox.sql"), "\n-- tampered\n");
  assert.throws(() => loadAndValidateLedger({ root }), /0012_suite_outbox SQL hash does not match/);
}));

test("a registered but unreceipted migration fails the contract", () => withFixture((root) => {
  const receiptPath = path.join(root, "drizzle", "receipts", "reviewed-legacy-migrations.json");
  const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  receipt.migrations = receipt.migrations.filter((migration) => migration.id !== "0012_suite_outbox");
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  const ledgerPath = path.join(root, "drizzle", "migration-ledger.json");
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
  const receiptSha256 = canonicalFileSha256(receiptPath);
  ledger.entries
    .filter((entry) => entry.receipt === "drizzle/receipts/reviewed-legacy-migrations.json")
    .forEach((entry) => { entry.receiptSha256 = receiptSha256; });
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  assert.throws(() => loadAndValidateLedger({ root }), /0012_suite_outbox must have exactly one receipt/);
}));

test("a modified receipt fails its content-addressed ledger binding", () => withFixture((root) => {
  fs.appendFileSync(path.join(root, "drizzle", "receipts", "current-schema-baseline.json"), "\n");
  assert.throws(() => loadAndValidateLedger({ root }), /0014_current_schema_baseline receipt hash does not match/);
}));

test("a modified snapshot fails its content-addressed ledger binding", () => withFixture((root) => {
  fs.appendFileSync(path.join(root, "drizzle", "meta", "0014_snapshot.json"), "\n");
  assert.throws(() => loadAndValidateLedger({ root }), /0014_current_schema_baseline snapshot hash does not match/);
}));

test("journal omission fails even when the SQL and receipt exist", () => withFixture((root) => {
  const journalPath = path.join(root, "drizzle", "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  journal.entries.splice(8, 1);
  fs.writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
  assert.throws(() => loadAndValidateLedger({ root }), /same entries/);
}));

test("fresh databases apply the canonical baseline plus forwards and rerun as a no-op", async () => withClient(async (client) => {
  const first = await runMigrations({ client, releaseSha: "test-release", now: () => 1_784_156_994_451 });
  assert.deepEqual(first.applied, [
    "0014_current_schema_baseline",
    "0015_notes_extract_exact_identity",
    "0016_tasks_archived_at",
    "0017_resources",
    "0018_notification_prefs_nudges",
    "0019_invites_and_workspace_events",
    "0020_user_preferences_theme_mode",
    "0021_tasks_seq",
    "0022_workspaces_description",
  ]);
  assert.equal(first.proofs.length, 51);

  const objectCounts = await client.execute("SELECT type, COUNT(*) AS value FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name NOT IN ('signal_schema_migrations', '__drizzle_migrations') GROUP BY type ORDER BY type");
  assert.deepEqual(objectCounts.rows.map((row) => [row.type, Number(row.value)]), [
    ["index", 31],
    ["table", 26],
    ["trigger", 2],
  ]);

  const second = await runMigrations({ client, releaseSha: "test-release" });
  assert.deepEqual(second, { status: "no-op", applied: [] });
  assert.equal((await migrationStatus({ client })).state, "current");
}));

test("a non-empty database without an exact ledger refuses migration execution", async () => withClient(async (client) => {
  await client.execute("CREATE TABLE users (id TEXT PRIMARY KEY)");
  await assert.rejects(() => runMigrations({ client }), /run receipt-backed adopt/);
  assert.equal(await client.execute("SELECT COUNT(*) AS value FROM sqlite_schema WHERE name = 'signal_schema_migrations'").then((result) => Number(result.rows[0].value)), 0);
}));

test("database ledger hash drift fails closed", async () => withClient(async (client) => {
  await runMigrations({ client, releaseSha: "test-release" });
  await client.execute("UPDATE signal_schema_migrations SET sha256 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'");
  await assert.rejects(() => runMigrations({ client }), /database ledger hash mismatch/);
}));

test("schema drift fails both migration no-op and current status", async () => withClient(async (client) => {
  await runMigrations({ client, releaseSha: "test-release" });
  await client.execute("DROP TRIGGER tasks_parent_workspace_guard_insert");
  await client.execute("DROP INDEX idx_tasks_source_note_id");
  await assert.rejects(() => runMigrations({ client }), /proof required-indexes expected 26 but received 25/);
  await assert.rejects(() => migrationStatus({ client }), /proof required-indexes expected 26 but received 25/);
}));

test("applied forward migration drift fails both migration no-op and current status", async () => withClient(async (client) => {
  await runMigrations({ client, releaseSha: "test-release" });
  await client.execute("ALTER TABLE tasks DROP COLUMN source_note_extract_body");

  await assert.rejects(
    () => runMigrations({ client }),
    /proof exact-identity-columns expected 2 but received 1/,
  );
  await assert.rejects(
    () => migrationStatus({ client }),
    /proof exact-identity-columns expected 2 but received 1/,
  );
}));

test("same-name wrong-definition source-note index fails semantic proofs", async () => withClient(async (client) => {
  await runMigrations({ client, releaseSha: "test-release" });
  await client.execute("DROP INDEX idx_tasks_source_note_id");
  await client.execute("CREATE INDEX idx_tasks_source_note_id ON tasks (title) WHERE title IS NOT NULL");
  await assert.rejects(() => runMigrations({ client }), /proof source-note-partial-unique expected 1 but received 0/);
  await assert.rejects(() => migrationStatus({ client }), /proof source-note-partial-unique expected 1 but received 0/);
}));

test("same-name inert parent guards fail both trigger-definition proofs", async () => withClient(async (client) => {
  await runMigrations({ client, releaseSha: "test-release" });
  const originalInsert = String((await client.execute("SELECT sql FROM sqlite_schema WHERE type = 'trigger' AND name = 'tasks_parent_workspace_guard_insert'")).rows[0].sql);

  await client.execute("DROP TRIGGER tasks_parent_workspace_guard_insert");
  await client.execute("CREATE TRIGGER tasks_parent_workspace_guard_insert BEFORE INSERT ON tasks BEGIN SELECT 1; END");
  await assert.rejects(() => runMigrations({ client }), /proof parent-guard-insert-definition expected 1 but received 0/);

  await client.execute("DROP TRIGGER tasks_parent_workspace_guard_insert");
  await client.execute(originalInsert);
  await client.execute("DROP TRIGGER tasks_parent_workspace_guard_update");
  await client.execute("CREATE TRIGGER tasks_parent_workspace_guard_update BEFORE UPDATE OF parent_task_id, workspace_id ON tasks BEGIN SELECT 1; END");
  await assert.rejects(() => migrationStatus({ client }), /proof parent-guard-update-definition expected 1 but received 0/);
}));

test("remote databases cannot bypass receipt safety with a local label or environment typo", async () => withClient(async (client) => {
  await assert.rejects(
    () => runMigrations({ client, databaseUrl: "libsql://tasks-production.example", environment: "local" }),
    /pending migrations but no --receipt/,
  );
  await assert.rejects(
    () => runMigrations({ client, environment: "prod" }),
    /unsupported environment prod/,
  );
  assert.equal(await client.execute("SELECT COUNT(*) AS value FROM sqlite_schema WHERE name = 'signal_schema_migrations'").then((result) => Number(result.rows[0].value)), 0);
}));

test("production execution receipt is bound to target, environment, ledger, and pending hashes", async () => withClient(async (client) => {
  const context = loadAndValidateLedger();
  const databaseUrl = "libsql://tasks-production.example";
  const receiptDir = fs.mkdtempSync(path.join(os.tmpdir(), "tasks-execution-receipt-"));
  const receiptPath = path.join(receiptDir, "receipt.json");
  const receipt = {
    schemaVersion: "tasks-migration-execution/1",
    id: "tasks-production-baseline",
    environment: "production",
    databaseIdentitySha256: databaseIdentitySha256(databaseUrl),
    ledgerSha256: context.ledgerSha256,
    backupSha256: "a".repeat(64),
    dryRun: { status: "passed", databaseSha256: "b".repeat(64) },
    migrations: [context.baseline, ...context.forward].map(({ id, sha256 }) => ({
      id,
      sha256,
    })),
  };
  const writeReceipt = () => fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  try {
    receipt.databaseIdentitySha256 = "f".repeat(64);
    writeReceipt();
    await assert.rejects(
      () => runMigrations({ client, databaseUrl, environment: "production", executionReceiptPath: receiptPath }),
      /targets a different database/,
    );

    receipt.databaseIdentitySha256 = databaseIdentitySha256(databaseUrl);
    receipt.environment = "staging";
    writeReceipt();
    await assert.rejects(
      () => runMigrations({ client, databaseUrl, environment: "production", executionReceiptPath: receiptPath }),
      /environment does not match/,
    );

    receipt.environment = "production";
    receipt.ledgerSha256 = "e".repeat(64);
    writeReceipt();
    await assert.rejects(
      () => runMigrations({ client, databaseUrl, environment: "production", executionReceiptPath: receiptPath }),
      /ledger hash does not match/,
    );

    receipt.ledgerSha256 = context.ledgerSha256;
    writeReceipt();
    const result = await runMigrations({
      client,
      databaseUrl,
      environment: "production",
      executionReceiptPath: receiptPath,
      releaseSha: "production-release",
    });
    assert.deepEqual(
      result.applied,
      [context.baseline, ...context.forward].map((entry) => entry.id),
    );
    const row = (await client.execute("SELECT execution_receipt_id, environment FROM signal_schema_migrations")).rows[0];
    assert.equal(row.execution_receipt_id, receipt.id);
    assert.equal(row.environment, "production");
  } finally {
    fs.rmSync(receiptDir, { recursive: true, force: true });
  }
}));

test("failed postconditions roll back both SQL and ledger row", async () => withClient(async (client) => {
  const base = loadAndValidateLedger();
  await runMigrations({ client, context: base, releaseSha: "test-release" });

  const sql = "CREATE TABLE forward_probe (id TEXT PRIMARY KEY);";
  const forward = {
    ordinal: base.entries.length,
    id: "0016_forward_probe",
    file: "drizzle/0016_forward_probe.sql",
    when: base.entries.at(-1).when + 1,
    sha256: sha256(canonicalText(sql)),
    policy: "forward",
    sql,
    receipt: {
      document: { id: "forward-probe-review" },
      record: {
        proofs: [{
          id: "deliberate-failure",
          sql: "SELECT COUNT(*) AS value FROM sqlite_schema WHERE name = 'forward_probe'",
          expected: 2,
        }],
      },
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
  };
  const context = {
    ...base,
    entries: [...base.entries, forward],
    forward: [...base.forward, forward],
  };
  await assert.rejects(() => runMigrations({ client, context, releaseSha: "test-release" }), /deliberate-failure/);
  assert.equal(await client.execute("SELECT COUNT(*) AS value FROM sqlite_schema WHERE name = 'forward_probe'").then((result) => Number(result.rows[0].value)), 0);
  assert.equal(
    await client.execute("SELECT COUNT(*) AS value FROM signal_schema_migrations").then((result) => Number(result.rows[0].value)),
    1 + base.forward.length,
  );
}));

test("receipt-backed adoption verifies target, shape, proofs, and is idempotent", async () => withClient(async (client) => {
  const context = loadAndValidateLedger();
  await client.executeMultiple(context.baseline.sql);
  const databaseUrl = "file:tasks-adoption-test.db";
  const receiptDir = fs.mkdtempSync(path.join(os.tmpdir(), "tasks-adoption-receipt-"));
  const receiptPath = path.join(receiptDir, "receipt.json");
  const receipt = {
    schemaVersion: "tasks-production-adoption/1",
    id: "tasks-adoption-test",
    environment: "production",
    databaseIdentitySha256: databaseIdentitySha256(databaseUrl),
    schemaFingerprintSha256: await schemaFingerprintSha256(client),
    ledgerSha256: context.ledgerSha256,
    baseline: { id: context.baseline.id, sha256: context.baseline.sha256 },
    operatorEvidence: [
      { receiptSha256: "a".repeat(64), backupSha256: "b".repeat(64) },
      { receiptSha256: "c".repeat(64), backupSha256: "d".repeat(64) },
    ],
    proofs: [{ id: "no-invalid-parents", sql: "SELECT COUNT(*) AS value FROM tasks WHERE parent_task_id IS NOT NULL", expected: 0 }],
  };
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  try {
    const first = await adoptExistingDatabase({
      client,
      databaseUrl,
      receiptPath,
      context,
      releaseSha: "adoption-release",
      now: () => 1_784_156_994_451,
    });
    assert.equal(first.status, "adopted");
    const row = (await client.execute("SELECT * FROM signal_schema_migrations")).rows[0];
    assert.equal(row.status, "adopted_legacy");
    assert.equal(row.execution_receipt_id, receipt.id);

    assert.equal((await migrationStatus({ client, context })).state, "pending");
    const second = await adoptExistingDatabase({ client, databaseUrl, receiptPath, context, releaseSha: "adoption-release" });
    assert.equal(second.status, "no-op");
    const upgraded = await runMigrations({
      client,
      databaseUrl,
      context,
      environment: "development",
      releaseSha: "adoption-upgrade",
    });
    assert.deepEqual(
      upgraded.applied,
      context.forward.map((entry) => entry.id),
    );
    assert.equal((await migrationStatus({ client, context })).state, "current");
  } finally {
    fs.rmSync(receiptDir, { recursive: true, force: true });
  }
}));

test("adoption receipt for another database fails before writing metadata", async () => withClient(async (client) => {
  const context = loadAndValidateLedger();
  await client.executeMultiple(context.baseline.sql);
  const receiptDir = fs.mkdtempSync(path.join(os.tmpdir(), "tasks-wrong-target-"));
  const receiptPath = path.join(receiptDir, "receipt.json");
  fs.writeFileSync(receiptPath, JSON.stringify({
    schemaVersion: "tasks-production-adoption/1",
    id: "wrong-target",
    environment: "production",
    databaseIdentitySha256: "f".repeat(64),
    schemaFingerprintSha256: await schemaFingerprintSha256(client),
    ledgerSha256: context.ledgerSha256,
    baseline: { id: context.baseline.id, sha256: context.baseline.sha256 },
    operatorEvidence: [
      { receiptSha256: "a".repeat(64), backupSha256: "b".repeat(64) },
      { receiptSha256: "c".repeat(64), backupSha256: "d".repeat(64) },
    ],
    proofs: [{ id: "proof", sql: "SELECT 1 AS value", expected: 1 }],
  }));
  try {
    await assert.rejects(() => adoptExistingDatabase({ client, databaseUrl: "file:right-target.db", receiptPath, context }), /different database/);
    assert.equal(await client.execute("SELECT COUNT(*) AS value FROM sqlite_schema WHERE name = 'signal_schema_migrations'").then((result) => Number(result.rows[0].value)), 0);
  } finally {
    fs.rmSync(receiptDir, { recursive: true, force: true });
  }
}));
