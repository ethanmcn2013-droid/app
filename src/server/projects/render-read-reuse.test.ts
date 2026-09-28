import { test } from "node:test";
import assert from "node:assert/strict";
import { freshMemoryDb } from "@/server/db/memory-test-db";
import { DEMO_USER_ID } from "@/server/demo/tasks-demo";
import { demoMemberWorkspaces, listMyWorkspacesForUser } from "@/server/projects/member-workspaces";
import { getDemoProjectsTreeData, getProjectsTreeForWorkspaces } from "@/server/projects/projects-tree-read";
import { startTasksRenderReads } from "@/server/projects/tasks-render-reads";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const nextTick = () => new Promise<void>((done) => setImmediate(done));

test("persisted member list and tree preserve actor scope, roles, grouping, archived rows and all-task counts", async () => {
  const { client, db } = await freshMemoryDb();
  try {
    await client.executeMultiple(`
      INSERT INTO users (id, clerk_id, color, initials) VALUES
        ('internal_a', 'clerk_a', 'black', 'AA'),
        ('internal_b', 'clerk_b', 'blue', 'BB'),
        ('internal_foreign', 'clerk_foreign', 'gray', 'FF');
      INSERT INTO planning_periods
        (id, owner_user_id, name, context_type, start_date, end_date, timezone, position)
      VALUES ('period_crossyear', 'internal_a', 'Season', 'general', '2026-11-01', '2027-02-28', 'UTC', 1000);
      INSERT INTO workspaces (id, slug, name, owner_user_id, planning_period_id, context_type, position, archived_at) VALUES
        ('ws_a', 'a', 'Same name', 'internal_a', 'period_crossyear', 'project', 1000, NULL),
        ('ws_b', 'b', 'Archived name', 'internal_a', NULL, 'project', 2000, 1700000000),
        ('ws_c', 'c', 'Same name', 'internal_b', NULL, 'project', 3000, NULL),
        ('ws_foreign', 'foreign', 'Foreign', 'internal_foreign', NULL, 'project', 4000, NULL);
      INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
        ('ws_a', 'internal_a', 'owner'),
        ('ws_b', 'internal_a', 'owner'),
        ('ws_b', 'internal_b', 'member'),
        ('ws_c', 'internal_b', 'owner'),
        ('ws_foreign', 'internal_foreign', 'owner');
      INSERT INTO tasks (id, workspace_id, title, lane, priority, archived_at) VALUES
        ('a_open', 'ws_a', 'Open', 'todo', 'medium', NULL),
        ('a_done', 'ws_a', 'Done', 'done', 'medium', NULL),
        ('a_child', 'ws_a', 'Child', 'todo', 'medium', NULL),
        ('a_archived', 'ws_a', 'Archived task', 'todo', 'medium', 1700000000),
        ('b_one', 'ws_b', 'Shared task', 'todo', 'medium', NULL),
        ('foreign_one', 'ws_foreign', 'Foreign task', 'todo', 'medium', NULL);
      UPDATE tasks SET parent_task_id='a_open' WHERE id='a_child';
    `);
    const mineA = await listMyWorkspacesForUser("internal_a", db);
    const mineB = await listMyWorkspacesForUser("internal_b", db);
    assert.deepEqual(mineA.map(({ id, role }) => [id, role]).sort(),
      [["ws_a", "owner"], ["ws_b", "owner"]]);
    assert.deepEqual(mineB.map(({ id, role }) => [id, role]).sort(),
      [["ws_b", "member"], ["ws_c", "owner"]]);
    assert.equal(mineA.some((row) => row.id === "ws_foreign"), false);
    assert.equal(mineB.some((row) => row.id === "ws_a"), false);

    const treeA = await getProjectsTreeForWorkspaces(mineA, db);
    const treeB = await getProjectsTreeForWorkspaces(mineB, db);
    assert.deepEqual(treeA.groups, [{ periodId: "period_crossyear", periodName: "Season",
      dateRange: "1 Nov 2026 – 28 Feb 2027", workspaces: [{ id: "ws_a", name: "Same name", taskCount: 4 }] }]);
    assert.deepEqual(treeA.archived, [{ id: "ws_b", name: "Archived name", taskCount: 1 }]);
    assert.deepEqual(treeB.groups, [{ periodId: null, periodName: null, dateRange: null,
      workspaces: [{ id: "ws_c", name: "Same name", taskCount: 0 }] }]);
    assert.deepEqual(treeB.archived, [{ id: "ws_b", name: "Archived name", taskCount: 1 }]);
    assert.deepEqual(await getProjectsTreeForWorkspaces([], db), { groups: [], archived: [] });
    await client.execute("DELETE FROM workspace_members WHERE workspace_id='ws_b' AND user_id='internal_b'");
    const afterRevocation = await listMyWorkspacesForUser("internal_b", db);
    assert.deepEqual(afterRevocation.map((row) => row.id), ["ws_c"]);
    assert.deepEqual((await getProjectsTreeForWorkspaces(afterRevocation, db)).archived, []);
  } finally { client.close(); }
});

