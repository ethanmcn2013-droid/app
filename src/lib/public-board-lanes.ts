import type { ColumnConfig } from "./board-config";
import { COLUMN_COLORS } from "./board-colors";
import {
  effectiveColumnKey,
  humaniseColumnKey,
  resolveBoardColumns,
} from "./board-columns";

/**
 * Column resolution for the unauthenticated board surfaces — the share
 * link, the print sheet, the public embed — and the exports (T·121).
 *
 * These surfaces used to iterate the four canonical lanes and, after
 * T·116, "every lane the data contains". The column config now reaches
 * them: they render the same columns, names and order the operator's
 * board shows, appending a neutral column for any orphaned key still
 * present in the data so nothing a guest was sent can silently vanish.
 */

export type PublicColumn = {
  id: string;
  name: string;
  /** CSS colour value for the column dot/tint; null = neutral. */
  accent: string | null;
  /** Landing here means the work is finished (config doneKeys, T·122). */
  isDone: boolean;
};

type ColumnedTask = { lane: string; boardColumnKey?: string | null };

export function publicBoardColumns(
  config: ColumnConfig | null,
  tasks: readonly ColumnedTask[],
): PublicColumn[] {
  const resolved = resolveBoardColumns(config).map((column) => ({
    id: column.key,
    name: column.name,
    accent: COLUMN_COLORS[column.color].var,
    isDone: column.isDone,
  }));
  const known = new Set(resolved.map((column) => column.id));
  const extras = new Set<string>();
  for (const task of tasks) {
    const key = effectiveColumnKey(task);
    if (!known.has(key)) extras.add(key);
  }
  return [
    ...resolved,
    ...[...extras].sort().map((id) => ({
      id,
      name: humaniseColumnKey(id),
      accent: null,
      isDone: false,
    })),
  ];
}

/** The tasks that belong to a public column, claims and lanes alike. */
export function publicColumnTasks<T extends ColumnedTask>(
  tasks: readonly T[],
  columnId: string,
): T[] {
  return tasks.filter((task) => effectiveColumnKey(task) === columnId);
}
