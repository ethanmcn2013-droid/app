/**
 * Account-erasure integration test · Signal Tasks. GDPR right-to-erasure /
 * App Store 5.1.1(v) guard.
 *
 * Runs the REAL `eraseAccountData` against a real in-memory libSQL database
 * built from the canonical current-schema baseline, so it
 * proves erasure end-to-end, not by source inspection.
 *
 * Two invariants, both load-bearing for the GDPR finding:
 *
 *   1. ZERO RESIDUAL ROWS. After erasing the target user, no row keyed to
 *      that user OR to any workspace they owned remains in ANY table —
 *      including the cutover edge cases (a child row whose `workspace_id`
 *      is NULL but whose task lived in an owned workspace) and the rows
 *      that FK cascade is supposed to handle (share_link_visits,
 *      task-bound children). We run with `PRAGMA foreign_keys = OFF` on
 *      purpose: if a delete is missing, the row survives and the test
 *      fails. Nothing is allowed to hide behind a cascade.
 *
 *   2. NO COLLATERAL DELETION. A second "bystander" user, who owns their
 *      own workspace, is a member of the target's workspace, and posted on
 *      the target's tasks, keeps their account and product data. Drive
 *      journal rows directly tied to the erased account are consumed, while
 *      unrelated work and a Project-deletion tombstone in the surviving
 *      workspace remain. Global, non-tenant tables are untouched.
 *
 * Plus: local and private-Blob attachment locators use the central storage
 * seam, a real disk probe is asserted gone, erasure is idempotent, and erasing
 * an unknown user is a no-op.
 *
 * Run: node --import tsx --test src/server/account-erasure.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { eraseAccountData } from "./account-erasure";
import { exportAccountData } from "./account-export";
import { freshFileDb } from "./db/memory-test-db";
import { resources } from "./db/schema";

async function count(client: Client, where: string): Promise<number> {
  const rs = await client.execute(`SELECT COUNT(*) AS c FROM ${where}`);
  return Number(rs.rows[0]!.c);
}

/**
 * Two tenants. Target (`u-target`) owns `ws-a`. Bystander (`u-bystander`)
 * owns `ws-b`. They are cross-members of each other's workspace, and the
 * target has posted on the bystander's task (`task-b1`) while the bystander
 * has posted on the target's task (`task-a1`). Includes a NULL-workspace_id
 * comment bound to an owned task (the cutover edge), and a probe attachment
 * pointing at a real file on disk.
 */
