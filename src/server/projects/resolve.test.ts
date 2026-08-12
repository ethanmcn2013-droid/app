import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { freshMemoryDb } from "@/server/db/memory-test-db";
import { listProjectCatalogRows } from "@/server/projects/catalog";
import { resolveActiveProjectForRouteWith } from "@/server/projects/resolve";

/**
 * ADR 0001 §4 resolution precedence, proved against a real schema-baseline
 * database rather than a hand-built stub, so a schema change that breaks the
 * membership join breaks these too.
 *
 * Fixture, matching the WP0 truth fixture shape: owner A and B, member C,
 * archived D, two Projects sharing a name across two periods, one Project in
 * another owner's period, and an id nobody can reach.
 */
async function fixture() {
  const harness = await freshMemoryDb();
  await harness.client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials) VALUES
      ('me', 'clerk-me', 'black', 'ME'),
      ('other', 'clerk-other', 'gray', 'OT'),
      ('stranger', 'clerk-stranger', 'blue', 'ST');

    INSERT INTO planning_periods
      (id, owner_user_id, name, context_type, start_date, end_date, timezone, position)
    VALUES
      ('p-mine-2026', 'me', '2026 school year', 'school_year', '2026-09-01', '2027-06-30', 'UTC', 1000),
      ('p-mine-2027', 'me', '2027 school year', 'school_year', '2027-09-01', '2028-06-30', 'UTC', 2000),
      ('p-theirs', 'other', 'Their season', 'wedding_season', '2026-05-01', '2026-10-01', 'UTC', 1000);

    INSERT INTO workspaces
      (id, slug, name, owner_user_id, planning_period_id, context_type, position, archived_at, revision, created_at)
    VALUES
      ('ws-a', 'a', 'Fifth year', 'me', 'p-mine-2026', 'project', 1000, NULL, 3, 1700000000),
      ('ws-a2', 'a2', 'Fifth year', 'me', 'p-mine-2027', 'project', 1000, NULL, 1, 1700000000),
      ('ws-loose', 'loose', 'Kitchen refit', 'me', NULL, 'project', 1500, NULL, 1, 1700000000),
      ('ws-shared', 'shared', 'Their wedding', 'other', 'p-theirs', 'project', 1000, NULL, 1, 1700000000),
      ('ws-archived', 'archived', 'Old season', 'me', 'p-mine-2026', 'project', 3000, 1699000000, 2, 1690000000),
      ('ws-unreachable', 'unreachable', 'Nobody sees this', 'stranger', NULL, 'project', 1000, NULL, 1, 1700000000);

    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      ('ws-a', 'me', 'owner'),
      ('ws-a2', 'me', 'owner'),
      ('ws-loose', 'me', 'owner'),
      ('ws-shared', 'other', 'owner'),
      ('ws-shared', 'me', 'member'),
      ('ws-archived', 'me', 'owner'),
      ('ws-unreachable', 'stranger', 'owner');

    INSERT INTO tasks (id, workspace_id, title, lane, priority) VALUES
      ('t-open', 'ws-a', 'Open root task', 'todo', 'medium'),
      ('t-done', 'ws-a', 'Finished root task', 'done', 'medium'),
      ('t-sub', 'ws-a', 'Subtask', 'todo', 'medium'),
      ('t-legacy', 'ws-unreachable', 'Private legacy task', 'todo', 'medium');
    UPDATE tasks SET parent_task_id = 't-open' WHERE id = 't-sub';
  `);
  return harness;
}

function resolve(
  harness: Awaited<ReturnType<typeof fixture>>,
  input: Parameters<typeof resolveActiveProjectForRouteWith>[1],
) {
  return resolveActiveProjectForRouteWith(harness.db, input, listProjectCatalogRows);
}

test("an explicit workspaceId returns that exact Project and never a substitute", async () => {
  const harness = await fixture();
  const result = await resolve(harness, {
    actorUserId: "me",
    requestedWorkspaceId: "ws-a",
  });
  assert.equal(result.state.kind, "ready");
  assert.equal(result.reason, "exact");
  assert.equal(result.redirectTo, null);
  assert(result.state.kind === "ready");
  assert.equal(result.state.project.id, "ws-a");
  assert.equal(result.state.source, "url");
  // One count definition: active top-level tasks. The done root task and the
  // subtask are both excluded.
  assert.equal(result.state.project.activeRootTaskCount, 1);
});

test("a forbidden Project collapses to neutral unavailable and leaks no existence", async () => {
  const harness = await fixture();
  const forbidden = await resolve(harness, {
    actorUserId: "me",
    requestedWorkspaceId: "ws-unreachable",
  });
  const missing = await resolve(harness, {
    actorUserId: "me",
    requestedWorkspaceId: "ws-does-not-exist",
  });
  assert.deepEqual(forbidden.state, { kind: "unavailable" });
  assert.deepEqual(missing.state, { kind: "unavailable" });
  // The client-visible halves are identical: a caller cannot tell "exists but
  // forbidden" from "never existed".
  assert.deepEqual(forbidden.state, missing.state);
  // The server-only reason is the same code for both, by design.
  assert.equal(forbidden.reason, "missing-or-forbidden");
  assert.equal(missing.reason, "missing-or-forbidden");
});

test("a forbidden explicit Project never falls back to an accessible one", async () => {
  const harness = await fixture();
  const result = await resolve(harness, {
    actorUserId: "me",
    requestedWorkspaceId: "ws-unreachable",
    cookieWorkspaceId: "ws-a",
    legacyCookieWorkspaceId: "ws-loose",
  });
  // Both cookies name Projects the caller really is a member of. The explicit
  // branch must still refuse: "never choose a substitute" (ADR 0001 §4).
  assert.deepEqual(result.state, { kind: "unavailable" });
  assert.equal(result.redirectTo, null);
});

test("a malformed or repeated explicit workspaceId is unavailable, not ignored", async () => {
  const harness = await fixture();
  const malformed = await resolve(harness, {
    actorUserId: "me",
    requestedWorkspaceId: "../../etc/passwd",
  });
  const repeated = await resolve(harness, {
    actorUserId: "me",
    requestedWorkspaceId: ["ws-a", "ws-loose"],
  });
  assert.deepEqual(malformed.state, { kind: "unavailable" });
  assert.equal(malformed.reason, "malformed");
  // An ambiguous explicit Project is not an explicit Project, and silently
  // taking the first would be a substitution with extra steps.
  assert.deepEqual(repeated.state, { kind: "unavailable" });
  assert.equal(repeated.reason, "malformed");
});

test("an explicitly requested archived Project opens read-only, not unavailable", async () => {
  const harness = await fixture();
  const result = await resolve(harness, {
    actorUserId: "me",
    requestedWorkspaceId: "ws-archived",
  });
  assert.equal(result.state.kind, "archived");
  assert(result.state.kind === "archived");
  assert.equal(result.state.project.id, "ws-archived");
  assert.equal(result.state.project.capabilities.createOrEditTasks, false);
  // Archive disables new publishing and leaves revocation reachable (ADR §5).
  assert.equal(result.state.project.capabilities.publishTimeline, false);
  assert.equal(result.state.project.capabilities.revokeTimeline, true);
  assert.equal(result.state.project.capabilities.open, true);
});

test("bare entry honours the unified cookie and replace-redirects to a canonical URL", async () => {
  const harness = await fixture();
  const result = await resolve(harness, {
    actorUserId: "me",
    requestedWorkspaceId: undefined,
    cookieWorkspaceId: "ws-loose",
  });
  assert.equal(result.reason, "cookie");
  assert(result.state.kind === "ready");
  assert.equal(result.state.project.id, "ws-loose");
  assert.equal(result.state.source, "fallback");
  assert.equal(result.redirectTo, "ws-loose");
});

test("bare entry falls through to the legacy cookie during migration", async () => {
  const harness = await fixture();
  const result = await resolve(harness, {
    actorUserId: "me",
    requestedWorkspaceId: undefined,
    cookieWorkspaceId: null,
    legacyCookieWorkspaceId: "ws-shared",
  });
  assert.equal(result.reason, "legacy-cookie");
  assert(result.state.kind === "ready");
  assert.equal(result.state.project.id, "ws-shared");
});

test("a cookie naming an archived or unauthorized Project is skipped, not honoured", async () => {
  const harness = await fixture();
  const archivedCookie = await resolve(harness, {
    actorUserId: "me",
    requestedWorkspaceId: undefined,
    cookieWorkspaceId: "ws-archived",
  });
  // ADR 0001 §5: when the last-active Project becomes archived, the next valid
  // active Project becomes the bare-entry default.
  assert.equal(archivedCookie.reason, "first-active");
  assert(archivedCookie.state.kind === "ready");
  assert.equal(archivedCookie.state.project.archivedAt, null);

  const foreignCookie = await resolve(harness, {
    actorUserId: "me",
    requestedWorkspaceId: undefined,
    cookieWorkspaceId: "ws-unreachable",
  });
  assert.equal(foreignCookie.reason, "first-active");
  assert(foreignCookie.state.kind === "ready");
  assert.notEqual(foreignCookie.state.project.id, "ws-unreachable");
});

test("bare entry with no cookie picks the first accessible active Project deterministically", async () => {
  const harness = await fixture();
  const first = await resolve(harness, {
    actorUserId: "me",
    requestedWorkspaceId: undefined,
  });
  const second = await resolve(harness, {
    actorUserId: "me",
    requestedWorkspaceId: undefined,
  });
  assert.equal(first.reason, "first-active");
  assert(first.state.kind === "ready");
  assert(second.state.kind === "ready");
  // Deterministic across calls: the order comes from the catalog projection,
  // not from whatever order SQLite returned rows in.
  assert.equal(first.state.project.id, second.state.project.id);
  assert.equal(first.redirectTo, first.state.project.id);
  assert.equal(first.state.project.archivedAt, null);
});

/**
 * DECISIONS D-005. This is the regression the decision record asks for.
 */
test("D-005: a user with no membership gets the empty state, never LEGACY_WORKSPACE_ID", async () => {
  const harness = await fixture();
  await harness.client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials)
      VALUES ('nobody', 'clerk-nobody', 'red', 'NB');
    INSERT INTO workspaces (id, slug, name, owner_user_id, context_type, position)
      VALUES ('ws-legacy', 'legacy', 'Legacy workspace', 'stranger', 'project', 1000);
    INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ('ws-legacy', 'stranger', 'owner');
    INSERT INTO tasks (id, workspace_id, title, lane, priority)
      VALUES ('t-ws-legacy', 'ws-legacy', 'Private legacy task', 'todo', 'medium');
  `);

  const bare = await resolve(harness, {
    actorUserId: "nobody",
    requestedWorkspaceId: undefined,
  });
  assert.deepEqual(bare.state, { kind: "empty" });
  assert.equal(bare.reason, "no-accessible-project");
  assert.equal(bare.redirectTo, null);

  // The same user carrying a cookie that names the legacy workspace still gets
  // nothing: a cookie is a preference, never a membership proof.
  const withLegacyCookie = await resolve(harness, {
    actorUserId: "nobody",
    requestedWorkspaceId: undefined,
    cookieWorkspaceId: "ws-legacy",
    legacyCookieWorkspaceId: "ws-legacy",
  });
  assert.deepEqual(withLegacyCookie.state, { kind: "empty" });

  // And asking for it outright is unavailable, not granted.
  const explicit = await resolve(harness, {
    actorUserId: "nobody",
    requestedWorkspaceId: "ws-legacy",
  });
  assert.deepEqual(explicit.state, { kind: "unavailable" });

  const serialized = JSON.stringify([bare, withLegacyCookie, explicit]);
  assert.equal(
    serialized.includes("ws-legacy"),
    false,
    "no resolver outcome may carry the legacy workspace id",
  );
});

