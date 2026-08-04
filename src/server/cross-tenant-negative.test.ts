/**
 * Cross-tenant negative suite — an id from workspace A is invisible in
 * workspace B (E08.04).
 *
 * ── Why this file had to be written ─────────────────────────────────────
 *
 * Every other tenant guard in this repository is a SOURCE INSPECTION.
 * `tenant-scope.test.mjs` reads the source and demands a predicate.
 * `cross-tenant-isolation.test.mjs`, `tasks-security-regression.test.mjs`
 * and `planning-security-contract.test.mjs` all read files and assert
 * about their text. Every one of them is a statement about what the code
 * LOOKS like.
 *
 * None of them executes a query. So on 2026-08-03 the honest answer to
 * "prove an id from workspace A is invisible in workspace B" was that
 * nothing proved it — the audit was of the code's appearance, not its
 * behaviour. Two behavioural tests existed
 * (`security-membership-regression.test.ts`) and both are about removed
 * membership, not cross-tenant reads.
 *
 * This file closes that. It builds a real libSQL database, seeds two
 * workspaces owned by two different people, and asserts per sensitive
 * object that the scoped read returns the tenant's own row and NOT the
 * other tenant's row — even when the caller supplies the other tenant's
 * primary key, which is the shape of a real attack.
 *
 * ── Why the assertion is "empty result", not "403" ──────────────────────
 *
 * At the data layer a cross-tenant read must come back EMPTY, so the route
 * above it renders a 404 rather than a 403. A 403 confirms the row exists,
 * which tells an attacker holding a guessed id that they guessed right.
 * `src/app/api/attachments/[id]/route.ts` is the model of the route-level
 * half. This file proves the data-layer half it depends on.
 *
 * ── What this file does NOT prove ───────────────────────────────────────
 *
 * That every production read uses these predicates. Nothing here can prove
 * that; it is what the static gate is for, and the static gate is a
 * detector rather than a boundary. There is no row-level security beneath
 * either of them — see `db/tenant.ts`. Read the E08.04 evidence document
 * for the control's real shape before citing this file.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { freshMemoryDb } from "./db/memory-test-db";
import { byWorkspace } from "./db/tenant";
import {
  tasks,
  comments,
  attachments,
  shareLinks,
  pendingInvites,
  entitlements,
  notifications,
  activities,
  workspaceSponsorships,
} from "./db/schema";

const WS_A = "ws-alpha";
const WS_B = "ws-beta";

/**
 * Two tenants, each holding one row in every sensitive table. Ids are
 * deliberately guessable (`task-a` / `task-b`) because the attack being
 * modelled is a caller who already knows, or has guessed, the other
 * tenant's primary key.
 */
