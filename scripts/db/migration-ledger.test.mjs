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
  assert.equal(context.entries.length, 29);
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
    "0023_retire_launch_scaffolding",
    "0024_retire_waiting_lane",
    "0025_tasks_completed_at",
    "0026_workspace_money",
    "0027_share_link_token_hash",
    "0028_project_drive",
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
    "0023_retire_launch_scaffolding",
    "0024_retire_waiting_lane",
    "0025_tasks_completed_at",
    "0026_workspace_money",
    "0027_share_link_token_hash",
    "0028_project_drive",
  ]);
  assert.equal(first.proofs.length, 121);

  const objectCounts = await client.execute("SELECT type, COUNT(*) AS value FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name NOT IN ('signal_schema_migrations', '__drizzle_migrations') GROUP BY type ORDER BY type");
  assert.deepEqual(objectCounts.rows.map((row) => [row.type, Number(row.value)]), [
    ["index", 40],
    ["table", 26],
    ["trigger", 4],
  ]);

  const second = await runMigrations({ client, releaseSha: "test-release" });
  assert.deepEqual(second, { status: "no-op", applied: [] });
  assert.equal((await migrationStatus({ client })).state, "current");
}));

test("Project Drive preserves credential, folder, and grant generations", async () => withClient(async (client) => {
  await runMigrations({ client, releaseSha: "test-release" });
  await client.execute("INSERT INTO users (id, color, initials) VALUES ('owner', '#000', 'OW'), ('member', '#111', 'ME')");
  await client.execute("INSERT INTO workspaces (id, slug, name) VALUES ('ws-a', 'ws-a', 'A'), ('ws-b', 'ws-b', 'B')");

  const connection = (id, permissionId, current = 1) => ({
    sql: `INSERT INTO provider_connections (
      id, user_id, provider, provider_account_id, root_folder_id,
      refresh_token_cipher, key_version, scopes, status, is_current, connected_at
    ) VALUES (?, 'owner', 'google_drive', ?, ?, ?, 1, '["drive.file"]', 'active', ?, 1)`,
    args: [id, permissionId, `root-${id}`, `cipher-${id}`, current],
  });
  await client.execute(connection("conn-a1", "permission-a"));
  await assert.rejects(
    () => client.execute(`INSERT INTO provider_connections (
      id, user_id, provider, provider_account_id, root_folder_id,
      refresh_token_cipher, key_version, scopes, status, is_current, connected_at
    ) VALUES ('conn-invalid-scopes', 'owner', 'google_drive', 'permission-invalid',
      'root-invalid', 'cipher-invalid', 1, 'not-json', 'active', 0, 1)`),
    /CHECK constraint failed/,
  );
  await assert.rejects(
    () => client.execute(connection("conn-b1", "permission-b")),
    /UNIQUE constraint failed/,
  );
  await client.execute("UPDATE provider_connections SET is_current = 0 WHERE id = 'conn-a1'");
  await client.execute(connection("conn-b1", "permission-b"));
  await client.execute("UPDATE provider_connections SET is_current = 0 WHERE id = 'conn-b1'");
  await client.execute(connection("conn-a2", "permission-a"));

  const generation = (id, connectionId, folderId, current = 1) => ({
    sql: `INSERT INTO workspace_storage (
      id, workspace_id, connection_id, folder_id, folder_web_view_link, state, is_current
    ) VALUES (?, 'ws-a', ?, ?, ?, 'active', ?)`,
    args: [id, connectionId, folderId, `https://drive.example/${folderId}`, current],
  });
  await client.execute(generation("gen-a1", "conn-a1", "folder-a1"));
  await assert.rejects(
    () => client.execute(generation("gen-b1", "conn-b1", "folder-b1")),
    /UNIQUE constraint failed/,
  );
  await client.execute("UPDATE workspace_storage SET is_current = 0 WHERE id = 'gen-a1'");
  await client.execute(generation("gen-b1", "conn-b1", "folder-b1"));
  await client.execute("UPDATE workspace_storage SET is_current = 0 WHERE id = 'gen-b1'");
  await client.execute(generation("gen-a2", "conn-a2", "folder-a2"));
  await client.execute("UPDATE workspace_storage SET is_current = 0 WHERE id = 'gen-a2'");
  await client.execute(generation("gen-a3", "conn-a2", "replacement-folder"));

  await client.execute(`INSERT INTO drive_folder_grants (
    storage_generation_id, workspace_id, user_id, permission_id,
    granted_email, role, granted_at
  ) VALUES ('gen-a1', 'ws-a', 'member', 'grant-a1', 'member@example.com', 'writer', 1)`);
  await client.execute(`INSERT INTO drive_folder_grants (
    storage_generation_id, workspace_id, user_id, permission_id,
    granted_email, role, granted_at
  ) VALUES ('gen-b1', 'ws-a', 'member', 'grant-b1', 'member@example.com', 'writer', 2)`);
  await assert.rejects(
    () => client.execute(`INSERT INTO drive_folder_grants (
      storage_generation_id, workspace_id, user_id, permission_id,
      granted_email, role, granted_at
    ) VALUES ('gen-a3', 'ws-b', 'member', 'wrong-workspace', 'member@example.com', 'writer', 3)`),
  );

  await client.execute(`INSERT INTO resources (
    id, workspace_id, task_id, kind, provider, storage, storage_generation_id,
    title, added_at, access_state, counts_against_storage
  ) VALUES ('resource-drive', 'ws-a', 'task-a', 'upload', 'drive', 'drive',
    'gen-a3', 'Drive file', 1, 'pending', 0)`);
  await assert.rejects(
    () => client.execute(`INSERT INTO resources (
      id, workspace_id, task_id, kind, provider, storage, storage_generation_id,
      title, added_at, access_state, counts_against_storage
    ) VALUES ('resource-wrong-workspace', 'ws-b', 'task-a', 'upload', 'drive',
      'drive', 'gen-a3', 'Wrong workspace', 1, 'pending', 0)`),
    /storage generation must belong to the resource workspace/,
  );
  await assert.rejects(
    () => client.execute(`INSERT INTO resources (
      id, workspace_id, task_id, kind, provider, storage,
      title, added_at, access_state, counts_against_storage
    ) VALUES ('resource-drive-no-generation', 'ws-a', 'task-a', 'upload',
      'drive', 'drive', 'Missing generation', 1, 'pending', 0)`),
    /CHECK constraint failed/,
  );
  await assert.rejects(
    () => client.execute(`INSERT INTO resources (
      id, workspace_id, task_id, kind, provider, storage, storage_generation_id,
      title, added_at, access_state, counts_against_storage
    ) VALUES ('resource-signal-with-generation', 'ws-a', 'task-a', 'upload',
      'file', 'signal', 'gen-a3', 'Wrong generation', 1, 'pending', 0)`),
    /CHECK constraint failed/,
  );
  await assert.rejects(
    () => client.execute(`INSERT INTO resources (
      id, workspace_id, task_id, kind, provider, storage, storage_generation_id,
      title, added_at, access_state, counts_against_storage
    ) VALUES ('resource-missing', 'ws-a', 'task-a', 'upload', 'drive', 'drive',
      'missing-generation', 'Missing', 1, 'pending', 0)`),
  );

  const generations = await client.execute(
    "SELECT id, connection_id, folder_id, is_current FROM workspace_storage WHERE workspace_id = 'ws-a' ORDER BY id",
  );
  assert.deepEqual(
    generations.rows.map((row) => [row.id, row.connection_id, row.folder_id, Number(row.is_current)]),
    [
      ["gen-a1", "conn-a1", "folder-a1", 0],
      ["gen-a2", "conn-a2", "folder-a2", 0],
      ["gen-a3", "conn-a2", "replacement-folder", 1],
      ["gen-b1", "conn-b1", "folder-b1", 0],
    ],
  );
  assert.equal(
    Number((await client.execute("SELECT COUNT(*) AS value FROM drive_folder_grants WHERE user_id = 'member'")).rows[0].value),
    2,
  );
  await assert.rejects(() => client.execute("DELETE FROM users WHERE id = 'owner'"), /FOREIGN KEY constraint failed/);
  await assert.rejects(() => client.execute("DELETE FROM workspaces WHERE id = 'ws-a'"), /FOREIGN KEY constraint failed/);
  await assert.rejects(() => client.execute("DELETE FROM provider_connections WHERE id = 'conn-a1'"), /FOREIGN KEY constraint failed/);
  await assert.rejects(() => client.execute("DELETE FROM workspace_storage WHERE id = 'gen-a1'"), /FOREIGN KEY constraint failed/);
  await assert.rejects(() => client.execute("DELETE FROM workspace_storage WHERE id = 'gen-a3'"), /FOREIGN KEY constraint failed/);
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

test("migration-time backfill proofs do not become false production drift alarms", async () => withClient(async (client) => {
  await runMigrations({ client, releaseSha: "test-release" });
  await client.execute({
    sql: "INSERT INTO tasks (id, title, lane, priority, completed_at, seq) VALUES (?, ?, ?, ?, ?, ?)",
    args: ["post-migration-task", "Completed after the migration", "done", "P2", 1_785_000_000, 999],
  });

  assert.equal((await migrationStatus({ client })).state, "current");
  assert.deepEqual(await runMigrations({ client }), { status: "no-op", applied: [] });
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
