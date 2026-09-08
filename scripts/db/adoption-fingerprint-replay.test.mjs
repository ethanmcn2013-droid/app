import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createClient } from "@libsql/client";
import { canonicalFileSha256, loadAndValidateLedger, sha256 } from "./migration-ledger.mjs";
import { adoptExistingDatabase, databaseIdentitySha256, schemaFingerprintSha256 } from "./migrate.mjs";
import { adoptTimelineDatabase, loadTimelineLedger, readLegacyDrizzleChain, timelineSchemaFingerprintSha256 } from "./timeline-migrate.mjs";
import { testDatabaseUrl, withTempDatabaseDir } from "./test-temp-database.mjs";

// Historical fixture algorithm, pinned by independent parent-to-candidate
// reproduction at4c88733f. This intentionally describes the OLD coverage;
// it must never certify a new adoption.
async function parentFingerprint(client, ledgerTable) {
  const rows = await client.execute({
    sql: "SELECT type,name,tbl_name,COALESCE(sql,'') AS sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name NOT IN (?,?) ORDER BY type,name",
    args: [ledgerTable, "__drizzle_migrations"],
  });
  return sha256(JSON.stringify(rows.rows.map(row => [String(row.type), String(row.name), String(row.tbl_name), String(row.sql).replace(/\s+/g, " ").trim()])));
}

