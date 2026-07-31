/**
 * The one column model every Tasks surface renders from (T·120).
 *
 * The board, the list's status grouping, the bulk toolbar, the card menus,
 * and the public share / print / embed / export surfaces all resolve their
 * columns HERE, from the workspace's ColumnConfig. Before this module, the
 * mounted board iterated a hardcoded five-value const, the public surfaces
 * iterated the four canonical lanes, and the two disagreed about both the
 * set of columns and their names.
 *
 * Model:
 * - The four system lanes (todo/doing/review/done) are permanent. They can
 *   be renamed, recoloured, described, limited and reordered, never deleted.
 * - Every other column is a custom column: `tasks.boardColumnKey` claims a
 *   task for it while `lane` keeps a canonical value ("doing") so surfaces
 *   that only understand lanes stay coherent (schema.ts: the effective
 *   column is COALESCE(boardColumnKey, lane)).
 * - "Waiting" is a DEFAULT custom column: with no stored config, the board
 *   is Queued · In progress · Review · Waiting · Done — exactly what the
 *   shipped app has rendered since 2026-07-20 — and once a workspace stores
 *   a config, Waiting is theirs to rename, recolour or delete like any
 *   other custom column.
 * - A legacy row whose `lane` still holds raw "waiting" text (pre-migration
 *   0023) resolves to the same "waiting" column key via effectiveColumnKey,
 *   so this module renders identically before and after the data migration.
 */

import { LANES, LANE_ORDER, type LaneId } from "@/lib/data";
import { boardColumnColor, type ColumnColorKey } from "@/lib/board-colors";
import { emptyConfig, type ColumnConfig } from "@/lib/board-config";

export type BoardColumn = {
  key: string;
  name: string;
  /** One of the four permanent lanes. Custom columns are not. */
  isSystem: boolean;
  /** Effective colour: owner choice, else the system default, else neutral. */
  color: ColumnColorKey;
  /** Editable subtext; undefined means "none to show". */
  description: string | undefined;
  /** Soft work-in-progress limit; undefined means no limit. */
  limit: number | undefined;
};

/** The default fifth column's stable key. Also the value legacy rows hold
 *  as raw `lane` text, which is what lets both worlds resolve identically. */
export const WAITING_COLUMN_KEY = "waiting";

/** Default subtext for the default columns. Editable per workspace; an
 *  explicit "" clears them. The sentences are the shipped group notes. */
const DEFAULT_DESCRIPTIONS: Record<string, string> = {
  todo: "Agreed and ready to start.",
  doing: "In motion right now.",
  review: "Being checked before it ships.",
  [WAITING_COLUMN_KEY]: "Held by a reply, a delivery, or a decision.",
  done: "Finished work stays visible.",
};

/**
 * The config a workspace has before it stores one: the five shipped
 * columns. Returned fresh each call so callers can mutate their copy.
 */
export function defaultColumnConfig(): ColumnConfig {
  return {
    ...emptyConfig(),
    custom: [{ key: WAITING_COLUMN_KEY, name: "Waiting" }],
    order: ["todo", "doing", "review", WAITING_COLUMN_KEY, "done"],
  };
}

function isLaneId(key: string): key is LaneId {
  return (LANE_ORDER as readonly string[]).includes(key);
}

/** "on_hold" → "On hold". Last-resort display for a key with no record. */
export function humaniseColumnKey(key: string): string {
  const spaced = key.replace(/[-_]+/g, " ").trim();
  if (spaced.length === 0) return "Other";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function resolveDescription(
  key: string,
  stored: string | undefined,
): string | undefined {
  // An explicit stored value wins, and an explicit "" means cleared.
  if (stored !== undefined) return stored === "" ? undefined : stored;
  return DEFAULT_DESCRIPTIONS[key];
}

/**
 * Resolve the ordered, render-ready column list for a workspace.
 *
 * Order comes from config.order; system lanes missing from it are appended
 * defensively so a column can never vanish through a malformed config.
 * With no stored config, the default five columns resolve.
 */
export function resolveBoardColumns(config: ColumnConfig | null): BoardColumn[] {
  const source = config ?? defaultColumnConfig();
  const customByKey = new Map(source.custom.map((c) => [c.key, c]));
  const order = source.order.length > 0 ? source.order : [...LANE_ORDER];

  const seen = new Set<string>();
  const columns: BoardColumn[] = [];

  const push = (key: string, name: string, isSystem: boolean) => {
    columns.push({
      key,
      name,
      isSystem,
      color: boardColumnColor(key, source.colors?.[key], isSystem),
      description: resolveDescription(key, source.descriptions?.[key]),
      limit: source.limits?.[key],
    });
  };

  for (const key of order) {
    if (seen.has(key)) continue;
    seen.add(key);
    if (isLaneId(key)) {
      push(key, source.system[key] ?? LANES[key].name, true);
    } else {
      const custom = customByKey.get(key);
      if (custom) push(key, custom.name, false);
      // Unknown key in order → skipped (defensive).
    }
  }

  // Append system lanes a stored order forgot, and custom columns the
  // order does not mention, so nothing configured can disappear.
  for (const id of LANE_ORDER) {
    if (!seen.has(id)) {
      seen.add(id);
      push(id, source.system[id] ?? LANES[id].name, true);
    }
  }
  for (const custom of source.custom) {
    if (!seen.has(custom.key)) {
      seen.add(custom.key);
      push(custom.key, custom.name, false);
    }
  }

  return columns;
}

/**
 * The column a task belongs to: its custom claim when it has one, else its
 * lane. Raw legacy lane text (e.g. "waiting" before migration 0023) is a
 * valid column key by design.
 */
export function effectiveColumnKey(task: {
  lane: string;
  boardColumnKey?: string | null;
}): string {
  return task.boardColumnKey || task.lane;
}

export function columnByKey(
  columns: readonly BoardColumn[],
  key: string,
): BoardColumn | undefined {
  return columns.find((column) => column.key === key);
}

/** Display name for a column key, resolving through the column list and
 *  falling back to a humanised key so orphaned data still reads honestly. */
export function columnDisplayName(
  columns: readonly BoardColumn[],
  key: string,
): string {
  return columnByKey(columns, key)?.name ?? humaniseColumnKey(key);
}

/**
 * How a move INTO a column persists, mirrored by moveTaskToColumnAction and
 * the optimistic reducer: a system column is canonical (`lane` moves, the
 * claim clears); a custom column claims the task while `lane` stays "doing"
 * so lane-only surfaces keep a truthful workflow reading.
 */
export function columnPersistence(
  column: Pick<BoardColumn, "key" | "isSystem">,
): { lane: LaneId; boardColumnKey: string | null } {
  if (column.isSystem && isLaneId(column.key)) {
    return { lane: column.key, boardColumnKey: null };
  }
  return { lane: "doing", boardColumnKey: column.key };
}
