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
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { Priority, Task } from "@/lib/data";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { useActiveWorkspace } from "@/lib/domain-context";

export type RoomSortMode = "manual" | "date" | "title";
export type RoomOwnerFilter = "all" | "assigned" | "unassigned";
export type RoomDensity = "compact" | "comfortable";
export type RoomView = "board" | "list" | "timeline" | "calendar";

export type SavedRoomView = Readonly<{
  id: string;
  name: string;
  view: RoomView;
  query: string;
  priority: "all" | Priority;
  owner: RoomOwnerFilter;
  sort: RoomSortMode;
  density: RoomDensity;
}>;

type RoomToolsState = {
  query: string;
  priority: "all" | Priority;
  owner: RoomOwnerFilter;
  sort: RoomSortMode;
  density: RoomDensity;
  savedViews: readonly SavedRoomView[];
  setQuery: (v: string) => void;
  setPriority: (v: "all" | Priority) => void;
  setOwner: (v: RoomOwnerFilter) => void;
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

function readSaved(workspaceId: string): SavedRoomView[] {
  try {
    const raw = window.localStorage.getItem(storageKey(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function RoomToolsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const ws = useActiveWorkspace();
  const wsId = ws?.id ?? "";
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<"all" | Priority>("all");
  const [owner, setOwner] = useState<RoomOwnerFilter>("all");
  const [sort, setSort] = useState<RoomSortMode>("manual");
  const [density, setDensity] = useState<RoomDensity>("compact");
  const [savedViews, setSavedViews] = useState<readonly SavedRoomView[]>([]);

  useEffect(() => {
    if (!wsId) return;
    setSavedViews(readSaved(wsId));
  }, [wsId]);

  const persist = useCallback(
    (next: readonly SavedRoomView[]) => {
      setSavedViews(next);
      if (!wsId) return;
      try {
        window.localStorage.setItem(storageKey(wsId), JSON.stringify(next));
      } catch {
        /* storage full/blocked: the in-memory list still works this session */
      }
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
        sort,
        density,
      };
      persist([...savedViews, entry]);
    },
    [density, owner, persist, priority, query, savedViews, sort],
  );

  const applySavedView = useCallback(
    (id: string) => {
      const entry = savedViews.find((v) => v.id === id);
      if (!entry) return;
      setQuery(entry.query);
      setPriority(entry.priority);
      setOwner(entry.owner);
      setSort(entry.sort);
      setDensity(entry.density);
      router.push(`/app/${entry.view}`);
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
  }, []);

  const activeFilterCount = (priority === "all" ? 0 : 1) + (owner === "all" ? 0 : 1);

  const value = useMemo(
    () => ({
      query,
      priority,
      owner,
      sort,
      density,
      savedViews,
      setQuery,
      setPriority,
      setOwner,
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
      sort,
      density,
      savedViews,
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

function matchesQuery(task: Task, query: string): boolean {
  const q = query.trim().toLocaleLowerCase("en-GB");
  if (!q) return true;
  const haystack = [
    task.title,
    task.description ?? "",
    task.lane,
    task.priority,
    ...(task.tags ?? []),
    ...task.assignees,
  ]
    .join(" ")
    .toLocaleLowerCase("en-GB");
  return haystack.includes(q);
}

function sortRoomTasks(tasks: readonly Task[], sort: RoomSortMode): Task[] {
  const list = [...tasks];
  if (sort === "title") {
    list.sort((a, b) => a.title.localeCompare(b.title, "en-GB"));
  } else if (sort === "date") {
    // Dated work first (soonest first), then explicitly unscheduled.
    list.sort((a, b) => {
      const ad = a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bd = b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });
  }
  return list;
}

/**
 * The room's visible task list: the live store filtered and ordered by
 * the tools. Views render THIS, so Filter/Sort/Search apply everywhere.
 */
export function useRoomVisibleTasks(): Task[] {
  const state = useTasksState();
  const { query, priority, owner, sort } = useRoomTools();
  return useMemo(() => {
    const filtered = state.tasks.filter((task) => {
      if (!matchesQuery(task, query)) return false;
      if (priority !== "all" && task.priority !== priority) return false;
      if (owner === "assigned" && task.assignees.length === 0) return false;
      if (owner === "unassigned" && task.assignees.length > 0) return false;
      return true;
    });
    return sortRoomTasks(filtered, sort);
  }, [owner, priority, query, sort, state.tasks]);
}
