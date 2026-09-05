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
  assert.equal(context.entries.length, 32);
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
    "0029_project_drive_operations",
    "0030_sponsored_use_intents",
    "0031_event_purchase_designations",
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
    "0029_project_drive_operations",
    "0030_sponsored_use_intents",
    "0031_event_purchase_designations",
  ]);
  assert.equal(first.proofs.length, 169);

  const objectCounts = await client.execute("SELECT type, COUNT(*) AS value FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name NOT IN ('signal_schema_migrations', '__drizzle_migrations') GROUP BY type ORDER BY type");
  assert.deepEqual(objectCounts.rows.map((row) => [row.type, Number(row.value)]), [
    ["index", 51],
    ["table", 30],
    ["trigger", 7],
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

test("Project Drive operation journal is typed, recoverable, and lifecycle-safe with foreign keys on", async () => withClient(async (client) => {
  await runMigrations({ client, releaseSha: "test-release" });
  assert.equal(
    Number((await client.execute("SELECT foreign_keys AS value FROM pragma_foreign_keys")).rows[0].value),
    1,
    "this test must exercise real SQLite FK enforcement",
  );

  await client.execute(`INSERT INTO users (id, color, initials) VALUES
    ('journal-owner', '#000', 'JO'),
    ('journal-member', '#111', 'JM'),
    ('journal-delete-member', '#333', 'DM'),
    ('handover-owner', '#222', 'HO')`);
  await client.execute(`INSERT INTO workspaces (id, slug, name) VALUES
    ('journal-ws-a', 'journal-ws-a', 'Journal A'),
    ('journal-ws-b', 'journal-ws-b', 'Journal B'),
    ('journal-ws-delete', 'journal-ws-delete', 'Delete me')`);
  await client.execute(`INSERT INTO provider_connections (
    id, user_id, provider, provider_account_id, root_folder_id,
    refresh_token_cipher, key_version, scopes, status, is_current, connected_at
  ) VALUES
    ('journal-conn-a', 'journal-owner', 'google_drive', 'provider-a',
      'root-a', 'cipher-a', 1, '["drive.file"]', 'active', 1, 1),
    ('journal-conn-b', 'handover-owner', 'google_drive', 'provider-b',
      'root-b', 'cipher-b', 1, '["drive.file"]', 'active', 1, 1)`);
  await client.execute(`INSERT INTO workspace_storage (
    id, workspace_id, connection_id, folder_id, folder_web_view_link,
    state, is_current
  ) VALUES
    ('journal-gen-a', 'journal-ws-a', 'journal-conn-a',
      'folder-a', 'https://drive.example/folder-a', 'active', 1),
    ('journal-gen-delete', 'journal-ws-delete', 'journal-conn-a',
      'folder-delete', 'https://drive.example/folder-delete', 'active', 1)`);

  const insertOperation = (input) => client.execute({
    sql: `INSERT INTO project_drive_operations (
      id, workspace_id, operation_kind, status, dedupe_key, connection_id,
      storage_generation_id, target_storage_generation_id, subject_user_id,
      grantee_email, grant_role, workspace_revision, provider_folder_id,
      provider_folder_web_view_link, provider_permission_id, attempt_count,
      last_attempt_at, next_attempt_at, lease_expires_at, last_error_code,
      created_at, updated_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.id,
      input.workspaceId ?? "journal-ws-a",
      input.operationKind,
      input.status ?? "pending",
      input.dedupeKey,
      input.connectionId ?? null,
      input.storageGenerationId ?? null,
      input.targetStorageGenerationId ?? null,
      input.subjectUserId ?? null,
      input.granteeEmail ?? null,
      input.grantRole ?? null,
      input.workspaceRevision ?? null,
      input.providerFolderId ?? null,
      input.providerFolderWebViewLink ?? null,
      input.providerPermissionId ?? null,
      input.attemptCount ?? 0,
      input.lastAttemptAt ?? null,
      input.nextAttemptAt ?? null,
      input.leaseExpiresAt ?? null,
      input.lastErrorCode ?? null,
      input.createdAt ?? 10,
      input.updatedAt ?? 10,
      input.completedAt ?? null,
    ],
  });

  await insertOperation({
    id: "op-provision",
    operationKind: "folder_provision",
    dedupeKey: "a".repeat(64),
    connectionId: "journal-conn-a",
    targetStorageGenerationId: "journal-gen-reserved",
  });
  await insertOperation({
    id: "op-grant",
    operationKind: "grant_create",
    dedupeKey: "b".repeat(64),
    storageGenerationId: "journal-gen-a",
    subjectUserId: "journal-member",
    granteeEmail: "member@example.com",
    grantRole: "writer",
  });
  await insertOperation({
    id: "op-rename",
    operationKind: "folder_rename",
    dedupeKey: "c".repeat(64),
    storageGenerationId: "journal-gen-a",
    workspaceRevision: 2,
  });
  await insertOperation({
    id: "op-delete",
    workspaceId: "journal-ws-delete",
    operationKind: "project_delete",
    dedupeKey: "d".repeat(64),
  });
  await insertOperation({
    id: "op-handover",
    operationKind: "storage_handover",
    dedupeKey: "e".repeat(64),
    connectionId: "journal-conn-b",
    storageGenerationId: "journal-gen-a",
    targetStorageGenerationId: "journal-gen-b",
  });
  await client.execute(`INSERT INTO drive_folder_grants (
    storage_generation_id, workspace_id, user_id, permission_id,
    granted_email, role, granted_at, revoke_pending
  ) VALUES
    ('journal-gen-a', 'journal-ws-a', 'journal-member',
      'permission-to-revoke', 'member@example.com', 'writer', 10, 1),
    ('journal-gen-delete', 'journal-ws-delete', 'journal-delete-member',
      'permission-delete', 'delete@example.com', 'reader', 10, 1)`);

  assert.equal(
    Number((await client.execute("SELECT COUNT(*) AS value FROM workspace_storage WHERE id = 'journal-gen-reserved'")).rows[0].value),
    0,
    "folder intent must be durable before its storage generation can exist",
  );
  assert.equal(
    Number((await client.execute(`SELECT COUNT(*) AS value
      FROM pragma_foreign_key_list('project_drive_operations')
      WHERE "from" = 'target_storage_generation_id'`)).rows[0].value),
    0,
    "the reserved target generation must not have a premature FK",
  );

  await assert.rejects(
    () => insertOperation({
      id: "op-bad-key",
      operationKind: "project_delete",
      dedupeKey: "not-a-hash",
    }),
    /CHECK constraint failed/,
  );
  await assert.rejects(
    () => insertOperation({
      id: "op-revoke-duplicate-queue",
      operationKind: "grant_revoke",
      dedupeKey: "3".repeat(64),
    }),
    /CHECK constraint failed/,
    "grant revocation must stay in drive_folder_grants.revoke_pending",
  );
  await assert.rejects(
    () => insertOperation({
      id: "op-duplicate-key",
      workspaceId: "journal-ws-b",
      operationKind: "project_delete",
      dedupeKey: "d".repeat(64),
    }),
    /UNIQUE constraint failed/,
  );
  await assert.rejects(
    () => insertOperation({
      id: "op-duplicate-generation",
      operationKind: "folder_provision",
      dedupeKey: "f".repeat(64),
      connectionId: "journal-conn-a",
      targetStorageGenerationId: "journal-gen-reserved",
    }),
    /UNIQUE constraint failed/,
  );
  await assert.rejects(
    () => insertOperation({
      id: "op-cross-workspace",
      workspaceId: "journal-ws-b",
      operationKind: "folder_rename",
      dedupeKey: "0".repeat(64),
      storageGenerationId: "journal-gen-a",
      workspaceRevision: 1,
    }),
    /FOREIGN KEY constraint failed/,
  );
  await assert.rejects(
    () => insertOperation({
      id: "op-wrong-shape",
      operationKind: "grant_create",
      dedupeKey: "1".repeat(64),
      connectionId: "journal-conn-a",
      storageGenerationId: "journal-gen-a",
      subjectUserId: "journal-member",
      granteeEmail: "member@example.com",
      grantRole: "writer",
    }),
    /CHECK constraint failed/,
  );
  await assert.rejects(
    () => insertOperation({
      id: "op-running-without-attempt",
      operationKind: "project_delete",
      dedupeKey: "2".repeat(64),
      status: "running",
      leaseExpiresAt: 20,
    }),
    /CHECK constraint failed/,
  );
  await assert.rejects(
    () => insertOperation({
      id: "op-fractional-attempt",
      operationKind: "project_delete",
      dedupeKey: "4".repeat(64),
      attemptCount: 1.5,
      lastAttemptAt: 10,
    }),
    /CHECK constraint failed/,
    "attempt fencing values must be integers",
  );
  await assert.rejects(
    () => insertOperation({
      id: "op-text-revision",
      operationKind: "folder_rename",
      dedupeKey: "5".repeat(64),
      storageGenerationId: "journal-gen-a",
      workspaceRevision: "not-an-integer",
    }),
    /CHECK constraint failed/,
    "workspace revisions must retain integer affinity",
  );
  await assert.rejects(
    () => insertOperation({
      id: "op-invalid-email",
      operationKind: "grant_create",
      dedupeKey: "6".repeat(64),
      storageGenerationId: "journal-gen-a",
      subjectUserId: "journal-member",
      granteeEmail: "member@",
      grantRole: "writer",
    }),
    /CHECK constraint failed/,
    "the database and key normalizer must reject the same incomplete email",
  );
  await assert.rejects(
    () => insertOperation({
      id: "op-invalid-role",
      operationKind: "grant_create",
      dedupeKey: "7".repeat(64),
      storageGenerationId: "journal-gen-a",
      subjectUserId: "journal-member",
      granteeEmail: "member@example.com",
      grantRole: "owner",
    }),
    /CHECK constraint failed/,
    "only the exact writer/reader request may be journaled",
  );

  await client.execute(`UPDATE project_drive_operations SET
    status = 'running', attempt_count = 1, last_attempt_at = 20,
    lease_expires_at = 30, updated_at = 20
    WHERE id = 'op-provision'`);
  await client.execute(`UPDATE project_drive_operations SET
    status = 'retry_wait', lease_expires_at = NULL, next_attempt_at = 40,
    last_error_code = 'network_error', updated_at = 30
    WHERE id = 'op-provision'`);
  await client.execute(`UPDATE project_drive_operations SET
    status = 'manual_attention', next_attempt_at = NULL,
    last_error_code = 'ambiguous_provider_result', updated_at = 40
    WHERE id = 'op-provision'`);
  await client.execute(`UPDATE project_drive_operations SET
    status = 'succeeded', provider_folder_id = 'folder-reserved',
    provider_folder_web_view_link = 'https://drive.example/folder-reserved',
    last_error_code = NULL, completed_at = 50, updated_at = 50
    WHERE id = 'op-provision'`);
  await assert.rejects(
    () => client.execute(`UPDATE project_drive_operations SET
      status = 'cancelled' WHERE id = 'op-provision'`),
    /CHECK constraint failed/,
    "a provider receipt must be repaired, not hidden by cancellation",
  );

  await assert.rejects(
    () => client.execute(`UPDATE project_drive_operations SET
      status = 'manual_attention', attempt_count = 1, last_attempt_at = 20,
      last_error_code = '401 bearer secret response', updated_at = 20
      WHERE id = 'op-rename'`),
    /CHECK constraint failed/,
    "raw provider errors are not valid journal codes",
  );
  await assert.rejects(
    () => client.execute(`UPDATE project_drive_operations SET
      status = 'succeeded', attempt_count = 1, last_attempt_at = 20,
      completed_at = 20, updated_at = 20 WHERE id = 'op-grant'`),
    /CHECK constraint failed/,
    "a successful grant requires its exact permission receipt",
  );
  await client.execute(`UPDATE project_drive_operations SET
    status = 'succeeded', attempt_count = 1, last_attempt_at = 20,
    provider_permission_id = 'permission-receipt', completed_at = 20,
    updated_at = 20 WHERE id = 'op-grant'`);

  const recoveredGrant = (await client.execute(`SELECT
    storage_generation_id, subject_user_id, grantee_email, grant_role,
    provider_permission_id
    FROM project_drive_operations WHERE id = 'op-grant'`)).rows[0];
  assert.deepEqual(
    [
      recoveredGrant.storage_generation_id,
      recoveredGrant.subject_user_id,
      recoveredGrant.grantee_email,
      recoveredGrant.grant_role,
      recoveredGrant.provider_permission_id,
    ],
    [
      "journal-gen-a",
      "journal-member",
      "member@example.com",
      "writer",
      "permission-receipt",
    ],
    "provider success plus a DB crash retains the complete grant request and receipt",
  );

  const revokeReceipt = (await client.execute(`SELECT permission_id, revoke_pending
    FROM drive_folder_grants
    WHERE storage_generation_id = 'journal-gen-a'
      AND user_id = 'journal-member'`)).rows[0];
  assert.equal(revokeReceipt.permission_id, "permission-to-revoke");
  assert.equal(Number(revokeReceipt.revoke_pending), 1);

  await assert.rejects(
    () => client.execute("DELETE FROM workspaces WHERE id = 'journal-ws-delete'"),
    /FOREIGN KEY constraint failed/,
    "project deletion must retain its durable operation until final cleanup",
  );
  await assert.rejects(
    () => client.execute("DELETE FROM users WHERE id = 'journal-member'"),
    /FOREIGN KEY constraint failed/,
    "account cleanup must resolve a member grant operation first",
  );
  await assert.rejects(
    () => client.execute("DELETE FROM provider_connections WHERE id = 'journal-conn-b'"),
    /FOREIGN KEY constraint failed/,
    "handover must retain its target credential generation until resolved",
  );
  await assert.rejects(
    () => client.execute("DELETE FROM workspace_storage WHERE id = 'journal-gen-a'"),
    /FOREIGN KEY constraint failed/,
    "rename, grant and handover repair must retain the source generation",
  );

  const projectDeleteGrant = (await client.execute(`SELECT permission_id,
    revoke_pending FROM drive_folder_grants
    WHERE storage_generation_id = 'journal-gen-delete'
      AND user_id = 'journal-delete-member'`)).rows[0];
  assert.equal(projectDeleteGrant.permission_id, "permission-delete");
  assert.equal(Number(projectDeleteGrant.revoke_pending), 1);
  await client.execute(`DELETE FROM drive_folder_grants
    WHERE storage_generation_id = 'journal-gen-delete'
      AND user_id = 'journal-delete-member' AND revoke_pending = 1`);
  await client.execute("DELETE FROM workspace_storage WHERE id = 'journal-gen-delete'");
  await client.execute(`UPDATE project_drive_operations SET
    status = 'succeeded', attempt_count = 1, last_attempt_at = 20,
    completed_at = 20, updated_at = 20 WHERE id = 'op-delete'`);
  await client.batch([
    "DELETE FROM project_drive_operations WHERE id = 'op-delete' AND status = 'succeeded'",
    "DELETE FROM workspaces WHERE id = 'journal-ws-delete'",
  ], "write");
  assert.equal(
    Number((await client.execute(`SELECT COUNT(*) AS value
      FROM project_drive_operations
      WHERE id = 'op-delete'`)).rows[0].value),
    0,
    "a completed project-delete marker is consumed, not left as a false tombstone",
  );
  await client.execute("DELETE FROM users WHERE id = 'journal-delete-member'");
  await client.execute("DELETE FROM project_drive_operations WHERE id = 'op-grant'");
  await assert.rejects(
    () => client.execute("DELETE FROM users WHERE id = 'journal-member'"),
    /FOREIGN KEY constraint failed/,
    "the sole revoke queue retains the exact grant until provider repair succeeds",
  );
  await client.execute(`DELETE FROM drive_folder_grants
    WHERE storage_generation_id = 'journal-gen-a'
      AND user_id = 'journal-member' AND revoke_pending = 1`);
  await client.execute("DELETE FROM users WHERE id = 'journal-member'");
  await client.execute("DELETE FROM project_drive_operations WHERE id = 'op-handover'");
  await client.execute("DELETE FROM provider_connections WHERE id = 'journal-conn-b'");
  await client.execute("DELETE FROM project_drive_operations WHERE id = 'op-rename'");
  await client.execute("DELETE FROM workspace_storage WHERE id = 'journal-gen-a'");
}));

test("Project Drive operation journal detects same-name partial-index drift", async () => withClient(async (client) => {
  await runMigrations({ client, releaseSha: "test-release" });

  await client.execute("DROP INDEX idx_project_drive_operations_target_generation");
  await client.execute(`CREATE UNIQUE INDEX idx_project_drive_operations_target_generation
    ON project_drive_operations (target_storage_generation_id) WHERE 0`);
  await assert.rejects(
    () => migrationStatus({ client }),
    /proof project-drive-operations-target-index-guard expected 1 but received 0/,
  );

  await client.execute("DROP INDEX idx_project_drive_operations_target_generation");
  await client.execute(`CREATE UNIQUE INDEX idx_project_drive_operations_target_generation
    ON project_drive_operations (target_storage_generation_id)
    WHERE target_storage_generation_id IS NOT NULL`);
  await client.execute("DROP INDEX idx_project_drive_operations_ready");
  await client.execute(`CREATE INDEX idx_project_drive_operations_ready
    ON project_drive_operations (
      status, next_attempt_at, lease_expires_at, created_at
    ) WHERE status = 'pending'`);
  await assert.rejects(
    () => migrationStatus({ client }),
    /proof project-drive-operations-ready-index-guard expected 1 but received 0/,
  );
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


test("normal post-migration resources do not invalidate the historical backfill receipt", async () => withClient(async (client) => {
  const first = await runMigrations({ client, releaseSha: "resource-lifecycle-test" });
  assert.ok(first.proofs.some((proof) => proof.id === "backfill-upload-count-matches-attachments"));
  await client.executeMultiple(`
    INSERT INTO users (id, color, initials) VALUES ('resource-owner', '#111', 'RO');
    INSERT INTO workspaces (id,slug,name,owner_user_id) VALUES ('resource-ws','resource-ws','Synthetic recovery','resource-owner');
    INSERT INTO tasks (id,workspace_id,seq,title,lane,priority) VALUES ('resource-task','resource-ws',1,'Synthetic file','todo','normal');
    INSERT INTO resources (id,workspace_id,task_id,kind,provider,storage,title,added_at)
      VALUES ('resource-new','resource-ws','resource-task','upload','file','signal','Synthetic file',1788552000);
  `);
  assert.equal((await migrationStatus({ client })).state, "current");
  assert.equal((await runMigrations({ client, releaseSha: "resource-lifecycle-retry" })).status, "no-op");
  await client.execute("DROP INDEX idx_resources_task_id");
  await assert.rejects(() => migrationStatus({ client }), /resources-task-id-index-exists/);
}));

test("the resource backfill count remains required when its migration executes", async () => withClient(async (client) => {
  const context = loadAndValidateLedger();
  const entry = context.forward.find((candidate) => candidate.id === "0017_resources");
  const proof = entry.receipt.record.proofs.find((candidate) => candidate.id === "backfill-upload-count-matches-attachments");
  proof.sql = "SELECT 0 AS value";
  await assert.rejects(() => runMigrations({ client, context, releaseSha: "broken-backfill-test" }), /backfill-upload-count-matches-attachments/);
}));

test("usage migration proof failure rolls back both new tables and its ledger receipt", async () => withClient(async (client) => {
  const before = loadAndValidateLedger();
  before.forward = before.forward.filter(entry => entry.ordinal < 30);
  await runMigrations({ client, context: before, releaseSha: "usage-before" });
  const broken = loadAndValidateLedger();
  const entry = broken.forward.find(row => row.id === "0030_sponsored_use_intents");
  entry.receipt.record.proofs.push({ id: "usage-forced-failure", sql: "SELECT 0 AS value", expected: 1 });
  await assert.rejects(() => runMigrations({ client, context: broken, releaseSha: "usage-failed" }), /usage-forced-failure/);
  assert.equal(Number((await client.execute("SELECT count(*) AS n FROM sqlite_schema WHERE name IN ('sponsored_use_intents','sponsored_use_subjects')")).rows[0].n), 0);
  assert.equal(Number((await client.execute("SELECT count(*) AS n FROM signal_schema_migrations WHERE id='0030_sponsored_use_intents'")).rows[0].n), 0);
  const applied = await runMigrations({ client, releaseSha: "usage-retry" });
  assert.deepEqual(applied.applied, ["0030_sponsored_use_intents", "0031_event_purchase_designations"]);
  assert.equal((await runMigrations({ client, releaseSha: "usage-no-op" })).status, "no-op");
}));

test("Event additive migration preserves populated history; failed proof rolls back all objects and its receipt before a successful retry/no-op", async () => withClient(async (client) => {
  const before = loadAndValidateLedger();
  before.forward = before.forward.filter(entry => entry.ordinal < 31);
  await runMigrations({ client, context: before, releaseSha: "event-before" });
  await client.execute("INSERT INTO users(id,initials,color) VALUES ('historic-owner','HO','#000')");
  await client.execute("INSERT INTO workspaces(id,slug,name,owner_user_id) VALUES ('historic-project','historic-project','Preserved','historic-owner')");
  await client.execute("INSERT INTO entitlements(id,user_id,workspace_id,tier,source,expires_at,notes) VALUES ('historic-event','historic-owner','historic-project','event','purchase',0,'stripe:cs_historical')");
  const snapshot = async () => ({
    schema: (await client.execute("SELECT type,name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name")).rows,
    grants: (await client.execute("SELECT * FROM entitlements ORDER BY id")).rows,
    projects: (await client.execute("SELECT * FROM workspaces ORDER BY id")).rows,
  });
  const original = await snapshot();
  const broken = loadAndValidateLedger();
  broken.forward.find(row => row.ordinal === 31).receipt.record.proofs.push({
    id: "event-forced-failure", sql: "SELECT 0 AS value", expected: 1,
  });
  await assert.rejects(runMigrations({ client, context: broken, releaseSha: "event-failed" }), /event-forced-failure/);
  assert.deepEqual(await snapshot(), original);
  assert.equal(Number((await client.execute("SELECT count(*) AS n FROM signal_schema_migrations WHERE id='0031_event_purchase_designations'")).rows[0].n), 0);
  assert.deepEqual((await runMigrations({ client, releaseSha: "event-retry" })).applied, ["0031_event_purchase_designations"]);
  assert.deepEqual((await client.execute("SELECT * FROM entitlements ORDER BY id")).rows, original.grants);
  assert.deepEqual((await client.execute("SELECT * FROM workspaces ORDER BY id")).rows, original.projects);
  assert.equal(Number((await client.execute("SELECT count(*) AS n FROM event_purchase_designations")).rows[0].n), 0);
  assert.equal((await runMigrations({ client, releaseSha: "event-no-op" })).status, "no-op");
  // Explicitly local, empty-table rollback. This is NOT a production downgrade
  // runner or permission to discard paid designation/reconciliation history.
  await client.batch([
    "DROP TRIGGER event_purchase_purchaser_erasure",
    "DROP TRIGGER event_purchase_project_erasure",
    "DROP TRIGGER event_purchase_facts_immutable",
    "DROP INDEX event_purchase_reference_unique",
    "DROP INDEX event_purchase_project_idx",
    "DROP TABLE event_purchase_designations",
    "DELETE FROM signal_schema_migrations WHERE id='0031_event_purchase_designations'",
    "DELETE FROM __drizzle_migrations WHERE created_at=1788602400000",
  ], "write");
  assert.deepEqual(await snapshot(), original);
  assert.deepEqual((await runMigrations({ client, releaseSha: "event-reapply-local" })).applied, ["0031_event_purchase_designations"]);
}));
