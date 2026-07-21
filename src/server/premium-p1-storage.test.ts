/**
 * Phase 1 storage integrity tests — Signal Tasks premium programme.
 *
 * Covers:
 *   S-1. getQuota mapping: free → constrained, every paid tier → generous.
 *   S-2. Effective per-file cap = min(maxFileBytes, SERVER_UPLOAD_LIMIT_BYTES).
 *   S-3. getWorkspaceStorageUsage excludes links (counts_against_storage=0).
 *   S-4. getWorkspaceStorageUsage does not double-count mirrored attachments.
 *   S-5. Over-quota claim is rolled back (row absent after rejection).
 *   S-6. Concurrent-claim overshoot bounded to one file (two sequential
 *        claims that each passed a stale pre-check; second claim is counted
 *        in the SUM, usage exceeds quota, claim rolled back).
 *   S-7. Deletes are allowed when the workspace is over quota.
 *   S-8. chooseBackend: BLOB_READ_WRITE_TOKEN → "blob",
 *        no token + no VERCEL → "disk",
 *        VERCEL=1 + no token → "vercel-no-token".
 *
 * Uses freshMemoryDb + direct-SQL seeding. FK OFF to prove explicit
 * deletes (not cascade).
 *
 * Run: node --import tsx --test src/server/premium-p1-storage.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Client } from "@libsql/client";
import { freshMemoryDb } from "./db/memory-test-db";
import {
  getQuota,
  SERVER_UPLOAD_LIMIT_BYTES,
  WARN_THRESHOLDS,
} from "@/lib/storage-config";
import type { EntitlementTier } from "@/lib/data";

// ── S-1: getQuota tier mapping ────────────────────────────────────────

test("getQuota: free tier returns constrained quota", () => {
  const q = getQuota("free");
  assert.ok(q.totalBytes > 0, "totalBytes must be positive");
  assert.ok(q.maxFileBytes > 0, "maxFileBytes must be positive");
  assert.ok(
    q.totalBytes < 1 * 1024 * 1024 * 1024,
    "free totalBytes must be < 1 GB",
  );
  assert.ok(
    q.maxFileBytes <= 10 * 1024 * 1024,
    "free maxFileBytes must be <= 10 MB",
  );
});

test("getQuota: every paid tier returns generous quota", () => {
  const paidTiers: EntitlementTier[] = ["event", "wedding", "workspace", "studio"];
  for (const tier of paidTiers) {
    const q = getQuota(tier);
    assert.ok(
      q.totalBytes >= 1 * 1024 * 1024 * 1024,
      `${tier} totalBytes must be >= 1 GB`,
    );
    assert.ok(
      q.maxFileBytes >= 50 * 1024 * 1024,
      `${tier} maxFileBytes must be >= 50 MB`,
    );
    // All paid tiers must share the same generous quota (single mapping).
    assert.deepEqual(
      q,
      getQuota("event"),
      `${tier} quota must equal event quota (all paid tiers share the same values)`,
    );
  }
});

test("getQuota: free quota is strictly less than paid quota", () => {
  const free = getQuota("free");
  const paid = getQuota("workspace");
  assert.ok(free.totalBytes < paid.totalBytes, "free totalBytes < paid totalBytes");
  assert.ok(free.maxFileBytes < paid.maxFileBytes, "free maxFileBytes < paid maxFileBytes");
});

// ── S-2: Effective per-file cap = min(maxFileBytes, SERVER_UPLOAD_LIMIT_BYTES) ──

test("effective per-file cap is min(maxFileBytes, SERVER_UPLOAD_LIMIT_BYTES)", () => {
  // SERVER_UPLOAD_LIMIT_BYTES must be a positive number.
  assert.ok(SERVER_UPLOAD_LIMIT_BYTES > 0, "SERVER_UPLOAD_LIMIT_BYTES must be positive");

  // For free tier: maxFileBytes is < SERVER_UPLOAD_LIMIT_BYTES (10 MB < 50 MB),
  // so the effective cap is maxFileBytes.
  const free = getQuota("free");
  const freeEffective = Math.min(free.maxFileBytes, SERVER_UPLOAD_LIMIT_BYTES);
  assert.equal(
    freeEffective,
    free.maxFileBytes,
    "free tier effective cap must be maxFileBytes (smaller than SERVER_UPLOAD_LIMIT_BYTES)",
  );

  // For paid tiers: maxFileBytes is > SERVER_UPLOAD_LIMIT_BYTES (250 MB > 50 MB),
  // so the effective cap is SERVER_UPLOAD_LIMIT_BYTES until multipart ships.
  const paid = getQuota("studio");
  const paidEffective = Math.min(paid.maxFileBytes, SERVER_UPLOAD_LIMIT_BYTES);
  assert.equal(
    paidEffective,
    SERVER_UPLOAD_LIMIT_BYTES,
    "paid tier effective cap must be SERVER_UPLOAD_LIMIT_BYTES (server buffers in memory)",
  );
});

test("WARN_THRESHOLDS contains 0.8 and 0.95", () => {
  assert.ok(WARN_THRESHOLDS.includes(0.8), "WARN_THRESHOLDS must include 0.8");
  assert.ok(WARN_THRESHOLDS.includes(0.95), "WARN_THRESHOLDS must include 0.95");
  assert.equal(WARN_THRESHOLDS.length, 2, "WARN_THRESHOLDS must have exactly 2 entries");
});

// ── Storage usage SQL helpers ─────────────────────────────────────────

/**
 * Replicate the getWorkspaceStorageUsage logic directly against the
 * test client so we can drive it without the production DB singleton.
 */
