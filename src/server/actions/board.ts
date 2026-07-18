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

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { meta, tasks } from "@/server/db/schema";
import { getActiveWorkspace } from "@/server/auth";
import { LANE_ORDER, type LaneId } from "@/lib/data";
import {
  isColumnColorKey,
  type ColumnColorKey,
} from "@/lib/board-colors";
import { isDemoMode } from "@/lib/access-mode";

const MAX_NAME_LEN = 80;
/** Max custom columns per workspace. Guards against runaway configs. */
const MAX_CUSTOM_COLUMNS = 20;

// ─── Types ────────────────────────────────────────────────────────────────────

export type CustomColumn = { key: string; name: string };

/**
 * Full column configuration for a board.
 *
 * - `system`: name overrides for the four system lanes (todo/doing/review/done).
 *   Absent key = use LANES static default.
 * - `custom`: user-added columns in order of creation.
 * - `order`: stable render order for ALL columns (system + custom interleaved).
 *   Absent = LANE_ORDER (no custom columns).
 *
 * The four system lane keys are always present in the render; the `order` array
 * drives left-to-right position. System keys that fall out of `order` are
 * appended at the end (defensive, keeps board functional if config is partially
 * corrupt).
 */
export type ColumnConfig = {
  system: Partial<Record<LaneId, string>>;
  custom: CustomColumn[];
  order: string[];
  /** Per-column colour by column key (system or custom). Absent key =
   *  the default (semantic for system lanes, neutral for custom). An
   *  explicit "neutral" IS stored so an owner can override a system
   *  lane's default back to no tint. T·96 / Phase 2. */
  colors: Partial<Record<string, ColumnColorKey>>;
  /** Per-column description / subtext by column key. Absent key = the
   *  static default (system lanes) or no subtext (custom). Empty string
   *  = an owner cleared the subtext. Phase 2. */
  descriptions: Partial<Record<string, string>>;
};

/** Max column description length; wraps/truncates gracefully in the UI. */
const MAX_DESCRIPTION_LEN = 160;

/** A fresh, empty config. Used as the base whenever none is stored. */
function emptyConfig(): ColumnConfig {
  return {
    system: {},
    custom: [],
    order: [...LANE_ORDER],
    colors: {},
    descriptions: {},
  };
}

// ─── Key helpers ──────────────────────────────────────────────────────────────

function boardNameKey(workspaceId: string): string {
  return `board:${workspaceId}:name`;
}

function columnsKey(workspaceId: string): string {
  return `board:${workspaceId}:columns`;
}

// ─── Parse / serialize ────────────────────────────────────────────────────────

/**
 * Parse the stored JSON into a ColumnConfig, handling both the legacy
 * `Record<LaneId, string>` format (pure system overrides, pre step-5)
 * and the new ColumnConfig shape.
 *
 * Returns `null` on parse failure or if the stored value is clearly empty.
 */
function parseColumnConfig(raw: string): ColumnConfig | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;

    // New format: has at least one recognised config key.
    if (
      "system" in obj ||
      "custom" in obj ||
      "order" in obj ||
      "colors" in obj ||
      "descriptions" in obj
    ) {
      const system = (obj.system as Partial<Record<LaneId, string>>) ?? {};
      const custom = Array.isArray(obj.custom)
        ? (obj.custom as CustomColumn[]).filter(
            (c) =>
              c && typeof c.key === "string" && typeof c.name === "string",
          )
        : [];
      const order = Array.isArray(obj.order)
        ? (obj.order as string[]).filter((k) => typeof k === "string")
        : buildDefaultOrder(custom);
      return {
        system,
        custom,
        order,
        colors: parseColors(obj.colors),
        descriptions: parseDescriptions(obj.descriptions),
      };
    }

    // Legacy format: flat Record<string, string> with lane keys.
    const hasLane = LANE_ORDER.some((id) => typeof obj[id] === "string");
    if (!hasLane) return null;
    const system = {} as Partial<Record<LaneId, string>>;
    for (const id of LANE_ORDER) {
      if (typeof obj[id] === "string") system[id] = obj[id] as string;
    }
    return { ...emptyConfig(), system };
  } catch {
    return null;
  }
}

/** Parse the stored colours map, keeping only recognised colour keys.
 *  An explicit "neutral" is preserved (Phase 2) so a system lane can be
 *  overridden back to no tint against its semantic default. */
function parseColors(raw: unknown): Partial<Record<string, ColumnColorKey>> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Partial<Record<string, ColumnColorKey>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isColumnColorKey(value)) out[key] = value;
  }
  return out;
}

/** Parse the stored descriptions map, keeping string values (incl. "").
 *  Clamps to MAX_DESCRIPTION_LEN defensively. */
function parseDescriptions(raw: unknown): Partial<Record<string, string>> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Partial<Record<string, string>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value.slice(0, MAX_DESCRIPTION_LEN);
  }
  return out;
}

/**
 * Build the default render order: LANE_ORDER first, then custom
 * columns in their definition order.
 */
