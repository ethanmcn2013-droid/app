/**
 * MY_WORK_PROJECTION.md §3, §4 — assignment storage. Assertions M11 to M13.
 *
 * These read shipped source and assert the end state the contract seals. Every
 * one of them is red at base `78021c5`, and the failure message names the file
 * that has to change.
 *
 * Why this cannot be left as a JSON column. An exact cross-Project "assigned to
 * me" query does not exist today, for four separate reasons recorded in §3.2.
 * The nearest thing is `getTasksForUser`, which is workspace-scoped by
 * construction, matches with `like(tasks.assignees, '%"id"%')`, has zero
 * callers, and caps at 2,000 rows per Project. A cross-Project surface built on
 * that scans every task in every Project the reader belongs to, cannot use an
 * index, and truncates without saying so.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/my-work/assignment-storage.contract.test.ts
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

const SCHEMA = "src/server/db/schema.ts";
const HELPER = "src/server/db/task-assignments.ts";
const READ_MODULE = "src/lib/home-layer/my-work/read.ts";

/**
 * Every path that writes task assignment at this base, enumerated in §4.5.
 * Each must route through the one dual-write helper once the relation lands,
 * because a path that writes JSON only is a parity break by construction.
 */
const ASSIGNMENT_WRITE_PATHS = [
  "src/server/actions/tasks.ts",
  "src/server/actions/duplicate-task.ts",
  "src/server/actions/import.ts",
  "src/server/actions/planning.ts",
  "src/app/api/notes-extract/route.ts",
  "src/app/api/notes-extract/v2/route.ts",
  "src/server/actions/seed.ts",
  "src/server/actions/templates.ts",
  "src/server/db/apply-template.ts",
  "src/server/db/seed.ts",
  "src/server/db/seed-published-wedding.ts",
] as const;

// ── M11 · the normalized relation exists ────────────────────────────────────

test("M11 · schema.ts declares a task_assignments table", () => {
  const schema = readRepoFile(SCHEMA);
  assert.ok(
    schema.includes(`sqliteTable("task_assignments"`),
    `${SCHEMA} declares no task_assignments table. §4.1 requires it: assignment is a ` +
      `JSON column at ${SCHEMA}:53-56 with no index anywhere in the index list at :156-171.`,
  );
});

test("M11 · task_assignments is indexed by user, and by user and Project", () => {
  const schema = readRepoFile(SCHEMA);
  for (const indexName of [
    "idx_task_assignments_user",
    "idx_task_assignments_user_ws",
    "idx_task_assignments_task",
  ]) {
    assert.ok(
      schema.includes(indexName),
      `${SCHEMA} is missing ${indexName}. §4.1 requires it; an unindexed relation ` +
        `is the LIKE scan with extra steps.`,
    );
  }
});

// ── M12 · the projection reads the relation, never a LIKE ───────────────────

test("M12 · the My work read path exists and matches assignment exactly", async () => {
  const mod = await requireContractModule(READ_MODULE, "§3.2 and §4.3");
  requireExports(mod, ["listAssignedTaskRows"], READ_MODULE);
});

test("M12 · the My work read path contains no LIKE match against assignees", () => {
  assert.ok(
    repoFileExists(READ_MODULE),
    `${READ_MODULE} does not exist yet. §4.3 step 5 requires the projection to read ` +
      `the relation. The only assignee read at this base is ` +
      `src/server/db/queries.ts:320-343, which matches with ` +
      `like(tasks.assignees, '%"id"%') at :335 and cannot use an index.`,
  );
  const source = readRepoFile(READ_MODULE);
  const likeLines = linesContaining(source, "like(");
  assert.deepEqual(
    likeLines,
    [],
    `${READ_MODULE} matches assignment with LIKE on line(s) ${likeLines.join(", ")}`,
  );
});

test("M12 · the My work read path applies no unordered row cap", () => {
  assert.ok(
    repoFileExists(READ_MODULE),
    `${READ_MODULE} does not exist yet. §8.1 forbids the .limit(2000) shape used by ` +
      `src/server/db/queries.ts:339 and src/server/planning/queries.ts:135.`,
  );
  const source = readRepoFile(READ_MODULE);
  for (const cap of [".limit(2000)", ".limit(200)", ".limit(50)"]) {
    assert.ok(
      !source.includes(cap),
      `${READ_MODULE} uses ${cap}. §8.1 seals a keyset cursor with no unordered hard cap.`,
    );
  }
});

// ── M13 · one dual-write helper owns both writes ────────────────────────────

test("M13 · a single transactional dual-write helper exists", async () => {
  const mod = await requireContractModule(HELPER, "§4.5");
  requireExports(mod, ["writeTaskAssignments"], HELPER);
});

test("M13 · every assignment write path routes through that helper", () => {
  const offenders: string[] = [];
  for (const path of ASSIGNMENT_WRITE_PATHS) {
    if (!repoFileExists(path)) continue;
    const source = readRepoFile(path);
    const writesAssignment = linesContaining(source, "assignees:");
    if (writesAssignment.length === 0) continue;
    if (!source.includes("writeTaskAssignments")) {
      offenders.push(`${path}:${writesAssignment.join(",")}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `§4.5 seals one helper for both writes. These paths still write tasks.assignees ` +
      `without it, so JSON and relation would diverge silently and §4.4 parity could ` +
      `never be proven: ${offenders.join(" · ")}`,
  );
});

// ── the parity proof and its receipt ────────────────────────────────────────

test("M13 · a parity check exists and refuses to pass on an empty population", async () => {
  const PARITY = "src/lib/home-layer/my-work/assignment-parity.ts";
  const mod = await requireContractModule(PARITY, "§4.4");
  requireExports(mod, ["compareAssignmentParity", "PARITY_UNMEASURED"], PARITY);
  assert.equal(
    mod.PARITY_UNMEASURED,
    "unmeasured",
    `§4.4: a parity run that compared nothing reports "unmeasured", never "pass". ` +
      `This mirrors check:contrast, which reports unmeasurable surfaces rather than ` +
      `a pass on an empty population (RISK_REGISTER.md R-H04).`,
  );
});
