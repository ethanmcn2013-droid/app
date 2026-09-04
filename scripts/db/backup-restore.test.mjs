// Proof that the backup path produces something restorable, and that the
// verifier actually fails when the restore is wrong (E08.09).
//
// The claim under test is not "the code runs". It is:
//   - a backup taken from a populated database restores into an empty one
//     with identical content, including blobs and triggers;
//   - the verifier compares the RESTORED database, so tampering with the
//     backup body is caught;
//   - the verifier refuses to restore anywhere but a local file.
//
// Each negative case is asserted to fail. A verifier that cannot fail is
// not evidence of anything.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createClient } from "@libsql/client";
import { takeBackup, tableHash } from "./backup.mjs";
import { compare, compareDdl, measure, restoreInto } from "./restore-verify.mjs";

const DDL = [
  `CREATE TABLE workspaces (
     id text PRIMARY KEY,
     name text NOT NULL,
     owner_user_id text NOT NULL
   )`,
  `CREATE TABLE ledger (
     id text PRIMARY KEY,
     workspace_id text NOT NULL,
     payload blob,
     amount integer NOT NULL
   )`,
  `CREATE INDEX ledger_workspace_idx ON ledger (workspace_id)`,
  // An append-only trigger, because a restore that silently drops triggers
  // returns the data and loses the invariant. That is the exact defect
  // recorded against the entitlements audit ledger baseline.
  `CREATE TRIGGER ledger_no_delete
     BEFORE DELETE ON ledger
     BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END`,
];

let workDir;
let sourcePath;
let source;

before(async () => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "signal-backup-test-"));
  sourcePath = path.join(workDir, "source.db");
  source = createClient({ url: `file:${sourcePath}` });
  for (const statement of DDL) await source.execute(statement);
  await source.execute({
    sql: "INSERT INTO workspaces (id, name, owner_user_id) VALUES (?, ?, ?)",
    args: ["ws-1", "Glenmara House wedding", "u-1"],
  });
  await source.execute({
    sql: "INSERT INTO workspaces (id, name, owner_user_id) VALUES (?, ?, ?)",
    args: ["ws-2", "Second workspace", "u-2"],
  });
  for (let index = 0; index < 40; index += 1) {
    await source.execute({
      sql: "INSERT INTO ledger (id, workspace_id, payload, amount) VALUES (?, ?, ?, ?)",
      args: [
        `l-${index}`,
        index % 2 === 0 ? "ws-1" : "ws-2",
        Buffer.from(`binary-payload-${index}`),
        index * 100,
      ],
    });
  }
});

after(async () => {
  try {
    await source?.close();
  } catch {
    // handle already closed
  }
  try {
    fs.rmSync(workDir, {
      recursive: true,
      force: true,
      maxRetries: process.platform === "win32" ? 5 : 0,
      retryDelay: 50,
    });
  } catch (error) {
    // A native libSQL handle can survive until process teardown on Windows.
    // This is a unique OS-temp fixture, so EBUSY/EPERM after bounded retries
    // is teardown noise rather than a failed backup or restore assertion.
    if (error?.code !== "EPERM" && error?.code !== "EBUSY") throw error;
  }
});

describe("backup and restore", () => {
  it("restores every row, including blobs, into a fresh database", async () => {
    const { body, manifest } = await takeBackup(source, {
      label: "test",
      url: `file:${sourcePath}`,
    });
    assert.equal(manifest.totalRows, 42);
    assert.deepEqual(manifest.ddl.triggers, ["ledger_no_delete"]);

    const target = path.join(workDir, `restore-${Date.now()}.db`);
    const { client } = await restoreInto(`file:${target}`, body);
    try {
      const measured = await measure(client, manifest.tables.map((t) => t.name));
      const result = compare(manifest, measured);
      assert.deepEqual(result.differences, []);
      assert.equal(result.ok, true);

      const blob = await client.execute("SELECT payload FROM ledger WHERE id = 'l-7'");
      assert.equal(Buffer.from(blob.rows[0].payload).toString(), "binary-payload-7");
    } finally {
      await client.close();
    }
  });

  it("restores the triggers, so the invariant survives the restore", async () => {
    const { body, manifest } = await takeBackup(source, {
      label: "test",
      url: `file:${sourcePath}`,
    });
    const target = path.join(workDir, `restore-trigger-${Date.now()}.db`);
    const { client } = await restoreInto(`file:${target}`, body);
    try {
      const ddl = await compareDdl(client, manifest);
      assert.deepEqual(ddl.missing, []);
      await assert.rejects(
        () => client.execute("DELETE FROM ledger WHERE id = 'l-1'"),
        /append-only/,
      );
    } finally {
      await client.close();
    }
  });

  it("FAILS when a row is missing from the restore", async () => {
    const { body, manifest } = await takeBackup(source, {
      label: "test",
      url: `file:${sourcePath}`,
    });
    // Drop one row line from the backup body. A verifier that only checked
    // the file's own hash would still pass; this one reads the database.
    const lines = body.trim().split("\n");
    const index = lines.findIndex((line) => JSON.parse(line).kind === "row");
    const tampered = lines.filter((_, i) => i !== index).join("\n") + "\n";

    const target = path.join(workDir, `restore-short-${Date.now()}.db`);
    const { client } = await restoreInto(`file:${target}`, tampered);
    try {
      const measured = await measure(client, manifest.tables.map((t) => t.name));
      const result = compare(manifest, measured);
      assert.equal(result.ok, false);
      assert.equal(result.differences[0].reason, "row count differs");
    } finally {
      await client.close();
    }
  });

  it("FAILS when a value is altered but the row count is right", async () => {
    const { body, manifest } = await takeBackup(source, {
      label: "test",
      url: `file:${sourcePath}`,
    });
    const tampered = body.replace(
      '"Glenmara House wedding"',
      '"Somewhere else entirely"',
    );
    assert.notEqual(tampered, body, "the fixture value must appear in the body");

    const target = path.join(workDir, `restore-altered-${Date.now()}.db`);
    const { client } = await restoreInto(`file:${target}`, tampered);
    try {
      const measured = await measure(client, manifest.tables.map((t) => t.name));
      const result = compare(manifest, measured);
      assert.equal(result.ok, false);
      assert.equal(result.differences[0].table, "workspaces");
      assert.equal(result.differences[0].reason, "content hash differs");
    } finally {
      await client.close();
    }
  });

  it("refuses to restore anywhere but a local file", async () => {
    const { body } = await takeBackup(source, { label: "test", url: `file:${sourcePath}` });
    await assert.rejects(
      () => restoreInto("libsql://tasks-prod.turso.io", body),
      /must be a local file/,
    );
  });

  it("hashes a table by its set of rows, not by their order", () => {
    const columns = ["id", "name"];
    const a = tableHash(columns, [["1", "a"], ["2", "b"]]);
    const b = tableHash(columns, [["2", "b"], ["1", "a"]]);
    assert.equal(a, b);
    const c = tableHash(columns, [["1", "a"], ["2", "c"]]);
    assert.notEqual(a, c);
  });

  it("does not record the database URL anywhere in the manifest", async () => {
    const url = "libsql://tasks-prod-secret-name.turso.io";
    const { manifest } = await takeBackup(source, { label: "test", url });
    const serialised = JSON.stringify(manifest);
    assert.ok(!serialised.includes("tasks-prod-secret-name"));
    assert.equal(manifest.databaseIdentity.length, 16);
  });
});
