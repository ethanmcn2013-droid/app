/**
 * The daily digest's mention lookup, executed against two real tenants.
 *
 * ── Why this file exists ────────────────────────────────────────────────
 *
 * `cross-tenant-negative.test.ts` proves that a read carrying
 * `byWorkspace(...)` returns only its own tenant's rows. It cannot prove
 * that any particular production read carries one — that is the static
 * gate's job, and on 2026-08-12 the static gate was passing a read that
 * had no workspace predicate at all. `compileDailyDigest` selected from
 * `activities` filtered only by `kind` and `created_at`, and
 * `tenant-scope-rules.mjs` accepted the `userId` in
 * `.leftJoin(users, eq(activities.userId, users.id))` as proof of scope.
 *
 * So this file executes the actual query rather than inspecting it. Both
 * halves of the defect are asserted as behaviour:
 *
 *   1. DISCLOSURE. Another workspace's comment snippet and task title must
 *      not appear in this user's digest. The digest is emailed
 *      (`src/app/api/cron/digest/route.ts`), so the leak leaves the app.
 *
 *   2. DROPPED MENTIONS. `.limit(50)` used to bound the whole `activities`
 *      table across every tenant BEFORE any per-user filtering, so a
 *      user's real mentions vanished whenever other tenants were busier.
 *      This one needed no attacker and no id collision — it was simply
 *      wrong, every day, in proportion to how well the product sold.
 *
 * The third test is the control: it runs the unscoped form and asserts it
 * really does leak, so the two above are evidence rather than a statement
 * about an empty table.
 *
 * Run: node --import tsx --import ./src/test/register-server-only.mjs \
 *        --test src/server/cross-tenant-digest-mentions.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { and, desc, eq, getTableColumns, gte } from "drizzle-orm";
import { freshMemoryDb } from "./db/memory-test-db";
import { collectMentions, MENTION_LIMIT } from "./db/digest-mentions";
import { activities, users } from "./db/schema";

const WS_A = "ws-alpha";
const WS_B = "ws-beta";

/** The person the digest is being compiled for. A member of A, not of B. */
const VICTIM = "user-a";

const ALPHA_SNIPPET = `@${VICTIM} the alpha florist confirmed`;
const BETA_SNIPPET = `@${VICTIM} beta's budget is 40k, do not share`;
const ALPHA_TITLE = "Alpha private task";
const BETA_TITLE = "Beta private task";

/**
 * Two tenants. Workspace B holds `betaNoise` comment activities that all
 * mention workspace A's user and are all NEWER than A's single genuine
 * mention — the shape of a busy neighbouring tenant. With the limit
 * applied before tenant filtering, A's mention falls off the end.
 */
async function seedTwoTenants(betaNoise: number) {
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
      ('task-a', '${WS_A}', 1, '${ALPHA_TITLE}', '', 'todo', 'normal', '[]', 0, 0, 0, 0),
      ('task-b', '${WS_B}', 1, '${BETA_TITLE}',  '', 'todo', 'normal', '[]', 0, 0, 0, 0);

    INSERT INTO activities (id, workspace_id, task_id, user_id, kind, payload, created_at)
    VALUES ('act-a', '${WS_A}', 'task-a', 'user-a', 'commentAdd',
            '{"kind":"commentAdd","snippet":"${ALPHA_SNIPPET}"}', 1000);
  `);

  for (let i = 0; i < betaNoise; i++) {
    await client.execute({
      sql: `INSERT INTO activities (id, workspace_id, task_id, user_id, kind, payload, created_at)
            VALUES (?, ?, 'task-b', 'user-b', 'commentAdd', ?, ?)`,
      args: [
        `act-b-${i}`,
        WS_B,
        JSON.stringify({ kind: "commentAdd", snippet: BETA_SNIPPET }),
        2000 + i,
      ],
    });
  }
  return { client, db };
}

test("the digest never carries another workspace's mention", async () => {
  const { client, db } = await seedTwoTenants(1);
  try {
    const mentions = await collectMentions(db, {
      workspaceId: WS_A,
      userId: VICTIM,
      since: new Date(0),
    });

    assert.deepEqual(
      mentions.map((m) => m.snippet),
      [ALPHA_SNIPPET],
      "the digest for workspace A carried a comment snippet from workspace " +
        "B. This goes out by email, so the leak leaves the product.",
    );
    assert.deepEqual(
      mentions.map((m) => m.taskTitle),
      [ALPHA_TITLE],
      "the task-title lookup resolved a title from the other tenant. A " +
        "title is itself private content.",
    );
    assert.equal(
      mentions.some((m) => m.taskId === "task-b"),
      false,
      "a foreign task id reached the digest",
    );
  } finally {
    client.close();
  }
});

test("a busy neighbouring tenant cannot push a real mention out of the digest", async () => {
  // Twice the limit, so with a pre-filter limit every returned row is B's
  // and A's genuine mention is silently dropped. No attacker involved.
  const { client, db } = await seedTwoTenants(MENTION_LIMIT * 2);
  try {
    const mentions = await collectMentions(db, {
      workspaceId: WS_A,
      userId: VICTIM,
      since: new Date(0),
    });

    assert.deepEqual(
      mentions.map((m) => m.snippet),
      [ALPHA_SNIPPET],
      `workspace A's own mention was missing from its digest while ` +
        `${MENTION_LIMIT * 2} newer rows existed in workspace B. The row ` +
        `limit is being applied before the tenant filter, not after it.`,
    );
  } finally {
    client.close();
  }
});

test("the unscoped form really would have leaked, so the tests above mean something", async () => {
  // Control case: the exact query `compileDailyDigest` ran until
  // 2026-08-12 — no workspace predicate, limit ahead of every user-level
  // filter. If this does not leak, the assertions above prove nothing.
  const { client, db } = await seedTwoTenants(MENTION_LIMIT * 2);
  try {
    const rows = await db
      .select({
        ...getTableColumns(activities),
        authorName: users.name,
      })
      .from(activities)
      .leftJoin(users, eq(activities.userId, users.id))
      .where(
        and(
          eq(activities.kind, "commentAdd"),
          gte(activities.createdAt, new Date(0)),
        ),
      ) // isolation-ok: deliberate control case reproducing the fixed defect
      .orderBy(desc(activities.createdAt))
      .limit(MENTION_LIMIT);

    const snippets = rows.map(
      (r) => (r.payload as { snippet?: string }).snippet ?? "",
    );
    assert.ok(
      snippets.includes(BETA_SNIPPET),
      "the control case did not read workspace B's snippet, so the " +
        "disclosure assertion above is not proving anything.",
    );
    assert.equal(
      snippets.includes(ALPHA_SNIPPET),
      false,
      "the control case did not drop workspace A's own mention, so the " +
        "limit-ordering assertion above is not proving anything.",
    );
  } finally {
    client.close();
  }
});

test("an absent workspace id cannot degrade the mention read into an unscoped one", async () => {
  const { client, db } = await seedTwoTenants(1);
  try {
    await assert.rejects(
      () =>
        collectMentions(db, {
          workspaceId: "",
          userId: VICTIM,
          since: new Date(0),
        }),
      /refusing to build an unscoped tenant query/,
      "an empty workspace id read across tenants instead of throwing",
    );
  } finally {
    client.close();
  }
});
