"use client";

// The board columns the mounted views render (T·121). Production mounts
// resolve the workspace's ColumnConfig once (DomainProvider carries it) and
// provide the result here; the design-lab routes provide nothing and read
// the default five columns. Every view, menu and toolbar under the hybrid
// tree gets its column set from this context — never from a constant.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColumnConfig } from "@/lib/domain-context";
import {
  resolveBoardColumns,
  type BoardColumn,
} from "@/lib/board-columns";

const BoardColumnsContext = createContext<BoardColumn[] | null>(null);

/** Production provider: resolves the active workspace's config. */
export function WorkspaceBoardColumnsProvider({ children }: { children: ReactNode }) {
  const config = useColumnConfig();
  const columns = useMemo(() => resolveBoardColumns(config), [config]);
  return (
    <BoardColumnsContext.Provider value={columns}>
      {children}
    </BoardColumnsContext.Provider>
  );
}

const DEFAULT_COLUMNS = resolveBoardColumns(null);

/** The active column set. Defaults to the shipped five columns so the
 *  design-lab routes (no provider) keep rendering unchanged. */
export function useBoardColumns(): BoardColumn[] {
  return useContext(BoardColumnsContext) ?? DEFAULT_COLUMNS;
}