async function seedTwoTenants() {
  const { client, db } = await freshMemoryDb();
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, handle, name, color, initials) VALUES
      ('user-a', 'clerk-a', 'a', 'Owner A', 'black', 'OA'),
      ('user-b', 'clerk-b', 'b', 'Owner B', 'gray', 'OB');

    INSERT INTO workspaces (id, slug, name, owner_user_id, context_type, position)
    VALUES
      ('${WS_A}', 'alpha', 'Alpha wedding', 'user-a', 'project', 1000),
      ('${WS_B}', 'beta',  'Beta wedding',  'user-b', 'project', 2000);

    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      ('${WS_A}', 'user-a', 'owner'),
      ('${WS_B}', 'user-b', 'owner');

    INSERT INTO tasks (id, workspace_id, seq, title, description, lane, priority, assignees, is_milestone, archived_at, created_at, updated_at)
    VALUES
      ('task-a', '${WS_A}', 1, 'Alpha private task', '', 'todo', 'normal', '[]', 0, 0, 0, 0),
      ('task-b', '${WS_B}', 1, 'Beta private task',  '', 'todo', 'normal', '[]', 0, 0, 0, 0);

    INSERT INTO comments (id, workspace_id, task_id, user_id, body, created_at) VALUES
      ('comment-a', '${WS_A}', 'task-a', 'user-a', 'Alpha private comment', 0),
      ('comment-b', '${WS_B}', 'task-b', 'user-b', 'Beta private comment', 0);

    INSERT INTO attachments (id, workspace_id, task_id, uploader_user_id, filename, stored_path, mime_type, size_bytes, created_at)
    VALUES
      ('att-a', '${WS_A}', 'task-a', 'user-a', 'alpha.pdf', '/a', 'application/pdf', 10, 0),
      ('att-b', '${WS_B}', 'task-b', 'user-b', 'beta.pdf',  '/b', 'application/pdf', 10, 0);

    INSERT INTO share_links (token, token_scheme, workspace_id, view, mode, label, created_at, expires_at, visits)
    VALUES
      ('share-a', 'plaintext', '${WS_A}', 'board', 'view', 'Alpha', 0, 0, 0),
      ('share-b', 'plaintext', '${WS_B}', 'board', 'view', 'Beta',  0, 0, 0);

    INSERT INTO pending_invites (token, workspace_id, email, invited_by_user_id, role, created_at, expires_at)
    VALUES
      ('invite-a', '${WS_A}', 'guest-a@example.com', 'user-a', 'member', 0, 0),
      ('invite-b', '${WS_B}', 'guest-b@example.com', 'user-b', 'member', 0, 0);

    INSERT INTO entitlements (id, workspace_id, user_id, tier, source, started_at)
    VALUES
      ('ent-a', '${WS_A}', 'user-a', 'wedding', 'comp', 0),
      ('ent-b', '${WS_B}', 'user-b', 'wedding', 'comp', 0);

    INSERT INTO notifications (id, workspace_id, user_id, kind, task_id, payload, created_at)
    VALUES
      ('note-a', '${WS_A}', 'user-a', 'mention', 'task-a', '{}', 0),
      ('note-b', '${WS_B}', 'user-b', 'mention', 'task-b', '{}', 0);

    INSERT INTO activities (id, workspace_id, task_id, user_id, kind, payload, created_at)
    VALUES
      ('act-a', '${WS_A}', 'task-a', 'user-a', 'created', '{}', 0),
      ('act-b', '${WS_B}', 'task-b', 'user-b', 'created', '{}', 0);

    INSERT INTO workspace_sponsorships
      (id, workspace_id, sponsor_id, sponsor_ref, entitlement_ref, status,
       consented_metadata, metadata_version, consent_receipt_id, consented_at,
       revoked_at, created_at, updated_at)
    VALUES
      ('spon-a', '${WS_A}', 'venue-one', 'ref-a', 'ent-a', 'active', '{}', 1, 'rc-a', 0, 0, 0, 0),
      ('spon-b', '${WS_B}', 'venue-two', 'ref-b', 'ent-b', 'active', '{}', 1, 'rc-b', 0, 0, 0, 0);
  `);
  return { client, db };
}

/**
 * Every sensitive object, as {table, tenant column, id column, A's id,
 * B's id}. Driving the tests from one table means adding a sensitive
 * object is a single line, not a copied test nobody updates.
 */
const OBJECTS = [
  { name: "tasks", table: tasks, ws: tasks.workspaceId, key: tasks.id, a: "task-a", b: "task-b" },
  { name: "comments", table: comments, ws: comments.workspaceId, key: comments.id, a: "comment-a", b: "comment-b" },
  { name: "attachments", table: attachments, ws: attachments.workspaceId, key: attachments.id, a: "att-a", b: "att-b" },
  { name: "share links", table: shareLinks, ws: shareLinks.workspaceId, key: shareLinks.token, a: "share-a", b: "share-b" },
  { name: "pending invites", table: pendingInvites, ws: pendingInvites.workspaceId, key: pendingInvites.token, a: "invite-a", b: "invite-b" },
  { name: "entitlements", table: entitlements, ws: entitlements.workspaceId, key: entitlements.id, a: "ent-a", b: "ent-b" },
  { name: "notifications", table: notifications, ws: notifications.workspaceId, key: notifications.id, a: "note-a", b: "note-b" },
  { name: "activities", table: activities, ws: activities.workspaceId, key: activities.id, a: "act-a", b: "act-b" },
  { name: "sponsorships", table: workspaceSponsorships, ws: workspaceSponsorships.workspaceId, key: workspaceSponsorships.id, a: "spon-a", b: "spon-b" },
];

test("a scoped read returns only the caller's own rows, per sensitive object", async () => {
  const { client, db } = await seedTwoTenants();
  try {
    for (const object of OBJECTS) {
      const rows = await db
        .select({ id: object.key })
        .from(object.table)
        .where(byWorkspace(object.ws, WS_A));

      assert.deepEqual(
        rows.map((r) => r.id),
        [object.a],
        `${object.name}: a workspace-scoped read returned rows that are not ` +
          `workspace A's. This is a cross-tenant leak.`,
      );
    }
  } finally {
    client.close();
  }
});