async function seed(client: Client, probePath: string) {
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials) VALUES
      ('u-target','clerk_target','#111','TT'),
      ('u-bystander','clerk_bystander','#222','BB');

    INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES
      ('ws-a','ws-a-slug','A','u-target'),
      ('ws-b','ws-b-slug','B','u-bystander');

    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      ('ws-a','u-target','owner'),
      ('ws-b','u-bystander','owner'),
      ('ws-b','u-target','member'),
      ('ws-a','u-bystander','member');

    INSERT INTO provider_connections (
      id, user_id, provider, provider_account_id, provider_account_email,
      root_folder_id, refresh_token_cipher, key_version, scopes, status,
      is_current, connected_at
    ) VALUES
      ('conn-target','u-target','google_drive','perm-target','target@example.test',
       'root-target','cipher-target',1,'["https://www.googleapis.com/auth/drive.file"]','active',1,1756800000),
      ('conn-bystander','u-bystander','google_drive','perm-bystander','bystander@example.test',
       'root-bystander','cipher-bystander',1,'["https://www.googleapis.com/auth/drive.file"]','active',1,1756800001);

    -- The target stores ws-b; the bystander stores ws-a. Erasure must remove
    -- both dependency directions without deleting ws-b or conn-bystander.
    INSERT INTO workspace_storage (
      id, workspace_id, connection_id, folder_id, folder_web_view_link, state, is_current
    ) VALUES
      ('storage-target-in-b','ws-b','conn-target','folder-target-in-b','https://drive.test/target-in-b','active',1),
      ('storage-bystander-in-a','ws-a','conn-bystander','folder-bystander-in-a','https://drive.test/bystander-in-a','active',1),
      ('storage-bystander-in-b','ws-b','conn-bystander','folder-bystander-in-b','https://drive.test/bystander-in-b','active',0);
    INSERT INTO drive_folder_grants (
      storage_generation_id, workspace_id, user_id, permission_id,
      granted_email, role, granted_at, revoke_pending
    ) VALUES
      ('storage-target-in-b','ws-b','u-target','grant-target','target@example.test','writer',1756800000,0),
      ('storage-target-in-b','ws-b','u-bystander','grant-bystander-b','bystander@example.test','writer',1756800000,0),
      ('storage-bystander-in-a','ws-a','u-target','grant-target-a','target@example.test','writer',1756800000,0),
      ('storage-bystander-in-a','ws-a','u-bystander','grant-bystander-a','bystander@example.test','writer',1756800000,0);

    INSERT INTO project_drive_operations (
      id, workspace_id, operation_kind, status, dedupe_key, connection_id,
      storage_generation_id, target_storage_generation_id, subject_user_id,
      grantee_email, grant_role, workspace_revision, provider_permission_id,
      attempt_count, last_attempt_at, created_at, updated_at, completed_at
    ) VALUES
      -- Terminal delete receipts are safe for account erasure to consume. A
      -- non-terminal delete is covered by the lifecycle-precedence tests.
      ('op-owned-project','ws-a','project_delete','cancelled','${"1".repeat(64)}',
       NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,1756800000,1756800001,1756800001),
      ('op-target-connection','ws-b','folder_provision','pending','${"2".repeat(64)}',
       'conn-target',NULL,'storage-target-reserved',NULL,NULL,NULL,NULL,NULL,
       0,NULL,1756800000,1756800000,NULL),
      ('op-target-storage','ws-b','folder_rename','pending','${"3".repeat(64)}',
       NULL,'storage-target-in-b',NULL,NULL,NULL,NULL,2,NULL,
       0,NULL,1756800000,1756800000,NULL),
      ('op-target-subject','ws-b','grant_create','succeeded','${"4".repeat(64)}',
       NULL,'storage-bystander-in-b',NULL,'u-target','target@example.test','writer',NULL,
       'grant-operation-only',1,1756800001,1756800000,1756800001,1756800001),
      ('op-unattempted-subject','ws-b','grant_create','pending','${"8".repeat(64)}',
       NULL,'storage-bystander-in-b',NULL,'u-target','target@example.test','reader',NULL,
       NULL,0,NULL,1756800000,1756800000,NULL),
      ('op-cancelled-subject','ws-b','grant_create','cancelled','${"9".repeat(64)}',
       NULL,'storage-bystander-in-b',NULL,'u-target','target@example.test','reader',NULL,
       NULL,0,NULL,1756800000,1756800001,1756800001),
      -- A project-delete row carries no connection, storage, or subject. A
      -- target-owned generation must not make this tombstone or unrelated
      -- work elsewhere in the surviving workspace account-owned cleanup.
      ('op-target-storage-project-delete','ws-b','project_delete','cancelled','${"0".repeat(64)}',
       NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
       0,NULL,1756800000,1756800001,1756800001),
      ('op-bystander-only','ws-b','folder_rename','pending','${"5".repeat(64)}',
       NULL,'storage-bystander-in-b',NULL,NULL,NULL,NULL,3,NULL,
       0,NULL,1756800000,1756800000,NULL);

    INSERT INTO tasks (
      id, workspace_id, title, lane, priority,
      source_note_id, source_note_extract_body, source_note_extract_sha256
    ) VALUES
      ('task-a1','ws-a','A task','todo','med',NULL,NULL,NULL),
      ('task-b1','ws-b','B task','todo','med','clerk_target:note-shared','Exact private wording','${"a".repeat(64)}'),
      ('task-b2','ws-b','Unrelated note task','todo','med','clerkXtarget:note-safe','Keep unrelated wording','${"b".repeat(64)}');

    INSERT INTO comments (id, workspace_id, task_id, user_id, body) VALUES
      ('c-a1','ws-a','task-a1','u-target','t on own'),
      ('c-a1-null',NULL,'task-a1','u-bystander','legacy null-ws on owned task'),
      ('c-b1','ws-b','task-b1','u-target','t on bystander task'),
      ('c-b2','ws-b','task-b1','u-bystander','bystander on own task');

    INSERT INTO activities (id, workspace_id, task_id, user_id, kind, payload) VALUES
      ('act-a1','ws-a','task-a1','u-target','created','{}'),
      ('act-b1','ws-b','task-b1','u-target','commented','{}'),
      ('act-b2','ws-b','task-b1','u-bystander','created','{}');

    INSERT INTO attachments (id, workspace_id, task_id, uploader_user_id, filename, stored_path, mime_type, size_bytes) VALUES
      ('att-a1','ws-a','task-a1','u-target','probe.bin','${probePath}','application/octet-stream',3),
      ('att-b1','ws-b','task-b1','u-target','tb.bin','.data/uploads/missing-b1.bin','application/octet-stream',3),
      ('att-b2','ws-b','task-b1','u-bystander','bb.bin','.data/uploads/missing-b2.bin','application/octet-stream',3);

    INSERT INTO resources (id, workspace_id, task_id, kind, provider, title, added_at, access_state, counts_against_storage) VALUES
      ('res-att-a1','ws-a','task-a1','upload','file','probe.bin',1753056000,'legacy',1),
      ('res-link-a1','ws-a','task-a1','link','url','https://example.com',1753056000,'ok',0),
      ('res-b1','ws-b','task-b1','link','figma','https://figma.com/x',1753056000,'ok',0);
    INSERT INTO resources (
      id, workspace_id, task_id, kind, provider, storage,
      storage_generation_id, stored_path, title, added_by_user_id,
      added_at, access_state, counts_against_storage
    ) VALUES
      ('res-drive-target-in-b','ws-b','task-b1','upload','drive','drive',
       'storage-target-in-b','drive-file-target','Target-owned Drive file','u-bystander',
       1756800000,'ok',0),
      ('res-drive-bystander-in-a','ws-a','task-a1','upload','drive','drive',
       'storage-bystander-in-a','drive-file-bystander','Owned-workspace Drive file','u-target',
       1756800000,'ok',0),
      ('res-signal-target-in-b','ws-b','task-b1','link','url','signal',
       NULL,NULL,'Target-added surviving-project link','u-target',
       1756800000,'ok',0);

    INSERT INTO notifications (id, workspace_id, user_id, kind, task_id, payload) VALUES
      ('n-a1','ws-a','u-target','mention','task-a1','{}'),
      ('n-tinb','ws-b','u-target','mention','task-b1','{}'),
      ('n-baboutA','ws-a','u-bystander','mention','task-a1','{}'),
      ('n-b','ws-b','u-bystander','mention','task-b1','{}');

    INSERT INTO entitlements (id, workspace_id, user_id, tier, source) VALUES
      ('e-a','ws-a','u-target','free','signup'),
      ('e-tinb','ws-b','u-target','free','signup'),
      ('e-b','ws-b','u-bystander','pro','purchase');

    INSERT INTO notification_prefs (user_id) VALUES ('u-target'),('u-bystander');
    INSERT INTO user_preferences (user_id) VALUES ('u-target'),('u-bystander');

    INSERT INTO share_links (token, workspace_id, view) VALUES
      ('tok-a','ws-a','board'),
      ('tok-b','ws-b','board');
    INSERT INTO share_link_visits (id, token) VALUES
      ('slv-a','tok-a'),
      ('slv-b','tok-b');

    INSERT INTO pending_invites (token, workspace_id, email, invited_by_user_id, accepted_by_user_id, expires_at) VALUES
      ('pi-a','ws-a','x@a.com','u-target',NULL,9999999999),
      ('pi-tinb','ws-b','y@b.com','u-target',NULL,9999999999),
      ('pi-acc','ws-b','z@b.com','u-bystander','u-target',9999999999),
      ('pi-b','ws-b','w@b.com','u-bystander',NULL,9999999999);

    INSERT INTO meta (key, value) VALUES
      ('board:ws-a:name','A board'),
      ('board:ws-a:columns','[]'),
      ('board:ws-b:name','B board'),
      ('activeDomain','wedding');

    -- Non-tenant global tables, must be untouched by erasure.
    INSERT INTO comp_codes (code, tier, duration_days, quantity) VALUES ('CODE1','pro',30,10);
    INSERT INTO processed_webhooks (event_id, event_type) VALUES ('evt_1','checkout.session.completed');
  `);
}

test("erasure removes every target row across every table, leaves the bystander intact", async () => {
  const { client, db, cleanup } = await freshFileDb();

  // A real local attachment the central storage seam must remove. The path is
  // relative to cwd (the repo root at test time) to match legacy rows.
  const probeDir = ".data/uploads/__erasure_test__";
  const probePath = `${probeDir}/probe.bin`;
  mkdirSync(probeDir, { recursive: true });
  writeFileSync(probePath, "bin");

  try {
    await seed(client, probePath);

    const revokedGrantIds: string[] = [];
    const revokedRefreshTokens: string[] = [];
    const receipt = await eraseAccountData(db, "clerk_target", {
      openProviderToken: ({ connectionId, refreshTokenCipher }) => {
        assert.equal(connectionId, "conn-target");
        assert.equal(refreshTokenCipher, "cipher-target");
        return "refresh-target";
      },
      revokeDriveFolderGrant: async (grant) => {
        assert.ok(grant.folderId.startsWith("folder-"));
        assert.ok(grant.connectionId.startsWith("conn-"));
        revokedGrantIds.push(grant.permissionId);
      },
      revokeProjectDriveRefreshToken: async (refreshToken) => {
        const retained = await client.execute(
          "SELECT refresh_token_cipher FROM provider_connections WHERE id='conn-target'",
        );
        assert.equal(retained.rows[0]!.refresh_token_cipher, "cipher-target");
        revokedRefreshTokens.push(refreshToken);
      },
    });
    assert.deepEqual(receipt.googleRefreshTokens, []);
    assert.deepEqual(revokedRefreshTokens, ["refresh-target"]);
    assert.deepEqual(revokedGrantIds.sort(), [
      "grant-bystander-a",
      "grant-bystander-b",
      "grant-operation-only",
      "grant-target",
      "grant-target-a",
    ]);

    // ── Invariant 1: ZERO residual rows for the target or ws-a ──────────
    const residual: Array<[string, string]> = [
      ["users", "users WHERE id='u-target'"],
      ["workspaces", "workspaces WHERE id='ws-a' OR owner_user_id='u-target'"],
      ["tasks", "tasks WHERE workspace_id='ws-a'"],
      ["comments", "comments WHERE user_id='u-target' OR workspace_id='ws-a' OR task_id='task-a1'"],
      ["activities", "activities WHERE user_id='u-target' OR workspace_id='ws-a' OR task_id='task-a1'"],
      ["attachments", "attachments WHERE uploader_user_id='u-target' OR workspace_id='ws-a' OR task_id='task-a1'"],
      ["resources", "resources WHERE workspace_id='ws-a'"],
      ["notifications", "notifications WHERE user_id='u-target' OR workspace_id='ws-a' OR task_id='task-a1'"],
      ["entitlements", "entitlements WHERE user_id='u-target' OR workspace_id='ws-a'"],
      ["notification_prefs", "notification_prefs WHERE user_id='u-target'"],
      ["user_preferences", "user_preferences WHERE user_id='u-target'"],
      ["share_links", "share_links WHERE workspace_id='ws-a'"],
      ["share_link_visits", "share_link_visits WHERE token='tok-a'"],
      ["pending_invites", "pending_invites WHERE workspace_id='ws-a' OR invited_by_user_id='u-target' OR accepted_by_user_id='u-target'"],
      ["workspace_members", "workspace_members WHERE user_id='u-target' OR workspace_id='ws-a'"],
      ["provider_connections", "provider_connections WHERE user_id='u-target'"],
      ["workspace_storage", "workspace_storage WHERE workspace_id='ws-a' OR connection_id='conn-target'"],
      ["drive_folder_grants", "drive_folder_grants WHERE user_id='u-target' OR workspace_id='ws-a' OR storage_generation_id='storage-target-in-b'"],
      ["project_drive_operations", "project_drive_operations WHERE workspace_id='ws-a' OR connection_id='conn-target' OR storage_generation_id='storage-target-in-b' OR subject_user_id='u-target'"],
      ["resources", "resources WHERE added_by_user_id='u-target'"],
      ["meta", "meta WHERE key LIKE 'board:ws-a:%'"],
    ];
    for (const [table, where] of residual) {
      assert.equal(
        await count(client, where),
        0,
        `residual rows left in ${table} after erasure, erasure is incomplete`,
      );
    }

    // ── Invariant 2: bystander account/product data + globals intact ───
    const survivors: Array<[string, number]> = [
      ["users", 1], // only u-bystander
      ["workspaces", 1], // only ws-b
      ["tasks", 2], // shared artifact + unrelated Notes task
      ["comments", 1], // only c-b2
      ["activities", 1], // only act-b2
      ["attachments", 1], // only att-b2
      ["resources", 1], // only res-b1 (ws-b link resource)
      ["notifications", 1], // only n-b
      ["entitlements", 1], // only e-b
      ["notification_prefs", 1],
      ["user_preferences", 1],
      ["share_links", 1], // tok-b
      ["share_link_visits", 1], // slv-b
      ["pending_invites", 1], // pi-b
      ["workspace_members", 1], // (ws-b,u-bystander)
      ["provider_connections", 1], // conn-bystander
      ["workspace_storage", 1], // unrelated bystander generation in ws-b
      ["drive_folder_grants", 0],
      ["project_drive_operations", 2], // surviving delete tombstone + unrelated bystander operation
      ["meta", 2], // board:ws-b:name + activeDomain
      ["comp_codes", 1],
      ["processed_webhooks", 1],
    ];
    for (const [table, expected] of survivors) {
      assert.equal(
        await count(client, table),
        expected,
        `${table} row count wrong after erasure (collateral deletion or leftover)`,
      );
    }
    // Spot-check identity, not just counts.
    assert.equal(await count(client, "users WHERE id='u-bystander'"), 1);
    assert.equal(await count(client, "comments WHERE id='c-b2'"), 1);
    assert.equal(
      await count(client, "provider_connections WHERE id='conn-bystander'"),
      1,
    );
    assert.equal(await count(client, "meta WHERE key='activeDomain'"), 1);
    assert.equal(
      await count(
        client,
        "project_drive_operations WHERE id='op-target-storage-project-delete'",
      ),
      1,
      "a surviving Project keeps its deletion evidence after storage-account erasure",
    );
    assert.equal(
      await count(
        client,
        "project_drive_operations WHERE id='op-bystander-only'",
      ),
      1,
      "unrelated operation evidence in a surviving Project must not be erased",
    );

    // Shared task survives, but the erased Notes account's exact wording,
    // fingerprint, and stable provenance identifier do not.
    const redacted = await client.execute(
      "SELECT source_note_id, source_note_extract_body, source_note_extract_sha256 FROM tasks WHERE id='task-b1'",
    );
    assert.equal(redacted.rows[0]!.source_note_id, null);
    assert.equal(redacted.rows[0]!.source_note_extract_body, null);
    assert.equal(redacted.rows[0]!.source_note_extract_sha256, null);

    // Clerk ids contain `_`; erasure must not treat it as a LIKE wildcard.
    const unrelated = await client.execute(
      "SELECT source_note_id, source_note_extract_body FROM tasks WHERE id='task-b2'",
    );
    assert.equal(unrelated.rows[0]!.source_note_id, "clerkXtarget:note-safe");
    assert.equal(
      unrelated.rows[0]!.source_note_extract_body,
      "Keep unrelated wording",
    );

    // ── Local attachment bytes removed through the storage seam ─────────
    assert.equal(
      existsSync(probePath),
      false,
      "the owned attachment's local bytes were not removed, GDPR gap",
    );

    // ── Idempotent: a retry after a partial failure is safe ─────────────
    await eraseAccountData(db, "clerk_target");
    assert.equal(await count(client, "users"), 1);
    assert.equal(await count(client, "comments"), 1);
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
    cleanup();
  }
});

test("erasure consumes Drive journal evidence before every RESTRICT parent", async () => {
  const { client, db, cleanup } = await freshFileDb();
  try {
    await client.execute("PRAGMA foreign_keys = ON");
    await client.executeMultiple(`
      INSERT INTO users (id, clerk_id, color, initials) VALUES
        ('u-target','clerk_target','#111','TT'),
        ('u-bystander','clerk_bystander','#222','BB');
      INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES
        ('ws-target','ws-target','Target Project','u-target');
      INSERT INTO provider_connections (
        id, user_id, provider, provider_account_id, root_folder_id,
        refresh_token_cipher, key_version, scopes, status, is_current,
        connected_at
      ) VALUES (
        'conn-target','u-target','google_drive','perm-target','root-target',
        'cipher-target',1,'["https://www.googleapis.com/auth/drive.file"]',
        'active',1,1756800000
      );
      INSERT INTO workspace_storage (
        id, workspace_id, connection_id, folder_id, folder_web_view_link,
        state, is_current
      ) VALUES (
        'storage-target','ws-target','conn-target','folder-target',
        'https://drive.test/folder-target','active',1
      );
      INSERT INTO drive_folder_grants (
        storage_generation_id, workspace_id, user_id, permission_id,
        granted_email, role, granted_at, revoke_pending
      ) VALUES (
        'storage-target','ws-target','u-bystander','permission-bystander',
        'bystander@example.test','reader',1756800000,0
      );
      INSERT INTO project_drive_operations (
        id, workspace_id, operation_kind, status, dedupe_key,
        storage_generation_id, workspace_revision, attempt_count, created_at,
        updated_at, completed_at
      ) VALUES
        ('operation-storage','ws-target','folder_rename','pending',
          '${"a".repeat(64)}','storage-target',2,0,1756800000,1756800000,NULL),
        ('operation-project','ws-target','project_delete','cancelled',
          '${"b".repeat(64)}',NULL,NULL,0,1756800000,1756800001,1756800001);
    `);

    const revoked: string[] = [];
    await eraseAccountData(db, "clerk_target", {
      openProviderToken: () => "refresh-target",
      revokeDriveFolderGrant: async (grant) => {
        revoked.push(grant.permissionId);
      },
      revokeProjectDriveRefreshToken: async () => {},
    });

    assert.deepEqual(revoked, ["permission-bystander"]);
    for (const table of [
      "project_drive_operations",
      "drive_folder_grants",
      "workspace_storage",
      "provider_connections",
      "workspaces",
    ]) {
      assert.equal(await count(client, table), 0, `${table} was not erased`);
    }
    assert.equal(await count(client, "users WHERE id='u-target'"), 0);
    assert.equal(await count(client, "users WHERE id='u-bystander'"), 1);
    assert.equal(
      (await client.execute("PRAGMA foreign_key_check")).rows.length,
      0,
      "erasure left a broken RESTRICT relationship",
    );
  } finally {
    cleanup();
  }
});

test("a private Blob locator reaches only the storage deletion seam", async () => {
  const { client, db, cleanup } = await freshFileDb();
  const blobLocator =
    "https://private-blob.example/SECRET-ACCOUNT-ERASURE-LOCATOR";
  try {
    await client.executeMultiple(`
      INSERT INTO users (id, clerk_id, color, initials) VALUES
        ('u-target','clerk_target','#111','TT');
      INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES
        ('ws-target','ws-target','Target Project','u-target');
      INSERT INTO tasks (id, workspace_id, title, lane, priority) VALUES
        ('task-target','ws-target','Target task','todo','med');
      INSERT INTO attachments (
        id, workspace_id, task_id, uploader_user_id, filename, stored_path,
        mime_type, size_bytes
      ) VALUES (
        'attachment-blob','ws-target','task-target','u-target','private.pdf',
        '${blobLocator}','application/pdf',42
      );
    `);

    const deletedLocators: string[] = [];
    const consoleOutput: string[] = [];
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };
    const captureConsole = (...values: unknown[]) => {
      consoleOutput.push(values.map(String).join(" "));
    };
    let exportedJson = "";
    try {
      console.log = captureConsole;
      console.warn = captureConsole;
      console.error = captureConsole;
      exportedJson = JSON.stringify(
        await exportAccountData(db, "clerk_target"),
      );
      await eraseAccountData(db, "clerk_target", {
        deleteStoredBytes: async (storedPath) => {
          deletedLocators.push(storedPath);
        },
      });
    } finally {
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
    }

    assert.equal(exportedJson.includes(blobLocator), false);
    assert.deepEqual(deletedLocators, [blobLocator]);
    assert.equal(
      consoleOutput.some((entry) => entry.includes(blobLocator)),
      false,
      "private storage locators must never be logged",
    );
    assert.equal(await count(client, "attachments"), 0);
    assert.equal(await count(client, "users"), 0);
  } finally {
    cleanup();
  }
});

test("erasing an unknown user is a no-op (no throw, no writes)", async () => {
  const { client, db, cleanup } = await freshFileDb();
  try {
    await client.execute(
      "INSERT INTO users (id, clerk_id, color, initials) VALUES ('u-x','clerk_x','#1','XX')",
    );
    await eraseAccountData(db, "clerk_does_not_exist");
    assert.equal(await count(client, "users"), 1);
  } finally {
    cleanup();
  }
});

test("Project Drive token revocation fails closed with encrypted retry custody", async () => {
  const { client, db, cleanup } = await freshFileDb();
  try {
    await client.executeMultiple(`
      INSERT INTO users (id, clerk_id, color, initials) VALUES
        ('u-target','clerk_target','#111','TT');
      INSERT INTO provider_connections (
        id, user_id, provider, provider_account_id, root_folder_id,
        refresh_token_cipher, key_version, scopes, status, is_current,
        connected_at
      ) VALUES (
        'conn-target','u-target','google_drive','perm-target','root-target',
        'cipher-target',1,'["https://www.googleapis.com/auth/drive.file"]',
        'active',1,1756800000
      );
    `);

    const openProviderToken = () => "refresh-target";
    await assert.rejects(
      eraseAccountData(db, "clerk_target", { openProviderToken }),
      /Project Drive credential revocation is not configured/,
    );
    assert.equal(
      await count(
        client,
        "provider_connections WHERE id='conn-target' AND refresh_token_cipher='cipher-target'",
      ),
      1,
      "missing revocation wiring must preserve the encrypted credential",
    );

    let revokeAttempts = 0;
    await assert.rejects(
      eraseAccountData(db, "clerk_target", {
        openProviderToken,
        revokeProjectDriveRefreshToken: async (refreshToken) => {
          revokeAttempts += 1;
          assert.equal(refreshToken, "refresh-target");
          throw new Error("provider timeout");
        },
      }),
      /provider timeout/,
    );
    assert.equal(revokeAttempts, 1);
    assert.equal(await count(client, "users WHERE id='u-target'"), 1);
    assert.equal(
      await count(
        client,
        "provider_connections WHERE id='conn-target' AND refresh_token_cipher='cipher-target'",
      ),
      1,
      "ambiguous provider failure must retain ciphertext for a retry",
    );
    assert.equal(
      await count(
        client,
        "meta WHERE key='google-drive:account-erasure:user:u-target'",
      ),
      1,
      "the executor fence must remain active while revocation is retriable",
    );

    await eraseAccountData(db, "clerk_target", {
      openProviderToken,
      revokeProjectDriveRefreshToken: async (refreshToken) => {
        revokeAttempts += 1;
        assert.equal(refreshToken, "refresh-target");
        assert.equal(
          await count(client, "provider_connections WHERE id='conn-target'"),
          1,
          "ciphertext custody must exist until idempotent revocation succeeds",
        );
        // A resolved call also represents Google's `invalid_token` response:
        // expired/already-revoked is the desired provider postcondition.
      },
    });

    assert.equal(revokeAttempts, 2);
    assert.equal(await count(client, "provider_connections"), 0);
    assert.equal(await count(client, "users"), 0);
    assert.equal(
      await count(
        client,
        "meta WHERE key='google-drive:account-erasure:user:u-target'",
      ),
      0,
    );
  } finally {
    cleanup();
  }
});

test("erasure retains every attempted Drive grant, including cancelled work, until its exact permission is known", async () => {
  const { client, db, cleanup } = await freshFileDb();
  try {
    await client.executeMultiple(`
      INSERT INTO users (id, clerk_id, color, initials) VALUES
        ('u-target','clerk_target','#111','TT'),
        ('u-owner','clerk_owner','#222','OO');
      INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES
        ('ws-owner','ws-owner','Owner Project','u-owner');
      INSERT INTO provider_connections (
        id, user_id, provider, provider_account_id, root_folder_id,
        refresh_token_cipher, key_version, scopes, status, is_current,
        connected_at
      ) VALUES (
        'conn-owner','u-owner','google_drive','perm-owner','root-owner',
        'cipher-owner',1,'["https://www.googleapis.com/auth/drive.file"]',
        'active',1,1756800000
      );
      INSERT INTO workspace_storage (
        id, workspace_id, connection_id, folder_id, folder_web_view_link,
        state, is_current
      ) VALUES (
        'storage-owner','ws-owner','conn-owner','folder-owner',
        'https://drive.test/folder-owner','active',1
      );
      INSERT INTO project_drive_operations (
        id, workspace_id, operation_kind, status, dedupe_key,
        storage_generation_id, subject_user_id, grantee_email, grant_role,
        attempt_count, last_attempt_at, next_attempt_at, last_error_code,
        created_at, updated_at, completed_at
      ) VALUES
        ('operation-ambiguous','ws-owner','grant_create','manual_attention',
         '${"7".repeat(64)}','storage-owner','u-target','target@example.test',
         'writer',1,1756800001,NULL,'ambiguous_provider_result',1756800000,
         1756800001,NULL),
        ('operation-attempted-pending','ws-owner','grant_create','pending',
         '${"8".repeat(64)}','storage-owner','u-target','target@example.test',
         'reader',1,1756800001,NULL,'network_error',1756800000,1756800001,
         NULL),
        ('operation-retry-wait','ws-owner','grant_create','retry_wait',
         '${"9".repeat(64)}','storage-owner','u-target','target@example.test',
         'reader',1,1756800001,2756800001,'network_error',1756800000,
         1756800001,NULL),
        ('operation-attempted-cancelled','ws-owner','grant_create','cancelled',
         '${"0".repeat(64)}','storage-owner','u-target','target@example.test',
         'reader',1,1756800001,NULL,'network_error',1756800000,
         1756800001,1756800001);
    `);

    let revokeCalls = 0;
    await assert.rejects(
      eraseAccountData(db, "clerk_target", {
        revokeDriveFolderGrant: async () => {
          revokeCalls += 1;
        },
      }),
      /attempted Project Drive grant has no exact permission receipt/,
    );
    assert.equal(
      revokeCalls,
      0,
      "an unknown permission must never be guessed at the provider",
    );
    assert.equal(await count(client, "users WHERE id='u-target'"), 1);
    assert.equal(
      await count(
        client,
        "project_drive_operations WHERE id IN ('operation-ambiguous','operation-attempted-pending','operation-retry-wait') AND status='manual_attention'",
      ),
      3,
      "ambiguous repair evidence must survive until the exact permission is recovered",
    );
    assert.equal(
      await count(
        client,
        "project_drive_operations WHERE id='operation-attempted-cancelled' AND status='cancelled' AND attempt_count=1 AND provider_permission_id IS NULL",
      ),
      1,
      "attempted cancelled work is still ambiguous and must retain its evidence",
    );
    assert.equal(
      await count(
        client,
        "meta WHERE key='google-drive:account-erasure:user:u-target'",
      ),
      1,
      "a failed erasure must keep its durable executor fence",
    );
    assert.equal(
      await count(client, "workspace_storage WHERE id='storage-owner'"),
      1,
    );
    assert.equal(
      await count(client, "provider_connections WHERE id='conn-owner'"),
      1,
    );
  } finally {
    cleanup();
  }
});

test("the account fence wins a retry-wait claim race and retains evidence for recovery", async () => {
  const { client, db, cleanup } = await freshFileDb();
  try {
    await client.execute("PRAGMA foreign_keys = ON");
    await client.executeMultiple(`
      INSERT INTO users (id, clerk_id, color, initials) VALUES
        ('u-target','clerk_target','#111','TT'),
        ('u-bystander','clerk_bystander','#222','BB');
      INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES
        ('ws-target','ws-target','Target Project','u-target');
      INSERT INTO provider_connections (
        id, user_id, provider, provider_account_id, root_folder_id,
        refresh_token_cipher, key_version, scopes, status, is_current,
        connected_at
      ) VALUES (
        'conn-target','u-target','google_drive','perm-target','root-target',
        'cipher-target',1,'["https://www.googleapis.com/auth/drive.file"]',
        'active',1,1756800000
      );
      INSERT INTO workspace_storage (
        id, workspace_id, connection_id, folder_id, folder_web_view_link,
        state, is_current
      ) VALUES (
        'storage-target','ws-target','conn-target','folder-target',
        'https://drive.test/folder-target','active',1
      );
      INSERT INTO drive_folder_grants (
        storage_generation_id, workspace_id, user_id, permission_id,
        granted_email, role, granted_at, revoke_pending
      ) VALUES (
        'storage-target','ws-target','u-bystander','permission-bystander',
        'bystander@example.test','reader',1756800000,0
      );
      INSERT INTO project_drive_operations (
        id, workspace_id, operation_kind, status, dedupe_key,
        storage_generation_id, workspace_revision, attempt_count,
        last_attempt_at, next_attempt_at, last_error_code, created_at,
        updated_at
      ) VALUES (
        'operation-retry','ws-target','folder_rename','retry_wait',
        '${"c".repeat(64)}','storage-target',2,1,1756800001,2756800001,
        'network_error',1756800000,1756800001
      );
    `);

    await assert.rejects(
      eraseAccountData(db, "clerk_target", {
        openProviderToken: () => "refresh-target",
      }),
      /provider truth requires recovery/,
    );
    const fenced = await client.execute(
      "SELECT status, next_attempt_at FROM project_drive_operations WHERE id='operation-retry'",
    );
    assert.equal(fenced.rows[0]!.status, "manual_attention");
    assert.equal(fenced.rows[0]!.next_attempt_at, null);
    assert.equal(
      await count(
        client,
        "meta WHERE key='google-drive:account-erasure:user:u-target'",
      ),
      1,
    );

    // The worker's real contract is an atomic SQL status CAS plus the
    // account-fence check. It must lose once the erasure transaction wins.
    const claim = await client.execute(`
      UPDATE project_drive_operations
      SET status='running', attempt_count=attempt_count+1,
          last_attempt_at=unixepoch(), lease_expires_at=unixepoch()+60,
          next_attempt_at=NULL, updated_at=unixepoch()
      WHERE id='operation-retry'
        AND status IN ('pending','retry_wait','running')
        AND NOT EXISTS (
          SELECT 1 FROM meta
          WHERE key='google-drive:account-erasure:user:u-target'
        )
    `);
    const claimRowsAffected = claim.rowsAffected;

    assert.equal(claimRowsAffected, 0);
    assert.equal(await count(client, "project_drive_operations"), 1);
    assert.equal(await count(client, "users WHERE id='u-target'"), 1);
    assert.equal(
      await count(
        client,
        "meta WHERE key='google-drive:account-erasure:user:u-target'",
      ),
      1,
      "incomplete recovery must retain the fence and journal evidence",
    );
    assert.equal(
      (await client.execute("PRAGMA foreign_key_check")).rows.length,
      0,
    );
  } finally {
    cleanup();
  }
});

test("erasure retains exact Drive grant receipts until WP5 revocation succeeds", async () => {
  const { client, db, cleanup } = await freshFileDb();
  try {
    await client.executeMultiple(`
      INSERT INTO users (id, clerk_id, color, initials) VALUES
        ('u-target','clerk_target','#111','TT'),
        ('u-owner','clerk_owner','#222','OO');
      INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES
        ('ws-owner','ws-owner','Owner Project','u-owner');
      INSERT INTO provider_connections (
        id, user_id, provider, provider_account_id, root_folder_id,
        refresh_token_cipher, key_version, scopes, status, is_current,
        connected_at
      ) VALUES (
        'conn-owner','u-owner','google_drive','perm-owner','root-owner',
        'cipher-owner',1,'["https://www.googleapis.com/auth/drive.file"]',
        'active',1,1756800000
      );
      INSERT INTO workspace_storage (
        id, workspace_id, connection_id, folder_id, folder_web_view_link,
        state, is_current
      ) VALUES (
        'storage-owner','ws-owner','conn-owner','folder-owner',
        'https://drive.test/folder-owner','active',1
      );
      INSERT INTO drive_folder_grants (
        storage_generation_id, workspace_id, user_id, permission_id,
        granted_email, role, granted_at, revoke_pending
      ) VALUES (
        'storage-owner','ws-owner','u-target','permission-target',
        'target@example.test','writer',1756800000,0
      );
      INSERT INTO project_drive_operations (
        id, workspace_id, operation_kind, status, dedupe_key,
        storage_generation_id, subject_user_id, grantee_email, grant_role,
        provider_permission_id, attempt_count, last_attempt_at, created_at,
        updated_at, completed_at
      ) VALUES (
        'operation-target','ws-owner','grant_create','succeeded',
        '${"6".repeat(64)}','storage-owner','u-target','target@example.test',
        'writer','permission-target',1,1756800001,1756800000,1756800001,
        1756800001
      );
    `);

    await assert.rejects(
      eraseAccountData(db, "clerk_target"),
      /Drive grant revocation is not configured/,
    );
    assert.equal(await count(client, "users WHERE id='u-target'"), 1);
    assert.equal(
      await count(
        client,
        "drive_folder_grants WHERE permission_id='permission-target'",
      ),
      1,
      "the only exact provider-revocation receipt must survive",
    );
    assert.equal(
      await count(
        client,
        "project_drive_operations WHERE id='operation-target'",
      ),
      1,
      "journal evidence must survive while no exact revoker is configured",
    );

    await assert.rejects(
      eraseAccountData(db, "clerk_target", {
        revokeDriveFolderGrant: async () => {
          throw new Error("provider unavailable");
        },
      }),
      /provider unavailable/,
    );
    assert.equal(await count(client, "users WHERE id='u-target'"), 1);
    assert.equal(
      await count(
        client,
        "drive_folder_grants WHERE permission_id='permission-target'",
      ),
      1,
    );
    assert.equal(
      await count(
        client,
        "project_drive_operations WHERE id='operation-target'",
      ),
      1,
      "a failed provider call must retain every receipt for an idempotent retry",
    );

    const retriedPermissions: string[] = [];
    await eraseAccountData(db, "clerk_target", {
      revokeDriveFolderGrant: async (grant) => {
        retriedPermissions.push(grant.permissionId);
      },
    });
    assert.deepEqual(
      retriedPermissions,
      ["permission-target"],
      "the same exact receipt in the journal and revoke queue must be called once",
    );
    assert.equal(await count(client, "users WHERE id='u-target'"), 0);
    assert.equal(
      await count(
        client,
        "drive_folder_grants WHERE permission_id='permission-target'",
      ),
      0,
    );
    assert.equal(
      await count(
        client,
        "project_drive_operations WHERE id='operation-target'",
      ),
      0,
    );
  } finally {
    cleanup();
  }
});

async function seedPendingDelegatedErasureReceipt(
  client: Client,
  accountScope: "actor" | "storage-owner",
) {
  const actorUserId = accountScope === "actor" ? "u-target" : "u-actor";
  const storageOwnerUserId =
    accountScope === "storage-owner" ? "u-target" : "u-storage-owner";
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials) VALUES
      ('u-target','clerk_target','#111','TT'),
      ('u-actor','clerk_actor','#222','AA'),
      ('u-storage-owner','clerk_storage_owner','#333','SO'),
      ('u-project-owner','clerk_project_owner','#444','PO');
    INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES
      ('ws-shared','ws-shared','Shared','u-project-owner');
    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      ('ws-shared','u-project-owner','owner'),
      ('ws-shared','${actorUserId}','member'),
      ('ws-shared','${storageOwnerUserId}','member');
    INSERT INTO provider_connections (
      id, user_id, provider, provider_account_id, root_folder_id,
      refresh_token_cipher, key_version, scopes, status, is_current,
      connected_at
    ) VALUES (
      'conn-storage','${storageOwnerUserId}','google_drive','perm-storage',
      'root-storage','cipher-storage',1,
      '["https://www.googleapis.com/auth/drive.file"]','active',1,100
    );
    INSERT INTO workspace_storage (
      id, workspace_id, connection_id, folder_id, folder_web_view_link,
      state, is_current
    ) VALUES (
      'storage-shared','ws-shared','conn-storage','folder-shared',
      'https://drive.test/folder-shared','active',1
    );
    INSERT INTO tasks (
      id, workspace_id, title, lane, priority, assignees, created_at, updated_at
    ) VALUES (
      'task-shared','ws-shared','Shared task','todo','medium','[]',100,100
    );
    INSERT INTO resources (
      id, workspace_id, task_id, kind, provider, storage,
      storage_generation_id, stored_path, title, mime_type, size_bytes,
      added_by_user_id, added_at, refreshed_at, access_state,
      counts_against_storage
    ) VALUES (
      'a0000000-0000-4000-8000-000000000001','ws-shared','task-shared',
      'upload','drive','drive','storage-shared','sealed-session-evidence',
      'brief.pdf','application/pdf',1024,'${actorUserId}',100,110,
      'pending',0
    );
  `);
}

