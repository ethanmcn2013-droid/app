/**
 * WP1 · path 7 — `connectSuiteWorkspaceAction`, the third twin.
 *
 * ── WHY THIS IS ITS OWN FILE ───────────────────────────────────────────────
 * `resolveCanonicalTimeline` has two write paths and both are now gated on the
 * Tasks Project's owner. This Server Action is a THIRD way to write the same
 * binding, wired through `useActionState` on /app/timeline/audience, and it
 * proved membership and stopped — `currentMembership.ownerClerkId` was read
 * and never used.
 *
 * It is worse than the two it resembles, and needs no promotion to reach:
 *
 *   1. An ordinary `role: 'member'` of somebody else's Project can bind their
 *      OWN Timeline to it, consuming `uq_workspaces_suite_workspace_id`. The
 *      Project's real owner then hits a unique-index violation on their first
 *      visit, the owner-scoped re-read finds nothing, and they are locked out
 *      permanently.
 *   2. Worse: `syncMilestonesAction` afterwards resolves `canonicalWorkspaceId`
 *      to that Project, the member's Tasks membership is genuine, and the
 *      owner's milestone titles are pulled into a Timeline the member owns —
 *      and may publish on a public bearer link. Plan §6.6 gives members no
 *      publish capability; this routed around it entirely.
 *
 * A Server Action is addressable by any authenticated user whatever the UI
 * renders, so "the form is not shown to members" is not a control.
 *
 * ── HOW THE ACTOR IS AUTHENTICATED HERE ────────────────────────────────────
 * `requireUser()` returns the keyless-dev identity when NODE_ENV is not
 * production, Clerk is unconfigured and the access mode is development
 * (`timeline-auth-policy.ts`). The test therefore drives the action as that
 * one subject, which is enough: the attacker is the authenticated user, and
 * the victim only has to exist in the Tasks database as the Project's owner.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";

/** Must match DEV_FALLBACK_USER in src/modules/timeline/server/auth.ts. */
const ACTOR = "david";
const ACTOR_TASKS_ID = "u_actor";
const VICTIM = "user_b_owner";
const VICTIM_TASKS_ID = "u_victim";
const PROJECT = "ws_a";
const ACTOR_TIMELINE = "a-personal";

const SCRATCH_DIR = mkdtempSync(join(tmpdir(), "wp1-connect-"));
const TIMELINE_URL = pathToFileURL(join(SCRATCH_DIR, "timeline.db")).href;
const TASKS_URL = pathToFileURL(join(SCRATCH_DIR, "tasks.db")).href;

process.env.TIMELINE_DATABASE_URL = TIMELINE_URL;
delete process.env.TIMELINE_AUTH_TOKEN;
process.env.TASKS_DATABASE_URL = TASKS_URL;
process.env.TASKS_AUTH_TOKEN = "test-token";
// Keyless-dev identity, and no rate limiter to configure.
process.env.SIGNAL_ACCESS_MODE = "development";
delete process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE;
delete process.env.NEXT_PUBLIC_DEMO_MODE;
delete process.env.DEMO_MODE;
delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
delete process.env.CLERK_SECRET_KEY;

let connectSuiteWorkspaceAction:
  | typeof import("@/modules/timeline/server/actions/audience-timeline")["connectSuiteWorkspaceAction"]
  | null = null;

async function load() {
  connectSuiteWorkspaceAction ??= (
    await import("@/modules/timeline/server/actions/audience-timeline")
  ).connectSuiteWorkspaceAction;
  return connectSuiteWorkspaceAction;
}

async function resetTimeline(client: Client): Promise<void> {
  await client.executeMultiple(`
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS workspaces;
    DROP TABLE IF EXISTS node_overlays;
  `);
  const baseline = readFileSync(
    "drizzle-timeline/0000_timeline_baseline.sql",
    "utf8",
  );
  const wanted =
    /^CREATE (TABLE|UNIQUE INDEX|INDEX) `?(tasks|projects|workspaces|node_overlays|uq_workspaces_suite_workspace_id|idx_workspaces_owner)`?/;
  await client.executeMultiple(
    baseline
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter((statement) => wanted.test(statement))
      .join(";\n") + ";",
  );
  // The actor's own Timeline: theirs, and connected to nothing.
  await client.execute({
    sql: "INSERT INTO workspaces (slug, name, owner_user_id) VALUES (?, 'A personal', ?)",
    args: [ACTOR_TIMELINE, ACTOR],
  });
}

/**
 * One Tasks Project owned by the victim. `role` is the variable under test:
 * 'member' is the case that needs no promotion at all.
 */
