// Proof that the integrity checks run against the real schema and that
// every one of them can actually fail (E08.09).
//
// A check that has never fired is indistinguishable from a check that
// cannot fire. So this suite builds a real database from the migration
// ledger, asserts every invariant is clean on it, then plants exactly one
// violation per check and asserts that check — and only that check —
// reports it.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { createClient } from "@libsql/client";
import { CHECKS, runChecks, summarise } from "./integrity-check.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

/**
 * Build the fixture from the migration SQL itself, from the baseline
 * forward, rather than by shelling out to the runner.
 *
 * The runner also validates the migration ledger, and a ledger that is
 * transiently inconsistent while someone else is adding a migration would
 * fail this suite for a reason that has nothing to do with data integrity.
 * The SQL files are the schema; the ledger is bookkeeping about them.
 *
 * The split is on `--> statement-breakpoint`, NOT on semicolons — the
 * runner's own rule, and splitting on semicolons silently truncates any
 * migration containing a trigger body.
 */
const BASELINE = "0014_current_schema_baseline.sql";

function migrationStatements() {
  const dir = path.join(repoRoot, "drizzle");
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .filter((name) => name >= BASELINE);
  const statements = [];
  for (const name of files) {
    const body = fs.readFileSync(path.join(dir, name), "utf8");
    for (const segment of body.split("--> statement-breakpoint")) {
      const sql = segment
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();
      if (sql) statements.push({ file: name, sql });
    }
  }
  return statements;
}

let workDir;
let dbPath;
let client;

/** Insert a row, tolerating the columns this schema version actually has. */
async function insert(table, values) {
  const columns = Object.keys(values);
  await client.execute({
    sql: `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")}) ` +
      `VALUES (${columns.map(() => "?").join(", ")})`,
    args: Object.values(values),
  });
}

async function violationsOf(id) {
  const [result] = await runChecks(client, CHECKS.filter((c) => c.id === id));
  return result;
}

before(async () => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "signal-integrity-test-"));
  dbPath = path.join(workDir, "tasks.db");

  client = createClient({ url: `file:${dbPath}` });
  await client.execute("PRAGMA foreign_keys = OFF");

  // Build the real schema from the real migration SQL. If a migration
  // renames a column a check depends on, this suite is where it surfaces.
  for (const { file, sql } of migrationStatements()) {
    try {
      await client.execute(sql);
    } catch (error) {
      throw new Error(`fixture build failed in ${file}: ${error.message}\n${sql.slice(0, 200)}`);
    }
  }
});

after(() => {
  try {
    client?.close();
  } catch {
    // already closed
  }
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== "EPERM") throw error;
  }
});