test("render graph resolves identity once, shares exact membership result, and overlaps edition with unrelated work", async () => {
  const identity = deferred<string>();
  const membership = deferred<Array<{ id: string; name: string; slug: string; role: string }>>();
  const tree = deferred<{ groups: []; archived: [] }>();
  const edition = deferred<string | null>();
  const unrelated = deferred<string>();
  const calls: string[] = [];
  const mine = [{ id: "ws_a", name: "A", slug: "a", role: "member" }];
  const reads = startTasksRenderReads({
    getCurrentUser: () => { calls.push("identity"); return identity.promise; },
    listMyWorkspacesForUser: (actor) => { calls.push(`list:${actor}`); return membership.promise; },
    getProjectsTreeForWorkspaces: (value) => { assert.equal(value, mine); calls.push("tree"); return tree.promise; },
    getEdition: (actor) => { calls.push(`edition:${actor}`); return edition.promise; },
  }, false);
  const joined = Promise.all([reads.currentUser, reads.myWorkspaces, reads.projectsTree, reads.edition, unrelated.promise]);
  await nextTick();
  assert.deepEqual(calls, ["identity"]);
  identity.resolve("internal_a"); await nextTick();
  assert.deepEqual(calls, ["identity", "list:internal_a", "edition:internal_a"]);
  membership.resolve(mine); await nextTick();
  assert.deepEqual(calls, ["identity", "list:internal_a", "edition:internal_a", "tree"]);
  tree.resolve({ groups: [], archived: [] }); edition.resolve("Venue");
  let finished = false; void joined.then(() => { finished = true; });
  await nextTick(); assert.equal(finished, false);
  unrelated.resolve("other");
  assert.deepEqual(await joined, ["internal_a", mine, { groups: [], archived: [] }, "Venue", "other"]);
  assert.equal(calls.filter((call) => call === "identity").length, 1);
});

test("rejected or throwing prerequisites fail rendering without unauthorized empty results", async () => {
  for (const failing of ["identity", "list", "tree", "edition"]) {
    const calls: string[] = [];
    const reads = startTasksRenderReads({
      getCurrentUser: async () => { calls.push("identity"); if (failing === "identity") throw Error("identity rejected"); return "actor"; },
      listMyWorkspacesForUser: async () => { calls.push("list"); if (failing === "list") throw Error("list rejected"); return []; },
      getProjectsTreeForWorkspaces: async () => { calls.push("tree"); if (failing === "tree") throw Error("tree rejected"); return { groups: [], archived: [] }; },
      getEdition: async () => { calls.push("edition"); if (failing === "edition") throw Error("edition rejected"); return null; },
    }, false);
    await assert.rejects(Promise.all(Object.values(reads)), new RegExp(`${failing} rejected`));
    if (failing === "identity") assert.deepEqual(calls, ["identity"]);
    if (failing === "list") assert.equal(calls.includes("tree"), false);
  }
  const sync = startTasksRenderReads({
    getCurrentUser: () => { throw Error("synchronous identity failure"); },
    listMyWorkspacesForUser: async () => { throw Error("must not list"); },
    getProjectsTreeForWorkspaces: async () => { throw Error("must not tree"); },
    getEdition: async () => { throw Error("must not read edition"); },
  }, false);
  await assert.rejects(Promise.all(Object.values(sync)), /synchronous identity failure/);
});

