/**
 * WP4 · F6. An archived Project's Timeline is read-only, and revoke is not.
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * `resolveCanonicalTimeline` returns `archived` — it has since WP1 — and
 * `resolveTimelineContext` dropped the word on the floor. The plan page then
 * rendered the full edit surface for an archived Project, and every control in
 * it worked, because `upsertNodeOverlayAction`, `createManualMilestoneAction`
 * and `reorderNodesAction` checked local Timeline ownership and nothing else.
 * ADR 0001 §5 says archived is read-only for every Project-scoped operation.
 *
 * ── THE ASYMMETRY THAT MATTERS ─────────────────────────────────────────────
 * ADR 0001 §5 also says, in as many words: *existing bearer links remain
 * manageable and revocable; new publishing is disabled.* An owner who finds a
 * leaked link must be able to kill it whether or not the Project is archived.
 * So publish/create/rotate are refused and revoke/unpublish are untouched, and
 * that is asserted here rather than left to a comment.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";

const OWNER_CLERK = "user_couple";
const OWNER_TASKS_ID = "u_1";
const ACTIVE_PROJECT = "ws_active";
const ARCHIVED_PROJECT = "ws_archived";

const SCRATCH_DIR = mkdtempSync(join(tmpdir(), "wp4-archived-"));
const TIMELINE_URL = pathToFileURL(join(SCRATCH_DIR, "timeline.db")).href;
const TASKS_URL = pathToFileURL(join(SCRATCH_DIR, "tasks.db")).href;
process.env.TIMELINE_DATABASE_URL = TIMELINE_URL;
delete process.env.TIMELINE_AUTH_TOKEN;
process.env.TASKS_DATABASE_URL = TASKS_URL;
process.env.TASKS_AUTH_TOKEN = "test-token";

let loaded: Readonly<{
  readBoundProjectArchiveState: typeof import("@/modules/timeline/server/archived-project-policy")["readBoundProjectArchiveState"];
  requireFreshAudienceMutationAuthority: typeof import("@/modules/timeline/server/audience-authority")["requireFreshAudienceMutationAuthority"];
}> | null = null;

async function load() {
  if (!loaded) {
    const [policy, authority] = await Promise.all([
      import("@/modules/timeline/server/archived-project-policy"),
      import("@/modules/timeline/server/audience-authority"),
    ]);
    loaded = {
      readBoundProjectArchiveState: policy.readBoundProjectArchiveState,
      requireFreshAudienceMutationAuthority:
        authority.requireFreshAudienceMutationAuthority,
    };
  }
  return loaded;
}

async function resetTimeline(client: Client) {
  await client.executeMultiple(`
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS workspaces;
  `);
  const wanted = /^CREATE (TABLE|UNIQUE INDEX|INDEX) `?(projects|workspaces|uq_workspaces_suite_workspace_id|idx_workspaces_owner)`?/;
  await client.executeMultiple(
    readFileSync("drizzle-timeline/0000_timeline_baseline.sql", "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter((statement) => wanted.test(statement))
      .join(";\n") + ";",
  );
  for (const [slug, suiteId] of [
    ["live-plan", ACTIVE_PROJECT],
    ["archived-plan", ARCHIVED_PROJECT],
    ["manual-plan", null],
  ] as const) {
    await client.execute({
      sql: "INSERT INTO workspaces (slug, name, owner_user_id, suite_workspace_id) VALUES (?, ?, ?, ?)",
      args: [slug, slug, OWNER_CLERK, suiteId],
    });
  }
}

async function resetTasks(client: Client) {
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
    sql: "INSERT INTO users VALUES (?, ?)",
    args: [OWNER_TASKS_ID, OWNER_CLERK],
  });
  for (const [id, archivedAt] of [
    [ACTIVE_PROJECT, null],
    [ARCHIVED_PROJECT, 1_786_000_000],
  ] as const) {
    await client.execute({
      sql: `INSERT INTO workspaces (id, slug, name, owner_user_id, planning_period_id, active_domain, archived_at)
            VALUES (?, ?, ?, ?, NULL, NULL, ?)`,
      args: [id, id, id, OWNER_TASKS_ID, archivedAt],
    });
    await client.execute({
      sql: "INSERT INTO workspace_members VALUES (?, ?, 'owner')",
      args: [id, OWNER_TASKS_ID],
    });
  }
}

async function harness(t: { after: (fn: () => void) => void }) {
  const timeline = createClient({ url: TIMELINE_URL });
  const tasks = createClient({ url: TASKS_URL });
  t.after(() => {
    timeline.close();
    tasks.close();
  });
  await resetTimeline(timeline);
  await resetTasks(tasks);
  return { timeline, tasks, ...(await load()) };
}

test.after(() => {
  try {
    rmSync(SCRATCH_DIR, { recursive: true, force: true });
  } catch {
    /* left for the OS */
  }
});

