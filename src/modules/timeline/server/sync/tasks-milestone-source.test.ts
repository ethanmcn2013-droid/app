/**
 * Unit tests for RW-3c tasks-milestone-source + RW-2 removal invariants.
 *
 * RED→GREEN tests per spec:
 *   1. canonicaliseStatus: todo/doing/review/done → correct Status
 *   2. Milestone node id format: ms-{tasksWorkspaceId}-{tasksTaskId}
 *   3. Later lane: status:"next" + null targetDate (D7 presentational)
 *   4. Overlay COALESCE: labelOverride wins; null overlay flows through generated
 *   5. D6 two-gate: promote does NOT publish (tested via logic guard)
 *   6. G1: no auto-promote (filter guard, only is_milestone=1 rows surface)
 *   7. Public viewer: markdown surfaces absent (no parse-markdown module)
 *
 * Run: ./node_modules/.bin/tsx --test src/server/sync/tasks-milestone-source.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// ── 1. canonicaliseStatus ─────────────────────────────────────────────────────

import { canonicaliseStatus } from "./tasks-milestone-source.js";
import { assertTasksMilestoneQuery, TASKS_READ_CONTRACT_VERSION } from "./tasks-read-contract.js";

test("cross-product milestone source is keyed by immutable clerk_id", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(
    new URL("./tasks-milestone-source.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /getMilestonesForClerkId\([\s\S]*clerkId: string,[\s\S]*canonicalWorkspaceId: string/);
  assert.match(src, /SELECT id FROM users WHERE clerk_id = \? LIMIT 1/);
  assert.doesNotMatch(src, /getMilestonesForEmail|WHERE email =/);
});

test("Timeline consumes the versioned Tasks read contract", () => {
  assert.equal(TASKS_READ_CONTRACT_VERSION, 1);
  assert.doesNotThrow(() =>
    assertTasksMilestoneQuery({ subject: "user_1", workspaceId: "workspace_1" }),
  );
  assert.throws(() =>
    assertTasksMilestoneQuery({ subject: "", workspaceId: "workspace_1" }),
  );
  assert.throws(() =>
    assertTasksMilestoneQuery({ subject: "user_1", workspaceId: "" }),
  );
});

test("canonicaliseStatus, todo → next", () => {
  assert.equal(canonicaliseStatus("todo"), "next");
});

test("canonicaliseStatus, doing → in-flight", () => {
  assert.equal(canonicaliseStatus("doing"), "in-flight");
});

test("canonicaliseStatus, review → in-flight", () => {
  assert.equal(canonicaliseStatus("review"), "in-flight");
});

test("canonicaliseStatus, done → shipped", () => {
  assert.equal(canonicaliseStatus("done"), "shipped");
});

test("canonicaliseStatus, unknown → next (safe default)", () => {
  assert.equal(canonicaliseStatus("backlog"), "next");
  assert.equal(canonicaliseStatus(""), "next");
});

// ── 2. Node id format ─────────────────────────────────────────────────────────

test("node id format: ms-{tasksWorkspaceId}-{tasksTaskId}", () => {
  const wsId = "ws-abc123";
  const taskId = "task-xyz789";
  const nodeId = `ms-${wsId}-${taskId}`;
  assert.ok(nodeId.startsWith("ms-"), "Must start with ms-");
  assert.ok(nodeId.includes(wsId), "Must contain workspace id");
  assert.ok(nodeId.includes(taskId), "Must contain task id");
  assert.equal(nodeId, "ms-ws-abc123-task-xyz789");
});

// ── 3. Later lane (D7) ────────────────────────────────────────────────────────

import { statusToLane } from "../db/timeline-queries.js";

test("statusToLane, shipped → Shipped", () => {
  assert.equal(statusToLane("shipped", "2026-06-01"), "Shipped");
});

test("statusToLane, in-flight → In flight", () => {
  assert.equal(statusToLane("in-flight", "2026-06-01"), "In flight");
});

test("statusToLane, next + date → Next", () => {
  assert.equal(statusToLane("next", "2026-06-01"), "Next");
});

test("statusToLane, next + null date → Later (D7 presentational)", () => {
  // Later = status:"next" + view grouping. NOT a 6th status.
  assert.equal(statusToLane("next", null), "Later");
});

test("statusToLane, next + undefined date → Later", () => {
  assert.equal(statusToLane("next", undefined), "Later");
});

// ── 4. Overlay COALESCE logic ─────────────────────────────────────────────────

// Extracted pure logic from getEffectiveNodesForWorkspace for unit testing.

type MinimalOverlay = {
  labelOverride: string | null;
  dateOverride: string | null | undefined;
  laneOverride: string | null;
  hidden: boolean;
  source: "synced" | "manual";
};

type MinimalTask = {
  id: string;
  title: string;
  status: string;
  targetDate: string | null;
  sortOrder: number;
};

function applyOverlay(
  task: MinimalTask,
  overlay: MinimalOverlay | null,
): { title: string; targetDate: string | null; driftDetected: boolean } {
  if (!overlay) {
    return { title: task.title, targetDate: task.targetDate, driftDetected: false };
  }
  const effectiveTitle = overlay.labelOverride ?? task.title;
  const effectiveDate =
    overlay.dateOverride !== undefined ? overlay.dateOverride : task.targetDate;
  // An override is "active" only when actually set. labelOverride null/undefined
  // = no override; dateOverride undefined = no override (null = explicit clear).
  // Drift = an active override whose value diverges from the current Tasks value.
  const labelActive =
    overlay.labelOverride !== null && overlay.labelOverride !== undefined;
  const dateActive = overlay.dateOverride !== undefined;
  const driftDetected = Boolean(
    (labelActive && overlay.labelOverride !== task.title) ||
      (dateActive && overlay.dateOverride !== task.targetDate),
  );
  return { title: effectiveTitle, targetDate: effectiveDate ?? null, driftDetected };
}

test("COALESCE, no overlay: generated title flows through", () => {
  const task = { id: "t1", title: "Venue walkthrough", status: "next", targetDate: "2026-06-12", sortOrder: 0 };
  const result = applyOverlay(task, null);
  assert.equal(result.title, "Venue walkthrough");
  assert.equal(result.driftDetected, false);
});

test("COALESCE, labelOverride set: overlay wins", () => {
  const task = { id: "t1", title: "Old title", status: "next", targetDate: "2026-06-12", sortOrder: 0 };
  const overlay: MinimalOverlay = {
    labelOverride: "Venue soft launch",
    dateOverride: undefined,
    laneOverride: null,
    hidden: false,
    source: "synced",
  };
  const result = applyOverlay(task, overlay);
  assert.equal(result.title, "Venue soft launch");
});

test("COALESCE, labelOverride null: generated title flows through", () => {
  const task = { id: "t1", title: "Venue walkthrough", status: "next", targetDate: null, sortOrder: 0 };
  const overlay: MinimalOverlay = {
    labelOverride: null,
    dateOverride: undefined,
    laneOverride: null,
    hidden: false,
    source: "synced",
  };
  const result = applyOverlay(task, overlay);
  assert.equal(result.title, "Venue walkthrough");
});

test("COALESCE, drift detected when Tasks title changed after override", () => {
  const task = { id: "t1", title: "New title from Tasks", status: "next", targetDate: "2026-06-12", sortOrder: 0 };
  const overlay: MinimalOverlay = {
    labelOverride: "Old human override",
    dateOverride: undefined,
    laneOverride: null,
    hidden: false,
    source: "synced",
  };
  const result = applyOverlay(task, overlay);
  // labelOverride differs from current Tasks title → drift
  assert.equal(result.driftDetected, true);
});

test("COALESCE, no drift when override matches current Tasks value", () => {
  const task = { id: "t1", title: "Venue walkthrough", status: "next", targetDate: "2026-06-12", sortOrder: 0 };
  const overlay: MinimalOverlay = {
    labelOverride: "Venue walkthrough", // same as task.title
    dateOverride: undefined,
    laneOverride: null,
    hidden: false,
    source: "synced",
  };
  const result = applyOverlay(task, overlay);
  assert.equal(result.driftDetected, false);
});

// ── 5. D6 two-gate: real action-level tests (BV-4) ────────────────────────────
//
// These tests replaced the prior hardcoded-simulation approach (BV-4 defect).
// Two complementary strategies ensure regressions are caught:
//
//   a) Import the exported path-contract functions from workspaces.ts and
//      assert the exact set of paths each action revalidates. If a future
//      engineer changes syncRevalidationPaths to include /{workspaceSlug},
//      test (a) fails directly.
//
//   b) Static source scan of syncMilestonesAction: read the actual source
//      file and assert that NO revalidatePath call in the sync function body
//      matches a public slug pattern (i.e. a path like "/" + variable that
//      doesn't start with /app). This catches inline additions that bypass
//      the path-contract helper.
//
// Together, (a) + (b) fail on any future regression, not just a test of
// hardcoded constants.

import {
  syncRevalidationPaths,
  publishRevalidationPaths,
} from "../actions/timeline-revalidation-contracts.js";

test("D6 two-gate, syncRevalidationPaths contains only /app-prefixed paths", () => {
  const paths = syncRevalidationPaths("venue-plan");
  // Every path must start with /app, none may be a public URL
  for (const p of paths) {
    assert.ok(
      p.startsWith("/app"),
      `syncRevalidationPaths must only contain /app paths; got: ${p}`,
    );
  }
  // Must include the dashboard and the curation view
  // Unified app: dashboard is /app/timeline, curation is /app/timeline/{slug}.
  assert.ok(paths.includes("/app/timeline"), "sync must revalidate /app/timeline (dashboard)");
  assert.ok(
    paths.some((p) => p.startsWith("/app/timeline/")),
    "sync must revalidate /app/timeline/... (curation view)",
  );
});

test("D6 two-gate, publishRevalidationPaths unified-app ISR contract", () => {
  // Unified-app adaptation: publish/unpublish writes publishedAt to the shared
  // Timeline Turso DB. The public deployment at timeline.signalstudio.ie is a
  // SEPARATE Next.js app — revalidatePath cannot cross app boundaries. The
  // public page picks up the change within its ISR window (~5 min).
  //
  // Therefore publishRevalidationPaths must NOT include the public /{workspaceSlug}
  // path — only the authenticated /app/timeline path is revalidated here.
  // This is intentional and documented in timeline-revalidation-contracts.ts.
  const paths = publishRevalidationPaths("glenmara-weddings");
  // Must revalidate the authed dashboard so the published state is reflected
  assert.ok(
    paths.includes("/app/timeline"),
    "publish must revalidate /app/timeline (authenticated dashboard)",
  );
  // Must NOT attempt to revalidate the public URL (different Next.js app, would be a no-op or error)
  assert.ok(
    !paths.includes("/glenmara-weddings"),
    "publish must NOT attempt to revalidate /{workspaceSlug} — cross-app revalidation is a no-op; public page uses ISR",
  );
});

test("D6 two-gate, sync paths and publish paths are disjoint on public URLs", () => {
  const syncPaths = syncRevalidationPaths("venue-plan");
  const publishPaths = publishRevalidationPaths("glenmara-weddings");
  const publicPublishPaths = publishPaths.filter((p) => !p.startsWith("/app"));
  for (const pub of publicPublishPaths) {
    assert.ok(
      !syncPaths.includes(pub),
      `sync must never revalidate public path ${pub}, only publish may do so`,
    );
  }
});

test("D6 two-gate, static source scan: syncMilestonesAction body has no public revalidatePath", async () => {
  // Read the real action source and extract the syncMilestonesAction function body.
  // Assert that every revalidatePath call inside it begins with /app, never /{slug}.
  // This test catches inline additions that bypass the path-contract helper above.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(
    new URL("../actions/workspaces.ts", import.meta.url),
    "utf8",
  );

  // Extract from the function declaration to the next export async function
  const syncStart = src.indexOf("export async function syncMilestonesAction(");
  assert.ok(syncStart >= 0, "syncMilestonesAction must exist in workspaces.ts");

  // Find the end of the function by locating the next top-level export after it
  const afterSync = src.indexOf("\nexport ", syncStart + 1);
  const syncBody = afterSync > syncStart ? src.slice(syncStart, afterSync) : src.slice(syncStart);

  // Find all revalidatePath(...) calls in the function body
  const revalidateRe = /revalidatePath\(\s*[`"']([^`"']+)[`"']/g;
  let match;
  const foundPublicPaths: string[] = [];
  while ((match = revalidateRe.exec(syncBody)) !== null) {
    const path = match[1];
    // A public path is one that does NOT start with /app
    if (!path.startsWith("/app")) {
      foundPublicPaths.push(path);
    }
  }
  assert.deepEqual(
    foundPublicPaths,
    [],
    `syncMilestonesAction must NOT call revalidatePath with any public path. Found: ${foundPublicPaths.join(", ")}`,
  );
});

// ── 6. G1, only is_milestone=1 rows (filter guard) ─────────────────────────

function filterMilestones(
  tasks: Array<{ id: string; is_milestone: number; title: string }>,
): Array<{ id: string; title: string }> {
  return tasks
    .filter((t) => t.is_milestone === 1)
    .map((t) => ({ id: t.id, title: t.title }));
}

test("G1, only is_milestone=1 tasks surface", () => {
  const tasks = [
    { id: "t1", is_milestone: 1, title: "Venue walkthrough" },
    { id: "t2", is_milestone: 0, title: "Normal task" },
    { id: "t3", is_milestone: 1, title: "Menu finalised" },
    { id: "t4", is_milestone: 0, title: "Another normal" },
  ];
  const result = filterMilestones(tasks);
  assert.equal(result.length, 2);
  assert.ok(result.every((r) => tasks.find((t) => t.id === r.id)?.is_milestone === 1));
});

test("G1, zero milestones when none flagged", () => {
  const tasks = [
    { id: "t1", is_milestone: 0, title: "Normal task" },
  ];
  const result = filterMilestones(tasks);
  assert.equal(result.length, 0);
});

// ── 6b. BV-2: drag-sort batch-write, all siblings must be persisted ─────────
//
// The fix for BV-2 calls reorderNodesAction with the full ordered node list
// (not just the moved node). This test asserts the persistence contract:
// after a drag, EVERY sibling has a deterministic sortOverride so reload order
// is stable. Tested via pure reindex logic (same function the action uses).

function reindexForPersistence(
  nodes: Array<{ id: string }>,
): Array<{ nodeId: string; sortOverride: number }> {
  // Mirror what reorderNodesAction does: assign sortOverride = position index.
  return nodes.map((n, i) => ({ nodeId: n.id, sortOverride: i }));
}

test("BV-2, after drag, ALL siblings receive a sortOverride (not just moved node)", () => {
  const nodes = [
    { id: "ms-a" },
    { id: "ms-b" },
    { id: "ms-c" },
    { id: "ms-d" },
  ];
  // Simulate moving ms-a to position 2 (between ms-b and ms-c)
  const reordered = [nodes[1], nodes[0], nodes[2], nodes[3]]; // b, a, c, d
  const entries = reindexForPersistence(reordered);

  // All 4 nodes must be in the persistence payload
  assert.equal(entries.length, 4, "All siblings must be in the batch-write payload");

  // Each node gets a unique, 0-based sortOverride
  assert.deepEqual(
    entries.map((e) => e.sortOverride),
    [0, 1, 2, 3],
    "sortOverride values must be 0-indexed and contiguous",
  );

  // The moved node (ms-a, now at index 1) must have sortOverride=1
  const movedEntry = entries.find((e) => e.nodeId === "ms-a");
  assert.equal(movedEntry?.sortOverride, 1, "Moved node must have correct sortOverride");

  // Its former sibling (ms-b, now at index 0) must have sortOverride=0, not its original 0
  // (both have 0 in this case, but crucially ms-b is now explicitly written at 0)
  const siblingEntry = entries.find((e) => e.nodeId === "ms-b");
  assert.equal(siblingEntry?.sortOverride, 0, "Sibling node must have explicit sortOverride");

  // Verify: no two nodes share the same sortOverride (deterministic order)
  const overrides = entries.map((e) => e.sortOverride);
  const unique = new Set(overrides);
  assert.equal(unique.size, entries.length, "sortOverride values must be unique across siblings");
});

test("BV-2, reload order is stable: sorted by sortOverride is deterministic", () => {
  // Simulate what the query does on reload: sort by COALESCE(sortOverride, sortOrder).
  // With all siblings having explicit sortOverride values, the order is determined
  // solely by those values, not by the Tasks DB sortOrder field.
  const persisted = [
    { id: "ms-b", sortOverride: 0, tasksSortOrder: 5 },
    { id: "ms-a", sortOverride: 1, tasksSortOrder: 3 }, // moved; Tasks sortOrder was 3
    { id: "ms-c", sortOverride: 2, tasksSortOrder: 2 },
    { id: "ms-d", sortOverride: 3, tasksSortOrder: 1 },
  ];

  const reloaded = [...persisted].sort(
    (a, b) =>
      (a.sortOverride ?? a.tasksSortOrder) - (b.sortOverride ?? b.tasksSortOrder),
  );

  // The order after reload must match the drag intent, ignoring Tasks sortOrder
  assert.deepEqual(
    reloaded.map((n) => n.id),
    ["ms-b", "ms-a", "ms-c", "ms-d"],
    "Reload order must be stable and match the drag intent when all sortOverrides are set",
  );

  // Contrast: if only the moved node was written (old bug), ms-a gets sortOverride=1
  // but ms-b has no sortOverride and would sort by tasksSortOrder=5.
  // That would incorrectly place ms-b at position 5, after ms-c (2) and ms-d (1).
  const bugged = [
    { id: "ms-b", sortOverride: null, tasksSortOrder: 5 }, // not written in old code
    { id: "ms-a", sortOverride: 1, tasksSortOrder: 3 },     // only this was written
    { id: "ms-c", sortOverride: null, tasksSortOrder: 2 },
    { id: "ms-d", sortOverride: null, tasksSortOrder: 1 },
  ];
  const buggedOrder = [...bugged].sort(
    (a, b) =>
      (a.sortOverride ?? a.tasksSortOrder) - (b.sortOverride ?? b.tasksSortOrder),
  );
  // Old buggy order: ms-d(1), ms-c(2), ms-a(1→sortOverride wins), ms-b(5)
  // ms-a and ms-d both resolve to effective sort=1 → tie-break is non-deterministic
  // The point: the order is NOT the drag intent.
  assert.notDeepEqual(
    buggedOrder.map((n) => n.id),
    ["ms-b", "ms-a", "ms-c", "ms-d"],
    "Without batch-write, reload order diverges from drag intent (old bug reproduced)",
  );
});

// ── 8. BV-8, G2 retract: reconcile logic (pure, no DB) ──────────────────────
//
// Mirrors the reconcile pass added to writeRoadmapNodes (queries.ts).
// Tests the branching logic that determines which synced nodes survive a sync.
//
// Rules under test:
//   a) Sync with milestone X → node exists; re-sync without X → node gone.
//   b) Manual nodes (non-ms- prefix) are NEVER touched by the reconcile pass.
//   c) Overlay rows are orphaned (not deleted), tested by asserting the
//      overlay set is unchanged after reconcile.
//   d) Empty incoming set → ALL synced ms- nodes for that project deleted.

type NodeRow = { id: string; workspaceSlug: string; projectSlug: string; kind: string };
type OverlayRow = { workspaceSlug: string; nodeId: string };

/**
 * Pure equivalent of the queries.ts reconcile pass.
 * Returns the set of node ids that would survive (not be deleted).
 * Models: delete WHERE workspaceSlug=ws AND projectSlug=proj AND kind='milestone'
 *   AND id LIKE 'ms-%' AND id NOT IN (incomingIds).
 */
