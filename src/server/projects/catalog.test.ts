import { test } from "node:test";
import assert from "node:assert/strict";
import { freshMemoryDb } from "@/server/db/memory-test-db";
import {
  ARCHIVED_GROUP_ID,
  LOOSE_GROUP_ID,
  SHARED_GROUP_ID,
  buildProjectCatalog,
  listProjectCatalogRows,
  type ProjectCatalogRow,
} from "@/server/projects/catalog";

/**
 * The catalog is the surface where a lost Project is invisible rather than
 * loud, so these tests are mostly about totality: every authorized Project
 * appears, exactly once, in exactly one group.
 */

function row(overrides: Partial<ProjectCatalogRow> & { id: string }): ProjectCatalogRow {
  return {
    slug: overrides.id,
    name: overrides.id,
    membershipRole: "owner",
    workspaceOwnerUserId: "me",
    planningPeriodId: null,
    planningPeriodName: null,
    planningPeriodOwnerUserId: null,
    planningPeriodStartDate: null,
    planningPeriodEndDate: null,
    planningPeriodContextType: null,
    position: 1000,
    revision: 1,
    archivedAt: null,
    createdAt: 1700000000,
    activeRootTaskCount: 0,
    ...overrides,
  };
}

test("grouped, loose and shared branches are all merged, and nothing is dropped", () => {
  const rows: ProjectCatalogRow[] = [
    row({
      id: "in-my-period",
      planningPeriodId: "p-mine",
      planningPeriodName: "2026 school year",
      planningPeriodOwnerUserId: "me",
      planningPeriodStartDate: "2026-09-01",
    }),
    // The regression. The shipped catalog files this under "Shared with you"
    // because its `else if` reaches `null !== actor` for a periodless Project.
    row({ id: "mine-no-period" }),
    row({ id: "shared-no-period", membershipRole: "member", workspaceOwnerUserId: "other" }),
    row({
      id: "shared-in-their-period",
      membershipRole: "member",
      workspaceOwnerUserId: "other",
      planningPeriodId: "p-theirs",
      planningPeriodName: "Their season",
      planningPeriodOwnerUserId: "other",
    }),
    row({ id: "archived-one", archivedAt: 1699000000 }),
  ];

  const catalog = buildProjectCatalog(rows, "me");

  assert.deepEqual(
    catalog.allProjects.map((p) => p.id).sort(),
    rows.map((r) => r.id).sort(),
    "every authorized Project must appear",
  );
  assert.equal(
    new Set(catalog.allProjects.map((p) => p.id)).size,
    rows.length,
    "and exactly once",
  );

  const groupOf = (id: string) =>
    catalog.groups.find((g) => g.projects.some((p) => p.id === id))?.id;
  assert.equal(groupOf("in-my-period"), "p-mine");
  assert.equal(groupOf("mine-no-period"), LOOSE_GROUP_ID);
  assert.equal(groupOf("shared-no-period"), SHARED_GROUP_ID);
  assert.equal(groupOf("shared-in-their-period"), SHARED_GROUP_ID);
  assert.equal(groupOf("archived-one"), ARCHIVED_GROUP_ID);
});

test("a Project in an owned period is emitted even when there are many periods", () => {
  // The second shipped defect: `grouped` was keyed by period id but the output
  // was rebuilt from a separately queried, .limit(200) period list. Period
  // metadata rides on the membership row here, so there is no second list.
  const rows = Array.from({ length: 250 }, (_, index) =>
    row({
      id: `ws-${String(index).padStart(3, "0")}`,
      planningPeriodId: `p-${String(index).padStart(3, "0")}`,
      planningPeriodName: `Period ${index}`,
      planningPeriodOwnerUserId: "me",
      planningPeriodStartDate: `20${26 + (index % 10)}-01-0${(index % 9) + 1}`,
    }),
  );
  const catalog = buildProjectCatalog(rows, "me");
  assert.equal(catalog.allProjects.length, 250);
  assert.equal(catalog.groups.length, 250);
});