test("account erasure fences delegated receipts for both actor and immutable storage-owner lineages", async () => {
  for (const accountScope of ["actor", "storage-owner"] as const) {
    const { client, db, cleanup } = await freshFileDb();
    try {
      await seedPendingDelegatedErasureReceipt(client, accountScope);
      const seen: Array<{ accountUserId: string; receipt: unknown }> = [];
      await assert.rejects(
        eraseAccountData(db, "clerk_target", {
          openProviderToken: () => "refresh-storage",
          recoverPendingDelegatedDriveUpload: async (
            accountUserId,
            receipt,
          ) => {
            seen.push({ accountUserId, receipt });
            return { outcome: "blocked" };
          },
        }),
        /delegated Drive upload provider truth is unresolved/,
      );
      assert.equal(seen.length, 1);
      assert.equal(seen[0]?.accountUserId, "u-target");
      assert.equal(
        (seen[0]?.receipt as { resourceId: string }).resourceId,
        "a0000000-0000-4000-8000-000000000001",
      );
      assert.equal(
        await count(
          client,
          "resources WHERE stored_path='sealed-session-evidence' AND access_state='pending'",
        ),
        1,
      );
      assert.equal(await count(client, "users WHERE id='u-target'"), 1);
      assert.equal(
        await count(
          client,
          "meta WHERE key='google-drive:account-erasure:user:u-target'",
        ),
        1,
      );
    } finally {
      cleanup();
    }
  }
});

