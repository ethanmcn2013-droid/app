/**
 * WP1 · the three binding write statements refuse on their own.
 *
 * ── WHY THIS EXISTS (DECISIONS.md D-018) ───────────────────────────────────
 * Two columns bind a Tasks Project to a Timeline — `workspaces.suite_workspace_id`
 * and `projects.source_tasks_workspace_id` — and three statements write them:
 * `createWorkspace` with a suite id, `connectSuiteWorkspace`, and
 * `bindProjectToTasksWorkspace`. Until now every gate lived in a caller, which
 * is why the same defect had to be found three separate times: the resolver's
 * provision path, its adopt path, and `connectSuiteWorkspaceAction`. Each fix
 * closed one door. A fourth caller would have inherited nothing at all.
 *
 * These tests are written from the position of that fourth caller: they call
 * the write statements DIRECTLY, with no gate above them, and assert the
 * statement itself refuses. If a future path forgets, this is what stops it.
 *
 * Run against a real libSQL database, because the refusals are partly SQL —
 * the inherited authority checks the parent row rather than trusting an
 * argument.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { proveTasksProjectOwnership } from "@/modules/timeline/lib/tasks-project-ownership";

const OWNER = "user_owner";
const OTHER = "user_other";
const PROJECT = "ws_a";
const OTHER_PROJECT = "ws_b";

const SCRATCH_DIR = mkdtempSync(join(tmpdir(), "wp1-gates-"));
const TIMELINE_URL = pathToFileURL(join(SCRATCH_DIR, "timeline.db")).href;
process.env.TIMELINE_DATABASE_URL = TIMELINE_URL;
delete process.env.TIMELINE_AUTH_TOKEN;

let queries:
  | typeof import("@/modules/timeline/server/db/timeline-queries")
  | null = null;
let audience:
  | typeof import("@/modules/timeline/server/audience-timeline")
  | null = null;

async function load() {
  queries ??= await import("@/modules/timeline/server/db/timeline-queries");
  audience ??= await import("@/modules/timeline/server/audience-timeline");
  return { ...queries, connectSuiteWorkspace: audience.connectSuiteWorkspace };
}

/** A proof for `tasksWorkspaceId`, held by `actor`. */
function ownershipFor(actor: string, tasksWorkspaceId: string) {
  const proof = proveTasksProjectOwnership(actor, tasksWorkspaceId, {
    kind: "member",
    context: { workspaceId: tasksWorkspaceId, ownerClerkId: actor },
  });
  assert.ok(proof, "fixture proof should mint");
  return proof;
}

async function reset(client: Client): Promise<void> {
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
      .map((s) => s.trim())
      .filter((s) => wanted.test(s))
      .join(";\n") + ";",
  );
}

async function harness(t: { after: (fn: () => void) => void }) {
  const client = createClient({ url: TIMELINE_URL });
  t.after(() => client.close());
  await reset(client);
  return { client, ...(await load()) };
}