test("simultaneous tree and independent failures are both observed by the aggregate", async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    const reads = startTasksRenderReads({
      getCurrentUser: async () => "actor",
      listMyWorkspacesForUser: async () => [],
      getProjectsTreeForWorkspaces: async () => { throw Error("tree failed"); },
      getEdition: async () => { throw Error("edition failed"); },
    }, false);
    await assert.rejects(Promise.all(Object.values(reads)), /tree failed|edition failed/);
    await nextTick();
    assert.deepEqual(unhandled, []);
  } finally { process.off("unhandledRejection", onUnhandled); }
});

test("two overlapping renders and a later invocation never mix actors or retain membership", async () => {
  const deferredLists = new Map([['a', deferred<Array<{ id: string; name: string; slug: string; role: string }>>()],
    ['b', deferred<Array<{ id: string; name: string; slug: string; role: string }>>()]]);
  let identityCalls = 0, listCalls = 0;
  const make = (actor: string) => startTasksRenderReads({
    getCurrentUser: async () => { identityCalls++; return actor; },
    listMyWorkspacesForUser: async (id) => { assert.equal(id, actor); listCalls++; return deferredLists.get(id)!.promise; },
    getProjectsTreeForWorkspaces: async (mine) => ({ groups: [{ periodId: null, periodName: null, dateRange: null,
      workspaces: mine.map((row) => ({ id: row.id, name: row.name, taskCount: 0 })) }], archived: [] }),
    getEdition: async (id) => `edition:${id}`,
  }, false);
  const a = make('a'), b = make('b');
  const resultA = Promise.all([a.currentUser, a.myWorkspaces, a.projectsTree, a.edition]);
  const resultB = Promise.all([b.currentUser, b.myWorkspaces, b.projectsTree, b.edition]);
  await nextTick();
  deferredLists.get('b')!.resolve([{ id: 'b-only', name: 'B', slug: 'b', role: 'owner' }]);
  deferredLists.get('a')!.resolve([{ id: 'a-only', name: 'A', slug: 'a', role: 'owner' }]);
  const [first, second] = await Promise.all([resultA, resultB]);
  assert.equal(first[2].groups[0].workspaces[0].id, 'a-only');
  assert.equal(second[2].groups[0].workspaces[0].id, 'b-only');
  const changed = deferred<Array<{ id: string; name: string; slug: string; role: string }>>();
  deferredLists.set('a', changed);
  const later = make('a');
  const laterResult = Promise.all([later.currentUser, later.myWorkspaces, later.projectsTree, later.edition]);
  changed.resolve([{ id: 'a-after-revocation', name: 'A again', slug: 'a2', role: 'owner' }]);
  const fresh = await laterResult;
  assert.equal(fresh[2].groups[0].workspaces[0].id,
    'a-after-revocation');
  assert.equal(identityCalls, 3); assert.equal(listCalls, 3);
});

test("demo render uses exact fixtures without calling authentication, DB or entitlement adapters", async () => {
  const forbidden = () => { throw Error("demo reached a live adapter"); };
  const reads = startTasksRenderReads({ getCurrentUser: forbidden, listMyWorkspacesForUser: forbidden,
    getProjectsTreeForWorkspaces: forbidden, getEdition: forbidden }, true);
  const [actor, workspaces, tree, edition] = await Promise.all(Object.values(reads));
  assert.equal(actor, DEMO_USER_ID);
  assert.deepEqual(workspaces, demoMemberWorkspaces());
  assert.deepEqual(tree, getDemoProjectsTreeData());
  assert.equal(edition, null);
});
