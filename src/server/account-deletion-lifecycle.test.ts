import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import {
  accountDeletionTombstoneKey,
  beginAccountDeletionWith,
  hasAccountDeletionStartedWith,
} from "./account-deletion-lifecycle";
import { ensureUserProvisionedWith } from "./db/ensure-user";
import * as schema from "./db/schema";

async function freshDb() {
  // libSQL transactions use a separate connection. A file-backed disposable
  // database therefore gives the race tests one shared durable SQLite truth.
  const directory = mkdtempSync(join(tmpdir(), "signal-account-deletion-"));
  const client = createClient({
    url: pathToFileURL(join(directory, "account-deletion.test.db")).href,
  });
  const drizzleDir = join(process.cwd(), "drizzle");
  const migrations = readdirSync(drizzleDir)
    .filter((file) => /^\d{4}_.+\.sql$/.test(file) && file >= "0014_")
    .sort();
  for (const migration of migrations) {
    await client.executeMultiple(
      readFileSync(join(drizzleDir, migration), "utf8"),
    );
  }
  return {
    client,
    db: drizzle(client, { schema }),
    cleanup: () => {
      client.close();
      try {
        rmSync(directory, { recursive: true, force: true });
      } catch {
        // This process owns the disposable fixture directory.
      }
    },
  };
}

async function countRows(
  client: Client,
  table: string,
): Promise<number> {
  const result = await client.execute(`SELECT COUNT(*) AS count FROM ${table}`);
  return Number(result.rows[0]!.count);
}

test("the deletion tombstone is idempotent and retains no raw identity", async () => {
  const { client, db, cleanup } = await freshDb();
  try {
    const clerkId = "user_delete_me_123";
    const key = accountDeletionTombstoneKey(clerkId);
    assert.equal(key.includes(clerkId), false);
    assert.match(key, /^account-deletion:tombstone:sha256:v1:[a-f0-9]{64}$/);

    await beginAccountDeletionWith(db, clerkId);
    await beginAccountDeletionWith(db, clerkId);

    assert.equal(await hasAccountDeletionStartedWith(db, clerkId), true);
    assert.equal(await countRows(client, "meta"), 1);
    const row = await client.execute("SELECT key, value FROM meta");
    assert.deepEqual(row.rows[0], {
      key,
      value: "erasure-requested:v1",
    });
  } finally {
    cleanup();
  }
});

test("a deletion that wins first blocks fallback account provisioning", async () => {
  const { client, db, cleanup } = await freshDb();
  try {
    const clerkId = "user_delete_first";
    await beginAccountDeletionWith(db, clerkId);

    assert.equal(
      await ensureUserProvisionedWith(
        db,
        clerkId,
        "deleted@example.test",
        "Deleted",
        "Person",
      ),
      false,
    );
    assert.equal(await countRows(client, "users"), 0);
    assert.equal(await countRows(client, "workspaces"), 0);
    assert.equal(await countRows(client, "workspace_members"), 0);
  } finally {
    cleanup();
  }
});

test("provisioning that wins first cannot recur after the tombstone", async () => {
  const { client, db, cleanup } = await freshDb();
  try {
    const clerkId = "user_provision_first";
    assert.equal(await ensureUserProvisionedWith(db, clerkId), true);
    assert.equal(await countRows(client, "users"), 1);

    await beginAccountDeletionWith(db, clerkId);
    await client.execute("DELETE FROM workspace_members");
    await client.execute("DELETE FROM workspaces");
    await client.execute("DELETE FROM planning_periods");
    await client.execute("DELETE FROM users");

    assert.equal(await ensureUserProvisionedWith(db, clerkId), false);
    assert.equal(await countRows(client, "users"), 0);
    assert.equal(await countRows(client, "workspaces"), 0);
  } finally {
    cleanup();
  }
});