function buildDefaultOrder(custom: CustomColumn[]): string[] {
  return [...LANE_ORDER, ...custom.map((c) => c.key)];
}

/**
 * Ensure every system lane key appears in `order`. Appends any that
 * are missing (defensive; guards against corrupt configs or old clients
 * that wrote an order without all four system lanes).
 */
function normaliseOrder(config: ColumnConfig): string[] {
  const existing = new Set(config.order);
  const extra = LANE_ORDER.filter((id) => !existing.has(id));
  return [...config.order, ...extra];
}

function serializeColumnConfig(config: ColumnConfig): string {
  return JSON.stringify({
    system: config.system,
    custom: config.custom,
    order: normaliseOrder(config),
    colors: config.colors ?? {},
    descriptions: config.descriptions ?? {},
  });
}

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
  if (isDemoMode()) return null;
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
  if (!trimmed) throw new Error("Board name can't be empty.");
  if (isDemoMode()) return { ok: true };
  const ws = await getActiveWorkspace();
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

/**
 * Backward-compat alias: returns the system-lane name overrides slice only.
 * Layout code imports this and passes columnNames into DomainProvider.
 * Kept so the layout doesn't need a bigger refactor; getColumnConfig is
 * the full read path.
 *
 * @deprecated Use getColumnConfig. This will be removed once board-app.tsx
 *   is updated to consume the full config.
 */
export async function getColumnNames(
  workspaceId: string,
): Promise<Partial<Record<LaneId, string>> | null> {
  if (isDemoMode()) return null;
  const config = await readColumnConfig(workspaceId);
  if (!config) return null;
  const hasAny = LANE_ORDER.some((id) => typeof config.system[id] === "string");
  return hasAny ? config.system : null;
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
  if (!trimmed) throw new Error("Column name can't be empty.");
  if (isDemoMode()) return { ok: true };
  const ws = await getActiveWorkspace();
  const clamped = trimmed.slice(0, MAX_NAME_LEN);

  const existing = (await readColumnConfig(ws)) ?? emptyConfig();

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
  const ws = await getActiveWorkspace();

  const existing = (await readColumnConfig(ws)) ?? emptyConfig();

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
  const ws = await getActiveWorkspace();
  const clamped = description.trim().slice(0, MAX_DESCRIPTION_LEN);

  const existing = (await readColumnConfig(ws)) ?? emptyConfig();
  existing.descriptions = { ...existing.descriptions, [columnKey]: clamped };

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
  if (!trimmed) throw new Error("Column name can't be empty.");
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
  const ws = await getActiveWorkspace();

  const existing = (await readColumnConfig(ws)) ?? emptyConfig();

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
  const ws = await getActiveWorkspace();
  const existing = (await readColumnConfig(ws)) ?? emptyConfig();

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

  const ws = await getActiveWorkspace();
  const existing = await readColumnConfig(ws);
  if (!existing) throw new Error("No column config found.");

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

  // Count tasks in this column before moving, for the toast copy.
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tasks)
    .where(
      and(eq(tasks.workspaceId, ws), eq(tasks.boardColumnKey, columnKey)),
    );
  const tasksReassigned = Number(countRow?.count ?? 0);

  // Move the tasks. With an explicit destination the client picked where
  // they go: into a system lane (set `lane`, clear boardColumnKey) or
  // another custom column (set boardColumnKey). Without one, fall back to
  // clearing boardColumnKey so tasks return to their canonical system lane
  // — no data loss either way.
  if (tasksReassigned > 0) {
    if (destination && (LANE_ORDER as string[]).includes(destination)) {
      await db
        .update(tasks)
        .set({ lane: destination as LaneId, boardColumnKey: null, idleDays: null })
        .where(and(eq(tasks.workspaceId, ws), eq(tasks.boardColumnKey, columnKey)));
    } else if (destination) {
      await db
        .update(tasks)
        .set({ boardColumnKey: destination })
        .where(and(eq(tasks.workspaceId, ws), eq(tasks.boardColumnKey, columnKey)));
    } else {
      await db
        .update(tasks)
        .set({ boardColumnKey: null })
        .where(and(eq(tasks.workspaceId, ws), eq(tasks.boardColumnKey, columnKey)));
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
  const ws = await getActiveWorkspace();
  const isSystemLane = (LANE_ORDER as string[]).includes(columnKey);

  const [row] = await db
    .select({ lane: tasks.lane, boardColumnKey: tasks.boardColumnKey })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  if (!row) return { ok: true }; // workspace guard, silent no-op for foreign ids

  if (isSystemLane) {
    const toLane = columnKey as LaneId;
    if (row.lane === toLane && !row.boardColumnKey) return { ok: true };
    await db
      .update(tasks)
      .set({ lane: toLane, boardColumnKey: null, idleDays: null })
      .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  } else {
    // Custom column: only update boardColumnKey; leave lane as canonical.
    if (row.boardColumnKey === columnKey) return { ok: true };
    await db
      .update(tasks)
      .set({ boardColumnKey: columnKey })
      .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  }

  revalidatePath("/app", "layout");
  return { ok: true };
}
