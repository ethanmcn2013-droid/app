import { test } from "node:test";
import assert from "node:assert/strict";
import type { ProjectSummary } from "@/lib/projects/project-ref";
import { assertProjectId } from "@/lib/projects/project-ref";
import {
  decideSnapshotCommit,
  projectChrome,
  routeKey,
  type RouteSnapshot,
} from "@/lib/projects/route-snapshot";

function project(id: string, revision = 1): ProjectSummary {
  return {
    id: assertProjectId(id),
    slug: id,
    name: id.toUpperCase(),
    role: "primary-owner",
    capabilities: {
      open: true,
      viewPrivateTimeline: true,
      createOrEditTasks: true,
      manageProject: true,
      moveIntoPlanningPeriod: true,
      curatePrimaryTimeline: true,
      publishOrRevokeTimeline: true,
      deleteOrTransferOwnership: true,
    },
    planningPeriod: null,
    position: 1000,
    revision,
    archivedAt: null,
    activeRootTaskCount: 0,
    disambiguator: null,
  };
}

const keyA = routeKey("/app/tasks", "ws-a");
const keyB = routeKey("/app/tasks", "ws-b");

function snapshot(key: string, epoch: number, id: string, revision = 1): RouteSnapshot {
  return { routeKey: key, epoch, project: project(id, revision) };
}

test("a snapshot commits when its route key and epoch both match the live transition", () => {
  assert.deepEqual(
    decideSnapshotCommit(snapshot(keyA, 1, "ws-a"), { routeKey: keyA, epoch: 1 }, null),
    { commit: true },
  );
});

test("B's payload never commits while the live route is A", () => {
  assert.deepEqual(
    decideSnapshotCommit(snapshot(keyB, 1, "ws-b"), { routeKey: keyA, epoch: 1 }, null),
    { commit: false, reason: "route-key-mismatch" },
  );
});

/**
 * The case route key alone cannot catch. A1 and A2 are the same URL, so their
 * route keys are identical; only the epoch separates them.
 */
test("A1 -> B -> A2: a late A1 payload is refused even though its route key matches", () => {
  const live = { routeKey: keyA, epoch: 3 };
  const committed = snapshot(keyA, 3, "ws-a", 7);

  const lateA1 = snapshot(keyA, 1, "ws-a", 4);
  assert.deepEqual(decideSnapshotCommit(lateA1, live, committed), {
    commit: false,
    reason: "stale-epoch",
  });

  // The current A2 payload, at the live epoch, still commits.
  assert.deepEqual(
    decideSnapshotCommit(snapshot(keyA, 3, "ws-a", 8), live, committed),
    { commit: true },
  );
});

test("a payload from an epoch the client has not started is refused, not adopted", () => {
  assert.deepEqual(
    decideSnapshotCommit(snapshot(keyA, 9, "ws-a"), { routeKey: keyA, epoch: 3 }, null),
    { commit: false, reason: "future-epoch" },
  );
});

test("a snapshot may not move the same Project backwards in revision", () => {
  const live = { routeKey: keyA, epoch: 2 };
  const committed = snapshot(keyA, 2, "ws-a", 12);
  assert.deepEqual(decideSnapshotCommit(snapshot(keyA, 2, "ws-a", 11), live, committed), {
    commit: false,
    reason: "revision-regression",
  });
  assert.deepEqual(
    decideSnapshotCommit(snapshot(keyA, 2, "ws-a", 12), live, committed),
    { commit: true },
  );
});

test("a cold direct URL for B never paints cookie-fallback A", () => {
  const chrome = projectChrome({
    live: { routeKey: keyB, epoch: 1 },
    committed: null,
    bootstrapProjectId: "ws-a",
    coldEntry: true,
  });
  assert.deepEqual(chrome, { kind: "skeleton" });
});

test("a cold direct URL waits even when the cookie names the same Project", () => {
  // The cookie proves no membership and carries no current name, capability or
  // count. Painting from it would be a guess that happened to be right.
  const chrome = projectChrome({
    live: { routeKey: keyA, epoch: 1 },
    committed: null,
    bootstrapProjectId: "ws-a",
    coldEntry: true,
  });
  assert.deepEqual(chrome, { kind: "skeleton" });
});

test("an in-app A -> B transition keeps verified A on screen but explicitly inert", () => {
  const committed = snapshot(keyA, 1, "ws-a");
  const chrome = projectChrome({
    live: { routeKey: keyB, epoch: 2 },
    committed,
    bootstrapProjectId: "ws-a",
    coldEntry: false,
  });
  assert.equal(chrome.kind, "pending");
  assert(chrome.kind === "pending");
  assert.equal(chrome.showing.id, "ws-a");
  assert.equal(chrome.inert, true);
});

test("only a route-key-and-epoch matched snapshot is painted as verified", () => {
  const committed = snapshot(keyA, 2, "ws-a");
  assert.equal(
    projectChrome({
      live: { routeKey: keyA, epoch: 2 },
      committed,
      bootstrapProjectId: null,
      coldEntry: false,
    }).kind,
    "verified",
  );
  // Same key, superseded epoch: not verified.
  assert.equal(
    projectChrome({
      live: { routeKey: keyA, epoch: 3 },
      committed,
      bootstrapProjectId: null,
      coldEntry: false,
    }).kind,
    "pending",
  );
});

test("the route key ignores local view state but not the Project", () => {
  assert.equal(routeKey("/app/notes", "ws-a"), routeKey("/app/notes", "ws-a"));
  assert.notEqual(routeKey("/app/notes", "ws-a"), routeKey("/app/notes", "ws-b"));
  assert.notEqual(routeKey("/app/notes", "ws-a"), routeKey("/app/tasks", "ws-a"));
  assert.notEqual(routeKey("/app/tasks", null), routeKey("/app/tasks", "ws-a"));
});
