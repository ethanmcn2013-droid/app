import { test } from "node:test";
import assert from "node:assert/strict";
import { freshMemoryDb } from "@/server/db/memory-test-db";
import {
  ARCHIVED_GROUP_ID,
  LOOSE_GROUP_ID,
  PLANNING_PERIOD_GROUP_PREFIX,
  SHARED_GROUP_ID,
  buildProjectCatalog,
  firstMembershipByCatalogOrder,
  listProjectCatalogPage,
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
  assert.equal(groupOf("in-my-period"), `${PLANNING_PERIOD_GROUP_PREFIX}p-mine`);
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
  // The first column is the caller-visible GROUP, not the period name: a row
  // with no owned period used to hold an empty value there, and an empty value
  // sank the whole column for everybody in the collision.
  assert.deepEqual(
    byRole.allProjects.map((p) => p.disambiguator).sort(),
    ["Active work", "Shared with you"],
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
  // The escape hatch is an authorized rename, not a leaked identifier. The
  // previous assertion here checked that the catalog's JSON contained the
  // string `ws-one",` — which is true because every summary carries its own
  // `id`, and would have stayed true if a raw id had been used as the
  // disambiguator. It proved nothing about the property it was named for.
  // This one checks the actual property.
  const ids = catalog.allProjects.map((p) => String(p.id));
  for (const project of catalog.allProjects) {
    for (const id of ids) {
      assert.equal(
        (project.disambiguator ?? "").includes(id),
        false,
        "no disambiguator may contain any Project id",
      );
    }
  }
});

/**
 * M1. Foreign keys are not enforced per request in this database (see
 * `src/server/account-erasure.ts:44-48`), so `ON DELETE SET NULL` on
 * `workspaces.planning_period_id` is decorative and dangling ids are real.
 */
test("an owned Project whose period row does not join stays in the caller's own group", () => {
  const catalog = buildProjectCatalog(
    [
      row({
        id: "ws-dangling",
        name: "Kitchen refit",
        membershipRole: "owner",
        workspaceOwnerUserId: "me",
        // The id survives; the period row is gone, so nothing joins.
        planningPeriodId: "p-deleted",
        planningPeriodName: null,
        planningPeriodOwnerUserId: null,
      }),
    ],
    "me",
  );
  assert.equal(
    catalog.groups[0].id,
    LOOSE_GROUP_ID,
    "a period id that resolves to nothing tells us nothing; it is not evidence of somebody else's period",
  );
  assert.equal(catalog.allProjects[0].role, "primary-owner");
  assert.equal(catalog.allProjects[0].planningPeriod, null);
});

/**
 * M2. Three Projects sharing a name, two in named periods and one loose. The
 * first version's period column held "" for the loose row, an empty value sank
 * the column, and all three came back unselectable.
 */
test("a mixed grouped-and-loose name collision is disambiguated, not blocked", () => {
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
      row({ id: "ws-loose", name: "Fifth year" }),
    ],
    "me",
  );
  assert.deepEqual(catalog.ambiguousProjectIds, [], "none may be blocked");
  assert.deepEqual(
    catalog.allProjects.map((p) => p.disambiguator).sort(),
    ["2026 school year", "2027 school year", "Active work"],
  );
});

test("archive state is a disambiguation level of its own", () => {
  const created = 1704067200;
  const catalog = buildProjectCatalog(
    [
      row({ id: "ws-live", name: "Wedding", createdAt: created }),
      row({ id: "ws-old", name: "Wedding", createdAt: created, archivedAt: 1699000000 }),
    ],
    "me",
  );
  assert.deepEqual(catalog.ambiguousProjectIds, []);
  assert.deepEqual(
    catalog.allProjects.map((p) => p.disambiguator).sort(),
    ["Active", "Archived"],
  );
});

/**
 * M6. A Planning Period id is user-facing enough to collide with a reserved
 * literal, and a UI keyed on group id would then merge or drop one of them.
 */
test("a Planning Period named like a reserved group does not collide with it", () => {
  const catalog = buildProjectCatalog(
    [
      row({
        id: "ws-in-period",
        name: "In period",
        planningPeriodId: SHARED_GROUP_ID,
        planningPeriodName: "Confusingly named period",
        planningPeriodOwnerUserId: "me",
      }),
      row({
        id: "ws-shared",
        name: "Shared one",
        membershipRole: "member",
        workspaceOwnerUserId: "other",
      }),
    ],
    "me",
  );
  const ids = catalog.groups.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length, "group ids must be unique");
  assert.deepEqual(
    ids.sort(),
    [`${PLANNING_PERIOD_GROUP_PREFIX}${SHARED_GROUP_ID}`, SHARED_GROUP_ID],
  );
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
  assert.equal(catalog.groups[0].id, `${PLANNING_PERIOD_GROUP_PREFIX}p-mine`);
  assert.equal(catalog.groups[0].planningPeriodId, "p-mine");
  assert.equal(catalog.groups[0].name, "Mine");
  assert.equal(catalog.truncated, false);
});

/**
 * B4. The first version had a bare `.limit(2000)` with no `ORDER BY` —
 * strictly less deterministic than the `planning/queries.ts` code it replaced,
 * which did order. Past the cap, which Projects survived was planner-dependent.
 * D-016 R10 records this class of defect.
 */
