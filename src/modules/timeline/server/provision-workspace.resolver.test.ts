/**
 * WP1 · who is allowed to make the exact Timeline resolver WRITE.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * `resolveCanonicalTimeline` has two branches that write: `provision` creates a
 * Timeline for the requested Project, and `adopt` binds an existing one to it.
 * Both consume `uq_workspaces_suite_workspace_id`, so both are one-way doors —
 * whoever gets there first owns the Project's Timeline, and the loser is
 * refused for good, because every later resolution is owner-scoped and finds
 * nothing.
 *
 * The first F3 fix put the ownership gate on `provision` and not on `adopt`,
 * which left the identical lockout reachable through the other door. Gating one
 * write path and not its twin is the kind of asymmetry a source-text guard
 * cannot see, so these run the real resolver against two real libSQL databases
 * and then check the row.
 *
 * ── THE CASE THAT MATTERS ──────────────────────────────────────────────────
 * `setMemberRoleAction` (src/server/actions/settings.ts) promotes members to
 * `workspace_members.role = 'owner'`. A promoted co-owner of somebody else's
 * Project, who owns no Project of their own, therefore resolves that SHARED
 * Project as their "sole owned" one — correctly, because the count is
 * deliberately broad (D-017/F2: a co-owned Project is still a Project an
 * unclaimed Timeline could belong to). The eligibility to WRITE is what has to
 * be narrow, and it lives on the branch.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";

const OWNER_CLERK = "user_b_owner";
const OWNER_TASKS_ID = "u_b";
const COOWNER_CLERK = "user_a_coowner";
const COOWNER_TASKS_ID = "u_a";
const MEMBER_CLERK = "user_c_member";
const MEMBER_TASKS_ID = "u_c";
const PROJECT = "ws_a";

// Both databases are bound before the modules that read them are imported;
// isolation between tests comes from resetting the schema, not from new files.
const SCRATCH_DIR = mkdtempSync(join(tmpdir(), "wp1-resolver-"));
const TIMELINE_URL = pathToFileURL(join(SCRATCH_DIR, "timeline.db")).href;
const TASKS_URL = pathToFileURL(join(SCRATCH_DIR, "tasks.db")).href;
process.env.TIMELINE_DATABASE_URL = TIMELINE_URL;
delete process.env.TIMELINE_AUTH_TOKEN;
process.env.TASKS_DATABASE_URL = TASKS_URL;
process.env.TASKS_AUTH_TOKEN = "test-token";

let modules: Readonly<{
  resolveCanonicalTimeline: typeof import("@/modules/timeline/server/provision-workspace")["resolveCanonicalTimeline"];
  getCurrentTasksWorkspaceContext: typeof import("@/modules/timeline/server/sync/tasks-workspace-context")["getCurrentTasksWorkspaceContext"];
}> | null = null;

async function load() {
  if (!modules) {
    const [provision, context] = await Promise.all([
      import("@/modules/timeline/server/provision-workspace"),
      import("@/modules/timeline/server/sync/tasks-workspace-context"),
    ]);
    modules = {
      resolveCanonicalTimeline: provision.resolveCanonicalTimeline,
      getCurrentTasksWorkspaceContext: context.getCurrentTasksWorkspaceContext,
    };
  }
  return modules;
}

/**
 * The Timeline schema, reset per test.
 *
 * `migrated: false` reproduces the state every deployment passes through: the
 * code is live and 0001 has not been applied yet. Provisioning must work
 * exactly the same there, because the alternative is the production dead end
 * this whole path exists to prevent (WP4).
 */
