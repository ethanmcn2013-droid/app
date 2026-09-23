import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@libsql/client";
import { readSchema, takeBackup } from "./backup.mjs";
import { compare, compareDdl, measure, restoreInto } from "./restore-verify.mjs";
import { migrationStatus, schemaFingerprintSha256 } from "./migrate.mjs";
import { loadTimelineLedger, timelineMigrationStatus, timelineSchemaFingerprintSha256 } from "./timeline-migrate.mjs";
import { testDatabaseUrl, withTempDatabaseDir } from "./test-temp-database.mjs";

// SQLite reserves the literal sqlite_ prefix. sqlitex_* is ordinary user data.
// Keep the expected objects independent of the enumeration being tested so an
// incomplete backup cannot certify itself against its own incomplete manifest.
const expectedDdl = {
  tables: ["ordinary", "sqlitex_payloads"],
  indexes: ["sqlitex_payload_idx"],
  triggers: ["sqlitex_keep_payload"],
  views: ["sqlitex_payload_view"],
};

async function populate(client) {
  await client.execute("CREATE TABLE ordinary (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)");
  await client.execute("CREATE TABLE sqlitex_payloads (id TEXT PRIMARY KEY, body TEXT NOT NULL)");
  await client.execute("CREATE INDEX sqlitex_payload_idx ON sqlitex_payloads(body)");
  await client.execute("CREATE TRIGGER sqlitex_keep_payload BEFORE DELETE ON sqlitex_payloads BEGIN SELECT RAISE(ABORT, 'retain fixture'); END");
  await client.execute("CREATE VIEW sqlitex_payload_view AS SELECT body FROM sqlitex_payloads");
  await client.execute("INSERT INTO ordinary (name) VALUES ('ordinary fixture')");
  await client.execute("INSERT INTO sqlitex_payloads VALUES ('fixture-1', 'Must survive restore')");
}

async function withDatabase(operation) {
  return withTempDatabaseDir(async (dir) => {
    const url = testDatabaseUrl(dir, "source.db");
    const client = createClient({ url });
    try { return await operation({ client, dir, url }); }
    finally { client.close(); }
  });
}

test("backup enumerates ordinary sqlite-like objects and excludes actual internal objects", () => withDatabase(async ({ client, url }) => {
  await populate(client);
  const raw = await client.execute("SELECT name FROM sqlite_schema");
  assert.ok(raw.rows.some((row) => row.name === "sqlite_sequence"));
  assert.ok(raw.rows.some((row) => String(row.name).startsWith("sqlite_autoindex_")));
  const schema = await readSchema(client);
  assert.deepEqual(schema.map((row) => row.name).sort(), Object.values(expectedDdl).flat().sort());
  const { manifest, body } = await takeBackup(client, { label: "synthetic-enumeration", url });
  assert.deepEqual(manifest.ddl, expectedDdl);
  assert.equal(manifest.tableCount, 2);
  assert.equal(manifest.totalRows, 2);
  assert.ok(body.includes("Must survive restore"));
}));

test("logical round trip preserves independently named rows, index, trigger and view", () => withDatabase(async ({ client, dir, url }) => {
  await populate(client);
  const { body, manifest } = await takeBackup(client, { label: "synthetic-roundtrip", url });
  const restored = await restoreInto(testDatabaseUrl(dir, "restored.db"), body);
  try {
    // These existing verifiers can agree on an incomplete source manifest.
    // The explicit source-domain assertions below must also pass.
    assert.equal(compare(manifest, await measure(restored.client, manifest.tables.map((row) => row.name))).ok, true);
    assert.equal((await compareDdl(restored.client, manifest)).ok, true);
    assert.equal((await compareDdl(restored.client, { ddl: expectedDdl })).ok, true);
    const rows = await restored.client.execute("SELECT id, body FROM sqlitex_payloads");
    assert.deepEqual(rows.rows.map((row) => [row.id, row.body]), [["fixture-1", "Must survive restore"]]);
    assert.equal((await restored.client.execute("SELECT body FROM sqlitex_payload_view")).rows[0].body, "Must survive restore");
    await assert.rejects(restored.client.execute("DELETE FROM sqlitex_payloads"), /retain fixture/);
    assert.equal((await restored.client.execute("PRAGMA integrity_check")).rows[0].integrity_check, "ok");
  } finally { restored.client.close(); }
}));

test("DDL verifier recognizes ordinary prefix objects and detects a missing trigger", () => withDatabase(async ({ client }) => {
  await populate(client);
  assert.deepEqual(await compareDdl(client, { ddl: expectedDdl }), { ok: true, missing: [] });
  await client.execute("DROP TRIGGER sqlitex_keep_payload");
  assert.deepEqual(await compareDdl(client, { ddl: expectedDdl }), {
    ok: false, missing: [{ type: "trigger", name: "sqlitex_keep_payload" }],
  });
}));

for (const moduleName of ["tasks", "timeline"]) {
  const fingerprint = moduleName === "tasks"
    ? schemaFingerprintSha256
    : (client) => timelineSchemaFingerprintSha256(client, loadTimelineLedger().ledger);
  const status = moduleName === "tasks" ? migrationStatus : timelineMigrationStatus;

  test(`${moduleName} fingerprint changes for ordinary prefix table, index, trigger and view`, () => withDatabase(async ({ client }) => {
    let previous = await fingerprint(client);
    for (const sql of [
      "CREATE TABLE sqlitex_records (id TEXT PRIMARY KEY, content TEXT)",
      "CREATE INDEX sqlitex_record_idx ON sqlitex_records(content)",
      "CREATE TRIGGER sqlitex_record_guard BEFORE DELETE ON sqlitex_records BEGIN SELECT RAISE(ABORT, 'fixture'); END",
      "CREATE VIEW sqlitex_record_view AS SELECT content FROM sqlitex_records",
    ]) {
      await client.execute(sql);
      const current = await fingerprint(client);
      assert.notEqual(current, previous, sql);
      previous = current;
    }
  }));

  test(`${moduleName} never classifies a database containing only an ordinary sqlite-like table as fresh`, () => withDatabase(async ({ client }) => {
    assert.equal((await status({ client })).state, "fresh");
    await client.execute("CREATE TABLE sqlitex_records (id TEXT PRIMARY KEY)");
    await client.execute("INSERT INTO sqlitex_records VALUES ('preserved')");
    assert.equal((await status({ client })).state, "adoption-required");
    assert.equal((await client.execute("SELECT id FROM sqlitex_records")).rows[0].id, "preserved");
  }));
}
