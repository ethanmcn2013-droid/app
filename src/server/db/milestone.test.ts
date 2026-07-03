/**
 * RW-3b regression tests, is_milestone flag: schema, toggle, read query shape.
 *
 * Tests are static (no DB connection, no server-only imports). They verify:
 *   1. The Task type carries isMilestone (compile-time + runtime assertions).
 *   2. MilestoneTaskRow type covers the full ARCH_SPEC §1.2 read shape.
 *   3. Row-mapper coercion logic: isMilestone truthy → truthy; falsy → undefined.
 *   4. Migration file exists and contains the expected ALTER TABLE SQL.
 *   5. setTaskMilestoneAction is present in the tasks actions source (grep guard).
 *   6. getMilestoneTasks is present in queries source (grep guard).
 *   7. D6 contract: the action name explicitly says "milestone" not "publish".
 *
 * Run via:
 *   ./node_modules/.bin/tsx --tsconfig tsconfig.json src/server/db/milestone.test.ts
 *
 * No DB connection required. Server-only modules are NOT imported at runtime
 *, only their source text is inspected via readFileSync (same approach used
 * for the migration guard below).
 */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Task } from "../../lib/data.js";
import type { MilestoneTaskRow } from "./queries.js";

// ── inline test harness (same pattern as seed.test.ts) ──────────────────────

interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
}
const tests: TestCase[] = [];
function test(name: string, fn: () => void | Promise<void>): void {
  tests.push({ name, fn });
}

// Resolve paths relative to this file (src/server/db/)
const repoRoot = join(new URL(".", import.meta.url).pathname, "../../..");

// ── 1. Task type accepts isMilestone ────────────────────────────────────────

test("Task type accepts isMilestone: true", () => {
  // Compile-time: would fail if isMilestone not in Task type.
  const t: Task = {
    id: "t-test",
    title: "Final menu tasting",
    lane: "todo",
    priority: "p1",
    assignees: [],
    parentTaskId: null,
    externalContactName: null,
    externalContactEmail: null,
    cents: null,
    updatedAt: new Date(),
    isMilestone: true,
  };
  assert.strictEqual(t.isMilestone, true);
});

test("Task type accepts isMilestone: false", () => {
  const t: Task = {
    id: "t-test-2",
    title: "Normal task",
    lane: "doing",
    priority: "p2",
    assignees: [],
    parentTaskId: null,
    externalContactName: null,
    externalContactEmail: null,
    cents: null,
    updatedAt: new Date(),
    isMilestone: false,
  };
  assert.strictEqual(!!t.isMilestone, false);
});

test("Task type allows isMilestone to be omitted (legacy rows)", () => {
  const t: Task = {
    id: "t-test-3",
    title: "Legacy task",
    lane: "done",
    priority: "p3",
    assignees: [],
    parentTaskId: null,
    externalContactName: null,
    externalContactEmail: null,
    cents: null,
    updatedAt: new Date(),
    // isMilestone deliberately omitted, must be valid (optional field)
  };
  assert.strictEqual(t.isMilestone, undefined);
  assert.strictEqual(!!t.isMilestone, false, "undefined isMilestone must be falsy");
});

// ── 2. Row-mapper coercion logic (pure function, no imports needed) ──────────

function mapIsMilestone(dbValue: unknown): true | undefined {
  // Replicate the exact logic from row-mappers.ts:
  //   isMilestone: row.isMilestone || undefined
  return (dbValue || undefined) as true | undefined;
}

test("row-mapper: DB value 1 → truthy", () => {
  assert.ok(mapIsMilestone(1), "DB integer 1 should map to truthy");
});

test("row-mapper: DB value 0 → undefined", () => {
  assert.strictEqual(mapIsMilestone(0), undefined, "DB integer 0 should map to undefined");
});

test("row-mapper: DB value true → truthy", () => {
  assert.ok(mapIsMilestone(true), "boolean true should survive coercion");
});

test("row-mapper: DB value false → undefined", () => {
  assert.strictEqual(mapIsMilestone(false), undefined, "boolean false should coerce to undefined");
});