test("account erasure re-reads recovery truth and ignores finalized, undelegated, and unrelated receipts", async () => {
  const { client, db, cleanup } = await freshFileDb();
  try {
    await seedPendingDelegatedErasureReceipt(client, "actor");
    await client.executeMultiple(`
      INSERT INTO resources (
        id, workspace_id, task_id, kind, provider, storage,
        storage_generation_id, stored_path, external_id, title, url,
        mime_type, size_bytes, added_by_user_id, added_at, refreshed_at,
        access_state, counts_against_storage
      ) VALUES
        ('b0000000-0000-4000-8000-000000000002','ws-shared','task-shared',
         'upload','drive','drive','storage-shared',NULL,'drive-final',
         'final.pdf','https://drive.google.com/file/d/drive-final/view',
         'application/pdf',1024,'u-target',100,110,'ok',0),
        ('c0000000-0000-4000-8000-000000000003','ws-shared','task-shared',
         'upload','drive','drive','storage-shared',NULL,NULL,'minting.pdf',NULL,
         'application/pdf',1024,'u-target',100,110,'pending',0),
        ('d0000000-0000-4000-8000-000000000004','ws-shared','task-shared',
         'upload','drive','drive','storage-shared','unrelated-session',NULL,
         'other.pdf',NULL,'application/pdf',1024,'u-actor',100,110,'pending',0);
    `);

    let calls = 0;
    await assert.rejects(
      eraseAccountData(db, "clerk_target", {
        recoverPendingDelegatedDriveUpload: async () => {
          calls += 1;
          // Claiming success without changing the exact row cannot make
          // erasure consume the evidence.
          return { outcome: "resolved" };
        },
      }),
      /delegated Drive upload receipt remains/,
    );
    assert.equal(calls, 1);
    assert.equal(
      await count(
        client,
        "resources WHERE id='a0000000-0000-4000-8000-000000000001'",
      ),
      1,
    );

    const recoveredIds: string[] = [];
    await eraseAccountData(db, "clerk_target", {
      recoverPendingDelegatedDriveUpload: async (_accountUserId, receipt) => {
        recoveredIds.push(receipt.resourceId);
        await db
          .delete(resources)
          .where(eq(resources.id, receipt.resourceId));
        return { outcome: "resolved" };
      },
    });
    assert.deepEqual(recoveredIds, [
      "a0000000-0000-4000-8000-000000000001",
    ]);
    assert.equal(await count(client, "users WHERE id='u-target'"), 0);
    assert.equal(
      await count(
        client,
        "resources WHERE id='d0000000-0000-4000-8000-000000000004' AND stored_path='unrelated-session'",
      ),
      1,
      "a receipt outside both erased account lineages must survive untouched",
    );
  } finally {
    cleanup();
  }
});
