/**
 * The Timeline migration runner, proved against real libSQL databases.
 *
 * The case that matters is the one this repository has never been able to
 * execute: a Timeline database that already carries production's standalone
 * `0000–0007` chain from `timeline.git`, which shares not one hash with the
 * consolidated `0000` baseline here. Replaying the baseline onto it would
 * attempt CREATE TABLE over live couple data; the runner must refuse, adopt
 * the observed fingerprint instead, and only then move forward.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { canonicalFileSha256, defaultRoot, sha256 } from "./migration-ledger.mjs";
import { testDatabaseUrl, withTempDatabaseDir } from "./test-temp-database.mjs";
import {
  adoptTimelineDatabase,
  databaseIdentitySha256,
  dryRunTimelineMigrations,
  loadTimelineLedger,
  readLegacyDrizzleChain,
  runTimelineMigrations,
  timelineMigrationStatus,
  timelineSchemaFingerprintSha256,
} from "./timeline-migrate.mjs";

const context = loadTimelineLedger();

async function withClient(operation) {
  const client = createClient({ url: ":memory:" });
  try {
    return await operation(client);
  } finally {
    client.close();
  }
}

/**
 * Scratch directories and their `file:` URLs come from `test-temp-database`,
 * which awaits the operation before cleaning up and asserts the path is
 * absolute, outside the repository, and still there when the client opens it.
 *
 * The previous local helper did none of those things: it was synchronous, so
 * its `finally` deleted the directory before the async body ran. Windows threw
 * EPERM on the open file and swallowed it; Linux unlinked it happily and the
 * next write failed with SQLITE_READONLY. The four adoption and dry-run tests
 * below passed here and failed in CI for that one reason.
 */
const withTempDir = withTempDatabaseDir;

/**
 * A stand-in for production: the schema as it exists today, plus the foreign
 * high-water table the `timeline.git` chain left behind. The hashes are
 * deliberately not ours — that is the whole point.
 */
async function seedLegacyProductionDatabase(client) {
  await client.executeMultiple(
    context.baseline.sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean).join(";\n") + ";",
  );
  await client.execute(
    "CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at NUMERIC NOT NULL)",
  );
  for (let i = 0; i <= 7; i += 1) {
    await client.execute({
      sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      args: [sha256(`timeline.git/000${i}`), 1_700_000_000_000 + i],
    });
  }
  // One couple's real planning data, so every refusal below is a refusal that
  // protects something.
  await client.execute({
    sql: "INSERT INTO workspaces (slug, name, owner_user_id, suite_workspace_id) VALUES (?, ?, ?, ?)",
    args: ["glenmara-house", "Glenmara House", "user_couple", "ws_project_a"],
  });
  await client.execute({
    sql: "INSERT INTO projects (workspace_slug, slug, name, one_liner, accent, source_tasks_workspace_id) VALUES (?, ?, ?, '', 'default', ?)",
    args: ["glenmara-house", "plan", "The plan", "ws_project_a"],
  });
}

