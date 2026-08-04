"use client";

/**
 * Room tools — the working state behind the Option B room view bar
 * (T·95 lab parity). One provider carries the room's search query,
 * filter, sort, and density across all four views, exactly the lab's
 * OptionB state lifted into production, plus saved views.
 *
 * Saved views persist in localStorage per workspace (the same
 * operator-owned-surface precedent as prospects/feedback in Studio HQ):
 * a saved view is a named snapshot of view + query + filter + sort +
 * density. Applying one restores the snapshot and navigates.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { Priority } from "@/lib/data";
import { TASKS_VIEW_PATHS, type TasksViewId } from "@/lib/product-urls";
import { useActiveWorkspace } from "@/lib/domain-context";

export type RoomSortMode = "manual" | "date" | "title";
/** T·125 widening: beyond the has/hasn't tri-state, any other value is a
 *  workspace member id — "this person's work, by name". */
export type RoomOwnerFilter = "all" | "assigned" | "unassigned" | (string & {});
/** T·125: filter by where work sits in time. "week" = due in the next
 *  seven days including today; "unscheduled" = explicitly dateless. */
export type RoomDueFilter = "all" | "overdue" | "today" | "week" | "unscheduled";
/** T·125: filter to one board column ("all" or a column key). */
export type RoomColumnFilter = "all" | (string & {});
export type RoomDensity = "compact" | "comfortable";
export type RoomView = TasksViewId;

export type SavedRoomView = Readonly<{
  id: string;
  name: string;
  view: RoomView;
  query: string;
  priority: "all" | Priority;
  owner: RoomOwnerFilter;
  sort: RoomSortMode;
  density: RoomDensity;
  /** Absent on views saved before the T·125 widening — treated as "all". */
  due?: RoomDueFilter;
  column?: RoomColumnFilter;
}>;

type RoomToolsState = {
  query: string;
  priority: "all" | Priority;
  owner: RoomOwnerFilter;
  due: RoomDueFilter;
  column: RoomColumnFilter;
  sort: RoomSortMode;
  density: RoomDensity;
  savedViews: readonly SavedRoomView[];
  /** List-view field configurator visibility (the Fields tool). */
  fieldsOpen: boolean;
  setFieldsOpen: (v: boolean) => void;
  setQuery: (v: string) => void;
  setPriority: (v: "all" | Priority) => void;
  setOwner: (v: RoomOwnerFilter) => void;
  setDue: (v: RoomDueFilter) => void;
  setColumn: (v: RoomColumnFilter) => void;
  setSort: (v: RoomSortMode) => void;
  setDensity: (v: RoomDensity) => void;
  clearFilters: () => void;
  activeFilterCount: number;
  saveCurrentView: (name: string, view: RoomView) => void;
  applySavedView: (id: string) => void;
  deleteSavedView: (id: string) => void;
};

const RoomToolsContext = createContext<RoomToolsState | null>(null);

const storageKey = (workspaceId: string) =>
  `signal-tasks:saved-views:${workspaceId}`;

/* localStorage as an external store (lint-safe, hydration-safe): the
   server snapshot is the empty list; writes notify subscribers. */
const savedViewListeners = new Set<() => void>();
function subscribeSavedViews(onChange: () => void) {
  savedViewListeners.add(onChange);
  return () => savedViewListeners.delete(onChange);
}
function notifySavedViews() {
  for (const listener of savedViewListeners) listener();
}
function readSavedRaw(workspaceId: string): string {
  try {
    return window.localStorage.getItem(storageKey(workspaceId)) ?? "[]";
  } catch {
    return "[]";
  }
}

export function RoomToolsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const ws = useActiveWorkspace();
  const wsId = ws?.id ?? "";
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<"all" | Priority>("all");
  const [owner, setOwner] = useState<RoomOwnerFilter>("all");
  const [due, setDue] = useState<RoomDueFilter>("all");
  const [column, setColumn] = useState<RoomColumnFilter>("all");
  const [sort, setSort] = useState<RoomSortMode>("manual");
  const [density, setDensity] = useState<RoomDensity>("compact");
  const [fieldsOpen, setFieldsOpen] = useState(false);

  const savedRaw = useSyncExternalStore(
    subscribeSavedViews,
    () => (wsId ? readSavedRaw(wsId) : "[]"),
    () => "[]",
  );
  const savedViews = useMemo<readonly SavedRoomView[]>(() => {
    try {
      const parsed = JSON.parse(savedRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [savedRaw]);

  const persist = useCallback(
    (next: readonly SavedRoomView[]) => {
      if (!wsId) return;
      try {
        window.localStorage.setItem(storageKey(wsId), JSON.stringify(next));
      } catch {
        /* storage full/blocked: the write is lost, nothing else breaks */
      }
      notifySavedViews();
    },
    [wsId],
  );

  const saveCurrentView = useCallback(
    (name: string, view: RoomView) => {
      const entry: SavedRoomView = {
        id: `sv-${Math.random().toString(36).slice(2, 10)}`,
        name,
        view,
        query,
        priority,
        owner,
        due,
        column,
        sort,
        density,
      };
      persist([...savedViews, entry]);
    },
    [column, density, due, owner, persist, priority, query, savedViews, sort],
  );

  const applySavedView = useCallback(
    (id: string) => {
      const entry = savedViews.find((v) => v.id === id);
      if (!entry) return;
      setQuery(entry.query);
      setPriority(entry.priority);
      setOwner(entry.owner);
      setDue(entry.due ?? "all");
      setColumn(entry.column ?? "all");
      setSort(entry.sort);
      setDensity(entry.density);
      router.push(TASKS_VIEW_PATHS[entry.view]);
    },
    [router, savedViews],
  );

  const deleteSavedView = useCallback(
    (id: string) => persist(savedViews.filter((v) => v.id !== id)),
    [persist, savedViews],
  );

  const clearFilters = useCallback(() => {
    setPriority("all");
    setOwner("all");
    setDue("all");
    setColumn("all");
  }, []);

  const activeFilterCount =
    (priority === "all" ? 0 : 1) +
    (owner === "all" ? 0 : 1) +
    (due === "all" ? 0 : 1) +
    (column === "all" ? 0 : 1);

  const value = useMemo(
    () => ({
      query,
      priority,
      owner,
      due,
      column,
      sort,
      density,
      savedViews,
      fieldsOpen,
      setFieldsOpen,
      setQuery,
      setPriority,
      setOwner,
      setDue,
      setColumn,
      setSort,
      setDensity,
      clearFilters,
      activeFilterCount,
      saveCurrentView,
      applySavedView,
      deleteSavedView,
    }),
    [
      query,
      priority,
      owner,
      due,
      column,
      sort,
      density,
      savedViews,
      fieldsOpen,
      clearFilters,
      activeFilterCount,
      saveCurrentView,
      applySavedView,
      deleteSavedView,
    ],
  );

  return <RoomToolsContext.Provider value={value}>{children}</RoomToolsContext.Provider>;
}

export function useRoomTools(): RoomToolsState {
  const v = useContext(RoomToolsContext);
  if (!v) throw new Error("useRoomTools must be inside <RoomToolsProvider>");
  return v;
}

// The Task-level useRoomVisibleTasks hook that used to live here served
// the pre-consolidation views; since T·125 the visible list is derived
// on LabTask by useVisibleLabTasks in src/components/hybrid/view-tools.tsx.
