"use client";

/**
 * Column management: the optimistic column config and every action that
 * edits it.
 *
 * Ported from the retired board (hybrid/options/a/board-view.tsx) with the
 * logic moved, not rewritten: each edit paints an optimistic config at once,
 * then calls its server action in @/server/actions/board, and rolls back to
 * the previous config if the server refuses. The server re-authorises every
 * action; nothing here grants permission.
 */

import { createContext, useCallback, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import { useColumnConfig } from "@/lib/domain-context";
import { defaultColumnConfig, resolveBoardColumns, resolveDoneKeys, type BoardColumn } from "@/lib/board-columns";
import { MAX_COLUMN_LIMIT, MAX_DESCRIPTION_LEN, MAX_NAME_LEN, type ColumnConfig } from "@/lib/board-config";
import type { ColumnColorKey } from "@/lib/board-colors";
import {
  addColumnAction,
  deleteColumnAction,
  renameColumnAction,
  reorderColumnsAction,
  setColumnColorAction,
  setColumnDescriptionAction,
  setColumnDoneAction,
  setColumnLimitAction,
} from "@/server/actions/board";
import { BoardColumnsOverrideProvider } from "@/components/hybrid/columns-context";

type ColumnActions = {
  columns: BoardColumn[];
  rename: (column: BoardColumn, name: string) => void;
  describe: (column: BoardColumn, description: string) => void;
  setLimit: (column: BoardColumn, limit: number | null) => void;
  setColor: (column: BoardColumn, color: ColumnColorKey) => void;
  toggleDone: (column: BoardColumn) => boolean;
  move: (column: BoardColumn, direction: -1 | 1) => void;
  remove: (column: BoardColumn, destination: string | undefined) => void;
  add: (name: string, options?: { description?: string; color?: ColumnColorKey; position?: number }) => void;
  pending: boolean;
};

const ColumnActionsContext = createContext<ColumnActions | null>(null);

export function TasksColumnsProvider({ children }: { children: ReactNode }) {
  // The server value arrives through DomainProvider; edits paint an
  // optimistic copy and the revalidated server value replaces it
  // (render-time adjust, no effect).
  const serverConfig = useColumnConfig();
  const [optimistic, setOptimistic] = useState<ColumnConfig | null>(serverConfig);
  const [previousServer, setPreviousServer] = useState(serverConfig);
  if (previousServer !== serverConfig) {
    setPreviousServer(serverConfig);
    setOptimistic(serverConfig);
  }
  const [pending, startTransition] = useTransition();
  const columns = useMemo(() => resolveBoardColumns(optimistic), [optimistic]);

  const commit = useCallback(
    (next: ColumnConfig, persist: () => Promise<unknown>) => {
      const previous = optimistic;
      setOptimistic(next);
      startTransition(async () => {
        try {
          await persist();
        } catch {
          setOptimistic(previous);
        }
      });
    },
    [optimistic],
  );

  const base = useCallback(() => optimistic ?? defaultColumnConfig(), [optimistic]);

  const value = useMemo<ColumnActions>(() => ({
    columns,
    pending,
    rename: (column, raw) => {
      const name = raw.trim().slice(0, MAX_NAME_LEN);
      if (!name || name === column.name) return;
      const next = base();
      commit(
        column.isSystem
          ? { ...next, system: { ...next.system, [column.key]: name } }
          : { ...next, custom: next.custom.map((c) => (c.key === column.key ? { ...c, name } : c)) },
        () => renameColumnAction(column.key, name),
      );
    },
    describe: (column, raw) => {
      const description = raw.trim().slice(0, MAX_DESCRIPTION_LEN);
      if (description === (column.description ?? "")) return;
      const next = base();
      commit({ ...next, descriptions: { ...next.descriptions, [column.key]: description } }, () =>
        setColumnDescriptionAction(column.key, description),
      );
    },
    setLimit: (column, limit) => {
      const valid = limit === null || (Number.isInteger(limit) && limit >= 0 && limit <= MAX_COLUMN_LIMIT);
      if (!valid) return;
      const normalised = limit === 0 ? null : limit;
      if ((normalised ?? undefined) === column.limit) return;
      const next = base();
      const limits = { ...next.limits };
      if (normalised === null) delete limits[column.key];
      else limits[column.key] = normalised;
      commit({ ...next, limits }, () => setColumnLimitAction(column.key, normalised));
    },
    setColor: (column, color) => {
      const next = base();
      commit({ ...next, colors: { ...next.colors, [column.key]: color } }, () => setColumnColorAction(column.key, color));
    },
    toggleDone: (column) => {
      const next = base();
      const keys = new Set(resolveDoneKeys(next));
      const marking = !column.isDone;
      if (marking) keys.add(column.key);
      else keys.delete(column.key);
      // The board always keeps at least one done column; the server refuses
      // an empty set, so never paint a state it will reject.
      if (keys.size === 0) return false;
      commit({ ...next, doneKeys: [...keys] }, () => setColumnDoneAction(column.key, marking));
      return true;
    },
    move: (column, direction) => {
      const from = columns.findIndex((c) => c.key === column.key);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= columns.length) return;
      const order = columns.map((c) => c.key);
      const [moved] = order.splice(from, 1);
      order.splice(to, 0, moved);
      const next = base();
      commit({ ...next, order }, () => reorderColumnsAction(order));
    },
    remove: (column, destination) => {
      if (column.isSystem) return;
      const next = base();
      commit(
        { ...next, custom: next.custom.filter((c) => c.key !== column.key), order: next.order.filter((k) => k !== column.key) },
        () => deleteColumnAction(column.key, destination),
      );
    },
    add: (raw, options = {}) => {
      const name = raw.trim().slice(0, MAX_NAME_LEN);
      if (!name) return;
      const description = options.description?.trim();
      const color = options.color && options.color !== "neutral" ? options.color : undefined;
      const tempKey = `col-temp-${Math.random().toString(36).slice(2, 8)}`;
      const next = base();
      const order = [...next.order];
      const append = options.position === undefined || options.position >= order.length;
      if (append) order.push(tempKey);
      else order.splice(options.position!, 0, tempKey);
      commit(
        {
          ...next,
          custom: [...next.custom, { key: tempKey, name }],
          order,
          colors: color ? { ...next.colors, [tempKey]: color } : next.colors,
          descriptions: description ? { ...next.descriptions, [tempKey]: description } : next.descriptions,
        },
        () => addColumnAction(name, { description: description || undefined, color, position: append ? undefined : options.position }),
      );
    },
  }), [base, columns, commit, pending]);

  return (
    <ColumnActionsContext.Provider value={value}>
      <BoardColumnsOverrideProvider columns={columns}>{children}</BoardColumnsOverrideProvider>
    </ColumnActionsContext.Provider>
  );
}

export function useColumnActions(): ColumnActions {
  const value = useContext(ColumnActionsContext);
  if (!value) throw new Error("useColumnActions must be used inside TasksColumnsProvider");
  return value;
}