test("the query is ordered, and the order matches the projection's", async () => {
  const { client, db } = await freshMemoryDb();
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials) VALUES ('me', 'clerk-me', 'black', 'ME');
  `);
  // Inserted in an order that is neither the position order nor the name order.
  const inserts = [
    ["ws-c", "Charlie", 3000],
    ["ws-a", "Alpha", 1000],
    ["ws-d", "Delta", 1000],
    ["ws-b", "Bravo", 2000],
  ] as const;
  for (const [id, name, position] of inserts) {
    await client.execute({
      sql: `INSERT INTO workspaces (id, slug, name, owner_user_id, context_type, position)
            VALUES (?, ?, ?, 'me', 'project', ?)`,
      args: [id, id, name, position],
    });
    await client.execute({
      sql: `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, 'me', 'owner')`,
      args: [id],
    });
  }

  const rows = await listProjectCatalogRows(db, "me");
  assert.deepEqual(
    rows.map((r) => r.id),
    ["ws-a", "ws-d", "ws-b", "ws-c"],
    "position, then name, then id — the same key compareProjects uses",
  );

  // The SQL prefix and the projection must agree about which rows are first,
  // or the cap would keep one set and the chooser would show another.
  const catalog = buildProjectCatalog(rows, "me");
  assert.deepEqual(catalog.allProjects.map((p) => String(p.id)), rows.map((r) => r.id));
});

test("hitting the row cap is surfaced, not swallowed", async () => {
  const { client, db } = await freshMemoryDb();
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials) VALUES ('me', 'clerk-me', 'black', 'ME');
  `);
  const page = await listProjectCatalogPage(db, "me");
  assert.equal(page.truncated, false);
  assert.equal(buildProjectCatalog(page.rows, "me", { truncated: false }).truncated, false);
  // The flag is what a chooser needs in order to say "showing the first N"
  // instead of quietly presenting a planner-dependent subset as the whole list.
  assert.equal(buildProjectCatalog([], "me", { truncated: true }).truncated, true);
});

/**
 * The ambient fallback in `getActiveWorkspaceOrNull` was a bare `.limit(1)`
 * with no ORDER BY, so a cookieless caller with several memberships resolved
 * to a planner-dependent Project. Same class as the catalog query's missing
 * ORDER BY; it survived because it was written as a drop-in with no callers,
 * and WP3 has since adopted it across 65 migrated sites.
 */
test("the first-membership fallback is deterministic across repeated calls", async () => {
  const { client, db } = await freshMemoryDb();
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials) VALUES ('me', 'clerk-me', 'black', 'ME');
  `);
  // Inserted in an order that is neither the position order nor the name order,
  // so a query relying on insertion order would answer "ws-late".
  const inserts = [
    ["ws-late", "Zulu", 500],
    ["ws-b", "Bravo", 1000],
    ["ws-a", "Alpha", 1000],
    ["ws-c", "Charlie", 250],
  ] as const;
  for (const [id, name, position] of inserts) {
    await client.execute({
      sql: `INSERT INTO workspaces (id, slug, name, owner_user_id, context_type, position)
            VALUES (?, ?, ?, 'me', 'project', ?)`,
      args: [id, id, name, position],
    });
    await client.execute({
      sql: `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, 'me', 'owner')`,
      args: [id],
    });
  }

  const answers = new Set<string | null>();
  for (let call = 0; call < 8; call += 1) {
    answers.add(await firstMembershipByCatalogOrder(db, "me"));
  }
  assert.equal(answers.size, 1, "repeated calls must agree");
  assert.equal([...answers][0], "ws-c", "lowest position wins");

  // And it must be the same Project the catalog lists first, so bare entry and
  // the chooser cannot tell the user two different things about where they are.
  const catalog = buildProjectCatalog(await listProjectCatalogRows(db, "me"), "me");
  assert.equal(String(catalog.allProjects[0].id), [...answers][0]);
});

test("the fallback breaks position ties by name, then by id", async () => {
  const { client, db } = await freshMemoryDb();
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials) VALUES ('me', 'clerk-me', 'black', 'ME');
    INSERT INTO workspaces (id, slug, name, owner_user_id, context_type, position) VALUES
      ('ws-z', 'z', 'Same name', 'me', 'project', 1000),
      ('ws-a', 'a', 'Same name', 'me', 'project', 1000);
    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      ('ws-z', 'me', 'owner'),
      ('ws-a', 'me', 'owner');
  `);
  assert.equal(await firstMembershipByCatalogOrder(db, "me"), "ws-a");
});

test("a caller with no membership gets null, not a guess", async () => {
  const { client, db } = await freshMemoryDb();
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials) VALUES ('nobody', 'clerk-nobody', 'red', 'NB');
    INSERT INTO workspaces (id, slug, name, owner_user_id, context_type, position)
      VALUES ('ws-legacy', 'legacy', 'Legacy workspace', 'nobody', 'project', 1000);
  `);
  // Owning the workspaces row is not membership of it.
  assert.equal(await firstMembershipByCatalogOrder(db, "nobody"), null);
});