async function addWorkspace(
  client: Client,
  slug: string,
  owner: string,
  suiteWorkspaceId: string | null = null,
): Promise<void> {
  await client.execute({
    sql: "INSERT INTO workspaces (slug, name, owner_user_id, suite_workspace_id) VALUES (?, ?, ?, ?)",
    args: [slug, slug, owner, suiteWorkspaceId],
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
  const v = rows.rows[0]?.suite_workspace_id;
  return v == null ? null : String(v);
}

async function projectBindingOf(
  client: Client,
  slug: string,
): Promise<string | null> {
  const rows = await client.execute({
    sql: "SELECT source_tasks_workspace_id FROM projects WHERE workspace_slug = ? AND slug = 'plan'",
    args: [slug],
  });
  const v = rows.rows[0]?.source_tasks_workspace_id;
  return v == null ? null : String(v);
}

test.after(() => {
  try {
    rmSync(SCRATCH_DIR, { recursive: true, force: true });
  } catch {
    /* left for the OS */
  }
});

// ── createWorkspace ─────────────────────────────────────────────────────────

test("createWorkspace refuses a suite binding with no proof", async (t) => {
  const h = await harness(t);
  await assert.rejects(
    () =>
      h.createWorkspace({
        slug: "sneaky",
        name: "Sneaky",
        ownerUserId: OTHER,
        suiteWorkspaceId: PROJECT,
      }),
    /requires proved ownership/,
  );
  assert.equal(await suiteIdOf(h.client, "sneaky"), null);
});

test("createWorkspace refuses a proof issued for another Project", async (t) => {
  const h = await harness(t);
  await assert.rejects(
    () =>
      h.createWorkspace({
        slug: "sneaky",
        name: "Sneaky",
        ownerUserId: OWNER,
        suiteWorkspaceId: PROJECT,
        ownership: ownershipFor(OWNER, OTHER_PROJECT),
      }),
    /different Signal Tasks project/,
  );
});

test("createWorkspace refuses a proof issued to another owner", async (t) => {
  const h = await harness(t);
  await assert.rejects(
    () =>
      h.createWorkspace({
        slug: "sneaky",
        name: "Sneaky",
        ownerUserId: OTHER,
        suiteWorkspaceId: PROJECT,
        ownership: ownershipFor(OWNER, PROJECT),
      }),
    /different owner/,
  );
});

test("createWorkspace still creates an UNBOUND Timeline with no proof", async (t) => {
  // The capability must survive the gate: making a Timeline that claims no
  // Project is not a binding write and needs no proof.
  const h = await harness(t);
  const created = await h.createWorkspace({
    slug: "mine",
    name: "Mine",
    ownerUserId: OWNER,
  });
  assert.equal(created.suiteWorkspaceId, null);
});

test("createWorkspace binds when the proof matches", async (t) => {
  const h = await harness(t);
  const created = await h.createWorkspace({
    slug: "mine",
    name: "Mine",
    ownerUserId: OWNER,
    suiteWorkspaceId: PROJECT,
    ownership: ownershipFor(OWNER, PROJECT),
  });
  assert.equal(created.suiteWorkspaceId, PROJECT);
});

// ── connectSuiteWorkspace ───────────────────────────────────────────────────

test("connectSuiteWorkspace refuses a proof for another Project", async (t) => {
  const h = await harness(t);
  await addWorkspace(h.client, "mine", OWNER);
  await assert.rejects(
    () =>
      h.connectSuiteWorkspace(
        "mine",
        OWNER,
        PROJECT,
        ownershipFor(OWNER, OTHER_PROJECT),
      ),
    /different Signal Tasks project/,
  );
  assert.equal(await suiteIdOf(h.client, "mine"), null);
});

test("connectSuiteWorkspace refuses a proof held by someone else", async (t) => {
  const h = await harness(t);
  await addWorkspace(h.client, "mine", OTHER);
  await assert.rejects(
    () =>
      h.connectSuiteWorkspace("mine", OTHER, PROJECT, ownershipFor(OWNER, PROJECT)),
    /different owner/,
  );
  assert.equal(await suiteIdOf(h.client, "mine"), null);
});

test("connectSuiteWorkspace connects when the proof matches", async (t) => {
  const h = await harness(t);
  await addWorkspace(h.client, "mine", OWNER);
  const ok = await h.connectSuiteWorkspace(
    "mine",
    OWNER,
    PROJECT,
    ownershipFor(OWNER, PROJECT),
  );
  assert.equal(ok, true);
  assert.equal(await suiteIdOf(h.client, "mine"), PROJECT);
});

// ── bindProjectToTasksWorkspace ─────────────────────────────────────────────

test("the child binding refuses a proof for another Project", async (t) => {
  const h = await harness(t);
  await addWorkspace(h.client, "mine", OWNER, PROJECT);
  await assert.rejects(
    () =>
      h.bindProjectToTasksWorkspace("mine", "plan", PROJECT, {
        kind: "project-owner",
        ownership: ownershipFor(OWNER, OTHER_PROJECT),
      }),
    /different Signal Tasks project/,
  );
  assert.equal(await projectBindingOf(h.client, "mine"), null);
});

test("inherited authority refuses when the parent carries no binding", async (t) => {
  // The inherited form is not a bypass: the statement reads the parent row
  // itself. An unbound parent inherits nothing.
  const h = await harness(t);
  await addWorkspace(h.client, "mine", OWNER, null);
  await assert.rejects(
    () =>
      h.bindProjectToTasksWorkspace("mine", "plan", PROJECT, {
        kind: "inherits-workspace-binding",
      }),
    /not bound to that Signal Tasks project/,
  );
  assert.equal(await projectBindingOf(h.client, "mine"), null);
});

test("inherited authority refuses a Project the parent is not bound to", async (t) => {
  const h = await harness(t);
  await addWorkspace(h.client, "mine", OWNER, OTHER_PROJECT);
  await assert.rejects(
    () =>
      h.bindProjectToTasksWorkspace("mine", "plan", PROJECT, {
        kind: "inherits-workspace-binding",
      }),
    /not bound to that Signal Tasks project/,
  );
  assert.equal(await projectBindingOf(h.client, "mine"), null);
});

test("inherited authority binds the child to the parent's own Project", async (t) => {
  // The legitimate sync path: authorized as the Timeline's owner, propagating
  // a binding that already exists rather than making a new claim.
  const h = await harness(t);
  await addWorkspace(h.client, "mine", OWNER, PROJECT);
  await h.bindProjectToTasksWorkspace("mine", "plan", PROJECT, {
    kind: "inherits-workspace-binding",
  });
  assert.equal(await projectBindingOf(h.client, "mine"), PROJECT);
});

// ── the proof itself ────────────────────────────────────────────────────────

test("a proof cannot be minted from anything short of proved ownership", () => {
  const ctx = { workspaceId: PROJECT, ownerClerkId: OWNER };
  // Not a member, or the read failed: no proof.
  assert.equal(
    proveTasksProjectOwnership(OWNER, PROJECT, { kind: "not-a-member" }),
    null,
  );
  assert.equal(
    proveTasksProjectOwnership(OWNER, PROJECT, { kind: "unavailable" }),
    null,
  );
  // Membership of a DIFFERENT Project than the one being written.
  assert.equal(
    proveTasksProjectOwnership(OWNER, OTHER_PROJECT, {
      kind: "member",
      context: ctx,
    }),
    null,
  );
  // The Project has no owner row: missing identity is not permission.
  assert.equal(
    proveTasksProjectOwnership(OWNER, PROJECT, {
      kind: "member",
      context: { workspaceId: PROJECT, ownerClerkId: null },
    }),
    null,
  );
  // The actor is a member — even an owner-ROLE member — but not the owner.
  assert.equal(
    proveTasksProjectOwnership(OTHER, PROJECT, { kind: "member", context: ctx }),
    null,
  );
  // And the one case that does mint.
  assert.ok(
    proveTasksProjectOwnership(OWNER, PROJECT, { kind: "member", context: ctx }),
  );
});
