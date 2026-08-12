/**
 * WP1 · the Tasks-side proofs the exact Timeline resolver rests on.
 *
 * Two of them are load-bearing and both were wrong in the first WP1 pass, in
 * the same way: the SQL did not prove what the calling comment claimed it
 * proved. Neither could be caught by a pure test, because in both cases the
 * defect IS the WHERE clause. So these run against a real libSQL file.
 *
 * F2 · `getSoleOwnedTasksWorkspaceIdForUser` is the uniqueness proof behind the
 *      one inference WP1 retains — "the actor owns exactly one Tasks Project,
 *      so there is exactly one possible pairing for their one unclaimed
 *      Timeline". It counted only NON-ARCHIVED Projects, so an owner with an
 *      archived 2024 Project and an active 2026 one counted as one, and the
 *      2024 plan was permanently adopted as the 2026 Project's Timeline.
 *
 * F3 · `getCurrentTasksWorkspaceContext.role` is `workspace_members.role`, not
 *      Project ownership. Co-owners are real (`setMemberRoleAction` promotes
 *      members to `role:"owner"`), so gating provisioning on it let a promoted
 *      co-owner mint the Project's Timeline under THEIR identity, consume the
 *      unique suite-id index, and lock the primary owner out for good.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";
import {
  getCurrentTasksWorkspaceContext,
  getSoleOwnedTasksWorkspaceIdForUser,
} from "@/modules/timeline/server/sync/tasks-workspace-context";

const OWNER_CLERK = "user_owner";
const OWNER_TASKS_ID = "u_owner";
const COOWNER_CLERK = "user_coowner";
const COOWNER_TASKS_ID = "u_coowner";

const SCRATCH_DIR = mkdtempSync(join(tmpdir(), "wp1-tasks-ctx-"));
let counter = 0;

/** The subset of the Tasks schema these two reads touch. */
async function makeTasksDatabase(): Promise<
  Readonly<{ url: string; client: Client; close: () => void }>
> {
  const path = join(SCRATCH_DIR, `tasks-${(counter += 1)}.db`);
  const url = pathToFileURL(path).href;
  const client = createClient({ url });
  await client.executeMultiple(`
    CREATE TABLE users (id TEXT PRIMARY KEY, clerk_id TEXT);
    CREATE TABLE workspaces (
      id TEXT PRIMARY KEY,
      slug TEXT,
      name TEXT,
      owner_user_id TEXT,
      planning_period_id TEXT,
      active_domain TEXT,
      archived_at INTEGER,
      created_at INTEGER DEFAULT 0
    );
    CREATE TABLE workspace_members (workspace_id TEXT, user_id TEXT, role TEXT);
  `);
  await client.execute({
    sql: "INSERT INTO users VALUES (?, ?), (?, ?)",
    args: [OWNER_TASKS_ID, OWNER_CLERK, COOWNER_TASKS_ID, COOWNER_CLERK],
  });
  process.env.TASKS_DATABASE_URL = url;
  process.env.TASKS_AUTH_TOKEN = "test-token";
  return {
    url,
    client,
    close: () => {
      client.close();
      try {
        rmSync(path, { force: true });
      } catch {
        /* left for the OS */
      }
    },
  };
}

async function addProject(
  client: Client,
  options: Readonly<{
    id: string;
    ownerTasksId?: string | null;
    archivedAt?: number | null;
    members?: ReadonlyArray<readonly [string, string]>;
  }>,
): Promise<void> {
  await client.execute({
    sql: `INSERT INTO workspaces
          (id, slug, name, owner_user_id, planning_period_id, active_domain, archived_at)
          VALUES (?, ?, ?, ?, NULL, NULL, ?)`,
    args: [
      options.id,
      options.id.replace(/_/g, "-"),
      `Project ${options.id}`,
      options.ownerTasksId === undefined ? OWNER_TASKS_ID : options.ownerTasksId,
      options.archivedAt ?? null,
    ],
  });
  for (const [userId, role] of options.members ?? [[OWNER_TASKS_ID, "owner"]]) {
    await client.execute({
      sql: "INSERT INTO workspace_members VALUES (?, ?, ?)",
      args: [options.id, userId, role],
    });
  }
}

/** Assert the read proved membership, and hand back the context it proved. */
async function member(clerkId: string, workspaceId: string) {
  const result = await getCurrentTasksWorkspaceContext(clerkId, workspaceId);
  assert.equal(result.kind, "member", `expected membership for ${clerkId}`);
  if (result.kind !== "member") throw new Error("unreachable");
  return result.context;
}

// ── F2 · the uniqueness proof must count every sibling ───────────────────────

test("one owned Project and nothing else is a sole-owned pairing", async (t) => {
  const db = await makeTasksDatabase();
  t.after(db.close);
  await addProject(db.client, { id: "ws_2026" });

  assert.equal(
    await getSoleOwnedTasksWorkspaceIdForUser(OWNER_CLERK),
    "ws_2026",
  );
});

test("an ARCHIVED sibling breaks the pairing proof", async (t) => {
  // F2, the repro. The owner has an archived 2024 Project and an active 2026
  // one, and one unclaimed in-app Timeline that was made for 2024. Counting
  // only non-archived rows made this look like "exactly one Project", so
  // requesting 2026 adopted the 2024 plan — permanently, because
  // `connectSuiteWorkspaceAction` then refuses to rebind.
  //
  // The requested Project is already proved non-archived before this is
  // consulted, so counting archived rows can only make the proof stricter.
  const db = await makeTasksDatabase();
  t.after(db.close);
  await addProject(db.client, { id: "ws_2024", archivedAt: 1_700_000_000 });
  await addProject(db.client, { id: "ws_2026" });

  assert.equal(
    await getSoleOwnedTasksWorkspaceIdForUser(OWNER_CLERK),
    null,
    "an archived sibling is still a second Project this Timeline could belong to",
  );
});