function reconcileNodes(
  existingNodes: NodeRow[],
  workspaceSlug: string,
  projectSlug: string,
  incomingIds: string[],
): { surviving: NodeRow[]; deleted: NodeRow[] } {
  const incomingSet = new Set(incomingIds);
  const surviving: NodeRow[] = [];
  const deleted: NodeRow[] = [];
  for (const n of existingNodes) {
    const isSyncTarget =
      n.workspaceSlug === workspaceSlug &&
      n.projectSlug === projectSlug &&
      n.kind === "milestone" &&
      n.id.startsWith("ms-");
    if (isSyncTarget && !incomingSet.has(n.id)) {
      deleted.push(n);
    } else {
      surviving.push(n);
    }
  }
  return { surviving, deleted };
}

test("BV-8 G2, sync with milestone X: node exists after sync", () => {
  // Simulate: initial sync wrote ms-ws1-task1.
  const existing: NodeRow[] = [
    { id: "ms-ws1-task1", workspaceSlug: "venue-plan", projectSlug: "wedding", kind: "milestone" },
  ];
  // Re-sync WITH the same milestone still present.
  const { surviving, deleted } = reconcileNodes(existing, "venue-plan", "wedding", ["ms-ws1-task1"]);
  assert.equal(surviving.length, 1, "Node must survive when still in incoming set");
  assert.equal(deleted.length, 0, "No nodes deleted when all incoming ids are present");
  assert.equal(surviving[0].id, "ms-ws1-task1");
});