async function writeAdoptionReceipt(dir, client, { databaseUrl, overrides = {} }) {
  const legacy = await readLegacyDrizzleChain(client, context.ledger);
  const receipt = {
    schemaVersion: "timeline-production-adoption/1",
    id: "timeline-production-adoption-test",
    environment: "production",
    authorizedBy: "test fixture",
    databaseIdentitySha256: databaseIdentitySha256(databaseUrl),
    schemaFingerprintSha256: await timelineSchemaFingerprintSha256(client, context.ledger),
    ledgerSha256: context.ledgerSha256,
    baseline: { id: context.baseline.id, sha256: context.baseline.sha256 },
    legacyLedger: {
      table: "__drizzle_migrations",
      rowCount: legacy.rowCount,
      hashesSha256: legacy.hashesSha256,
    },
    operatorEvidence: [
      { id: "backup", receiptSha256: "a".repeat(64), backupSha256: "b".repeat(64) },
      { id: "restore-verify", receiptSha256: "c".repeat(64), backupSha256: "d".repeat(64) },
    ],
    proofs: [
      {
        id: "no-workspace-claims-two-projects",
        sql: "SELECT COUNT(*) AS value FROM (SELECT suite_workspace_id FROM workspaces WHERE suite_workspace_id IS NOT NULL GROUP BY suite_workspace_id HAVING COUNT(*) > 1)",
        expected: 0,
      },
    ],
    ...overrides,
  };
  const file = path.join(dir, "adoption.json");
  fs.writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`);
  return { file, receipt };
}

test("the ledger registers both Timeline SQL files with receipt and journal parity", () => {
  assert.equal(context.module, "timeline");
  assert.deepEqual(context.entries.map((entry) => entry.id), [
    "0000_timeline_baseline",
    "0001_suite_project_bindings",
  ]);
  assert.equal(context.baseline.id, "0000_timeline_baseline");
  assert.deepEqual(context.forward.map((entry) => entry.id), ["0001_suite_project_bindings"]);
  assert.equal(context.ledger.databaseLedgerTable, "signal_timeline_schema_migrations");
  assert.equal(context.ledger.legacyDrizzleTable, "__drizzle_migrations");
});

test("a tampered Timeline migration fails the content-addressed contract", () => withTempDir((root) => {
  fs.cpSync(path.join(defaultRoot, "drizzle-timeline"), path.join(root, "drizzle-timeline"), { recursive: true });
  fs.copyFileSync(path.join(defaultRoot, ".gitattributes"), path.join(root, ".gitattributes"));
  fs.appendFileSync(path.join(root, "drizzle-timeline", "0001_suite_project_bindings.sql"), "\n-- tampered\n");
  assert.throws(
    () => loadTimelineLedger({ root }),
    /0001_suite_project_bindings SQL hash does not match/,
  );
}));

test("a fresh database applies the baseline plus forwards and reruns as a no-op", async () => withClient(async (client) => {
  const first = await runTimelineMigrations({ client, context, releaseSha: "test-release", now: () => 1_786_600_000_000 });
  assert.deepEqual(first.applied, ["0000_timeline_baseline", "0001_suite_project_bindings"]);
  assert.equal(first.proofs.length, 33);

  const second = await runTimelineMigrations({ client, context, releaseSha: "test-release" });
  assert.deepEqual(second, { status: "no-op", applied: [] });
  assert.equal((await timelineMigrationStatus({ client, context })).state, "current");
}));

test("a database carrying the foreign 0000-0007 chain refuses baseline replay", async () => withClient(async (client) => {
  await seedLegacyProductionDatabase(client);
  await assert.rejects(
    () => runTimelineMigrations({ client, context }),
    /run receipt-backed adopt instead of executing the consolidated baseline/,
  );
  // Nothing was written, including the ledger table itself.
  assert.equal(
    Number((await client.execute("SELECT COUNT(*) AS value FROM sqlite_schema WHERE name = 'signal_timeline_schema_migrations'")).rows[0].value),
    0,
  );
  assert.equal((await timelineMigrationStatus({ client, context })).state, "adoption-required");
}));

test("adoption registers the observed fingerprint, is idempotent, and unlocks forward migration", async () => withTempDir(async (dir) => {
  const databaseUrl = testDatabaseUrl(dir, "timeline.db");
  const client = createClient({ url: databaseUrl });
  try {
    await seedLegacyProductionDatabase(client);
    const { file, receipt } = await writeAdoptionReceipt(dir, client, { databaseUrl });

    const first = await adoptTimelineDatabase({
      client,
      databaseUrl,
      receiptPath: file,
      context,
      releaseSha: "adoption-release",
      now: () => 1_786_600_000_000,
    });
    assert.equal(first.status, "adopted");
    assert.equal(first.legacyDrizzleChain.rowCount, 8);

    const row = (await client.execute("SELECT * FROM signal_timeline_schema_migrations")).rows[0];
    assert.equal(row.status, "adopted_legacy");
    assert.equal(row.execution_receipt_id, receipt.id);
    assert.equal(row.execution_receipt_sha256, canonicalFileSha256(file));

    // The foreign chain is untouched: same rows, same hashes.
    const legacyAfter = await readLegacyDrizzleChain(client, context.ledger);
    assert.equal(legacyAfter.rowCount, 8);
    assert.equal(legacyAfter.hashesSha256, receipt.legacyLedger.hashesSha256);

    assert.equal((await timelineMigrationStatus({ client, context })).state, "pending");

    const second = await adoptTimelineDatabase({ client, databaseUrl, receiptPath: file, context });
    assert.equal(second.status, "no-op");

    const forward = await runTimelineMigrations({
      client,
      context,
      databaseUrl,
      environment: "development",
      releaseSha: "forward-release",
    });
    assert.deepEqual(forward.applied, ["0001_suite_project_bindings"]);
    assert.equal((await timelineMigrationStatus({ client, context })).state, "current");

    // Second run of the forward migration proves no-op (plan §12 step 8).
    assert.deepEqual(
      await runTimelineMigrations({ client, context, databaseUrl, environment: "development" }),
      { status: "no-op", applied: [] },
    );

    // The couple's data and both legacy mirrors survived intact.
    const workspace = (await client.execute("SELECT suite_workspace_id FROM workspaces WHERE slug = 'glenmara-house'")).rows[0];
    assert.equal(workspace.suite_workspace_id, "ws_project_a");
    const project = (await client.execute("SELECT source_tasks_workspace_id FROM projects WHERE workspace_slug = 'glenmara-house'")).rows[0];
    assert.equal(project.source_tasks_workspace_id, "ws_project_a");
  } finally {
    client.close();
  }
}));

test("adoption refuses a receipt whose legacy chain fingerprint has moved", async () => withTempDir(async (dir) => {
  const databaseUrl = testDatabaseUrl(dir, "timeline.db");
  const client = createClient({ url: databaseUrl });
  try {
    await seedLegacyProductionDatabase(client);
    const { file } = await writeAdoptionReceipt(dir, client, { databaseUrl });
    // Somebody ran another migration between fingerprinting and adopting.
    await client.execute({
      sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      args: [sha256("timeline.git/0008"), 1_700_000_000_008],
    });
    await assert.rejects(
      () => adoptTimelineDatabase({ client, databaseUrl, receiptPath: file, context }),
      /legacy Drizzle chain has changed/,
    );
    assert.equal(
      Number((await client.execute("SELECT COUNT(*) AS value FROM sqlite_schema WHERE name = 'signal_timeline_schema_migrations'")).rows[0].value),
      0,
    );
  } finally {
    client.close();
  }
}));

test("adoption refuses a receipt written against a different database or a drifted schema", async () => withTempDir(async (dir) => {
  const databaseUrl = testDatabaseUrl(dir, "timeline.db");
  const client = createClient({ url: databaseUrl });
  try {
    await seedLegacyProductionDatabase(client);
    const wrongTarget = await writeAdoptionReceipt(dir, client, {
      databaseUrl,
      overrides: { databaseIdentitySha256: "f".repeat(64) },
    });
    await assert.rejects(
      () => adoptTimelineDatabase({ client, databaseUrl, receiptPath: wrongTarget.file, context }),
      /targets a different database/,
    );

    const drifted = await writeAdoptionReceipt(dir, client, {
      databaseUrl,
      overrides: { schemaFingerprintSha256: "e".repeat(64) },
    });
    await assert.rejects(
      () => adoptTimelineDatabase({ client, databaseUrl, receiptPath: drifted.file, context }),
      /schema fingerprint does not match/,
    );

    const unevidenced = await writeAdoptionReceipt(dir, client, {
      databaseUrl,
      overrides: { operatorEvidence: [{ receiptSha256: "a".repeat(64), backupSha256: "b".repeat(64) }] },
    });
    await assert.rejects(
      () => adoptTimelineDatabase({ client, databaseUrl, receiptPath: unevidenced.file, context }),
      /missing operator evidence/,
    );
  } finally {
    client.close();
  }
}));

test("a remote target cannot be migrated without an execution receipt", async () => withClient(async (client) => {
  await assert.rejects(
    () => runTimelineMigrations({ client, context, databaseUrl: "libsql://timeline-production.example", environment: "production" }),
    /pending migrations but no --receipt/,
  );
  await assert.rejects(
    () => runTimelineMigrations({ client, context, environment: "prod" }),
    /unsupported environment prod/,
  );
  assert.equal(
    Number((await client.execute("SELECT COUNT(*) AS value FROM sqlite_schema WHERE name = 'signal_timeline_schema_migrations'")).rows[0].value),
    0,
  );
}));

test("a failed postcondition rolls back the schema and the ledger row together", async () => withClient(async (client) => {
  await runTimelineMigrations({ client, context, releaseSha: "test-release" });
  const probeSql = "CREATE TABLE timeline_forward_probe (id TEXT PRIMARY KEY);";
  const probe = {
    ordinal: context.entries.length,
    id: "0002_forward_probe",
    file: "drizzle-timeline/0002_forward_probe.sql",
    when: context.entries.at(-1).when + 1,
    sha256: sha256(probeSql),
    policy: "forward",
    sql: probeSql,
    receipt: {
      document: { id: "forward-probe-review" },
      record: {
        postconditions: ["deliberately impossible"],
        proofs: [{
          id: "deliberate-failure",
          sql: "SELECT COUNT(*) AS value FROM sqlite_schema WHERE name = 'timeline_forward_probe'",
          expected: 2,
        }],
      },
      sha256: "a".repeat(64),
    },
  };
  const drifted = { ...context, entries: [...context.entries, probe], forward: [...context.forward, probe] };
  await assert.rejects(
    () => runTimelineMigrations({ client, context: drifted, releaseSha: "test-release" }),
    /deliberate-failure/,
  );
  assert.equal(
    Number((await client.execute("SELECT COUNT(*) AS value FROM sqlite_schema WHERE name = 'timeline_forward_probe'")).rows[0].value),
    0,
  );
  assert.equal(
    Number((await client.execute("SELECT COUNT(*) AS value FROM signal_timeline_schema_migrations")).rows[0].value),
    2,
  );
}));

test("dry run writes nothing to the target and rehearses on a copy", async () => withTempDir(async (dir) => {
  const databaseUrl = testDatabaseUrl(dir, "timeline.db");
  const client = createClient({ url: databaseUrl });
  try {
    await seedLegacyProductionDatabase(client);
    const { file } = await writeAdoptionReceipt(dir, client, { databaseUrl });
    await adoptTimelineDatabase({ client, databaseUrl, receiptPath: file, context, now: () => 1_786_600_000_000 });

    const before = await timelineSchemaFingerprintSha256(client, context.ledger);
    const dry = await dryRunTimelineMigrations({ client, context, databaseUrl, environment: "development" });

    assert.equal(dry.status, "would-apply");
    assert.deepEqual(dry.wouldApply.map((entry) => entry.id), ["0001_suite_project_bindings"]);
    assert.equal(dry.wouldApply[0].statements, 5);
    assert.equal(dry.rehearsal.status, "passed");
    assert.deepEqual(dry.rehearsal.applied, ["0001_suite_project_bindings"]);
    assert.equal(dry.rehearsal.secondRun, "no-op");
    assert.match(dry.rehearsal.databaseSha256, /^[a-f0-9]{64}$/);

    // The target is untouched: same schema, and the new tables do not exist.
    assert.equal(await timelineSchemaFingerprintSha256(client, context.ledger), before);
    assert.equal(
      Number((await client.execute("SELECT COUNT(*) AS value FROM sqlite_schema WHERE name = 'suite_project_bindings'")).rows[0].value),
      0,
    );
    assert.equal((await timelineMigrationStatus({ client, context })).state, "pending");
  } finally {
    client.close();
  }
}));

test("a dry run against a remote target refuses to rehearse rather than pretending", async () => withClient(async (client) => {
  const dry = await dryRunTimelineMigrations({
    client,
    context,
    databaseUrl: "libsql://timeline-production.example",
    environment: "production",
  });
  assert.equal(dry.rehearsal.status, "skipped");
  assert.equal(dry.rehearsal.reason, "remote-target");
  assert.match(dry.rehearsal.guidance, /isolated copy/);
  assert.equal(
    Number((await client.execute("SELECT COUNT(*) AS value FROM sqlite_schema WHERE name = 'signal_timeline_schema_migrations'")).rows[0].value),
    0,
  );
}));

test("ledger row tampering fails closed on the next run", async () => withClient(async (client) => {
  await runTimelineMigrations({ client, context, releaseSha: "test-release" });
  await client.execute("UPDATE signal_timeline_schema_migrations SET sha256 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'");
  await assert.rejects(() => runTimelineMigrations({ client, context }), /database ledger hash mismatch/);
  await assert.rejects(() => timelineMigrationStatus({ client, context }), /database ledger hash mismatch/);
}));

test("schema drift after apply fails both the no-op and the status check", async () => withClient(async (client) => {
  await runTimelineMigrations({ client, context, releaseSha: "test-release" });
  await client.execute("DROP INDEX uq_suite_binding_timeline_workspace");
  await assert.rejects(
    () => runTimelineMigrations({ client, context }),
    /proof bindings-timeline-workspace-unique expected 1 but received 0/,
  );
  await assert.rejects(
    () => timelineMigrationStatus({ client, context }),
    /proof bindings-timeline-workspace-unique expected 1 but received 0/,
  );
}));

test("a backfilled binding row is not read as production drift", async () => withClient(async (client) => {
  // The apply-time proofs assert the migration itself binds nothing. If those
  // were also verified continuously, the first real backfill would look like
  // schema drift for ever after — the exact false alarm the Tasks ledger
  // learned to avoid with continuousProofIds.
  await runTimelineMigrations({ client, context, releaseSha: "test-release" });
  await client.execute({
    sql: "INSERT INTO workspaces (slug, name, owner_user_id, suite_workspace_id) VALUES (?, ?, ?, ?)",
    args: ["glenmara-house", "Glenmara House", "user_couple", "ws_project_a"],
  });
  await client.execute({
    sql: "INSERT INTO projects (workspace_slug, slug, name, one_liner, accent, source_tasks_workspace_id) VALUES (?, ?, ?, '', 'default', ?)",
    args: ["glenmara-house", "plan", "The plan", "ws_project_a"],
  });
  await client.execute({
    sql: "INSERT INTO suite_project_bindings (tasks_workspace_id, timeline_workspace_slug, primary_timeline_slug, provenance) VALUES (?, ?, ?, 'legacy_exact')",
    args: ["ws_project_a", "glenmara-house", "plan"],
  });

  assert.equal((await timelineMigrationStatus({ client, context })).state, "current");
  assert.deepEqual(await runTimelineMigrations({ client, context }), { status: "no-op", applied: [] });
}));

test("the binding table refuses the states and shapes the plan forbids", async () => withClient(async (client) => {
  await runTimelineMigrations({ client, context, releaseSha: "test-release" });
  await client.execute("PRAGMA foreign_keys = ON");
  await client.execute({
    sql: "INSERT INTO workspaces (slug, name, owner_user_id, suite_workspace_id) VALUES (?, ?, ?, ?)",
    args: ["glenmara-house", "Glenmara House", "user_couple", "ws_project_a"],
  });
  await client.execute({
    sql: "INSERT INTO projects (workspace_slug, slug, name, one_liner, accent, source_tasks_workspace_id) VALUES (?, ?, ?, '', 'default', ?)",
    args: ["glenmara-house", "plan", "The plan", "ws_project_a"],
  });
  await client.execute({
    sql: "INSERT INTO suite_project_bindings (tasks_workspace_id, timeline_workspace_slug, primary_timeline_slug, provenance) VALUES (?, ?, ?, 'legacy_exact')",
    args: ["ws_project_a", "glenmara-house", "plan"],
  });

  // A second Project may not claim the same Timeline workspace.
  await assert.rejects(() => client.execute({
    sql: "INSERT INTO suite_project_bindings (tasks_workspace_id, timeline_workspace_slug, primary_timeline_slug, provenance) VALUES (?, ?, ?, 'legacy_exact')",
    args: ["ws_project_b", "glenmara-house", "plan"],
  }), /UNIQUE/i);

  // Invented lifecycle states and provenances are refused by the CHECKs.
  await assert.rejects(() => client.execute({
    sql: "INSERT INTO suite_project_bindings (tasks_workspace_id, timeline_workspace_slug, primary_timeline_slug, state, provenance) VALUES (?, ?, ?, 'probably', 'legacy_exact')",
    args: ["ws_project_c", "other", "plan"],
  }), /CHECK|FOREIGN KEY/i);
  await assert.rejects(() => client.execute({
    sql: "INSERT INTO suite_project_bindings (tasks_workspace_id, timeline_workspace_slug, primary_timeline_slug, provenance) VALUES (?, ?, ?, 'best_guess')",
    args: ["ws_project_d", "glenmara-house-2", "plan"],
  }), /CHECK|FOREIGN KEY/i);

  // A bound primary Timeline cannot be deleted out from under its Project.
  await assert.rejects(
    () => client.execute("DELETE FROM projects WHERE workspace_slug = 'glenmara-house' AND slug = 'plan'"),
    /FOREIGN KEY/i,
  );

  // The lease is a pair or it is nothing.
  await assert.rejects(() => client.execute({
    sql: "INSERT INTO timeline_source_sync_state (tasks_workspace_id, timeline_workspace_slug, timeline_slug, lease_token) VALUES (?, ?, ?, 'half-a-lease')",
    args: ["ws_project_a", "glenmara-house", "plan"],
  }), /CHECK/i);

  // Sync state cannot exist for a Project that has no confirmed binding.
  await assert.rejects(() => client.execute({
    sql: "INSERT INTO timeline_source_sync_state (tasks_workspace_id, timeline_workspace_slug, timeline_slug) VALUES (?, ?, ?)",
    args: ["ws_unbound", "glenmara-house", "plan"],
  }), /FOREIGN KEY/i);
}));
