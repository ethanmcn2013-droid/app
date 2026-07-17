"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DOMAINS, type DomainId, type DomainPack } from "@/lib/domains";
import type { WorkspacePersonalization } from "@/lib/onboarding/personalization";
import type { LaneId } from "@/lib/data";
import type { ColumnConfig } from "@/server/actions/board";

/** Active-workspace + domain context. The app layout resolves the
 *  active workspace once at the server-component boundary; this
 *  provider hands the resulting `(domain, workspaceId, workspaceSlug)`
 *  triple to every client component below. The DomainProvider name
 *  is kept for cycle 14 callsite continuity. */
type DomainCtx = {
  pack: DomainPack;
  workspaceId: string;
  workspaceSlug: string;
  /** Per-workspace board name override from the meta table.
   *  Null when no override has been set, consumers fall back to
   *  `shortenTitle(pack.workspaceTitle)` in that case. */
  boardName: string | null;
  /** Full column config: system overrides + custom columns + render order.
   *  Null when no config has been stored, consumers fall back to LANES
   *  defaults and LANE_ORDER. */
  columnConfig: ColumnConfig | null;
  /** Segment-aware copy for empty states and chrome. */
  personalization: WorkspacePersonalization;
};

const DomainContext = createContext<DomainCtx | null>(null);

export function DomainProvider({
  domain,
  workspaceId,
  workspaceSlug,
  boardName,
  columnConfig,
  /** @deprecated Pass columnConfig instead. Kept for callers that haven't
   *  migrated yet; merged into a synthetic ColumnConfig if columnConfig is absent. */
  columnNames,
  personalization,
  children,
}: {
  domain: DomainId;
  workspaceId: string;
  workspaceSlug: string;
  personalization: WorkspacePersonalization;
  /** Resolved from meta table in the layout server component. */
  boardName?: string | null;
  /** Full column config resolved by getColumnConfig() in the layout. */
  columnConfig?: ColumnConfig | null;
  /** @deprecated Legacy prop, use columnConfig. */
  columnNames?: Partial<Record<LaneId, string>> | null;
  children: ReactNode;
}) {
  // Merge legacy columnNames into a synthetic ColumnConfig so old callers
  // continue to work while the layout is being updated.
  const resolvedConfig: ColumnConfig | null =
    columnConfig ??
    (columnNames
      ? { system: columnNames, custom: [], order: ["todo", "doing", "review", "done"], colors: {} }
      : null);

  return (
    <DomainContext.Provider
      value={{
        pack: DOMAINS[domain],
        workspaceId,
        workspaceSlug,
        boardName: boardName ?? null,
        columnConfig: resolvedConfig,
        personalization,
      }}
    >
      {children}
    </DomainContext.Provider>
  );
}

export function useDomain(): DomainPack & {
  /** Resolved board-name override (null = not overridden). */
  boardName: string | null;
} {
  const v = useContext(DomainContext);
  if (!v) {
    // Fall back to wedding rather than throwing, callers may render
    // outside the app shell (e.g. marketing pages embed components).
    // Wedding (not marketing) so an out-of-shell render still shows a
    // real 80% audience, never the tech-company dogfood board.
    return { ...DOMAINS.wedding, boardName: null };
  }
  return { ...v.pack, boardName: v.boardName };
}

/** Active workspace metadata. Returns null when called outside the
 *  app shell, callers should branch and skip workspace-specific UI
 *  (export menu, iCal subscribe URL) in that case. */
export function useActiveWorkspace(): {
  id: string;
  slug: string;
} | null {
  const v = useContext(DomainContext);
  if (!v) return null;
  return { id: v.workspaceId, slug: v.workspaceSlug };
}

/** Full column config for the active workspace. Returns null outside
 *  the app shell, consumers fall back to LANES defaults and LANE_ORDER. */
export function useColumnConfig(): ColumnConfig | null {
  const v = useContext(DomainContext);
  return v?.columnConfig ?? null;
}

/**
 * Per-workspace column-name overrides (system lanes only).
 * @deprecated Use useColumnConfig() for the full picture (custom columns
 *   + render order). Kept for board-app.tsx and Card component that only
 *   needed system renames before step 5.
 */
export function useColumnNames(): Partial<Record<LaneId, string>> | null {
  const v = useContext(DomainContext);
  return v?.columnConfig?.system ?? null;
}

/** Segment-aware workspace copy, empty states, examples, titles. */
export function usePersonalization(): WorkspacePersonalization {
  const v = useContext(DomainContext);
  if (!v) {
    const pack = DOMAINS.wedding;
    return {
      headline: pack.emptyStateHeadline,
      body: pack.emptyStateBody,
      firstTaskExample: pack.firstTaskExample,
      workspaceTitle: pack.workspaceTitle,
    };
  }
  return v.personalization;
}