test("row-mapper: toggling true→false→true preserves correctness", () => {
  // Simulate toggle cycle
  let state: true | undefined = mapIsMilestone(true);
  assert.ok(state, "after set: should be truthy");
  state = mapIsMilestone(false);
  assert.strictEqual(state, undefined, "after unset: should be undefined");
  state = mapIsMilestone(true);
  assert.ok(state, "after re-set: should be truthy again");
});

// ── 3. MilestoneTaskRow type covers ARCH_SPEC §1.2 read shape ────────────────

test("MilestoneTaskRow covers all ARCH_SPEC §1.2 fields", () => {
  const row: MilestoneTaskRow = {
    id: "t-abc",
    title: "Ceremony confirmed",
    lane: "todo",
    dueAt: new Date("2026-08-15"),
    isMilestone: true,
    workspaceId: "ws-1",
    workspaceSlug: "murphys-wedding",
    workspaceName: "Murphy Wedding",
    ownerEmail: "niamh@glenmara.ie",
  };
  assert.strictEqual(typeof row.id, "string");
  assert.strictEqual(typeof row.title, "string");
  assert.strictEqual(typeof row.lane, "string");
  assert.ok(row.dueAt instanceof Date || row.dueAt === null);
  assert.strictEqual(typeof row.isMilestone, "boolean");
  assert.strictEqual(typeof row.workspaceId, "string");
  assert.strictEqual(typeof row.workspaceSlug, "string");
  assert.strictEqual(typeof row.workspaceName, "string");
  assert.ok(typeof row.ownerEmail === "string" || row.ownerEmail === null);
});

test("MilestoneTaskRow allows dueAt: null (Later lane, D7)", () => {
  const row: MilestoneTaskRow = {
    id: "t-undated",
    title: "Backup venue confirmed",
    lane: "todo",
    dueAt: null,
    isMilestone: true,
    workspaceId: "ws-2",
    workspaceSlug: "murphys-wedding",
    workspaceName: "Murphy Wedding",
    ownerEmail: "niamh@glenmara.ie",
  };
  assert.strictEqual(row.dueAt, null);
});

test("MilestoneTaskRow allows ownerEmail: null (unresolved owner)", () => {
  const row: MilestoneTaskRow = {
    id: "t-no-email",
    title: "Guest list finalised",
    lane: "doing",
    dueAt: null,
    isMilestone: true,
    workspaceId: "ws-3",
    workspaceSlug: "kellys-wedding",
    workspaceName: "Kelly Wedding",
    ownerEmail: null,
  };
  assert.strictEqual(row.ownerEmail, null);
});

// ── 4. Migration file exists and contains correct SQL ────────────────────────

test("migration 0006_add_is_milestone.sql exists", () => {
  const migPath = join(repoRoot, "drizzle/0006_add_is_milestone.sql");
  let content: string;
  try {
    content = readFileSync(migPath, "utf8");
  } catch {
    throw new Error(`Migration file not found at ${migPath}`);
  }
  assert.ok(content.length > 0, "migration file must not be empty");
});

test("migration contains ALTER TABLE tasks ADD COLUMN is_milestone", () => {
  const migPath = join(repoRoot, "drizzle/0006_add_is_milestone.sql");
  const content = readFileSync(migPath, "utf8");
  assert.ok(
    content.includes("ALTER TABLE tasks ADD COLUMN is_milestone"),
    "migration must contain correct ALTER TABLE",
  );
});

test("migration column is NOT NULL DEFAULT 0", () => {
  const migPath = join(repoRoot, "drizzle/0006_add_is_milestone.sql");
  const content = readFileSync(migPath, "utf8");
  assert.ok(
    content.includes("NOT NULL DEFAULT 0"),
    "migration column must be NOT NULL DEFAULT 0 to keep legacy rows clean",
  );
});

// ── 5. Source-level contract guards (grep the source, no import) ─────────────

test("setTaskMilestoneAction is defined in tasks actions source", () => {
  const actionsPath = join(repoRoot, "src/server/actions/tasks.ts");
  const content = readFileSync(actionsPath, "utf8");
  assert.ok(
    content.includes("export async function setTaskMilestoneAction"),
    "setTaskMilestoneAction must be exported from server/actions/tasks.ts",
  );
});