async function resetTasks(client: Client, actorRole: string): Promise<void> {
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
    sql: "INSERT INTO users VALUES (?, ?), (?, ?)",
    args: [VICTIM_TASKS_ID, VICTIM, ACTOR_TASKS_ID, ACTOR],
  });
  await client.execute({
    sql: `INSERT INTO workspaces
          (id, slug, name, owner_user_id, planning_period_id, active_domain, archived_at)
          VALUES (?, 'project-a', 'Project A', ?, NULL, NULL, NULL)`,
    args: [PROJECT, VICTIM_TASKS_ID],
  });
  await client.execute({
    sql: "INSERT INTO workspace_members VALUES (?, ?, 'owner'), (?, ?, ?)",
    args: [
      PROJECT,
      VICTIM_TASKS_ID,
      PROJECT,
      ACTOR_TASKS_ID,
      actorRole,
    ],
  });
}

function form(workspaceSlug: string, suiteWorkspaceId: string): FormData {
  const data = new FormData();
  data.set("workspaceSlug", workspaceSlug);
  data.set("suiteWorkspaceId", suiteWorkspaceId);
  return data;
}

async function suiteIdOf(client: Client, slug: string): Promise<string | null> {
  const rows = await client.execute({
    sql: "SELECT suite_workspace_id FROM workspaces WHERE slug = ?",
    args: [slug],
  });
  const value = rows.rows[0]?.suite_workspace_id;
  return value == null ? null : String(value);
}

async function harness(
  t: { after: (fn: () => void) => void },
  actorRole: string,
) {
  const timeline = createClient({ url: TIMELINE_URL });
  const tasks = createClient({ url: TASKS_URL });
  t.after(() => {
    timeline.close();
    tasks.close();
  });
  await resetTimeline(timeline);
  await resetTasks(tasks, actorRole);
  return { timeline, tasks, action: await load() };
}

test.after(() => {
  try {
    rmSync(SCRATCH_DIR, { recursive: true, force: true });
  } catch {
    /* left for the OS */
  }
});

test("an ordinary member cannot connect their own Timeline to the owner's Project", async (t) => {
  // THE repro. No promotion, no UI affordance, just a POST.
  const h = await harness(t, "member");

  const state = await h.action(
    { status: "idle" },
    form(ACTOR_TIMELINE, PROJECT),
  );

  assert.equal(state.status, "error");
  assert.equal(
    await suiteIdOf(h.timeline, ACTOR_TIMELINE),
    null,
    "the binding must not be written: this consumes the Project's one suite " +
      "id, locks its real owner out, and opens their milestones to a Timeline " +
      "the member can publish",
  );
});

test("a promoted co-owner cannot either", async (t) => {
  // `setMemberRoleAction` hands out `role: 'owner'`. It is a capability, not
  // ownership, and it must not open this door any more than it opened the
  // resolver's.
  const h = await harness(t, "owner");

  const state = await h.action(
    { status: "idle" },
    form(ACTOR_TIMELINE, PROJECT),
  );

  assert.equal(state.status, "error");
  assert.equal(await suiteIdOf(h.timeline, ACTOR_TIMELINE), null);
});

test("the Project's own owner still connects their Timeline", async (t) => {
  // The capability this action exists for must survive the gate. Here the
  // actor IS the Project's owner in Tasks.
  const h = await harness(t, "owner");
  await h.tasks.execute({
    sql: "UPDATE workspaces SET owner_user_id = ? WHERE id = ?",
    args: [ACTOR_TASKS_ID, PROJECT],
  });

  const state = await h.action(
    { status: "idle" },
    form(ACTOR_TIMELINE, PROJECT),
  );

  assert.equal(
    await suiteIdOf(h.timeline, ACTOR_TIMELINE),
    PROJECT,
    "the Project's owner may still connect their own Timeline to it",
  );
  // The returned status is NOT asserted here, and the reason is worth stating
  // rather than hiding behind a loose matcher: the action ends with
  // `revalidatePath`, which throws "static generation store missing" outside a
  // Next request scope, so a Node test process always sees the catch. The row
  // is the fact this test exists for, and the row is observable. What is
  // asserted instead is that the refusal is NOT the reason.
  assert.ok(
    !state.message?.includes("Only the owner"),
    "the owner must not be refused by the ownership gate",
  );
});

test("a non-member cannot connect, unchanged", async (t) => {
  const h = await harness(t, "member");
  await h.tasks.execute({
    sql: "DELETE FROM workspace_members WHERE user_id = ?",
    args: [ACTOR_TASKS_ID],
  });

  const state = await h.action(
    { status: "idle" },
    form(ACTOR_TIMELINE, PROJECT),
  );

  assert.equal(state.status, "error");
  assert.equal(await suiteIdOf(h.timeline, ACTOR_TIMELINE), null);
});