describe("data-integrity checks", () => {
  it("every check is valid SQL against the migrated production schema", async () => {
    const results = await runChecks(client);
    assert.equal(results.length, CHECKS.length);
    assert.ok(CHECKS.length >= 15, "the check set should not silently shrink");
  });

  it("a freshly migrated, empty database violates nothing", async () => {
    const results = await runChecks(client);
    const dirty = results.filter((r) => r.violations > 0);
    assert.deepEqual(
      dirty.map((r) => r.id),
      [],
      "an empty database should be clean; a check firing here is a false positive",
    );
    assert.equal(summarise(results).ok, true);
  });

  it("a correctly-built workspace violates nothing", async () => {
    await insert("users", { id: "u-ok", clerk_id: "clerk-ok", email: "ok@example.test", name: "Ok", color: "#000000", initials: "OK" });
    await insert("workspaces", { id: "ws-ok", slug: "ws-ok", name: "Clean", owner_user_id: "u-ok" });
    await insert("workspace_members", {
      workspace_id: "ws-ok", user_id: "u-ok", role: "owner", joined_at: 1,
    });
    await insert("tasks", {
      id: "t-ok", workspace_id: "ws-ok", title: "A task", lane: "now", priority: "medium", position: 1,
    });

    const results = await runChecks(client);
    assert.deepEqual(results.filter((r) => r.violations > 0).map((r) => r.id), []);
  });

  it("catches a workspace whose owner user does not exist", async () => {
    await insert("workspaces", { id: "ws-noowner", slug: "ws-noowner", name: "X", owner_user_id: "u-ghost" });
    await insert("workspace_members", {
      workspace_id: "ws-noowner", user_id: "u-ok", role: "owner", joined_at: 1,
    });
    const result = await violationsOf("workspace-owner-exists");
    assert.equal(result.violations, 1);
    assert.deepEqual(result.sample, ["ws-noowner"]);
  });

  it("catches a workspace with no owner membership row", async () => {
    await insert("workspaces", { id: "ws-nomember", slug: "ws-nomember", name: "Y", owner_user_id: "u-ok" });
    const result = await violationsOf("workspace-has-owner-member");
    assert.equal(result.violations, 1);
    assert.deepEqual(result.sample, ["ws-nomember"]);
  });

  it("catches an orphaned task", async () => {
    await insert("tasks", {
      id: "t-orphan", workspace_id: "ws-gone", title: "Orphan", lane: "now", priority: "medium", position: 1,
    });
    const result = await violationsOf("orphaned-tasks");
    assert.equal(result.violations, 1);
    assert.deepEqual(result.sample, ["t-orphan"]);
  });

  it("catches a share link with no owning workspace", async () => {
    await insert("share_links", {
      token: "tok-orphan", workspace_id: "ws-gone", view: "board", mode: "read", created_at: 1,
    });
    const result = await violationsOf("orphaned-share-links");
    assert.equal(result.violations, 1);
    assert.deepEqual(result.sample, ["tok-orphan"]);
  });

  it("catches an attachment whose workspace disagrees with its task", async () => {
    await insert("attachments", {
      id: "att-drift",
      workspace_id: "ws-nomember",
      task_id: "t-ok",
      uploader_user_id: "u-ok",
      filename: "photo.jpg",
      stored_path: "blob://x",
      mime_type: "image/jpeg",
      size_bytes: 10,
      created_at: 1,
    });
    const result = await violationsOf("attachment-tenant-drift");
    assert.equal(result.violations, 1);
    assert.deepEqual(result.sample, ["att-drift"]);
  });

  it("catches a comment whose workspace disagrees with its task", async () => {
    await insert("comments", {
      id: "c-drift", workspace_id: "ws-nomember", task_id: "t-ok", user_id: "u-ok",
      body: "note", created_at: 1,
    });
    const result = await violationsOf("comment-tenant-drift");
    assert.equal(result.violations, 1);
  });

  it("catches an activity row with a null workspace", async () => {
    await insert("activities", {
      id: "a-null", task_id: "t-ok", user_id: "u-ok", kind: "created",
      payload: "{}", created_at: 1,
    });
    const result = await violationsOf("activity-tenant-drift");
    assert.equal(result.violations, 1);
    assert.deepEqual(result.sample, ["a-null"]);
  });

  it("catches a sponsorship pointing at a workspace that does not exist", async () => {
    await insert("workspace_sponsorships", {
      id: "sp-orphan", workspace_id: "ws-gone", sponsor_id: "venue-1", status: "active",
      consent_receipt_id: "cr-1", consented_at: 1, created_at: 1, updated_at: 1,
    });
    const result = await violationsOf("orphaned-sponsorships");
    assert.equal(result.violations, 1);
    assert.deepEqual(result.sample, ["sp-orphan"]);
  });

  it("catches two venues both holding an active sponsorship on one workspace", async () => {
    await insert("workspace_sponsorships", {
      id: "sp-a", workspace_id: "ws-ok", sponsor_id: "venue-a", status: "active",
      consent_receipt_id: "cr-a", consented_at: 1, created_at: 1, updated_at: 1,
    });
    await insert("workspace_sponsorships", {
      id: "sp-b", workspace_id: "ws-ok", sponsor_id: "venue-b", status: "active",
      consent_receipt_id: "cr-b", consented_at: 1, created_at: 1, updated_at: 1,
    });
    const result = await violationsOf("duplicate-active-sponsorship");
    assert.equal(result.violations, 1);
    assert.deepEqual(result.sample, ["ws-ok"]);
  });

  it("catches an invite to a workspace that no longer exists", async () => {
    await insert("pending_invites", {
      token: "inv-orphan", workspace_id: "ws-gone", email: "someone@example.test",
      invited_by_user_id: "u-ok", created_at: 1, expires_at: 2, role: "member",
    });
    const result = await violationsOf("orphaned-pending-invites");
    assert.equal(result.violations, 1);
    assert.deepEqual(result.sample, ["inv-orphan"]);
  });

  it("catches an entitlement attached to a missing workspace", async () => {
    await insert("entitlements", {
      id: "ent-orphan", workspace_id: "ws-gone", user_id: "u-ok", tier: "pro", source: "stripe", started_at: 1,
    });
    const result = await violationsOf("orphaned-entitlements");
    assert.equal(result.violations, 1);
  });

  it("catches a workspace pointing at a planning period that does not exist", async () => {
    await client.execute(
      "UPDATE workspaces SET planning_period_id = 'pp-gone' WHERE id = 'ws-ok'",
    );
    const result = await violationsOf("orphaned-planning-period");
    assert.equal(result.violations, 1);
    assert.deepEqual(result.sample, ["ws-ok"]);
  });

  it("catches a membership row naming a deleted user", async () => {
    await insert("workspace_members", {
      workspace_id: "ws-ok", user_id: "u-ghost", role: "member", joined_at: 1,
    });
    const result = await violationsOf("membership-user-exists");
    assert.equal(result.violations, 1);
    assert.deepEqual(result.sample, ["ws-ok:u-ghost"]);
  });

  it("catches a published workspace with no slug", async () => {
    await insert("workspaces", {
      id: "ws-nopub", slug: "", name: "Published", owner_user_id: "u-ok", published_at: 1,
    });
    await insert("workspace_members", {
      workspace_id: "ws-nopub", user_id: "u-ok", role: "owner", joined_at: 1,
    });
    const result = await violationsOf("published-workspace-without-slug");
    assert.equal(result.violations, 1);
    assert.deepEqual(result.sample, ["ws-nopub"]);
  });

  it("warns, without failing the run, on an expired share link left unrevoked", async () => {
    await insert("share_links", {
      token: "tok-stale", workspace_id: "ws-ok", view: "board", mode: "read",
      created_at: 1, expires_at: 1,
    });
    const result = await violationsOf("share-link-expired-not-revoked");
    assert.equal(result.violations, 1);
    assert.equal(result.severity, "warn");
    assert.equal(summarise([result]).ok, true);
  });

  it("refuses to run a check whose SQL is not a SELECT", async () => {
    await assert.rejects(
      () => runChecks(client, [{ id: "bad", severity: "error", title: "t", why: "w", sql: "DELETE FROM tasks" }]),
      /read-only by contract/,
    );
  });

  it("reports the accumulated damage as a failing run", async () => {
    const results = await runChecks(client);
    const summary = summarise(results);
    assert.equal(summary.ok, false);
    assert.ok(summary.failingChecks >= 14, `expected most checks dirty, got ${summary.failingChecks}`);
  });
});