test("two active owned Projects are never a pairing proof", async (t) => {
  const db = await makeTasksDatabase();
  t.after(db.close);
  await addProject(db.client, { id: "ws_a" });
  await addProject(db.client, { id: "ws_b" });

  assert.equal(await getSoleOwnedTasksWorkspaceIdForUser(OWNER_CLERK), null);
});

test("membership of someone else's Project is not ownership of it", async (t) => {
  const db = await makeTasksDatabase();
  t.after(db.close);
  await addProject(db.client, { id: "ws_mine" });
  await addProject(db.client, {
    id: "ws_theirs",
    ownerTasksId: COOWNER_TASKS_ID,
    members: [[COOWNER_TASKS_ID, "owner"], [OWNER_TASKS_ID, "member"]],
  });

  assert.equal(
    await getSoleOwnedTasksWorkspaceIdForUser(OWNER_CLERK),
    "ws_mine",
    "a Project the actor is merely a member of is not one of theirs",
  );
});

// ── F3 · Project ownership is not a membership role ──────────────────────────

test("the membership context reports the Project's real owner subject", async (t) => {
  const db = await makeTasksDatabase();
  t.after(db.close);
  await addProject(db.client, {
    id: "ws_shared",
    ownerTasksId: OWNER_TASKS_ID,
    // The co-owner was PROMOTED: workspace_members.role is 'owner' for them,
    // but workspaces.owner_user_id still names the primary owner.
    members: [[OWNER_TASKS_ID, "owner"], [COOWNER_TASKS_ID, "owner"]],
  });

  const asOwner = await member(OWNER_CLERK, "ws_shared");
  const asCoOwner = await member(COOWNER_CLERK, "ws_shared");

  assert.equal(asOwner.ownerClerkId, OWNER_CLERK);
  assert.equal(
    asCoOwner.ownerClerkId,
    OWNER_CLERK,
    "a promoted co-owner must not read as the Project's owner",
  );
  assert.equal(
    asCoOwner.role,
    "owner",
    "their membership role really is owner — which is exactly why the role " +
      "is the wrong thing to gate a write on",
  );
});

test("a Project with no owner row yields no owner subject", async (t) => {
  // `workspaces.owner_user_id` is nullable (legacy backfill). Missing identity
  // must read as missing, so provisioning refuses rather than guessing.
  const db = await makeTasksDatabase();
  t.after(db.close);
  await addProject(db.client, { id: "ws_orphan", ownerTasksId: null });

  const context = await member(OWNER_CLERK, "ws_orphan");
  assert.equal(context.workspaceId, "ws_orphan");
  assert.equal(context.ownerClerkId, null);
});

test("membership of a different Project never authorizes this one", async (t) => {
  const db = await makeTasksDatabase();
  t.after(db.close);
  await addProject(db.client, { id: "ws_a" });
  await addProject(db.client, {
    id: "ws_b",
    ownerTasksId: COOWNER_TASKS_ID,
    members: [[COOWNER_TASKS_ID, "owner"]],
  });

  assert.deepEqual(await getCurrentTasksWorkspaceContext(OWNER_CLERK, "ws_b"), {
    kind: "not-a-member",
  });
});

test("an archived Project still resolves, and says so", async (t) => {
  const db = await makeTasksDatabase();
  t.after(db.close);
  await addProject(db.client, { id: "ws_old", archivedAt: 1_700_000_000 });

  const context = await member(OWNER_CLERK, "ws_old");
  assert.equal(context.archivedAt, 1_700_000_000);
});

// ── "no row" and "could not ask" are different facts ─────────────────────────

test("an unreachable Tasks database is unavailable, never a denial", async (t) => {
  // The regression this pass introduced and then removed. Every failure here
  // used to collapse to null, and the sync action read null as "you no longer
  // have access to this project" — told to every Timeline owner in edit mode,
  // with no Retry, for the length of any Tasks outage or migration window.
  //
  // It is the milestone read's defect one layer up: authorization expressed as
  // an absence. A denial is an answer; an outage is the absence of one.
  const db = await makeTasksDatabase();
  t.after(db.close);
  await addProject(db.client, { id: "ws_live" });

  // The schema is gone, so the query throws rather than returning no row.
  await db.client.executeMultiple("DROP TABLE workspace_members;");

  const result = await getCurrentTasksWorkspaceContext(OWNER_CLERK, "ws_live");
  assert.equal(result.kind, "unavailable");
  assert.notEqual(
    result.kind,
    "not-a-member",
    "an unanswered question must never be reported as a refused one",
  );
});

test("missing Tasks configuration is unavailable, never a denial", async (t) => {
  const db = await makeTasksDatabase();
  t.after(db.close);
  await addProject(db.client, { id: "ws_live" });

  const url = process.env.TASKS_DATABASE_URL;
  t.after(() => {
    process.env.TASKS_DATABASE_URL = url;
  });
  delete process.env.TASKS_DATABASE_URL;

  const result = await getCurrentTasksWorkspaceContext(OWNER_CLERK, "ws_live");
  assert.equal(result.kind, "unavailable");
  assert.equal(
    result.kind === "unavailable" ? result.code : null,
    "tasks_not_configured",
  );
});
