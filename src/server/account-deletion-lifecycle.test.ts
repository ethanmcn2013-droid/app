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
import { provisionCreatedClerkUserWith } from "./db/clerk-user-provision";
import { retryImmediateProvisioning } from "./db/immediate-transaction-retry";
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

test("a deletion tombstone also blocks delayed Clerk creation", async () => {
  const { client, db, cleanup } = await freshDb();
  try {
    const clerkId = "user_deleted_before_webhook";
    await beginAccountDeletionWith(db, clerkId);
    assert.equal(await provisionCreatedClerkUserWith(db, {
      clerkId, email: "deleted-webhook@example.test", handle: "deletedwebhook",
      name: "Deleted Account", color: "#456", initials: "DA",
    }), null);
    assert.equal(await countRows(client, "users"), 0);
    assert.equal(await countRows(client, "planning_periods"), 0);
    assert.equal(await countRows(client, "workspaces"), 0);
    assert.equal(await countRows(client, "workspace_members"), 0);
  } finally {
    cleanup();
  }
});

test("fallback and delayed webhook keep the persisted internal id and replay once", async () => {
  const { client, db, cleanup } = await freshDb();
  try {
    const clerkId = "user_existing_mapping";
    const internalId = "legacy-internal-id";
    await client.execute({
      sql: "INSERT INTO users (id, clerk_id, color, initials) VALUES (?, ?, '#123', 'LI')",
      args: [internalId, clerkId],
    });
    assert.equal(await ensureUserProvisionedWith(db, clerkId, "mapped@example.test"), true);
    assert.equal(await ensureUserProvisionedWith(db, clerkId, "mapped@example.test"), true);
    const profile = {
      clerkId, email: "mapped@example.test", handle: "mapped", name: "Mapped Person",
      color: "#456", initials: "MP",
    };
    assert.equal(await provisionCreatedClerkUserWith(db, profile), internalId);
    assert.equal(await provisionCreatedClerkUserWith(db, profile), internalId);
    assert.deepEqual((await client.execute("SELECT id, clerk_id FROM users")).rows.map((row) => ({ ...row })), [
      { id: internalId, clerk_id: clerkId },
    ]);
    assert.deepEqual((await client.execute("SELECT owner_user_id FROM planning_periods")).rows.map((row) => row.owner_user_id), [internalId]);
    assert.deepEqual((await client.execute("SELECT owner_user_id FROM workspaces")).rows.map((row) => row.owner_user_id), [internalId]);
    assert.deepEqual((await client.execute("SELECT user_id FROM workspace_members")).rows.map((row) => row.user_id), [internalId]);
  } finally {
    cleanup();
  }
});

test("webhook-first and fallback replay provision one canonical Clerk account", async () => {
  const { client, db, cleanup } = await freshDb();
  try {
    const clerkId = "user_fresh_mapping";
    const profile = {
      clerkId, email: "fresh@example.test", handle: "fresh", name: "Fresh Person",
      color: "#456", initials: "FP",
    };
    assert.equal(await provisionCreatedClerkUserWith(db, profile), clerkId);
    assert.equal(await ensureUserProvisionedWith(db, clerkId), true);
    assert.equal(await provisionCreatedClerkUserWith(db, profile), clerkId);
    assert.equal(await countRows(client, "users"), 1);
    assert.equal(await countRows(client, "planning_periods"), 1);
    assert.equal(await countRows(client, "workspaces"), 1);
    assert.equal(await countRows(client, "workspace_members"), 1);
    assert.deepEqual((await client.execute("SELECT owner_user_id FROM planning_periods")).rows.map((row) => row.owner_user_id), [clerkId]);
  } finally {
    cleanup();
  }
});

