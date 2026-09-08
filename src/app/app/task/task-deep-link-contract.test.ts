import { test } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { freshMemoryDb } from "@/server/db/memory-test-db";
import { tasks } from "@/server/db/schema";
import { listProjectCatalogRows } from "@/server/projects/catalog";
import { resolveActiveProjectForRouteWith } from "@/server/projects/resolve";
import { assertProjectId, type ProjectId } from "@/lib/projects/project-ref";
import type { Task } from "@/lib/data";
import {
  canonicalTaskUrl,
  decideTaskRouteWith,
  type TaskRouteDeps,
} from "./[id]/resolve-task-route";

/**
 * WP3 defect 1 — `/app/task/[id]` resolved via the ambient cookie.
 *
 * Deliberately one directory above the route it proves. Node's test runner
 * treats its arguments as glob patterns, and `[id]` is a character class, so a
 * test living inside the dynamic segment can only be addressed as
 * `[[]id[]]` — an unreadable thing to pin a CI command to. The import below
 * keeps the literal path; only the *runner's* argument needed to be plain.
 *
 * Proved against a real schema-baseline database rather than a stub, so the
 * membership join that does the authorizing is the one that ships.
 *
 * The fixture is the shape the defect needs: one caller who is a full member
 * of **two** Projects, plus a third Project they have no membership of. The
 * old code could only ever see one of the two at a time.
 */