test("the resolver source names no legacy workspace constant at all", () => {
  const source = readFileSync(
    new URL("./resolve.ts", import.meta.url),
    "utf8",
  );
  // A source guard, not decoration: the defect this replaces was one import
  // and one `return` away, and it would type-check perfectly.
  const code = source
    .replace(/^\s*\*.*$/gm, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*\/\*.*$/gm, "");
  assert.equal(
    /LEGACY_WORKSPACE_ID/.test(code),
    false,
    "resolve.ts must not reference LEGACY_WORKSPACE_ID outside its comments",
  );
});

test("the empty state is reached even when the actor owns periods but no Project", async () => {
  const harness = await fixture();
  await harness.client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials)
      VALUES ('periods-only', 'clerk-po', 'green', 'PO');
    INSERT INTO planning_periods
      (id, owner_user_id, name, context_type, start_date, end_date, timezone, position)
    VALUES ('p-empty', 'periods-only', 'Empty year', 'general', '2026-01-01', '2026-12-31', 'UTC', 1000);
  `);
  const result = await resolve(harness, {
    actorUserId: "periods-only",
    requestedWorkspaceId: undefined,
  });
  // Owning a Planning Period is not membership of anything. A period is a
  // grouping, never an authorization boundary (ADR 0001 §1).
  assert.deepEqual(result.state, { kind: "empty" });
});
