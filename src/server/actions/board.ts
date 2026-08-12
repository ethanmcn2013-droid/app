"use server";

/**
 * Board-level mutations: per-workspace name override, column-name
 * overrides, and custom column management (add / rename / reorder /
 * delete). All stored in the existing `meta` key/value table —
 * no schema migration required for items 3 and 4 in T·69.
 *
 * Key shapes:
 *   board:{workspaceId}:name      , plain string, ≤80 chars
 *   board:{workspaceId}:columns   , JSON: ColumnConfig (see below)
 *
 * ColumnConfig shape:
 *   {
 *     system?: Record<LaneId, string>  // system-lane name overrides (optional)
 *     custom?: Array<{key:string, name:string}>  // user-added columns
 *     order?: string[]  // all column keys in render order; default = LANE_ORDER
 *   }
 *
 * Backward compat: if the stored value is the old Record<LaneId,string>
 * format (steps 3/4 of T·69, shipped before step 5), it is interpreted
 * as `{ system: <that record>, custom: [], order: LANE_ORDER }`.
 *
 * Workspace-scoping is done by encoding the workspaceId into the key
 * AND by requiring the caller to own the active workspace (auth guard
 * matches every other action in this suite).
 */

import { and, eq, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { meta, tasks } from "@/server/db/schema";
import { getActiveWorkspaceOrNull, getCurrentUser } from "@/server/auth";
import {
  authorizeProjectCandidate,
  scopeForTask,
} from "@/server/actions/project-authz";
import { LANE_ORDER, type LaneId } from "@/lib/data";
import {
  isColumnColorKey,
  type ColumnColorKey,
} from "@/lib/board-colors";
import {
  MAX_COLUMN_LIMIT,
  MAX_CUSTOM_COLUMNS,
  MAX_DESCRIPTION_LEN,
  MAX_NAME_LEN,
  parseColumnConfig,
  serializeColumnConfig,
  type ColumnConfig,
} from "@/lib/board-config";
// T·121: a workspace that has never stored a config operates on the default
// five-column board (Waiting is a default custom column). Every mutation
// therefore bases its first write on defaultColumnConfig(), never on the
// bare four-lane emptyConfig() — otherwise the first rename on a fresh
// board would persist a config without Waiting and the column would vanish.
import {
  defaultColumnConfig,
  isDoneColumnKey,
  isTaskDone,
  resolveDoneKeys,
} from "@/lib/board-columns";
import { isDemoMode } from "@/lib/access-mode";
import { DEMO_WORKSPACE_NAME } from "@/server/demo/tasks-demo";

// Re-export the config types so existing importers of "@/server/actions/board"
// (domain-context, board-app) keep working; the canonical model lives in
// @/lib/board-config for unit-testability.
export type { ColumnConfig, CustomColumn } from "@/lib/board-config";

// ─── Project resolution ───────────────────────────────────────────────────────

/**
 * The Project a board-configuration write lands in — ADR 0001 §9, create/list.
 *
 * Every mutation in this file writes to `meta` under a key built from a
 * workspace id: `board:{workspaceId}:name`, `board:{workspaceId}:columns`.
 * There is no row to derive the Project from and no `WHERE` to get it wrong —
 * the resolved id *is* the destination, spliced straight into the key. That
 * makes these the sharpest kind of ambient site: a wrong id does not fail, it
 * silently reconfigures another Project's board.
 *
 * Two changes. The cookie is read through the fail-closed accessor, so it can
 * no longer decay to `LEGACY_WORKSPACE_ID` and rewrite a workspace the caller
 * has proved nothing about (D-005). And membership is proved before the key is
 * built, rather than assumed because a cookie parsed.
 *
 * `createOrEditTasks` rather than `manageProject`: renaming a column is
 * ordinary board work that every member does today, and WP3 is not the place
 * to introduce a role gate the product has never had.
 */
async function provedBoardProject(candidate: string | null): Promise<string> {
  const grant = await authorizeProjectCandidate({
    candidateProjectId: candidate,
    capability: "createOrEditTasks",
  });
  // One neutral message for every refusal: "no such Project", "not a member"
  // and "no Project at all" must not be tellable apart (ADR 0001 §4).
  if (!grant.ok) throw new Error("That project isn’t available.");
  return grant.projectId;
}

// ─── Key helpers ──────────────────────────────────────────────────────────────

function boardNameKey(workspaceId: string): string {
  return `board:${workspaceId}:name`;
}

function columnsKey(workspaceId: string): string {
  return `board:${workspaceId}:columns`;
}

// Parse / serialize / emptyConfig live in @/lib/board-config (pure + tested).

async function readColumnConfig(
  workspaceId: string,
): Promise<ColumnConfig | null> {
  const key = columnsKey(workspaceId);
  const [row] = await db
    .select({ value: meta.value })
    .from(meta)
    .where(eq(meta.key, key));
  if (!row) return null;
  return parseColumnConfig(row.value);
}

async function writeColumnConfig(
  workspaceId: string,
  config: ColumnConfig,
): Promise<void> {
  const key = columnsKey(workspaceId);
  const value = serializeColumnConfig(config);
  await db.run(sql`
    INSERT INTO meta (key, value, updated_at)
    VALUES (${key}, ${value}, unixepoch())
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);
}

// ─── Board name ───────────────────────────────────────────────────────────────

/**
 * Read the board-name override for a workspace. Returns null when no
 * override has been stored, callers fall back to the domain pack
 * workspaceTitle. Used by the app layout server component so the value
 * is server-rendered on every load.
 */
export async function getBoardName(
  workspaceId: string,
): Promise<string | null> {
  if (isDemoMode()) return DEMO_WORKSPACE_NAME;
  const key = boardNameKey(workspaceId);
  const [row] = await db
    .select({ value: meta.value })
    .from(meta)
    .where(eq(meta.key, key));
  return row?.value ?? null;
}

/**
 * Upsert the board-name override for the caller's active workspace.
 * Trims, rejects empty, clamps to MAX_NAME_LEN.
 */
export async function renameBoardAction(name: string): Promise<{ ok: true }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Board name can’t be empty.");
  if (isDemoMode()) return { ok: true };
  const ws = await provedBoardProject(await getActiveWorkspaceOrNull());
  const clamped = trimmed.slice(0, MAX_NAME_LEN);
  const key = boardNameKey(ws);
  await db.run(sql`
    INSERT INTO meta (key, value, updated_at)
    VALUES (${key}, ${clamped}, unixepoch())
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);
  revalidatePath("/app", "layout");
  return { ok: true };
}

// ─── Column config reads ──────────────────────────────────────────────────────

/**
 * Read full column config for a workspace. Returns null when no config
 * has been stored. Used by the layout server component.
 */
export async function getColumnConfig(
  workspaceId: string,
): Promise<ColumnConfig | null> {
  if (isDemoMode()) return null;
  return readColumnConfig(workspaceId);
}

// ─── Column mutations ─────────────────────────────────────────────────────────

/**
 * Rename a column, system lane or custom column.
 *
 * For system lanes, the name is stored in `config.system[laneId]`.
 * For custom columns, the name is updated in `config.custom[]`.
 */
export async function renameColumnAction(
  columnKey: string,
  name: string,
): Promise<{ ok: true }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Column name can’t be empty.");
  if (isDemoMode()) return { ok: true };
  const ws = await provedBoardProject(await getActiveWorkspaceOrNull());
  const clamped = trimmed.slice(0, MAX_NAME_LEN);

  const existing = (await readColumnConfig(ws)) ?? defaultColumnConfig();

  if ((LANE_ORDER as string[]).includes(columnKey)) {
    // System lane rename.
    existing.system = {
      ...existing.system,
      [columnKey as LaneId]: clamped,
    };
  } else {
    // Custom column rename.
    const idx = existing.custom.findIndex((c) => c.key === columnKey);
    if (idx === -1) throw new Error(`Unknown column key: ${columnKey}`);
    existing.custom = existing.custom.map((c) =>
      c.key === columnKey ? { ...c, name: clamped } : c,
    );
  }

  await writeColumnConfig(ws, existing);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/**
 * Set (or clear) a column's colour. Works for system lanes and custom
 * columns alike. `neutral` clears any stored colour (back to no tint).
 * T·96.
 */
export async function setColumnColorAction(
  columnKey: string,
  color: ColumnColorKey,
): Promise<{ ok: true }> {
  if (!isColumnColorKey(color)) throw new Error("Unknown column colour.");
  if (isDemoMode()) return { ok: true };
  const ws = await provedBoardProject(await getActiveWorkspaceOrNull());

  const existing = (await readColumnConfig(ws)) ?? defaultColumnConfig();

  // Store the chosen colour explicitly, including "neutral", so an owner
  // can override a system lane's semantic default back to no tint. The
  // client's boardColumnColor() treats a stored value as the owner's
  // choice and never overrides it with a default.
  existing.colors = { ...existing.colors, [columnKey]: color };

  await writeColumnConfig(ws, existing);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/**
 * Set (or clear) a column's description / subtext. Works for system lanes
 * and custom columns alike. An empty string clears the subtext (the
 * column then shows no description, not its static default). Phase 2.
 */
export async function setColumnDescriptionAction(
  columnKey: string,
  description: string,
): Promise<{ ok: true }> {
  if (isDemoMode()) return { ok: true };
  const ws = await provedBoardProject(await getActiveWorkspaceOrNull());
  const clamped = description.trim().slice(0, MAX_DESCRIPTION_LEN);

  const existing = (await readColumnConfig(ws)) ?? defaultColumnConfig();
  existing.descriptions = { ...existing.descriptions, [columnKey]: clamped };

  await writeColumnConfig(ws, existing);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/**
 * Set (or clear) a column's soft work-in-progress limit (T·121). Works for
 * system lanes and custom columns alike. `null` (or 0) clears the limit.
 * Advisory only: the board shows amber at and over the limit; nothing is
 * ever blocked.
 */
export async function setColumnLimitAction(
  columnKey: string,
  limit: number | null,
): Promise<{ ok: true }> {
  if (limit !== null) {
    if (!Number.isInteger(limit) || limit < 0 || limit > MAX_COLUMN_LIMIT) {
      throw new Error("Column limit must be a whole number in range.");
    }
  }
  if (isDemoMode()) return { ok: true };
  const ws = await provedBoardProject(await getActiveWorkspaceOrNull());

  const existing = (await readColumnConfig(ws)) ?? defaultColumnConfig();
  const limits = { ...existing.limits };
  if (limit === null || limit === 0) delete limits[columnKey];
  else limits[columnKey] = limit;
  existing.limits = limits;

  await writeColumnConfig(ws, existing);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/**
 * Mark (or unmark) a column as done-meaning (T·122). Guard: the board
 * must always keep at least one done column, or progress, briefs and
 * exports would have nothing to count — unmarking the last one throws.
 */
export async function setColumnDoneAction(
  columnKey: string,
  isDone: boolean,
): Promise<{ ok: true }> {
  if (isDemoMode()) return { ok: true };
  const ws = await provedBoardProject(await getActiveWorkspaceOrNull());

  const existing = (await readColumnConfig(ws)) ?? defaultColumnConfig();
  const current = new Set(resolveDoneKeys(existing));
  if (isDone) current.add(columnKey);
  else current.delete(columnKey);
  if (current.size === 0) {
    throw new Error("At least one column must count as done.");
  }
  existing.doneKeys = [...current];

  await writeColumnConfig(ws, existing);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Options for creating a custom column (Phase 2 full column management). */
export type AddColumnOptions = {
  /** Optional description / subtext shown under the column title. */
  description?: string;
  /** Optional colour; defaults to neutral (no tint). */
  color?: ColumnColorKey;
  /** Optional 0-based insert position within the full column order.
   *  Out of range clamps to the end. Absent = append. */
  position?: number;
};

/**
 * Add a new custom column. Generates a stable, URL-safe key from the
 * name (slug-style). Appends to the end of `order` by default, or inserts
 * at `opts.position` when supplied.
 *
 * Duplicate display names are allowed (the generated key is unique), which
 * matches the existing product convention — columns are identified by key,
 * not name, so two "Staging" columns can coexist.
 *
 * Returns the new column's key so the client can optimistically render it.
 */
export async function addColumnAction(
  name: string,
  opts: AddColumnOptions = {},
): Promise<{ ok: true; key: string }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Column name can’t be empty.");
  const clamped = trimmed.slice(0, MAX_NAME_LEN);
  const color = opts.color && isColumnColorKey(opts.color) ? opts.color : null;
  const description =
    typeof opts.description === "string"
      ? opts.description.trim().slice(0, MAX_DESCRIPTION_LEN)
      : "";

  const slug = clamped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);

  if (isDemoMode()) {
    return { ok: true, key: `col-${slug || "column"}-demo` };
  }
  const ws = await provedBoardProject(await getActiveWorkspaceOrNull());

  const existing = (await readColumnConfig(ws)) ?? defaultColumnConfig();

  if (existing.custom.length >= MAX_CUSTOM_COLUMNS) {
    throw new Error(
      `Workspace is at the column limit (${MAX_CUSTOM_COLUMNS} custom columns).`,
    );
  }

  // Generate a stable, collision-resistant key.
  // Format: `col-<slug>-<4-hex>` so two columns named "Staging" can coexist.
  const rand = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, "0");
  const key = `col-${slug || "column"}-${rand}`;

  existing.custom = [...existing.custom, { key, name: clamped }];
  // Ensure default order exists before inserting.
  if (!existing.order.length) {
    existing.order = [...LANE_ORDER];
  }
  if (
    typeof opts.position === "number" &&
    opts.position >= 0 &&
    opts.position < existing.order.length
  ) {
    const next = [...existing.order];
    next.splice(opts.position, 0, key);
    existing.order = next;
  } else {
    existing.order = [...existing.order, key];
  }
  if (color) existing.colors = { ...existing.colors, [key]: color };
  if (description) {
    existing.descriptions = { ...existing.descriptions, [key]: description };
  }

  await writeColumnConfig(ws, existing);
  revalidatePath("/app", "layout");
  return { ok: true, key };
}

/**
 * Reorder columns by setting a new full `order` array.
 *
 * Validation:
 *   - All four system lane keys must be present in the new order.
 *   - All custom column keys must be present (no orphans, no extras).
 *   - No duplicates.
 *
 * The client passes the full intended order; the server validates and
 * writes it. Cheaper than delta ops for the small N of columns a board
 * ever has (≤24 total).
 */
export async function reorderColumnsAction(
  newOrder: string[],
): Promise<{ ok: true }> {
  if (isDemoMode()) return { ok: true };
  const ws = await provedBoardProject(await getActiveWorkspaceOrNull());
  const existing = (await readColumnConfig(ws)) ?? defaultColumnConfig();

  const allKeys = new Set([
    ...LANE_ORDER,
    ...existing.custom.map((c) => c.key),
  ]);

  // Deduplicate the incoming order.
  const seen = new Set<string>();
  const deduped = newOrder.filter((k) => {
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Reject if any canonical key is missing.
  for (const key of allKeys) {
    if (!deduped.includes(key)) {
      throw new Error(`Reorder is missing column key: ${key}`);
    }
  }
  // Reject unknown keys.
  for (const key of deduped) {
    if (!allKeys.has(key)) {
      throw new Error(`Unknown column key in reorder: ${key}`);
    }
  }

  existing.order = deduped;
  await writeColumnConfig(ws, existing);
  revalidatePath("/app", "layout");
  return { ok: true };
}

/**
 * Delete a custom column.
 *
 * System lanes (todo/doing/review/done) are NOT deletable, the action
 * throws with a clear message.
 *
 * Non-empty column behavior: tasks whose `board_column_key` matches the
 * deleted key have that key cleared. Their `lane` is untouched, so they
 * reappear in their canonical system lane. This is the least-surprising
 * outcome: no data loss, tasks don't vanish, they just "fall back" to
 * their semantic lane. A deleted "Staging" column with 5 tasks → those
 * tasks reappear in "Moving" (their canonical `doing` lane).
 *
 * We chose reassign-to-canonical-lane over blocking deletion because:
 *   - The directive says tasks must "survive" deletion.
 *   - Blocking on non-empty columns creates a chicken-and-egg (you have
 *     to move the cards first, which is friction with no data-safety benefit
 *     since they're still in the workspace, just in a different column).
 *   - Clearing boardColumnKey is reversible by the user (undo isn't built,
 *     but moving to another custom column is).
 *
 * If we later want to block, replace the `clearColumnKey` call with:
 *   throw new Error(`Column "${name}" has ${count} tasks. Move them first.`)
 */
export async function deleteColumnAction(
  columnKey: string,
  destinationKey?: string,
): Promise<{ ok: true; tasksReassigned: number }> {
  if ((LANE_ORDER as string[]).includes(columnKey)) {
    throw new Error("System lanes cannot be deleted.");
  }

  if (isDemoMode()) return { ok: true, tasksReassigned: 0 };

  const ws = await provedBoardProject(await getActiveWorkspaceOrNull());
  // A fresh workspace holds no stored config but still shows the default
  // board, whose Waiting column is deletable like any custom column — so
  // the delete bases on the default config rather than refusing.
  const existing = (await readColumnConfig(ws)) ?? defaultColumnConfig();

  const col = existing.custom.find((c) => c.key === columnKey);
  if (!col) throw new Error(`Unknown custom column key: ${columnKey}`);

  // Validate the destination (when supplied). It must be a real, different
  // column — a system lane or another custom column — so tasks never land
  // in the column being deleted.
  let destination: string | null = null;
  if (destinationKey && destinationKey !== columnKey) {
    const isSystem = (LANE_ORDER as string[]).includes(destinationKey);
    const isCustom = existing.custom.some((c) => c.key === destinationKey);
    if (!isSystem && !isCustom) {
      throw new Error(`Unknown destination column: ${destinationKey}`);
    }
    destination = destinationKey;
  }

  // A task belongs to this column through its claim (boardColumnKey) OR,
  // for a non-canonical key, through raw `lane` text — the pre-0024 shape
  // of the Waiting column and any other stray value that ever leaked into
  // the unconstrained lane column. Deleting the column must move both
  // kinds, or the raw-lane rows would re-materialise as an orphan column.
  // The tenant clause stays inline at every callsite below so the
  // tenant-scope contract can verify it; only the column-membership OR is
  // shared.
  const memberOfDeletedColumn = or(
    eq(tasks.boardColumnKey, columnKey),
    and(isNull(tasks.boardColumnKey), eq(tasks.lane, columnKey as LaneId)),
  );

  // Count tasks in this column before moving, for the toast copy.
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, ws), memberOfDeletedColumn));
  const tasksReassigned = Number(countRow?.count ?? 0);

  // Move the tasks. With an explicit destination the client picked where
  // they go: into a system lane (set `lane`, clear boardColumnKey) or
  // another custom column (set boardColumnKey, canonicalising any raw
  // lane text to "doing"). Without one, fall back to clearing the claim
  // so tasks return to their canonical system lane — no data loss either
  // way, and no raw-text lane survives the delete.
  const canonicalisedLane = sql`CASE WHEN ${tasks.lane} = ${columnKey} THEN 'doing' ELSE ${tasks.lane} END`;
  if (tasksReassigned > 0) {
    if (destination && (LANE_ORDER as string[]).includes(destination)) {
      await db
        .update(tasks)
        .set({ lane: destination as LaneId, boardColumnKey: null, idleDays: null })
        .where(and(eq(tasks.workspaceId, ws), memberOfDeletedColumn));
    } else if (destination) {
      await db
        .update(tasks)
        .set({
          boardColumnKey: destination,
          lane: canonicalisedLane as unknown as LaneId,
        })
        .where(and(eq(tasks.workspaceId, ws), memberOfDeletedColumn));
    } else {
      await db
        .update(tasks)
        .set({
          boardColumnKey: null,
          lane: canonicalisedLane as unknown as LaneId,
        })
        .where(and(eq(tasks.workspaceId, ws), memberOfDeletedColumn));
    }
  }

  // Remove the column from config, including any colour / description it held.
  existing.custom = existing.custom.filter((c) => c.key !== columnKey);
  existing.order = existing.order.filter((k) => k !== columnKey);
  const nextColors = { ...existing.colors };
  delete nextColors[columnKey];
  existing.colors = nextColors;
  const nextDescriptions = { ...existing.descriptions };
  delete nextDescriptions[columnKey];
  existing.descriptions = nextDescriptions;

  await writeColumnConfig(ws, existing);
  revalidatePath("/app", "layout");
  return { ok: true, tasksReassigned };
}

// ─── Card move ────────────────────────────────────────────────────────────────

/**
 * Move a task to a board column, system lane or custom column.
 *
 * System lane move (columnKey ∈ LANE_ORDER):
 *   - Sets `tasks.lane = columnKey`
 *   - Clears `tasks.board_column_key` (null)
 *   - Lane stays canonical for List/Timeline/Calendar/export/print/SSE.
 *
 * Custom column move (columnKey starts with "col-"):
 *   - Sets `tasks.board_column_key = columnKey`
 *   - Does NOT change `tasks.lane`, the task keeps its semantic lane.
 *   - In List/Timeline/Calendar/export/print/SSE, the task groups under
 *     its canonical `lane`. For custom-column tasks whose lane is "todo"
 *     or "review" or "done", they appear under that lane in structured views;
 *     tasks with no prior system lane move default to "doing" (in-progress
 *     semantic). The board is the only surface where `board_column_key` wins.
 *
 * Idempotent: if the task is already in that column, returns current tasks.
 */
export async function moveTaskToColumnAction(
  id: string,
  columnKey: string,
): Promise<{ ok: true }> {
  if (isDemoMode()) return { ok: true };
  // Object operation, not create/list: the card being dragged already belongs
  // to a Project, and that Project decides. Scoping this to the cookie is what
  // made a drag on a stale board return { ok: true } and move nothing.
  const me = await getCurrentUser();
  const scope = await scopeForTask(id, me);
  if (!scope.ok) return { ok: true }; // neutral: refused and unknown look alike
  const ws = scope.ws;
  const isSystemLane = (LANE_ORDER as string[]).includes(columnKey);

  const [row] = await db
    .select({ lane: tasks.lane, boardColumnKey: tasks.boardColumnKey })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  if (!row) return { ok: true }; // re-read under the proved Project

  // Done transitions stamp completedAt whichever way the claim moves —
  // a custom "Paid" column that counts as done completes the task the
  // same as the canonical Done lane (T·122).
  const config = await readColumnConfig(ws);
  const wasDone = isTaskDone(row, config);
  if (isSystemLane) {
    const toLane = columnKey as LaneId;
    if (row.lane === toLane && !row.boardColumnKey) return { ok: true };
    await db
      .update(tasks)
      .set({
        lane: toLane,
        boardColumnKey: null,
        idleDays: null,
        ...(wasDone === isDoneColumnKey(toLane, config)
          ? {}
          : { completedAt: isDoneColumnKey(toLane, config) ? new Date() : null }),
      })
      .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  } else {
    // Custom column: set the claim. Lane normally stays canonical; a row
    // still holding raw lane text (pre-0024 "waiting") is canonicalised to
    // "doing" on touch so stray text never outlives a deliberate move.
    if (row.boardColumnKey === columnKey) return { ok: true };
    const laneIsCanonical = (LANE_ORDER as string[]).includes(row.lane);
    const nowDone = isDoneColumnKey(columnKey, config);
    await db
      .update(tasks)
      .set({
        boardColumnKey: columnKey,
        ...(laneIsCanonical ? {} : { lane: "doing" as LaneId }),
        ...(wasDone === nowDone
          ? {}
          : { completedAt: nowDone ? new Date() : null }),
      })
      .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  }

  revalidatePath("/app", "layout");
  return { ok: true };
}