test("another owner's Planning Period name and dates are never exposed", () => {
  const catalog = buildProjectCatalog(
    [
      row({
        id: "shared",
        membershipRole: "member",
        workspaceOwnerUserId: "other",
        planningPeriodId: "p-theirs",
        planningPeriodName: "Their private season",
        planningPeriodOwnerUserId: "other",
        planningPeriodStartDate: "2026-05-01",
        planningPeriodEndDate: "2026-10-01",
      }),
    ],
    "me",
  );
  const serialized = JSON.stringify(catalog);
  assert.equal(serialized.includes("Their private season"), false);
  assert.equal(serialized.includes("2026-05-01"), false);
  assert.equal(catalog.allProjects[0].planningPeriod, null);
  assert.equal(catalog.groups[0].id, SHARED_GROUP_ID);
});

test("a co-owner inside somebody else's period is also filed under Shared with you", () => {
  const catalog = buildProjectCatalog(
    [
      row({
        id: "co-owned",
        membershipRole: "owner",
        workspaceOwnerUserId: "other",
        planningPeriodId: "p-theirs",
        planningPeriodName: "Their season",
        planningPeriodOwnerUserId: "other",
      }),
    ],
    "me",
  );
  assert.equal(catalog.groups[0].id, SHARED_GROUP_ID);
  assert.equal(catalog.allProjects[0].planningPeriod, null);
  assert.equal(catalog.allProjects[0].role, "owner");
  // Co-owner keeps reversible management, never permanent delete or transfer.
  assert.equal(catalog.allProjects[0].capabilities.manageProject, true);
  assert.equal(catalog.allProjects[0].capabilities.deleteOrTransferOwnership, false);
  // And may not move it into a period they do not own.
  assert.equal(catalog.allProjects[0].capabilities.moveIntoPlanningPeriod, false);
});

test("ordering is deterministic and independent of input order", () => {
  const rows = [
    row({ id: "c", name: "Beta", position: 2000 }),
    row({ id: "a", name: "Alpha", position: 1000 }),
    row({ id: "b", name: "Alpha", position: 1000 }),
  ];
  const forward = buildProjectCatalog(rows, "me").allProjects.map((p) => p.id);
  const reversed = buildProjectCatalog([...rows].reverse(), "me").allProjects.map(
    (p) => p.id,
  );
  assert.deepEqual(forward, reversed);
  // position, then name, then id — a total order with no ties left over.
  assert.deepEqual(forward, ["a", "b", "c"]);
});

test("archived Projects are collapsed, read-only, and out of the ordinary groups", () => {
  const catalog = buildProjectCatalog(
    [
      row({ id: "live" }),
      row({
        id: "old",
        archivedAt: 1699000000,
        planningPeriodId: "p-mine",
        planningPeriodName: "2026",
        planningPeriodOwnerUserId: "me",
      }),
    ],
    "me",
  );
  const archived = catalog.groups.find((g) => g.id === ARCHIVED_GROUP_ID);
  assert(archived);
  assert.equal(archived.collapsed, true);
  assert.equal(archived.readOnly, true);
  assert.deepEqual(archived.projects.map((p) => p.id), ["old"]);
  // Archived is last.
  assert.equal(catalog.groups.at(-1)?.id, ARCHIVED_GROUP_ID);
  // Even an archived Project in an owned period stays out of that period group.
  assert.equal(
    catalog.groups.some((g) => g.id === "p-mine"),
    false,
  );
});

test("duplicate names are disambiguated permission-safely, never by raw id", () => {
  const catalog = buildProjectCatalog(
    [
      row({
        id: "ws-2026",
        name: "Fifth year",
        planningPeriodId: "p-2026",
        planningPeriodName: "2026 school year",
        planningPeriodOwnerUserId: "me",
        planningPeriodStartDate: "2026-09-01",
      }),
      row({
        id: "ws-2027",
        name: "Fifth year",
        planningPeriodId: "p-2027",
        planningPeriodName: "2027 school year",
        planningPeriodOwnerUserId: "me",
        planningPeriodStartDate: "2027-09-01",
      }),
    ],
    "me",
  );
  const labels = catalog.allProjects.map((p) => p.disambiguator);
  assert.deepEqual(labels.sort(), ["2026 school year", "2027 school year"]);
  assert.deepEqual(catalog.ambiguousProjectIds, []);
  for (const project of catalog.allProjects) {
    assert.equal(project.disambiguator?.includes(project.id), false);
  }
});