for (const moduleName of ["tasks", "timeline"]) {
  test(`${moduleName} keeps historical receipt replay read-only and refuses legacy coverage for new adoption`, () => withTempDatabaseDir(async dir => {
    const databaseUrl = testDatabaseUrl(dir, "target.db");
    const client = createClient({ url: databaseUrl });
    try {
      const context = moduleName === "tasks" ? loadAndValidateLedger() : loadTimelineLedger();
      for (const sql of context.baseline.sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)) await client.execute(sql);
      await client.execute("CREATE TABLE SQLiteX_receipt_payload (id TEXT PRIMARY KEY, content TEXT)");
      await client.execute("INSERT INTO SQLiteX_receipt_payload VALUES ('synthetic', 'Preserved original data')");
      const ledgerTable = context.ledger.databaseLedgerTable;
      const fingerprint = () => moduleName === "tasks" ? schemaFingerprintSha256(client) : timelineSchemaFingerprintSha256(client, context.ledger);
      const legacyFingerprint = await parentFingerprint(client, ledgerTable);
      const completeFingerprint = await fingerprint();
      assert.notEqual(legacyFingerprint, completeFingerprint);
      const legacy = moduleName === "timeline" ? await readLegacyDrizzleChain(client, context.ledger) : null;
      const receipt = {
        schemaVersion: `${moduleName}-production-adoption/1`, id: "synthetic-historical-adoption", environment: "test",
        databaseIdentitySha256: databaseIdentitySha256(databaseUrl), schemaFingerprintSha256: legacyFingerprint,
        ledgerSha256: context.ledgerSha256, baseline: { id: context.baseline.id, sha256: context.baseline.sha256 },
        operatorEvidence: [{ receiptSha256: "a".repeat(64), backupSha256: "b".repeat(64) }, { receiptSha256: "c".repeat(64), backupSha256: "d".repeat(64) }],
        proofs: [{ id: "synthetic-original-data", sql: "SELECT COUNT(*) AS value FROM SQLiteX_receipt_payload WHERE content='Preserved original data'", expected: 1 }],
        ...(legacy ? { legacyLedger: { table: context.ledger.legacyDrizzleTable, rowCount: legacy.rowCount, hashesSha256: legacy.hashesSha256 } } : {}),
      };
      const originalPath = path.join(dir, "original-receipt.json");
      fs.writeFileSync(originalPath, JSON.stringify(receipt, null, 2) + "\n");
      const originalSha = canonicalFileSha256(originalPath);
      const replacementPath = path.join(dir, "complete-receipt.json");
      fs.writeFileSync(replacementPath, JSON.stringify({ ...receipt, schemaFingerprintVersion: "sqlite-schema/2", schemaFingerprintSha256: completeFingerprint }, null, 2) + "\n");
      const adopt = moduleName === "tasks" ? adoptExistingDatabase : adoptTimelineDatabase;
      const options = { client, databaseUrl, context, environment: "test", releaseSha: "synthetic-regression" };
      await assert.rejects(adopt({ ...options, receiptPath: originalPath }), /schema fingerprint/);
      assert.equal((await client.execute({ sql: "SELECT COUNT(*) AS value FROM sqlite_schema WHERE name=?", args: [ledgerTable] })).rows[0].value, 0);
      assert.equal((await adopt({ ...options, receiptPath: replacementPath })).status, "adopted");

      // Seed only the disposable historical ledger's receipt binding. Its shape
      // equals the actual parent-generated row verified independently. No source
      // receipt is rewritten or presented as a production artifact.
      await client.execute({ sql: `UPDATE "${ledgerTable}" SET execution_receipt_sha256=? WHERE id=?`, args: [originalSha, context.baseline.id] });
      const before = JSON.stringify((await client.execute(`SELECT * FROM "${ledgerTable}"`)).rows);
      const replay = await adopt({ ...options, receiptPath: originalPath });
      assert.equal(replay.status, "no-op");
      assert.equal(replay.receiptFingerprintMode, "legacy-like-replay");
      assert.equal(replay.receiptFingerprintSha256, legacyFingerprint);
      assert.equal(replay.schemaFingerprintSha256, completeFingerprint);
      assert.equal(JSON.stringify((await client.execute(`SELECT * FROM "${ledgerTable}"`)).rows), before);
      assert.equal(canonicalFileSha256(originalPath), originalSha);
      await assert.rejects(adopt({ ...options, receiptPath: replacementPath }), /existing adoption receipt differs/);
      assert.equal((await client.execute("SELECT content FROM SQLiteX_receipt_payload")).rows[0].content, "Preserved original data");
      await client.execute("CREATE TABLE ordinary_schema_change (id TEXT)");
      await assert.rejects(adopt({ ...options, receiptPath: originalPath }), /schema fingerprint/);
      assert.equal(JSON.stringify((await client.execute(`SELECT * FROM "${ledgerTable}"`)).rows), before);
    } finally { client.close(); }
  }));

  test(`${moduleName} never downgrades a new complete receipt when sqlite-like objects appear later`, () => withTempDatabaseDir(async dir => {
    const databaseUrl = testDatabaseUrl(dir, "current.db");
    const client = createClient({ url: databaseUrl });
    try {
      const context = moduleName === "tasks" ? loadAndValidateLedger() : loadTimelineLedger();
      for (const sql of context.baseline.sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)) await client.execute(sql);
      const completeFingerprint = moduleName === "tasks" ? await schemaFingerprintSha256(client) : await timelineSchemaFingerprintSha256(client, context.ledger);
      const legacy = moduleName === "timeline" ? await readLegacyDrizzleChain(client, context.ledger) : null;
      const receipt = {
        schemaVersion: `${moduleName}-production-adoption/1`, schemaFingerprintVersion: "sqlite-schema/2",
        id: "synthetic-new-complete-adoption", environment: "test",
        databaseIdentitySha256: databaseIdentitySha256(databaseUrl), schemaFingerprintSha256: completeFingerprint,
        ledgerSha256: context.ledgerSha256, baseline: { id: context.baseline.id, sha256: context.baseline.sha256 },
        operatorEvidence: [{ receiptSha256: "a".repeat(64), backupSha256: "b".repeat(64) }, { receiptSha256: "c".repeat(64), backupSha256: "d".repeat(64) }],
        proofs: [{ id: "synthetic-proof", sql: "SELECT 1 AS value", expected: 1 }],
        ...(legacy ? { legacyLedger: { table: context.ledger.legacyDrizzleTable, rowCount: legacy.rowCount, hashesSha256: legacy.hashesSha256 } } : {}),
      };
      const receiptPath = path.join(dir, "complete.json");
      fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
      const adopt = moduleName === "tasks" ? adoptExistingDatabase : adoptTimelineDatabase;
      const options = { client, databaseUrl, context, environment: "test", receiptPath, releaseSha: "synthetic-current" };
      const unversionedPath = path.join(dir, "unversioned.json");
      const { schemaFingerprintVersion: omittedVersion, ...unversioned } = receipt;
      assert.equal(omittedVersion, "sqlite-schema/2");
      fs.writeFileSync(unversionedPath, JSON.stringify(unversioned, null, 2) + "\n");
      await assert.rejects(adopt({ ...options, receiptPath: unversionedPath }), /new adoption requires schemaFingerprintVersion/);
      assert.equal((await adopt(options)).status, "adopted");
      assert.equal((await adopt(options)).status, "no-op");
      const before = JSON.stringify((await client.execute(`SELECT * FROM "${context.ledger.databaseLedgerTable}"`)).rows);
      await client.execute("CREATE TABLE sqlitex_added_later (id TEXT)");
      await assert.rejects(adopt(options), /schema fingerprint/);
      assert.equal(JSON.stringify((await client.execute(`SELECT * FROM "${context.ledger.databaseLedgerTable}"`)).rows), before);
    } finally { client.close(); }
  }));
}
