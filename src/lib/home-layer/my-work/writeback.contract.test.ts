/**
 * MY_WORK_PROJECTION.md §9, §11 — writeback. Assertions M14 to M17.
 *
 * This is the central problem, and these are the tests that hold it.
 *
 * Every Tasks mutation binds its tenant to the tasks_active_ws cookie through
 * getActiveWorkspace(): 101 occurrences across 43 non-test source files at this
 * base, 80 of them across 23 files in src/server/actions/**. When a Home surface
 * asks to complete a task in Project B while the cookie says Project A, the
 * pre-read finds no row and the action returns getTasks(ws) — the caller's own
 * board, unchanged, with no exception and nothing in the value to distinguish
 * "your change landed" from "nothing happened".
 *
 * A silent no-op is the worst available failure mode for a surface contracted
 * never to show success before the source confirms. It fires on the common path
 * rather than the rare one, because on a cross-Project list the target Project
 * usually is not the cookie's Project. The optimistic client update makes the
 * row visibly change, so the reader's own evidence says it worked, and they stop
 * thinking about a task that is still open somewhere else. And no activity row
 * is written on the no-op branch, so afterwards there is no record that anything
 * was attempted. A visible error costs a retry. This costs the thing the product
 * exists to protect.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/my-work/writeback.contract.test.ts
 */

import { strict as assert } from "node:assert";
import test from "node:test";
import {
  linesContaining,
  readRepoFile,
  repoFileExists,
  requireContractModule,
  requireExports,
} from "./contract-support";

const WRITEBACK = "src/lib/home-layer/my-work/writeback.ts";
const TASKS_ACTIONS = "src/server/actions/tasks.ts";
const BOARD_ACTIONS = "src/server/actions/board.ts";

// ── M14 · workspace-parameterised entry points exist ────────────────────────

test("M14 · the Home writeback entry points exist", async () => {
  const mod = await requireContractModule(WRITEBACK, "§11.3");
  requireExports(
    mod,
    ["completeTaskInProject", "reassignTaskInProject"],
    WRITEBACK,
  );
});

test("M14 · both entry points take an explicit Project and an expected revision", async () => {
  const mod = await requireContractModule(WRITEBACK, "§11.3");
  const source = readRepoFile(WRITEBACK);
  for (const name of ["completeTaskInProject", "reassignTaskInProject"]) {
    assert.equal(
      typeof mod[name],
      "function",
      `${WRITEBACK} must export ${name} as a function`,
    );
  }
  for (const field of ["workspaceId", "expectedRevision"]) {
    assert.ok(
      source.includes(field),
      `${WRITEBACK} must take ${field}. §11.3 property 1 and property 4: the Project ` +
        `comes from the argument, and the revision is compared inside the same statement.`,
    );
  }
});

// ── M15 · the write path is never ambient ───────────────────────────────────

test("M15 · the writeback path never resolves its Project from the cookie", () => {
  assert.ok(
    repoFileExists(WRITEBACK),
    `${WRITEBACK} does not exist yet. §11.3 property 1 requires an entry point that ` +
      `never calls getActiveWorkspace(); at this base every Tasks mutation does ` +
      `(${TASKS_ACTIONS}:114, :159, :391).`,
  );
  const source = readRepoFile(WRITEBACK);
  const ambient = linesContaining(source, "getActiveWorkspace");
  assert.deepEqual(
    ambient,
    [],
    `${WRITEBACK} calls getActiveWorkspace on line(s) ${ambient.join(", ")}`,
  );
});

test("M15 · the writeback path writes no cookie", () => {
  assert.ok(
    repoFileExists(WRITEBACK),
    `${WRITEBACK} does not exist yet. §11.2 prohibits a per-write cookie dance: it is ` +
      `a global state change to serve a local write, it races with concurrent tabs, ` +
      `and it turns looking at a list into an Active Project switch the user did not ask for.`,
  );
  const source = readRepoFile(WRITEBACK);
  const writes = linesContaining(source, "cookies(");
  assert.deepEqual(
    writes,
    [],
    `${WRITEBACK} touches cookies on line(s) ${writes.join(", ")}. §7.1 of ` +
      `PROJECT_SCOPE.md: Home persists nothing about Project context.`,
  );
});