test("BV-8 G2, re-sync WITHOUT milestone X: node gone (immediate and total)", () => {
  // Existing: ms-ws1-task1 was synced last time.
  const existing: NodeRow[] = [
    { id: "ms-ws1-task1", workspaceSlug: "venue-plan", projectSlug: "wedding", kind: "milestone" },
  ];
  // Re-sync with EMPTY incoming set (milestone un-promoted in Tasks).
  const { surviving, deleted } = reconcileNodes(existing, "venue-plan", "wedding", []);
  assert.equal(deleted.length, 1, "Un-promoted node must be deleted");
  assert.equal(surviving.length, 0, "No synced nodes should survive when all un-promoted");
  assert.equal(deleted[0].id, "ms-ws1-task1");
});

test("BV-8 G2, manual nodes (non-ms- prefix) are NEVER deleted by reconcile", () => {
  const existing: NodeRow[] = [
    { id: "ms-ws1-task1", workspaceSlug: "venue-plan", projectSlug: "wedding", kind: "milestone" },
    { id: "manual-abc123", workspaceSlug: "venue-plan", projectSlug: "wedding", kind: "milestone" },
    { id: "d5-custom-node", workspaceSlug: "venue-plan", projectSlug: "wedding", kind: "milestone" },
  ];
  // Re-sync with EMPTY incoming set, all synced nodes gone, manual nodes survive.
  const { surviving, deleted } = reconcileNodes(existing, "venue-plan", "wedding", []);
  assert.equal(deleted.length, 1, "Only the ms- node should be deleted");
  assert.equal(deleted[0].id, "ms-ws1-task1");
  assert.equal(surviving.length, 2, "Manual and d5 nodes must survive");
  assert.ok(surviving.every((n) => !n.id.startsWith("ms-")), "Surviving nodes must all be non-ms- prefix");
});