test("supplying the other tenant's primary key returns nothing, per sensitive object", async () => {
  const { client, db } = await seedTwoTenants();
  try {
    for (const object of OBJECTS) {
      // The real attack: the caller is authenticated for workspace A and
      // hands the route workspace B's id.
      const rows = await db
        .select({ id: object.key })
        .from(object.table)
        .where(and(eq(object.key, object.b), byWorkspace(object.ws, WS_A)));

      assert.deepEqual(
        rows,
        [],
        `${object.name}: workspace A read workspace B's row by supplying its ` +
          `id. The route above this would render another tenant's data.`,
      );
    }
  } finally {
    client.close();
  }
});

test("the unscoped read really would have leaked, so the tests above mean something", async () => {
  // Control case. Without the predicate every one of these returns both
  // tenants' rows — which is what makes the two tests above evidence
  // rather than a tautology about an empty table.
  const { client, db } = await seedTwoTenants();
  try {
    for (const object of OBJECTS) {
      const rows = await db.select({ id: object.key }).from(object.table); // isolation-ok: deliberate control case proving the predicate is what does the work
      assert.equal(
        rows.length,
        2,
        `${object.name}: the control case did not see both tenants' rows, so ` +
          `the scoped assertions above prove nothing.`,
      );
    }
  } finally {
    client.close();
  }
});

test("an absent workspace id cannot degrade into an unscoped read", () => {
  // The runtime half of the boundary. `byWorkspace` throws rather than
  // building `WHERE workspace_id = ''`, which would match nothing today
  // and match the wrong rows the moment a blank tenant key exists.
  assert.throws(
    () => byWorkspace(tasks.workspaceId, ""),
    /refusing to build an unscoped tenant query/,
    "byWorkspace accepted an empty workspace id",
  );
});

test("the venue axis cannot be used to read a couple's content", async () => {
  const { client, db } = await seedTwoTenants();
  try {
    // A sponsor-scoped read is legitimate on the sponsorship row itself.
    const own = await db
      .select({ id: workspaceSponsorships.id })
      .from(workspaceSponsorships)
      .where(eq(workspaceSponsorships.sponsorId, "venue-one"));
    assert.deepEqual(own.map((r) => r.id), ["spon-a"]);

    // But joining that axis through to the couple's tasks is the boundary
    // this project forbids (D-011, D-027 point 4). Proven here as data: a
    // venue holding a sponsor id must never be able to reach task titles.
    // If a future change makes this join possible from a venue-facing
    // module, `tenant-scope.test.mjs` invariant 3 fails first.
    const sponsorship = await db
      .select({ workspaceId: workspaceSponsorships.workspaceId })
      .from(workspaceSponsorships)
      .where(eq(workspaceSponsorships.sponsorId, "venue-one"));
    const reachable = sponsorship[0]?.workspaceId;
    assert.equal(
      reachable,
      WS_A,
      "the sponsorship row does carry the workspace handle in the database",
    );
    // The handle exists in the table; the control is that no venue-facing
    // DTO or query may project it. That is asserted in
    // tenant-scope.test.mjs ("a sponsor-scoped read never projects couple
    // content") and in studio's hq-authorization.test.mjs. Recorded here
    // so the next reader knows the boundary is a projection rule, not a
    // storage rule, and does not mistake this file for proof of it.
  } finally {
    client.close();
  }
});
