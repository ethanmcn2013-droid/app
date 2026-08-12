/**
 * MY_WORK_PROJECTION.md §7.3, §7.4 — waiting and done semantics.
 * Assertions M18 to M20.
 *
 * The rule these tests exist to enforce: never guess custom-column semantics
 * from a display name.
 *
 * "Waiting" is a default CUSTOM column, not a lane. LaneId is exactly four
 * values (src/lib/data.ts:1) and a task in Waiting persists as
 * lane:"doing", boardColumnKey:"waiting" (src/lib/board-columns.ts:216-223).
 * The key "waiting" is stable (board-columns.ts:49), so renaming the column to
 * "Waiting on the venue" changes nothing. Deleting it is different: that Project
 * then has no waiting signal, and the honest answer is "unknown", not "no".
 *
 * The inverse is the trap. A workspace that adds a custom column called
 * "Waiting on client" with the key waiting-on-client has declared nothing. There
 * is no waitingKeys in ColumnConfig — it carries system, custom, order, colors,
 * descriptions, limits and doneKeys (src/lib/board-config.ts:29-37) and nothing
 * else. Reading intent off the name would be guessing, and a wrong guess here is
 * invisible: the reader sees a well-organised list that quietly misfiles the one
 * thing they were waiting on.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/my-work/waiting-semantics.contract.test.ts
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

const WAITING = "src/lib/home-layer/my-work/waiting.ts";
const READ_MODULE = "src/lib/home-layer/my-work/read.ts";
const BOARD_CONFIG = "src/lib/board-config.ts";

type ConfigLike = {
  custom: Array<{ key: string; name: string }>;
  order: string[];
  doneKeys: string[];
} | null;

type ResolveWaiting = (
  task: { columnKey: string; blockedByIds: readonly string[] },
  config: ConfigLike,
) => "blocked-by-dependency" | "in-waiting-column" | "no" | "unknown";

async function loadWaiting(): Promise<{ resolveWaiting: ResolveWaiting }> {
  const mod = await requireContractModule(WAITING, "§7.3");
  requireExports(mod, ["resolveWaiting"], WAITING);
  return mod as unknown as { resolveWaiting: ResolveWaiting };
}

/** A workspace that stored a config and kept the default Waiting column. */
const KEPT_WAITING: ConfigLike = {
  custom: [{ key: "waiting", name: "Waiting" }],
  order: ["todo", "doing", "review", "waiting", "done"],
  doneKeys: ["done"],
};

/** A workspace that renamed the default column. The KEY is unchanged. */
const RENAMED_WAITING: ConfigLike = {
  custom: [{ key: "waiting", name: "Held by the venue" }],
  order: ["todo", "doing", "review", "waiting", "done"],
  doneKeys: ["done"],
};

/** A workspace that deleted Waiting and added a differently keyed column
 *  whose NAME reads like waiting. Nothing declares its semantics. */
const NAME_ONLY_WAITING: ConfigLike = {
  custom: [{ key: "waiting-on-client", name: "Waiting on client" }],
  order: ["todo", "doing", "review", "waiting-on-client", "done"],
  doneKeys: ["done"],
};

// ── M18 · waiting comes from structure, never from a display name ───────────

test("M18 · a null config still has a waiting signal, because the default config includes it", async () => {
  const { resolveWaiting } = await loadWaiting();
  // defaultColumnConfig() ships To do · In progress · Review · Waiting · Done
  // (src/lib/board-columns.ts:78-86). No stored config means the defaults, not
  // an absence.
  assert.equal(
    resolveWaiting({ columnKey: "waiting", blockedByIds: [] }, null),
    "in-waiting-column",
  );
  assert.equal(
    resolveWaiting({ columnKey: "doing", blockedByIds: [] }, null),
    "no",
  );
});

test("M18 · renaming the Waiting column does not change the reading", async () => {
  const { resolveWaiting } = await loadWaiting();
  assert.equal(
    resolveWaiting({ columnKey: "waiting", blockedByIds: [] }, KEPT_WAITING),
    "in-waiting-column",
  );
  assert.equal(
    resolveWaiting({ columnKey: "waiting", blockedByIds: [] }, RENAMED_WAITING),
    "in-waiting-column",
    "the key is what is matched, so a renamed column reads identically",
  );
});