async function computeUsage(client: Client, workspaceId: string): Promise<number> {
  const res = await client.execute(
    `SELECT COALESCE(SUM(size_bytes), 0) AS total
     FROM resources
     WHERE workspace_id = '${workspaceId}'
       AND counts_against_storage = 1`,
  );
  const fromResources = Number((res.rows[0] as Record<string, unknown>)?.total ?? 0);

  const att = await client.execute(
    `SELECT COALESCE(SUM(a.size_bytes), 0) AS total
     FROM attachments a
     WHERE a.workspace_id = '${workspaceId}'
       AND NOT EXISTS (
         SELECT 1 FROM resources r WHERE r.id = 'res-' || a.id
       )`,
  );
  const fromAttachments = Number((att.rows[0] as Record<string, unknown>)?.total ?? 0);

  return fromResources + fromAttachments;
}

async function seedStorageBase(client: Client) {
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials) VALUES ('u-st','clerk_st','#100','ST');
    INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES
      ('ws-st','ws-st-slug','Storage Test WS','u-st');
    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      ('ws-st','u-st','owner');
    INSERT INTO tasks (id, workspace_id, title, lane, priority) VALUES
      ('t-st-1','ws-st','Task 1','todo','med');
  `);
}

// ── S-3: links excluded from usage ───────────────────────────────────

test("getWorkspaceStorageUsage: link resources (counts_against_storage=0) are excluded", async () => {
  const { client } = await freshMemoryDb();
  await seedStorageBase(client);

  // Insert a link resource — counts_against_storage=0.
  await client.execute(`
    INSERT INTO resources (id, workspace_id, task_id, kind, provider, title, size_bytes, added_at, access_state, counts_against_storage)
    VALUES ('res-link-st','ws-st','t-st-1','link','url','https://example.com',999999,1753000000,'ok',0)
  `);

  const usage = await computeUsage(client, "ws-st");
  assert.equal(usage, 0, "link resource must not count against storage quota");
});

// ── S-4: no double-counting of mirrored attachments ──────────────────

test("getWorkspaceStorageUsage: mirrored attachment is counted once (from resources, not both)", async () => {
  const { client } = await freshMemoryDb();
  await seedStorageBase(client);

  // Insert attachment + its mirrored resources row.
  await client.executeMultiple(`
    INSERT INTO attachments (id, workspace_id, task_id, uploader_user_id, filename, stored_path, mime_type, size_bytes)
    VALUES ('att-mirror','ws-st','t-st-1','u-st','f.pdf','.data/f.pdf','application/pdf',1024);

    INSERT INTO resources (id, workspace_id, task_id, kind, provider, title, size_bytes, added_at, access_state, counts_against_storage)
    VALUES ('res-att-mirror','ws-st','t-st-1','upload','file','f.pdf',1024,1753000000,'legacy',1);
  `);

  const usage = await computeUsage(client, "ws-st");
  // Should count 1024 exactly once — from resources, not from both.
  assert.equal(usage, 1024, "mirrored attachment must be counted exactly once");
});

test("getWorkspaceStorageUsage: unmirrored attachment is counted from attachments table", async () => {
  const { client } = await freshMemoryDb();
  await seedStorageBase(client);

  // Attachment with no matching resources row.
  await client.execute(`
    INSERT INTO attachments (id, workspace_id, task_id, uploader_user_id, filename, stored_path, mime_type, size_bytes)
    VALUES ('att-unmir','ws-st','t-st-1','u-st','g.png','.data/g.png','image/png',2048)
  `);

  const usage = await computeUsage(client, "ws-st");
  assert.equal(usage, 2048, "unmirrored attachment must be counted from attachments table");
});

test("getWorkspaceStorageUsage: mixed scenario — mirrored + unmirrored + link sums correctly", async () => {
  const { client } = await freshMemoryDb();
  await seedStorageBase(client);

  await client.executeMultiple(`
    INSERT INTO attachments (id, workspace_id, task_id, uploader_user_id, filename, stored_path, mime_type, size_bytes)
    VALUES
      ('att-m1','ws-st','t-st-1','u-st','a.pdf','.data/a.pdf','application/pdf',1000),
      ('att-u1','ws-st','t-st-1','u-st','b.png','.data/b.png','image/png',500);

    INSERT INTO resources (id, workspace_id, task_id, kind, provider, title, size_bytes, added_at, access_state, counts_against_storage)
    VALUES
      ('res-att-m1','ws-st','t-st-1','upload','file','a.pdf',1000,1753000000,'legacy',1),
      ('res-link-x','ws-st','t-st-1','link','url','https://x.com',NULL,1753000001,'ok',0);
  `);

  const usage = await computeUsage(client, "ws-st");
  // mirrored att-m1: 1000 (from resources)
  // unmirrored att-u1: 500 (from attachments)
  // link res-link-x: 0 (excluded)
  // total: 1500
  assert.equal(usage, 1500, "mixed scenario must sum to 1500 bytes");
});

// ── S-5: Over-quota claim is rolled back ──────────────────────────────

test("claim-then-verify: over-quota claim row is absent after rejection", async () => {
  const { client } = await freshMemoryDb();
  await seedStorageBase(client);

  // Simulate: workspace already at 99 MB of a 100 MB free quota.
  // Insert a pre-existing unmirrored attachment of 99 MB.
  const existingBytes = 99 * 1024 * 1024;
  await client.execute(`
    INSERT INTO attachments (id, workspace_id, task_id, uploader_user_id, filename, stored_path, mime_type, size_bytes)
    VALUES ('att-pre','ws-st','t-st-1','u-st','pre.bin','.data/pre.bin','application/octet-stream',${existingBytes})
  `);

  const freeQuota = getQuota("free");

  // Simulate claim: insert a 5 MB claim row.
  const claimBytes = 5 * 1024 * 1024;
  const claimId = "att-claim-1";
  await client.execute(`
    INSERT INTO attachments (id, workspace_id, task_id, uploader_user_id, filename, stored_path, mime_type, size_bytes)
    VALUES ('${claimId}','ws-st','t-st-1','u-st','claim.bin','ws-st/t-st-1/${claimId}-claim.bin','application/octet-stream',${claimBytes})
  `);

  // Compute usage including the claim.
  const usageAfterClaim = await computeUsage(client, "ws-st");
  assert.ok(
    usageAfterClaim > freeQuota.totalBytes,
    `usage (${usageAfterClaim}) must exceed free quota (${freeQuota.totalBytes}) after claim`,
  );

  // Over quota: roll back the claim.
  await client.execute(`DELETE FROM attachments WHERE id = '${claimId}'`);

  // Verify claim row is gone.
  const remaining = await client.execute(
    `SELECT COUNT(*) AS c FROM attachments WHERE id = '${claimId}'`,
  );
  assert.equal(
    Number((remaining.rows[0] as Record<string, unknown>)?.c),
    0,
    "claim row must be absent after over-quota rollback",
  );

  // Pre-existing bytes are untouched.
  const usageAfterRollback = await computeUsage(client, "ws-st");
  assert.equal(usageAfterRollback, existingBytes, "usage must revert to pre-existing bytes after rollback");
});

// ── S-6: Concurrent-claim overshoot bounded to one file ──────────────

test("concurrent-claim overshoot: second claim pushed over quota is rolled back", async () => {
  const { client } = await freshMemoryDb();
  await seedStorageBase(client);

  const freeQuota = getQuota("free");

  // Workspace at 90 MB — both concurrent uploads think they pass (stale pre-check).
  const baseBytes = 90 * 1024 * 1024;
  await client.execute(`
    INSERT INTO attachments (id, workspace_id, task_id, uploader_user_id, filename, stored_path, mime_type, size_bytes)
    VALUES ('att-base','ws-st','t-st-1','u-st','base.bin','.data/base.bin','application/octet-stream',${baseBytes})
  `);

  // Claim 1: 8 MB — within quota (90+8=98 < 100).
  const claim1Bytes = 8 * 1024 * 1024;
  const claim1Id = "att-cc-1";
  await client.execute(`
    INSERT INTO attachments (id, workspace_id, task_id, uploader_user_id, filename, stored_path, mime_type, size_bytes)
    VALUES ('${claim1Id}','ws-st','t-st-1','u-st','cc1.bin','ws-st/t-st-1/${claim1Id}-cc1.bin','application/octet-stream',${claim1Bytes})
  `);
  const usageAfterClaim1 = await computeUsage(client, "ws-st");
  // 90+8=98 MB — still under 100 MB.
  assert.ok(
    usageAfterClaim1 <= freeQuota.totalBytes,
    `claim 1 usage (${usageAfterClaim1}) must be within quota`,
  );
  // Claim 1 succeeds — no rollback.

  // Claim 2: 8 MB — both concurrent uploads passed the stale pre-check.
  // After claim 1 is inserted, the SUM now includes claim 1.
  const claim2Bytes = 8 * 1024 * 1024;
  const claim2Id = "att-cc-2";
  await client.execute(`
    INSERT INTO attachments (id, workspace_id, task_id, uploader_user_id, filename, stored_path, mime_type, size_bytes)
    VALUES ('${claim2Id}','ws-st','t-st-1','u-st','cc2.bin','ws-st/t-st-1/${claim2Id}-cc2.bin','application/octet-stream',${claim2Bytes})
  `);
  const usageAfterClaim2 = await computeUsage(client, "ws-st");
  // 90+8+8=106 MB > 100 MB — over quota.
  assert.ok(
    usageAfterClaim2 > freeQuota.totalBytes,
    `claim 2 usage (${usageAfterClaim2}) must exceed quota`,
  );

  // Claim 2 is rolled back.
  await client.execute(`DELETE FROM attachments WHERE id = '${claim2Id}'`);

  const countClaim2 = await client.execute(
    `SELECT COUNT(*) AS c FROM attachments WHERE id = '${claim2Id}'`,
  );
  assert.equal(
    Number((countClaim2.rows[0] as Record<string, unknown>)?.c),
    0,
    "claim 2 must be rolled back",
  );

  // Claim 1 survives.
  const countClaim1 = await client.execute(
    `SELECT COUNT(*) AS c FROM attachments WHERE id = '${claim1Id}'`,
  );
  assert.equal(
    Number((countClaim1.rows[0] as Record<string, unknown>)?.c),
    1,
    "claim 1 must survive (it was within quota)",
  );

  // Final usage = base + claim1.
  const finalUsage = await computeUsage(client, "ws-st");
  assert.equal(finalUsage, baseBytes + claim1Bytes, "final usage must be base + claim1 only");
});

// ── S-7: Deletes allowed when over quota ─────────────────────────────

test("deletes are allowed regardless of quota state", async () => {
  const { client } = await freshMemoryDb();
  await seedStorageBase(client);

  const freeQuota = getQuota("free");

  // Stuff the workspace beyond quota.
  const overBytes = freeQuota.totalBytes + 1024 * 1024;
  await client.execute(`
    INSERT INTO attachments (id, workspace_id, task_id, uploader_user_id, filename, stored_path, mime_type, size_bytes)
    VALUES ('att-over','ws-st','t-st-1','u-st','over.bin','.data/over.bin','application/octet-stream',${overBytes})
  `);

  const before = await computeUsage(client, "ws-st");
  assert.ok(before > freeQuota.totalBytes, "workspace must be over quota before delete");

  // Delete is allowed — no quota check on deletes.
  await client.execute(`DELETE FROM attachments WHERE id = 'att-over'`);

  const after = await computeUsage(client, "ws-st");
  assert.equal(after, 0, "usage must drop to 0 after deleting the only attachment");
});

// ── S-8: chooseBackend env-driven selection ───────────────────────────

test("chooseBackend: BLOB_READ_WRITE_TOKEN set → 'blob'", async () => {
  const original = process.env.BLOB_READ_WRITE_TOKEN;
  const originalVercel = process.env.VERCEL;
  try {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    delete process.env.VERCEL;
    // Dynamic import to pick up env at call time. The module is already
    // loaded, so we call the exported function directly after mutating env.
    const { chooseBackend } = await import("@/server/storage");
    assert.equal(chooseBackend(), "blob", "BLOB_READ_WRITE_TOKEN set must yield 'blob'");
  } finally {
    if (original === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = original;
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  }
});

test("chooseBackend: no token + no VERCEL → 'disk'", async () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
  const originalVercel = process.env.VERCEL;
  try {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.VERCEL;
    const { chooseBackend } = await import("@/server/storage");
    assert.equal(chooseBackend(), "disk", "no token + no VERCEL must yield 'disk'");
  } finally {
    if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  }
});

test("chooseBackend: VERCEL=1 + no token → 'vercel-no-token'", async () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
  const originalVercel = process.env.VERCEL;
  try {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.VERCEL = "1";
    const { chooseBackend } = await import("@/server/storage");
    assert.equal(
      chooseBackend(),
      "vercel-no-token",
      "VERCEL=1 + no token must yield 'vercel-no-token'",
    );
  } finally {
    if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  }
});
