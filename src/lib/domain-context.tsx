"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DOMAINS, type DomainId, type DomainPack } from "@/lib/domains";
import type { WorkspacePersonalization } from "@/lib/onboarding/personalization";
import type { LaneId } from "@/lib/data";
import type { ColumnConfig } from "@/server/actions/board";
import type { TagDef } from "@/lib/tags";
import type { WorkspaceMemberMeta } from "@/lib/members";

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
  /** The project's supporting line, from `workspaces.description` (T·114).
   *  Null when the owner hasn't written one; the brief shows its
   *  placeholder rather than inventing a sentence. Server-backed, so
   *  collaborators and the share, print and embed surfaces read the same
   *  text the owner sees — the previous localStorage value did not. */
  boardDescription: string | null;
  /** Full column config: system overrides + custom columns + render order.
   *  Null when no config has been stored, consumers fall back to LANES
   *  defaults and LANE_ORDER. */
  columnConfig: ColumnConfig | null;
  /** Reusable tag definitions (name + colour) for the workspace. Empty
   *  when none are defined; chips fall back to neutral. Phase 3A. */
  tagDefs: TagDef[];
  /** T·124: the project currency label (null = USD default) and the
   *  operator budget in cents (null = unset). App surfaces only —
   *  money never reaches share, print, embed or /p/{slug}. */
  currency: string | null;
  budgetCents: number | null;
  /** Real workspace members (owner first, then A–Z), resolved by
   *  getWorkspaceMemberMeta() in the layout. The assign menu and avatar
   *  stacks hydrate from this — never from design-lab fixtures. */
  members: WorkspaceMemberMeta[];
  /** The workspace's one anchor date (`workspaces.primary_date`) and the noun
   *  it is known by (`primary_date_label`). In a wedding workspace this is the
   *  wedding day. Null when the workspace has never had one set: consumers
   *  render nothing rather than inventing a date. */
  anchorDate: string | null;
  anchorLabel: string | null;
  /** Segment-aware copy for empty states and chrome. */
  personalization: WorkspacePersonalization;
};

const DomainContext = createContext<DomainCtx | null>(null);

export function DomainProvider({
  domain,
  workspaceId,
  workspaceSlug,
  boardName,
  boardDescription,
  currency,
  budgetCents,
  columnConfig,
  tagDefs,
  members,
  anchorDate,
  anchorLabel,
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
  /** Resolved from `workspaces.description` in the layout server component. */
  boardDescription?: string | null;
  /** Full column config resolved by getColumnConfig() in the layout. */
  columnConfig?: ColumnConfig | null;
  /** Reusable tag definitions resolved by getTagDefs() in the layout. */
  tagDefs?: TagDef[];
  /** Workspace members resolved by getWorkspaceMemberMeta() in the layout. */
  members?: WorkspaceMemberMeta[];
  /** `workspaces.primary_date` — the wedding day in a wedding workspace. */
  anchorDate?: string | null;
  /** `workspaces.primary_date_label` — the noun the anchor is known by. */
  anchorLabel?: string | null;
  /** Project currency + budget resolved from the workspaces row (T·124). */
  currency?: string | null;
  budgetCents?: number | null;
  /** @deprecated Legacy prop, use columnConfig. */
  columnNames?: Partial<Record<LaneId, string>> | null;
  children: ReactNode;
}) {
  // Merge legacy columnNames into a synthetic ColumnConfig so old callers
  // continue to work while the layout is being updated.
  const resolvedConfig: ColumnConfig | null =
    columnConfig ??
    (columnNames
      ? { system: columnNames, custom: [], order: ["todo", "doing", "review", "done"], colors: {}, descriptions: {}, limits: {}, doneKeys: ["done"] }
      : null);

  return (
    <DomainContext.Provider
      value={{
        pack: DOMAINS[domain],
        workspaceId,
        workspaceSlug,
        boardName: boardName ?? null,
        boardDescription: boardDescription ?? null,
        columnConfig: resolvedConfig,
        tagDefs: tagDefs ?? [],
        members: members ?? [],
        anchorDate: anchorDate ?? null,
        anchorLabel: anchorLabel ?? null,
        currency: currency ?? null,
        budgetCents: budgetCents ?? null,
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
  /** Resolved project description (null = the owner hasn't written one). */
  boardDescription: string | null;
} {
  const v = useContext(DomainContext);
  if (!v) {
    // Fall back to wedding rather than throwing, callers may render
    // outside the app shell (e.g. marketing pages embed components).
    // Wedding (not marketing) so an out-of-shell render still shows a
    // real 80% audience, never the tech-company dogfood board.
    return { ...DOMAINS.wedding, boardName: null, boardDescription: null };
  }
  return { ...v.pack, boardName: v.boardName, boardDescription: v.boardDescription };
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

/** Reusable tag definitions for the active workspace (Phase 3A). Empty
 *  outside the app shell. */
export function useTagDefs(): TagDef[] {
  const v = useContext(DomainContext);
  return v?.tagDefs ?? [];
}

/** The project money settings (T·124). Null currency renders as the
 *  USD default; null budget hides the coverage line. */
export function useProjectMoney(): { currency: string | null; budgetCents: number | null } {
  const v = useContext(DomainContext);
  return { currency: v?.currency ?? null, budgetCents: v?.budgetCents ?? null };
}

/** Real members of the active workspace, owner first. Empty outside the
 *  app shell — consumers must treat empty as "no one to offer", never
 *  fall back to fixture people. */
export function useWorkspaceMembers(): WorkspaceMemberMeta[] {
  const v = useContext(DomainContext);
  return v?.members ?? [];
}

/**
 * The workspace's anchor date and the noun it is known by. In a wedding
 * workspace that is the wedding day, and every due date can be read against
 * it. Both null outside the app shell and in any workspace that has never
 * had one set: callers render nothing rather than guess a date.
 */
export function useWorkspaceAnchor(): {
  date: string | null;
  label: string | null;
} {
  const v = useContext(DomainContext);
  return { date: v?.anchorDate ?? null, label: v?.anchorLabel ?? null };
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