test("webhook-first preserves a pre-existing mapped identity", async () => {
  const { client, db, cleanup } = await freshDb();
  try {
    const clerkId = "user_mapped_first";
    const internalId = "persisted-mapped-user";
    await client.execute({
      sql: "INSERT INTO users (id, clerk_id, color, initials) VALUES (?, ?, '#123', 'PM')",
      args: [internalId, clerkId],
    });
    const profile = {
      clerkId, email: "mapped-first@example.test", handle: "mappedfirst",
      name: "Mapped First", color: "#456", initials: "MF",
    };
    assert.equal(await provisionCreatedClerkUserWith(db, profile), internalId);
    assert.equal(await ensureUserProvisionedWith(db, clerkId), true);
    assert.equal(await provisionCreatedClerkUserWith(db, profile), internalId);
    assert.deepEqual((await client.execute("SELECT id FROM users")).rows.map((row) => row.id), [internalId]);
    assert.deepEqual((await client.execute("SELECT owner_user_id FROM planning_periods")).rows.map((row) => row.owner_user_id), [internalId]);
    assert.deepEqual((await client.execute("SELECT owner_user_id FROM workspaces")).rows.map((row) => row.owner_user_id), [internalId]);
    assert.deepEqual((await client.execute("SELECT user_id FROM workspace_members")).rows.map((row) => row.user_id), [internalId]);
  } finally {
    cleanup();
  }
});

test("parallel authenticated entries provision one mapped user on a local file database", async () => {
  const { client, db, cleanup } = await freshDb();
  try {
    const clerkId = "user_parallel_mapping";
    const internalId = "parallel-internal";
    await client.execute({
      sql: "INSERT INTO users (id, clerk_id, color, initials) VALUES (?, ?, '#123', 'PI')",
      args: [internalId, clerkId],
    });
    const results = await Promise.all(Array.from({ length: 8 }, () =>
      ensureUserProvisionedWith(db, clerkId, "parallel@example.test")));
    assert.deepEqual(results, Array(8).fill(true));
    assert.equal(await countRows(client, "users"), 1);
    assert.equal(await countRows(client, "planning_periods"), 1);
    assert.equal(await countRows(client, "workspaces"), 1);
    assert.equal(await countRows(client, "workspace_members"), 1);
  } finally {
    cleanup();
  }
});

test("parallel distinct local users complete without weakening the deletion fence", async () => {
  const { client, db, cleanup } = await freshDb();
  try {
    const clerkIds = ["user_alpha_distinct", "user_bravo_distinct", "user_charlie_distinct", "user_delta_distinct"];
    const results = await Promise.all(clerkIds.map((id) => ensureUserProvisionedWith(db, id)));
    assert.deepEqual(results, Array(4).fill(true));
    assert.equal(await countRows(client, "users"), 4);
    assert.equal(await countRows(client, "planning_periods"), 4);
    assert.equal(await countRows(client, "workspaces"), 4);
    assert.equal(await countRows(client, "workspace_members"), 4);
  } finally {
    cleanup();
  }
});

test("provisioning retry is bounded to SQLite lock errors", async () => {
  const database = {};
  let attempts = 0;
  await assert.rejects(
    retryImmediateProvisioning(database, "user_constraint", async () => {
      attempts += 1;
      throw Object.assign(new Error("constraint"), { code: "SQLITE_CONSTRAINT" });
    }),
    (error: unknown) => (error as { code?: string }).code === "SQLITE_CONSTRAINT",
  );
  assert.equal(attempts, 1);

  attempts = 0;
  assert.equal(await retryImmediateProvisioning(database, "user_busy", async () => {
    attempts += 1;
    if (attempts === 1) throw Object.assign(new Error("locked"), { code: "SQLITE_BUSY" });
    return "committed";
  }), "committed");
  assert.equal(attempts, 2);

  attempts = 0;
  await assert.rejects(
    retryImmediateProvisioning(database, "user_persistently_busy", async () => {
      attempts += 1;
      throw Object.assign(new Error("locked"), { code: "SQLITE_BUSY" });
    }),
    (error: unknown) => (error as { code?: string }).code === "SQLITE_BUSY",
  );
  assert.equal(attempts, 8);
});