test("disambiguation escalates to role, then to creation month and year", () => {
  const byRole = buildProjectCatalog(
    [
      row({ id: "ws-mine", name: "Wedding" }),
      row({
        id: "ws-theirs",
        name: "wedding",
        membershipRole: "member",
        workspaceOwnerUserId: "other",
      }),
    ],
    "me",
  );
  // Case-folded collision: a reader sees the same two words.
  assert.deepEqual(
    byRole.allProjects.map((p) => p.disambiguator).sort(),
    ["Shared with you", "Yours"],
  );

  const byMonth = buildProjectCatalog(
    [
      row({ id: "ws-jan", name: "Wedding", createdAt: 1704067200 }),
      row({ id: "ws-jun", name: "Wedding", createdAt: 1719792000 }),
    ],
    "me",
  );
  assert.deepEqual(
    byMonth.allProjects.map((p) => p.disambiguator).sort(),
    ["January 2024", "July 2024"],
  );
});

test("indistinguishable rows are blocked rather than exposed by internal id", () => {
  const created = 1704067200;
  const catalog = buildProjectCatalog(
    [
      row({ id: "ws-one", name: "Wedding", createdAt: created }),
      row({ id: "ws-two", name: "Wedding", createdAt: created }),
    ],
    "me",
  );
  assert.deepEqual([...catalog.ambiguousProjectIds].sort(), ["ws-one", "ws-two"]);
  for (const project of catalog.allProjects) {
    assert.equal(project.disambiguator, null);
  }
  // The escape hatch is an authorized rename, not a leaked identifier.
  assert.equal(JSON.stringify(catalog).includes("ws-one\","), true);
});

test("a repeated Project id collapses instead of appearing twice", () => {
  const catalog = buildProjectCatalog(
    [row({ id: "ws-a", name: "First" }), row({ id: "ws-a", name: "Second" })],
    "me",
  );
  assert.equal(catalog.allProjects.length, 1);
  assert.equal(catalog.allProjects[0].name, "First");
});

test("the query is membership-first: owning a period grants nothing", async () => {
  const { client, db } = await freshMemoryDb();
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials) VALUES
      ('me', 'clerk-me', 'black', 'ME'),
      ('other', 'clerk-other', 'gray', 'OT');
    INSERT INTO planning_periods
      (id, owner_user_id, name, context_type, start_date, end_date, timezone, position)
    VALUES ('p-mine', 'me', 'Mine', 'general', '2026-01-01', '2026-12-31', 'UTC', 1000);
    INSERT INTO workspaces
      (id, slug, name, owner_user_id, planning_period_id, context_type, position)
    VALUES
      ('ws-mine', 'mine', 'Mine', 'me', 'p-mine', 'project', 1000),
      -- Somebody else's Project, parked in a period I own. Owning the period
      -- is not membership of the Project.
      ('ws-not-mine', 'not-mine', 'Not mine', 'other', 'p-mine', 'project', 1000);
    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      ('ws-mine', 'me', 'owner'),
      ('ws-not-mine', 'other', 'owner');
    INSERT INTO tasks (id, workspace_id, title, lane, priority) VALUES
      ('t1', 'ws-mine', 'Open', 'todo', 'medium'),
      ('t2', 'ws-mine', 'Done', 'done', 'medium'),
      ('t3', 'ws-mine', 'Child', 'todo', 'medium');
    UPDATE tasks SET parent_task_id = 't1' WHERE id = 't3';
  `);

  const rows = await listProjectCatalogRows(db, "me");
  assert.deepEqual(rows.map((r) => r.id), ["ws-mine"]);
  assert.equal(rows[0].activeRootTaskCount, 1);
  assert.equal(rows[0].planningPeriodOwnerUserId, "me");

  const catalog = buildProjectCatalog(rows, "me");
  assert.equal(catalog.groups[0].id, "p-mine");
  assert.equal(catalog.groups[0].name, "Mine");
});