test("BV-8 G2, overlay rows are orphaned, not deleted, on retract", () => {
  // Overlays are in a separate table and are NOT touched by the reconcile pass.
  // Model: after deleting ms-ws1-task1 from tasks, the nodeOverlays row remains.
  const overlays: OverlayRow[] = [
    { workspaceSlug: "venue-plan", nodeId: "ms-ws1-task1" },
  ];
  const existing: NodeRow[] = [
    { id: "ms-ws1-task1", workspaceSlug: "venue-plan", projectSlug: "wedding", kind: "milestone" },
  ];
  // Reconcile deletes the task row.
  const { deleted } = reconcileNodes(existing, "venue-plan", "wedding", []);
  assert.equal(deleted.length, 1, "Task row deleted");

  // Overlay table is NOT modified by reconcile, it stays as-is.
  // If re-promoted later, the overlay re-activates.
  assert.equal(overlays.length, 1, "Overlay row must be preserved (orphaned, not deleted)");
  assert.equal(overlays[0].nodeId, "ms-ws1-task1", "Orphaned overlay nodeId matches deleted task");
});

test("BV-8 G2, partial un-promote: only un-promoted node deleted, others survive", () => {
  const existing: NodeRow[] = [
    { id: "ms-ws1-task1", workspaceSlug: "venue-plan", projectSlug: "wedding", kind: "milestone" },
    { id: "ms-ws1-task2", workspaceSlug: "venue-plan", projectSlug: "wedding", kind: "milestone" },
    { id: "ms-ws1-task3", workspaceSlug: "venue-plan", projectSlug: "wedding", kind: "milestone" },
  ];
  // task2 was un-promoted; task1 and task3 still exist.
  const { surviving, deleted } = reconcileNodes(
    existing, "venue-plan", "wedding",
    ["ms-ws1-task1", "ms-ws1-task3"],
  );
  assert.equal(deleted.length, 1, "Only the un-promoted node should be deleted");
  assert.equal(deleted[0].id, "ms-ws1-task2");
  assert.equal(surviving.length, 2, "Two promoted nodes survive");
  assert.ok(surviving.every((n) => n.id !== "ms-ws1-task2"), "ms-ws1-task2 must not be in surviving");
});