test("the archive state is proved, denied, or explicitly unknown", async (t) => {
  const h = await harness(t);

  assert.deepEqual(
    await h.readBoundProjectArchiveState(OWNER_CLERK, { suiteWorkspaceId: ARCHIVED_PROJECT }),
    { kind: "archived" },
  );
  assert.deepEqual(
    await h.readBoundProjectArchiveState(OWNER_CLERK, { suiteWorkspaceId: ACTIVE_PROJECT }),
    { kind: "active" },
  );
  // A Timeline bound to nothing has no Project to be archived. That is not a
  // failure and must not read as one.
  assert.deepEqual(
    await h.readBoundProjectArchiveState(OWNER_CLERK, { suiteWorkspaceId: null }),
    { kind: "unknown", reason: "unbound" },
  );
  // Someone who is not a member cannot prove anything about the Project.
  assert.deepEqual(
    await h.readBoundProjectArchiveState("user_stranger", { suiteWorkspaceId: ACTIVE_PROJECT }),
    { kind: "unknown", reason: "not-a-member" },
  );
});

test("an unreachable Tasks database is unknown, never a silent 'active'", async (t) => {
  const h = await harness(t);
  const original = process.env.TASKS_DATABASE_URL;
  process.env.TASKS_DATABASE_URL = pathToFileURL(join(SCRATCH_DIR, "missing.db")).href;
  try {
    const state = await h.readBoundProjectArchiveState(OWNER_CLERK, {
      suiteWorkspaceId: ARCHIVED_PROJECT,
    });
    assert.equal(state.kind, "unknown");
    // Reporting `active` here would let an outage quietly re-open an archived
    // Project for editing; reporting `archived` would take every live Timeline
    // read-only for the length of it. Neither is true, so neither is said.
    assert.notEqual(state.kind, "active");
    assert.notEqual(state.kind, "archived");
  } finally {
    process.env.TASKS_DATABASE_URL = original;
  }
});

test("publishing is refused on an archived Project, and revoke does not come through this gate", async (t) => {
  const h = await harness(t);

  await assert.rejects(
    () => h.requireFreshAudienceMutationAuthority(OWNER_CLERK, {
      slug: "archived-plan",
      ownerUserId: OWNER_CLERK,
      suiteWorkspaceId: ARCHIVED_PROJECT,
    }),
    /archived, so no new shared link can be made/,
  );

  // The same owner, the same act, on a live Project: allowed.
  assert.deepEqual(
    await h.requireFreshAudienceMutationAuthority(OWNER_CLERK, {
      slug: "live-plan",
      ownerUserId: OWNER_CLERK,
      suiteWorkspaceId: ACTIVE_PROJECT,
    }),
    { kind: "tasks", sourceWorkspaceId: ACTIVE_PROJECT },
  );

  // And the refusal reaches exactly the three minting actions. Revoke and
  // unpublish must not route through this function — an owner has to be able
  // to switch a leaked link off whatever state the Project is in.
  const actions = readFileSync(
    "src/modules/timeline/server/actions/audience-timeline.ts",
    "utf8",
  );
  const bodyOf = (name: string) => {
    const start = actions.indexOf(`export async function ${name}(`);
    assert.notEqual(start, -1, `${name} must exist`);
    return actions.slice(start, actions.indexOf("\nexport ", start + 1));
  };
  for (const minting of [
    "createAudiencePublicationAction",
    "publishAudiencePublicationAction",
    "rotateAudienceShareAction",
  ]) {
    assert.match(
      bodyOf(minting),
      /withFreshAudienceMutationAuthority\(/,
      `${minting} mints a bearer link and must pass the archived gate`,
    );
  }
  for (const reachable of [
    "revokeAudienceShareAction",
    "unpublishAudiencePublicationAction",
  ]) {
    assert.ok(
      !bodyOf(reachable).includes("withFreshAudienceMutationAuthority("),
      `${reachable} must stay reachable on an archived Project — that is a ` +
        "security property, not a nicety",
    );
  }
});

test("the curation actions refuse a proved archive and the page stops offering edit", () => {
  // The three writes are the enforcement; the page is the label. Both are
  // asserted, because a page that hides a control while the action still
  // accepts it is not read-only, and an action that refuses while the page
  // still offers the control is a broken surface.
  const actions = readFileSync(
    "src/modules/timeline/server/actions/workspaces.ts",
    "utf8",
  );
  for (const name of [
    "upsertNodeOverlayAction",
    "createManualMilestoneAction",
    "reorderNodesAction",
  ]) {
    const start = actions.indexOf(`export async function ${name}(`);
    assert.notEqual(start, -1, `${name} must exist`);
    const body = actions.slice(start, actions.indexOf("\nexport ", start + 1));
    assert.match(
      body,
      /const archived = await refuseArchivedCuration\(userId, workspace\);\s*\n\s*if \(archived\) return archived;/,
      `${name} must refuse a proved archive before it writes`,
    );
  }
  assert.match(
    actions,
    /state\.kind === "archived" \? \{ error: ARCHIVED_PROJECT_REFUSAL \} : null/,
    "only a PROVED archive refuses; an unreachable Tasks database does not",
  );

  const page = readFileSync(
    "src/modules/timeline/app/plan/[projectSlug]/page.tsx",
    "utf8",
  );
  assert.match(
    page,
    /const mode: OwnerMode = archived \? "view" : requestedMode;/,
    "`?mode=edit` is not a permission",
  );
  assert.match(page, /canPublish=\{!archived\}/, "publishing is disabled while archived");
  assert.ok(
    !/canRevoke/.test(page),
    "revoke is never gated on archive state, so there is no prop for it",
  );
});