test("M18 · a column merely NAMED like waiting is not waiting", async () => {
  const { resolveWaiting } = await loadWaiting();
  assert.equal(
    resolveWaiting(
      { columnKey: "waiting-on-client", blockedByIds: [] },
      NAME_ONLY_WAITING,
    ),
    "unknown",
    `§7.3 seals this: nothing in ColumnConfig declares that column's semantics, so ` +
      `reading them off the display name would be a guess. The Project has no waiting ` +
      `signal, which is "unknown", not "no".`,
  );
});

test("M18 · a Project that deleted its Waiting column reports unknown, never no", async () => {
  const { resolveWaiting } = await loadWaiting();
  const deleted: ConfigLike = {
    custom: [],
    order: ["todo", "doing", "review", "done"],
    doneKeys: ["done"],
  };
  assert.equal(
    resolveWaiting({ columnKey: "doing", blockedByIds: [] }, deleted),
    "unknown",
    `"no waiting signal" and "not waiting" are different statements, and charter rule ` +
      `11 requires them to stay different`,
  );
});

test("M18 · blockedBy outranks the column, and a legacy raw waiting lane still reads", async () => {
  const { resolveWaiting } = await loadWaiting();
  assert.equal(
    resolveWaiting({ columnKey: "doing", blockedByIds: ["t-9"] }, KEPT_WAITING),
    "blocked-by-dependency",
    "blockedBy is the only first-class blocking relation (schema.ts:67)",
  );
  // Pre-migration-0024 rows still hold raw "waiting" lane text and resolve to
  // the same key through effectiveColumnKey (board-columns.ts:23-25, :155-164).
  assert.equal(
    resolveWaiting({ columnKey: "waiting", blockedByIds: [] }, null),
    "in-waiting-column",
  );
});

// ── M19 · the config gains declared waiting semantics ───────────────────────

test("M19 · ColumnConfig declares waitingKeys alongside doneKeys", () => {
  const source = readRepoFile(BOARD_CONFIG);
  assert.ok(
    source.includes("doneKeys"),
    `${BOARD_CONFIG} should still declare doneKeys; if this failed, the citation in ` +
      `§7.4 is stale and the contract needs re-deriving.`,
  );
  assert.ok(
    source.includes("waitingKeys"),
    `${BOARD_CONFIG} declares doneKeys but no waitingKeys, so a workspace cannot say ` +
      `which of its columns mean "held". Until it can, Waiting is keyed on the default ` +
      `"waiting" key and Projects that deleted the column report unknown (§7.3). ` +
      `Owned by the Tasks board surface, recorded at §13 item 2.`,
  );
});

// ── M20 · done is the configured predicate, never a literal ─────────────────

test("M20 · the My work read path resolves done through the real per-Project config", () => {
  assert.ok(
    repoFileExists(READ_MODULE),
    `${READ_MODULE} does not exist yet. §7.4 requires isTaskDone against the Project's ` +
      `real config, read with readWorkspaceColumnConfig ` +
      `(src/server/db/board-config-read.ts:12-27).`,
  );
  const source = readRepoFile(READ_MODULE);
  assert.ok(
    source.includes("isTaskDone"),
    `${READ_MODULE} must use isTaskDone, which src/lib/board-columns.ts:194-208 declares ` +
      `as THE done predicate for every surface.`,
  );
});

test("M20 · the My work read path contains no lane-done literal", () => {
  assert.ok(
    repoFileExists(READ_MODULE),
    `${READ_MODULE} does not exist yet. Four cross-Project reads resolve done with a ` +
      `literal at this base: cross-workspace.ts:105, planning/queries.ts:100/:102/:107, ` +
      `the analytics providers passing a null config (providers/tasks.ts:113-118, ` +
      `providers/notes.ts:101-105), and the briefing's fixed lane table ` +
      `(signal/lib/data/source.ts:112-117). A Project that renamed Done is measured ` +
      `wrongly by all four, silently.`,
  );
  const source = readRepoFile(READ_MODULE);
  const literals = [
    ...linesContaining(source, `lane, "done"`),
    ...linesContaining(source, `lane === "done"`),
    ...linesContaining(source, `lane = 'done'`),
  ];
  assert.deepEqual(
    literals,
    [],
    `${READ_MODULE} decides done from a lane literal on line(s) ${literals.join(", ")}`,
  );
});