async function resetTimeline(
  client: Client,
  options: Readonly<{ migrated?: boolean }> = {},
): Promise<void> {
  await client.executeMultiple(`
    DROP TABLE IF EXISTS timeline_source_sync_state;
    DROP TABLE IF EXISTS suite_project_bindings;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS workspaces;
    DROP TABLE IF EXISTS node_overlays;
  `);
  const statements = (file: string, wanted: RegExp) =>
    readFileSync(file, "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter((statement) => wanted.test(statement));

  await client.executeMultiple(
    [
      ...statements(
        "drizzle-timeline/0000_timeline_baseline.sql",
        /^CREATE (TABLE|UNIQUE INDEX|INDEX) `?(tasks|projects|workspaces|node_overlays|uq_workspaces_suite_workspace_id|idx_workspaces_owner)`?/,
      ),
      ...(options.migrated === false
        ? []
        : statements(
            "drizzle-timeline/0001_suite_project_bindings.sql",
            /^CREATE (TABLE|UNIQUE INDEX)/,
          )),
    ].join(";\n") + ";",
  );
}

async function resetTasks(client: Client): Promise<void> {
  await client.executeMultiple(`
    DROP TABLE IF EXISTS workspace_members;
    DROP TABLE IF EXISTS workspaces;
    DROP TABLE IF EXISTS users;
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
    sql: "INSERT INTO users VALUES (?, ?), (?, ?), (?, ?)",
    args: [
      OWNER_TASKS_ID,
      OWNER_CLERK,
      COOWNER_TASKS_ID,
      COOWNER_CLERK,
      MEMBER_TASKS_ID,
      MEMBER_CLERK,
    ],
  });
}

/**
 * One Tasks Project owned by B. A is a PROMOTED CO-OWNER of it (role 'owner',
 * but not the Project's owner). C is an ordinary member.
 */
async function seedSharedProject(client: Client): Promise<void> {
  await client.execute({
    sql: `INSERT INTO workspaces
          (id, slug, name, owner_user_id, planning_period_id, active_domain, archived_at)
          VALUES (?, 'project-a', 'Project A', ?, NULL, NULL, NULL)`,
    args: [PROJECT, OWNER_TASKS_ID],
  });
  await client.execute({
    sql: "INSERT INTO workspace_members VALUES (?, ?, 'owner'), (?, ?, 'owner'), (?, ?, 'member')",
    args: [
      PROJECT,
      OWNER_TASKS_ID,
      PROJECT,
      COOWNER_TASKS_ID,
      PROJECT,
      MEMBER_TASKS_ID,
    ],
  });
}

/** An unclaimed Timeline: no suite id, no bound child. */
async function seedUnclaimedTimeline(
  client: Client,
  slug: string,
  ownerClerk: string,
): Promise<void> {
  await client.execute({
    sql: "INSERT INTO workspaces (slug, name, owner_user_id) VALUES (?, ?, ?)",
    args: [slug, slug, ownerClerk],
  });
  await client.execute({
    sql: `INSERT INTO projects (workspace_slug, slug, name, one_liner, accent)
          VALUES (?, 'plan', 'The plan', '', 'default')`,
    args: [slug],
  });
}

async function suiteIdOf(client: Client, slug: string): Promise<string | null> {
  const rows = await client.execute({
    sql: "SELECT suite_workspace_id FROM workspaces WHERE slug = ?",
    args: [slug],
  });
  const value = rows.rows[0]?.suite_workspace_id;
  return value == null ? null : String(value);
}

async function timelineCount(client: Client): Promise<number> {
  const rows = await client.execute("SELECT COUNT(*) AS n FROM workspaces");
  return Number(rows.rows[0]!.n);
}

/** Unwrap the tagged membership result; every case here is a real member. */
async function proveMembership(
  read: typeof import("@/modules/timeline/server/sync/tasks-workspace-context")["getCurrentTasksWorkspaceContext"],
  clerkId: string,
  workspaceId: string,
) {
  const membership = await read(clerkId, workspaceId);
  assert.equal(
    membership.kind,
    "member",
    `expected proved membership for ${clerkId}`,
  );
  return membership.kind === "member" ? membership.context : null;
}

async function harness(
  t: { after: (fn: () => void) => void },
  options: Readonly<{ migrated?: boolean }> = {},
) {
  const timeline = createClient({ url: TIMELINE_URL });
  const tasks = createClient({ url: TASKS_URL });
  t.after(() => {
    timeline.close();
    tasks.close();
  });
  await resetTimeline(timeline, options);
  await resetTasks(tasks);
  await seedSharedProject(tasks);
  return { timeline, tasks, ...(await load()) };
}

test.after(() => {
  try {
    rmSync(SCRATCH_DIR, { recursive: true, force: true });
  } catch {
    /* left for the OS */
  }
});

// ── F3 · the adopt branch is a write, and writes are owner-only ──────────────

test("a promoted co-owner cannot adopt their own Timeline onto the owner's Project", async (t) => {
  // THE repro. A is `role: 'owner'` on B's Project and owns no Project of their
  // own, so their "sole owned" Project resolves to B's — and they own one
  // unclaimed personal Timeline. Before the gate, opening
  // /app/timeline?workspaceId=ws_a bound A's personal Timeline to B's Project,
  // consumed the unique suite-id index, and locked B out permanently.
  const h = await harness(t);
  await seedUnclaimedTimeline(h.timeline, "co-owners-own-timeline", COOWNER_CLERK);

  const proved = await proveMembership(
    h.getCurrentTasksWorkspaceContext,
    COOWNER_CLERK,
    PROJECT,
  );
  assert.ok(proved, "the co-owner really is a member of this Project");
  assert.equal(proved.role, "owner", "their membership role really is owner");
  assert.equal(
    proved.ownerClerkId,
    OWNER_CLERK,
    "and the Project's owner is still B",
  );

  const resolution = await h.resolveCanonicalTimeline(
    COOWNER_CLERK,
    PROJECT,
    proved,
  );

  assert.equal(resolution.kind, "owner-reconciliation-required");
  assert.equal(
    await suiteIdOf(h.timeline, "co-owners-own-timeline"),
    null,
    "no binding may be written: the row must be exactly as it was",
  );
});

test("the Project's own owner still adopts their unclaimed Timeline", async (t) => {
  // The gate must not close the door it was built to keep open. B owns the
  // Project and owns one unclaimed Timeline — the production incident's shape —
  // and is still bound on first visit.
  const h = await harness(t);
  await seedUnclaimedTimeline(h.timeline, "owners-own-timeline", OWNER_CLERK);

  const proved = await proveMembership(
    h.getCurrentTasksWorkspaceContext,
    OWNER_CLERK,
    PROJECT,
  );
  assert.ok(proved);
  const resolution = await h.resolveCanonicalTimeline(
    OWNER_CLERK,
    PROJECT,
    proved,
  );

  assert.equal(resolution.kind, "exact");
  assert.equal(
    resolution.kind === "exact" ? resolution.provenance : null,
    "legacy_exact",
  );
  assert.equal(
    await suiteIdOf(h.timeline, "owners-own-timeline"),
    PROJECT,
    "the owner's binding is written",
  );
});

test("an ordinary member cannot adopt onto someone else's Project either", async (t) => {
  const h = await harness(t);
  await seedUnclaimedTimeline(h.timeline, "members-own-timeline", MEMBER_CLERK);

  const proved = await proveMembership(
    h.getCurrentTasksWorkspaceContext,
    MEMBER_CLERK,
    PROJECT,
  );
  assert.ok(proved);
  const resolution = await h.resolveCanonicalTimeline(
    MEMBER_CLERK,
    PROJECT,
    proved,
  );

  assert.equal(resolution.kind, "owner-reconciliation-required");
  assert.equal(await suiteIdOf(h.timeline, "members-own-timeline"), null);
});

// ── The provision branch, which was already gated, must stay gated ───────────

test("a promoted co-owner with no Timeline cannot provision the owner's either", async (t) => {
  const h = await harness(t);
  const before = await timelineCount(h.timeline);

  const proved = await proveMembership(
    h.getCurrentTasksWorkspaceContext,
    COOWNER_CLERK,
    PROJECT,
  );
  assert.ok(proved);
  const resolution = await h.resolveCanonicalTimeline(
    COOWNER_CLERK,
    PROJECT,
    proved,
  );

  assert.equal(resolution.kind, "owner-reconciliation-required");
  assert.equal(
    await timelineCount(h.timeline),
    before,
    "no Timeline may be created under the visitor's identity",
  );
});

test("the Project's owner with no Timeline is provisioned one", async (t) => {
  const h = await harness(t);

  const proved = await proveMembership(
    h.getCurrentTasksWorkspaceContext,
    OWNER_CLERK,
    PROJECT,
  );
  assert.ok(proved);
  const resolution = await h.resolveCanonicalTimeline(
    OWNER_CLERK,
    PROJECT,
    proved,
  );

  assert.equal(resolution.kind, "provisioned");
  assert.equal(
    resolution.kind === "provisioned"
      ? resolution.workspace.suiteWorkspaceId
      : null,
    PROJECT,
    "and it is bound to the exact Project that was asked for",
  );
});

// ── The read path is NOT owner-gated: Tasks membership is the boundary ───────

test("a member reads the Project's already-bound Timeline", async (t) => {
  // Ownership gates WRITES only. Current Tasks membership is the authorization
  // boundary for reading the bound primary Timeline (ADR 0001 §6.6), so
  // narrowing the write gate must not narrow the read.
  const h = await harness(t);
  await h.timeline.execute({
    sql: "INSERT INTO workspaces (slug, name, owner_user_id, suite_workspace_id) VALUES ('bound', 'Bound', ?, ?)",
    args: [OWNER_CLERK, PROJECT],
  });

  const proved = await proveMembership(
    h.getCurrentTasksWorkspaceContext,
    MEMBER_CLERK,
    PROJECT,
  );
  assert.ok(proved);
  const resolution = await h.resolveCanonicalTimeline(
    MEMBER_CLERK,
    PROJECT,
    proved,
  );

  // The member owns no Timeline row, so the owner-scoped list is empty and the
  // resolver cannot hand them the owner's. That is WP4's collaborator read, and
  // it must be a refusal today rather than a substitution — never someone
  // else's Timeline, and never a write.
  assert.notEqual(resolution.kind, "exact");
  assert.ok(
    resolution.kind === "owner-reconciliation-required" ||
      resolution.kind === "provisioned" ||
      resolution.kind === "failed",
    `unexpected outcome ${resolution.kind}`,
  );
  assert.notEqual(
    resolution.kind,
    "provisioned",
    "a member must not provision a second Timeline for a Project that has one",
  );
});

test("provisioning records the normalized binding beside the legacy mirrors", async (t) => {
  // WP4, plan §6.2. The binding table becomes the authoritative row, and both
  // mirrors are still dual-written so a rollback dual-read resolves the same
  // exact rows. Neither is cleared in this wave.
  const h = await harness(t);
  const proved = await proveMembership(
    h.getCurrentTasksWorkspaceContext,
    OWNER_CLERK,
    PROJECT,
  );
  assert.ok(proved);
  const resolution = await h.resolveCanonicalTimeline(OWNER_CLERK, PROJECT, proved);
  assert.equal(resolution.kind, "provisioned");

  const binding = await h.timeline.execute("SELECT * FROM suite_project_bindings");
  assert.equal(binding.rows.length, 1);
  assert.equal(binding.rows[0]!.tasks_workspace_id, PROJECT);
  assert.equal(binding.rows[0]!.primary_timeline_slug, "plan");
  assert.equal(binding.rows[0]!.state, "active");
  assert.equal(binding.rows[0]!.provenance, "provisioned");

  const created = resolution.kind === "provisioned" ? resolution.workspace : null;
  assert.equal(await suiteIdOf(h.timeline, created!.slug), PROJECT);
  const child = await h.timeline.execute({
    sql: "SELECT source_tasks_workspace_id FROM projects WHERE workspace_slug = ?",
    args: [created!.slug],
  });
  assert.equal(child.rows[0]!.source_tasks_workspace_id, PROJECT);
});

test("provisioning still works on a database where 0001 has not been applied", async (t) => {
  // Code ships before migrations run, always. If the binding write could throw
  // here, the deployment window would reopen the production dead end that
  // provisioning exists to close: a couple reaching Timeline and finding
  // nothing. The normalized binding is additive, so its absence degrades to
  // "not recorded" and never to "provisioning failed".
  const h = await harness(t, { migrated: false });
  const proved = await proveMembership(
    h.getCurrentTasksWorkspaceContext,
    OWNER_CLERK,
    PROJECT,
  );
  assert.ok(proved);
  const resolution = await h.resolveCanonicalTimeline(OWNER_CLERK, PROJECT, proved);

  assert.equal(resolution.kind, "provisioned");
  assert.equal(await timelineCount(h.timeline), 1);
  const created = resolution.kind === "provisioned" ? resolution.workspace : null;
  assert.equal(await suiteIdOf(h.timeline, created!.slug), PROJECT);
});