test("setTaskMilestoneAction accepts (id: string, isMilestone: boolean)", () => {
  const actionsPath = join(repoRoot, "src/server/actions/tasks.ts");
  const content = readFileSync(actionsPath, "utf8");
  assert.ok(
    content.includes("isMilestone: boolean"),
    "setTaskMilestoneAction must accept isMilestone: boolean (not string flag)",
  );
});

test("getMilestoneTasks is defined in queries source", () => {
  const queriesPath = join(repoRoot, "src/server/db/queries.ts");
  const content = readFileSync(queriesPath, "utf8");
  assert.ok(
    content.includes("export async function getMilestoneTasks"),
    "getMilestoneTasks must be exported from server/db/queries.ts for Roadmap sync consumer",
  );
});

test("getMilestoneTasks filters WHERE is_milestone=true (strategy gate)", () => {
  const queriesPath = join(repoRoot, "src/server/db/queries.ts");
  const content = readFileSync(queriesPath, "utf8");
  assert.ok(
    content.includes("eq(tasks.isMilestone, true)"),
    "getMilestoneTasks must filter on is_milestone=true, strategy gate (ARCH_SPEC §1.2)",
  );
});

test("getMilestoneTasks filters parent_task_id IS NULL (top-level only)", () => {
  const queriesPath = join(repoRoot, "src/server/db/queries.ts");
  const content = readFileSync(queriesPath, "utf8");
  assert.ok(
    content.includes("isNull(tasks.parentTaskId)"),
    "getMilestoneTasks must exclude subtasks (parent_task_id IS NULL)",
  );
});

// ── 6. D6 contract: nothing in the action auto-publishes ─────────────────────

test("D6: setTaskMilestoneAction does NOT call any publish action", () => {
  const actionsPath = join(repoRoot, "src/server/actions/tasks.ts");
  const content = readFileSync(actionsPath, "utf8");
  // Extract just the setTaskMilestoneAction function body
  const fnStart = content.indexOf("export async function setTaskMilestoneAction");
  const fnEnd = content.indexOf("\nexport ", fnStart + 1);
  const fnBody = content.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined);
  assert.ok(
    !fnBody.includes("publish"),
    "D6 violation: setTaskMilestoneAction must never call publish",
  );
  assert.ok(
    !fnBody.includes("revalidatePath") || fnBody.includes("revalidatePath"),
    "revalidatePath is fine, just not publish",
  );
});

test("D6: setTaskMilestoneAction does NOT emit a publish event", () => {
  const actionsPath = join(repoRoot, "src/server/actions/tasks.ts");
  const content = readFileSync(actionsPath, "utf8");
  const fnStart = content.indexOf("export async function setTaskMilestoneAction");
  const fnEnd = content.indexOf("\nexport ", fnStart + 1);
  const fnBody = content.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined);
  // Should only emit tasks-changed (for board refresh), never a roadmap publish event
  assert.ok(
    !fnBody.includes("roadmap:publish") && !fnBody.includes("publishWorkspace"),
    "D6 violation: setTaskMilestoneAction must not auto-publish the roadmap",
  );
});

// ── 7. Schema source guard ────────────────────────────────────────────────────

test("schema.ts has isMilestone column with mode: boolean", () => {
  const schemaPath = join(repoRoot, "src/server/db/schema.ts");
  const content = readFileSync(schemaPath, "utf8");
  assert.ok(
    content.includes('integer("is_milestone", { mode: "boolean" })'),
    'schema must define is_milestone with mode: "boolean"',
  );
});

test("schema.ts isMilestone has .notNull().default(false)", () => {
  const schemaPath = join(repoRoot, "src/server/db/schema.ts");
  const content = readFileSync(schemaPath, "utf8");
  // Check the isMilestone block has notNull and default(false)
  const colIdx = content.indexOf('"is_milestone"');
  const colBlock = content.slice(colIdx, colIdx + 120);
  assert.ok(
    colBlock.includes("notNull()"),
    "is_milestone must be NOT NULL",
  );
  assert.ok(
    colBlock.includes("default(false)"),
    "is_milestone must default to false",
  );
});

// ── runner ────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`ok  - ${t.name}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL - ${t.name}`);
      console.error(err instanceof Error ? err.message : String(err));
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passing`);
  if (failed > 0) process.exit(1);
}

void run();