async function fixture() {
  const harness = await freshMemoryDb();
  await harness.client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials) VALUES
      ('me', 'clerk-me', 'black', 'ME'),
      ('stranger', 'clerk-stranger', 'blue', 'ST');

    INSERT INTO workspaces
      (id, slug, name, owner_user_id, planning_period_id, context_type, position, archived_at, revision, created_at)
    VALUES
      ('ws-a', 'a', 'Project A', 'me', NULL, 'project', 1000, NULL, 1, 1700000000),
      ('ws-b', 'b', 'Project B', 'me', NULL, 'project', 2000, NULL, 1, 1700000000),
      ('ws-old', 'old', 'Archived project', 'me', NULL, 'project', 3000, 1699000000, 1, 1690000000),
      ('ws-x', 'x', 'Someone else', 'stranger', NULL, 'project', 1000, NULL, 1, 1700000000);

    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      ('ws-a', 'me', 'owner'),
      ('ws-b', 'me', 'owner'),
      ('ws-old', 'me', 'owner'),
      ('ws-x', 'stranger', 'owner');

    INSERT INTO tasks (id, workspace_id, title, lane, priority, archived_at) VALUES
      ('t-in-a', 'ws-a', 'Task in A', 'todo', 'medium', NULL),
      ('t-in-b', 'ws-b', 'Task in B', 'todo', 'medium', NULL),
      ('t-archived', 'ws-b', 'Archived task in B', 'todo', 'medium', 1699000000),
      ('t-in-old', 'ws-old', 'Task in an archived project', 'todo', 'medium', NULL),
      ('t-in-x', 'ws-x', 'Task nobody may see', 'todo', 'medium', NULL);
  `);
  return harness;
}

type Harness = Awaited<ReturnType<typeof fixture>>;

/**
 * Production-shaped dependencies. `authorize` runs the real resolver over the
 * real database; `loadDetail` keeps the real `byWorkspace`-equivalent tenant
 * predicate so the scoped read is the one being proved.
 */
function deps(harness: Harness, actorUserId: string): TaskRouteDeps {
  return {
    loadTaskProject: async (id) => {
      const [row] = await harness.db
        .select({ workspaceId: tasks.workspaceId })
        .from(tasks)
        // isolation-ok: this read exists to LEARN the tenant, which is the
        // value a predicate would have to guess. Nothing from the row reaches
        // a caller before `authorize` proves membership of it.
        .where(eq(tasks.id, id));
      return row?.workspaceId;
    },
    authorize: async (storedWorkspaceId) => {
      const resolution = await resolveActiveProjectForRouteWith(
        harness.db,
        { actorUserId, requestedWorkspaceId: storedWorkspaceId },
        listProjectCatalogRows,
      );
      if (resolution.state.kind === "ready") {
        return { kind: "ready", workspaceId: resolution.state.project.id };
      }
      if (resolution.state.kind === "archived") {
        return { kind: "archived", workspaceId: resolution.state.project.id };
      }
      return { kind: resolution.state.kind };
    },
    loadDetail: async (id, provenWorkspaceId) => {
      const [row] = await harness.db
        .select({
          id: tasks.id,
          title: tasks.title,
          archivedAt: tasks.archivedAt,
        })
        .from(tasks)
        .where(and(eq(tasks.workspaceId, provenWorkspaceId), eq(tasks.id, id)));
      if (!row) return null;
      return {
        task: { id: row.id, title: row.title } as Task,
        archived: row.archivedAt != null,
      };
    },
  };
}

test("REGRESSION: a task in another Project the caller is a member of now resolves", async () => {
  const harness = await fixture();

  // Before the fix this was the defect: cookie on A, link into B, "not found".
  // The decision no longer consults a cookie at all.
  const decision = await decideTaskRouteWith("t-in-b", deps(harness, "me"));

  assert.equal(decision.kind, "canonical");
  assert(decision.kind === "canonical");
  assert.equal(decision.workspaceId, "ws-b", "the task's OWN Project, not the cookie's");
  assert.equal(decision.taskId, "t-in-b");
});

test("the canonical URL carries the task's own Project and the task", async () => {
  const harness = await fixture();
  const decision = await decideTaskRouteWith("t-in-b", deps(harness, "me"));
  assert(decision.kind === "canonical");

  const url = canonicalTaskUrl(decision.workspaceId, decision.taskId);
  // Parameter order follows `withActiveProject`, which preserves the local
  // parameters it was handed and then sets the Project. Order is not
  // semantically meaningful; both parameters being present is.
  assert.equal(url, "/app/tasks?task=t-in-b&workspaceId=ws-b");
  const parsed = new URLSearchParams(url.slice(url.indexOf("?") + 1));
  assert.equal(parsed.get("workspaceId"), "ws-b");
  assert.equal(parsed.get("task"), "t-in-b");

  // ADR 0001 §8: a V3 link never emits V2 context vocabulary, and never a
  // retired path.
  for (const banned of ["sourceProduct", "contextVersion", "planningPeriodId", "projectId="]) {
    assert(!url.includes(banned), `canonical URL must not emit ${banned}`);
  }
  for (const retired of ["/app/board", "/app/plan", "/app/brief", "/app/signal"]) {
    assert(!url.startsWith(retired), `must never emit the retired path ${retired}`);
  }
});

test("a task in a Project the caller has no membership of is not-found", async () => {
  const harness = await fixture();
  const decision = await decideTaskRouteWith("t-in-x", deps(harness, "me"));
  assert.equal(decision.kind, "not-found");
});

test("EXISTENCE LEAK: forbidden and missing are byte-identical decisions", async () => {
  const harness = await fixture();
  const forbidden = await decideTaskRouteWith("t-in-x", deps(harness, "me"));
  const missing = await decideTaskRouteWith("t-does-not-exist", deps(harness, "me"));
  const empty = await decideTaskRouteWith("", deps(harness, "me"));

  // Deep equality, not just `kind`: any field added later that distinguished
  // the two — a reason code, a message, a Project name — fails here.
  assert.deepEqual(forbidden, missing);
  assert.deepEqual(missing, empty);
  assert.deepEqual(forbidden, { kind: "not-found" });
  assert.equal(
    Object.keys(forbidden).length,
    1,
    "no server-side reason code may ride along to the client",
  );
});

test("an archived task stays on the focus route rather than canonicalising", async () => {
  const harness = await fixture();
  const decision = await decideTaskRouteWith("t-archived", deps(harness, "me"));
  // The board filters archived rows out, so ?task= would open a panel for a
  // task the board cannot list.
  assert.equal(decision.kind, "archived");
  assert(decision.kind === "archived");
  assert.equal(decision.workspaceId, "ws-b", "the archived display retains the same proven project");
});

test("a task inside an archived Project is still readable", async () => {
  const harness = await fixture();
  const decision = await decideTaskRouteWith("t-in-old", deps(harness, "me"));
  // ADR 0001 §5: archived Projects are openable read-only through an explicit
  // link. The proof passes; the task itself is not archived.
  assert.equal(decision.kind, "canonical");
  assert(decision.kind === "canonical");
  assert.equal(decision.workspaceId, "ws-old");
});

test("the proof runs before the data read, and refuses on its own", async () => {
  const harness = await fixture();
  const calls: string[] = [];
  const base = deps(harness, "me");

  const decision = await decideTaskRouteWith("t-in-x", {
    loadTaskProject: async (id) => {
      calls.push("load-project");
      return base.loadTaskProject(id);
    },
    authorize: async (ws) => {
      calls.push("authorize");
      return base.authorize(ws);
    },
    loadDetail: async (id, ws) => {
      calls.push("load-detail");
      return base.loadDetail(id, ws);
    },
  });

  assert.equal(decision.kind, "not-found");
  // The task content is never read for a caller who failed the proof. An
  // authorization that ran *after* the read would still return not-found here
  // while having touched another tenant's row.
  assert.deepEqual(calls, ["load-project", "authorize"]);
});

test("the tenant-scoped read is scoped by the PROVEN Project, not a passed-in guess", async () => {
  const harness = await fixture();
  const seen: ProjectId[] = [];
  const base = deps(harness, "me");

  await decideTaskRouteWith("t-in-b", {
    ...base,
    loadDetail: async (id, ws) => {
      seen.push(ws);
      return base.loadDetail(id, ws);
    },
  });

  assert.deepEqual(seen, [assertProjectId("ws-b")]);
});
