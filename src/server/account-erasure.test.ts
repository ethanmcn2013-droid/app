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
 *      the target's tasks, keeps every one of their own rows. Global,
 *      non-tenant tables (comp_codes, processed_webhooks, …) are untouched.
 *
 * Plus: the on-disk attachment binary is unlinked (a real probe file is
 * created and asserted gone), erasure is idempotent, and erasing an
 * unknown user is a no-op.
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
import { eraseAccountData } from "./account-erasure";
import { freshMemoryDb as freshDb } from "./db/memory-test-db";

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

    INSERT INTO tasks (
      id, workspace_id, title, lane, priority,
      source_note_id, source_note_extract_body, source_note_extract_sha256
    ) VALUES
      ('task-a1','ws-a','A task','todo','med',NULL,NULL,NULL),
      ('task-b1','ws-b','B task','todo','med','clerk_target:note-shared','Exact private wording','${"a".repeat(64)}'),
      ('task-b2','ws-b','Unrelated note task','todo','med','clerkXtarget:note-safe','Keep unrelated wording','${"b".repeat(64)}');

    INSERT INTO task_discussion_state (task_id,workspace_id,next_create_seq,next_change_seq) VALUES
      ('task-a1','ws-a',3,3), ('task-b1','ws-b',3,3);
    INSERT INTO comments (id, workspace_id, task_id, user_id, body, client_request_id, request_hash, revision, create_seq) VALUES
      ('c-a1','ws-a','task-a1','u-target','t on own','request_erasure_a1','hash-a1',1,1),
      ('c-a1-null','ws-a','task-a1','u-bystander','validated legacy on owned task','request_erasure_a2','hash-a2',1,2),
      ('c-b1','ws-b','task-b1','u-target','t on bystander task','request_erasure_b1','hash-b1',1,1),
      ('c-b2','ws-b','task-b1','u-bystander','bystander on own task','request_erasure_b2','hash-b2',1,2);

    INSERT INTO task_comment_changes(task_id,change_seq,kind,comment_id,revision,audience_epoch,happened_at_ms) VALUES
      ('task-a1',1,'create','c-a1',1,1,1000), ('task-a1',2,'create','c-a1-null',1,1,2000),
      ('task-b1',1,'create','c-b1',1,1,1000), ('task-b1',2,'create','c-b2',1,1,2000);
    INSERT INTO task_comment_receipts(task_id,actor_id,client_request_id,operation,payload_hash,comment_id,create_seq,change_seq,revision,committed_at_ms) VALUES
      ('task-a1','u-target','request_erasure_a1','send','hash-a1','c-a1',1,1,1,1000),
      ('task-a1','u-bystander','request_erasure_a2','send','hash-a2','c-a1-null',2,2,1,2000),
      ('task-b1','u-target','request_erasure_b1','send','hash-b1','c-b1',1,1,1,1000),
      ('task-b1','u-bystander','request_erasure_b2','send','hash-b2','c-b2',2,2,1,2000);
    INSERT INTO task_comment_attention(id,event_id,task_id,workspace_id,recipient_id,comment_id,source_revision,root_id,create_seq,reason_bits) VALUES
      ('attn-b1','event-b1','task-b1','ws-b','u-bystander','c-b1',1,NULL,1,1),
      ('attn-b2','event-b2','task-b1','ws-b','u-target','c-b2',1,NULL,2,1);
    INSERT INTO task_comment_outbox(id,event_id,task_id,workspace_id,recipient_id,comment_id,source_revision,audience_epoch,state,created_at_ms) VALUES
      ('out-b1','out-event-b1','task-b1','ws-b','u-bystander','c-b1',1,1,'pending',1000),
      ('out-b2','out-event-b2','task-b1','ws-b','u-target','c-b2',1,1,'pending',2000);

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
  const { client, db } = await freshDb();

  // A real on-disk attachment binary the erasure must unlink. Path is
  // relative to cwd (the repo root at test time) to match production.
  const probeDir = ".data/uploads/__erasure_test__";
  const probePath = `${probeDir}/probe.bin`;
  mkdirSync(probeDir, { recursive: true });
  writeFileSync(probePath, "bin");

  try {
    await seed(client, probePath);

    await eraseAccountData(db, "clerk_target");

    // ── Invariant 1: ZERO residual rows for the target or ws-a ──────────
    const residual: Array<[string, string]> = [
      ["users", "users WHERE id='u-target'"],
      ["workspaces", "workspaces WHERE id='ws-a' OR owner_user_id='u-target'"],
      ["tasks", "tasks WHERE workspace_id='ws-a'"],
      ["comments", "comments WHERE user_id='u-target' OR workspace_id='ws-a' OR task_id='task-a1'"],
      ["task_discussion_state", "task_discussion_state WHERE workspace_id='ws-a' OR task_id='task-a1'"],
      ["task_comment_changes", "task_comment_changes WHERE task_id='task-a1' OR comment_id='c-b1'"],
      ["task_comment_receipts", "task_comment_receipts WHERE actor_id='u-target' OR task_id='task-a1' OR comment_id='c-b1'"],
      ["task_comment_attention", "task_comment_attention WHERE recipient_id='u-target' OR workspace_id='ws-a' OR comment_id='c-b1'"],
      ["task_comment_outbox", "task_comment_outbox WHERE recipient_id='u-target' OR workspace_id='ws-a' OR comment_id='c-b1'"],
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
      ["meta", "meta WHERE key LIKE 'board:ws-a:%'"],
    ];
    for (const [table, where] of residual) {
      assert.equal(
        await count(client, where),
        0,
        `residual rows left in ${table} after erasure, erasure is incomplete`,
      );
    }

    // ── Invariant 2: bystander + globals fully intact ───────────────────
    const survivors: Array<[string, number]> = [
      ["users", 1], // only u-bystander
      ["workspaces", 1], // only ws-b
      ["tasks", 2], // shared artifact + unrelated Notes task
      ["comments", 1], // only c-b2
      ["task_discussion_state", 1], // task-b1 remains
      ["task_comment_changes", 2], // c-b2 create + audience delta for erased member
      ["task_comment_receipts", 1], // only c-b2 send receipt remains
      ["task_comment_attention", 0],
      ["task_comment_outbox", 0],
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
    assert.equal(await count(client, "meta WHERE key='activeDomain'"), 1);

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

    // ── On-disk attachment binary unlinked ──────────────────────────────
    assert.equal(
      existsSync(probePath),
      false,
      "the owned attachment's on-disk binary was not unlinked, GDPR gap",
    );

    // ── Idempotent: a retry after a partial failure is safe ─────────────
    await eraseAccountData(db, "clerk_target");
    assert.equal(await count(client, "users"), 1);
    assert.equal(await count(client, "comments"), 1);
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
    client.close();
  }
});

test("erasing an unknown user is a no-op (no throw, no writes)", async () => {
  const { client, db } = await freshDb();
  try {
    await client.execute(
      "INSERT INTO users (id, clerk_id, color, initials) VALUES ('u-x','clerk_x','#1','XX')",
    );
    await eraseAccountData(db, "clerk_does_not_exist");
    assert.equal(await count(client, "users"), 1);
  } finally {
    client.close();
  }
});