// ── M16 · a refusal is distinguishable from a success ───────────────────────

test("M16 · the receipt distinguishes ok from every named refusal", async () => {
  const mod = await requireContractModule(WRITEBACK, "§11.3");
  requireExports(mod, ["SOURCE_REFUSALS"], WRITEBACK);
  const refusals = mod.SOURCE_REFUSALS as readonly string[];
  for (const refusal of [
    "not-found",
    "not-authorized",
    "project-archived",
    "revision-conflict",
    "capability-denied",
    "source-unavailable",
  ]) {
    assert.ok(
      refusals.includes(refusal),
      `§11.3 requires the receipt to be able to report "${refusal}"`,
    );
  }
});

test("M16 · no Tasks mutation returns unchanged source state on a foreign row", () => {
  const source = readRepoFile(TASKS_ACTIONS);
  const silent = source
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(
      ({ line }) =>
        line.includes("if (!") && line.includes("return getTasks(ws)"),
    );
  assert.deepEqual(
    silent.map(({ number }) => number),
    [],
    `${TASKS_ACTIONS} still returns the caller's own board unchanged when the target ` +
      `row is not in the cookie's Project, on line(s) ` +
      `${silent.map(({ number }) => number).join(", ")}. §11.3 property 3: a zero-row ` +
      `write is a typed refusal, never a return of unchanged state. Owned by whoever ` +
      `parameterises the Tasks actions (R-H11).`,
  );
});

test("M16 · moveTaskAction does not return an empty board as a refusal", () => {
  const source = readRepoFile(TASKS_ACTIONS);
  const bare = source
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line.includes("if (!") && line.includes("return [];"));
  assert.deepEqual(
    bare.map(({ number }) => number),
    [],
    `${TASKS_ACTIONS} returns a bare [] on invalid input, which is byte-identical to ` +
      `"this board is empty", on line(s) ${bare.map(({ number }) => number).join(", ")}.`,
  );
});

// ── M17 · a revision token that actually moves ──────────────────────────────

test("M17 · board.ts stamps updatedAt on every task write", () => {
  const source = readRepoFile(BOARD_ACTIONS);
  const stamps = linesContaining(source, "updatedAt");
  assert.ok(
    stamps.length > 0,
    `${BOARD_ACTIONS} contains no updatedAt reference at all. moveTaskToColumnAction ` +
      `(:585-637, writes at :606-616 and :624-633) and deleteColumnAction (:465-546, ` +
      `writes at :526-546) change a task's effective column without stamping it. Those ` +
      `are exactly the transitions that move a row between My work groups, so ` +
      `tasks.updatedAt is not a revision token (§9.1). There is no revision column on ` +
      `tasks either: revision exists on planning_periods (schema.ts:232), workspaces ` +
      `(:312) and the planning-onboarding table (:426), and on no task. New finding at ` +
      `this base; owned by the Tasks board surface, recorded at §13 item 3.`,
  );
});

test("M17 · the projection computes a field-scoped source revision", async () => {
  const REVISION = "src/lib/home-layer/my-work/revision.ts";
  const mod = await requireContractModule(REVISION, "§9.2");
  requireExports(mod, ["sourceRevision", "REVISION_FIELDS"], REVISION);
  const fields = mod.REVISION_FIELDS as readonly string[];
  for (const field of [
    "workspaceId",
    "lane",
    "boardColumnKey",
    "completedAt",
    "dueAt",
    "due",
    "assignees",
    "blockedBy",
    "archivedAt",
    "parentTaskId",
    "title",
  ]) {
    assert.ok(
      fields.includes(field),
      `§9.2 seals ${field} into the revision tuple; without it a change the row ` +
        `renders would not be detectable.`,
    );
  }
});