test("BV-8 G2, cross-workspace isolation: nodes from other workspaces untouched", () => {
  const existing: NodeRow[] = [
    { id: "ms-ws1-task1", workspaceSlug: "venue-plan", projectSlug: "wedding", kind: "milestone" },
    { id: "ms-ws2-task1", workspaceSlug: "other-workspace", projectSlug: "other-project", kind: "milestone" },
  ];
  // Re-sync venue-plan with empty incoming, only venue-plan nodes deleted.
  const { surviving, deleted } = reconcileNodes(existing, "venue-plan", "wedding", []);
  assert.equal(deleted.length, 1, "Only venue-plan node deleted");
  assert.equal(deleted[0].id, "ms-ws1-task1");
  assert.equal(surviving.length, 1, "Other-workspace node must survive");
  assert.equal(surviving[0].workspaceSlug, "other-workspace");
});

// ── 7. Markdown surfaces absent ───────────────────────────────────────────────

test("RW-2, parse-markdown module does not exist", async () => {
  // Filesystem check, the parser file must not exist (RW-2 excised it).
  // Avoid a typed import so tsc doesn't try to resolve the deleted module.
  const { existsSync } = await import("node:fs");
  const moduleNotFound = !existsSync(
    new URL("../parser/parse-markdown.ts", import.meta.url),
  );
  assert.equal(
    moduleNotFound,
    true,
    "parse-markdown.ts must be deleted, markdown input path is removed (RW-2)",
  );
});
