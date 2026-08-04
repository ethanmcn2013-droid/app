"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { LANES, LANE_ORDER, USERS, type Task } from "@/lib/data";
import { useAddTask } from "@/components/app/add-task/add-task-context";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { AvatarStack } from "@/components/showcase/avatar";
import { useSuiteContext } from "@/components/app/use-suite-context";
import {
  BRIEFING_APP_PATH,
  HOME_APP_PATH,
  PRODUCT_APP_PATHS,
} from "@/lib/product-urls";
import { withSuiteContext } from "@/lib/suite-context";
import {
  ScopeChipRow,
  ScopeOptionRow,
  ScopeFacetLegend,
  chipsPredicate,
  optionToChip,
  useScopeSearch,
  type ScopeChip,
  type ScopeFacet,
  type ScopeOption,
} from "@/components/ui/scope-search";

type Ctx = {
  open: boolean;
  /** Optionally seed the search field (e.g. from the Studio Bar's inline
   *  Search-Expand affordance handing off what the user typed). */
  openPalette: (initialQuery?: string) => void;
  closePalette: () => void;
};
const PaletteContext = createContext<Ctx | null>(null);

/**
 * `<PaletteRoot>` mounts the palette and binds the global cmd+k / ctrl+k
 * shortcut. Sidebar's Search link, the page-header Search button, and
 * any future "search" affordance can call `usePalette().openPalette()`
 * to surface it without re-binding the shortcut themselves.
 *
 * The palette matches task titles (with tag + description bonuses), and —
 * Delight Layer Phase 1 — accepts typed argument chips over that search:
 * `@assignee`, `#tag`, and `status:` narrow the list to a live facet of the
 * current workspace before the free text ranks what's left. Ranking is
 * "starts-with > contains > tag/desc match" so the typed prefix jumps to
 * the most likely target.
 */
export function PaletteRoot({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chips, setChips] = useState<ScopeChip[]>([]);
  const [active, setActive] = useState(0);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(true);
  const openPalette = useCallback((initialQuery = "") => {
    // Reset the search in the same event batch that opens the dialog so
    // stale results can never flash during the entrance animation. An
    // optional seed lets the Studio Bar's inline field hand off its text.
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    restoreFocusRef.current = true;
    setQuery(initialQuery);
    setChips([]);
    setActive(0);
    setOpen(true);
  }, []);
  const closePalette = useCallback(() => {
    restoreFocusRef.current = true;
    setOpen(false);
  }, []);
  const dismissPalette = useCallback(() => {
    restoreFocusRef.current = false;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    return () => {
      if (!restoreFocusRef.current) return;
      const returnTarget = returnFocusRef.current;
      window.setTimeout(() => {
        if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
      }, 0);
    };
  }, [open]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      const meta = e.metaKey || e.ctrlKey;
      // ⌘K is the universal "Search, jump or create" field (Studio Bar,
      // T·94) — the cross-app convention (Slack, Notion, Linear) where
      // ⌘K is the quick-switcher. ⌘⇧K opens the cross-workspace search
      // popover; ⌘P stays as the legacy file-open alias.
      if (meta && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) closePalette();
        else openPalette();
        return;
      }
      if (meta && e.key.toLowerCase() === "p") {
        e.preventDefault();
        if (open) closePalette();
        else openPalette();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [closePalette, open, openPalette]);

  const value = useMemo(() => ({ open, openPalette, closePalette }), [
    open,
    openPalette,
    closePalette,
  ]);

  return (
    <PaletteContext.Provider value={value}>
      {children}
      <Palette
        open={open}
        onClose={closePalette}
        onDismiss={dismissPalette}
        query={query}
        onQueryChange={setQuery}
        chips={chips}
        onChipsChange={setChips}
        active={active}
        onActiveChange={setActive}
      />
    </PaletteContext.Provider>
  );
}

export function usePalette(): Ctx {
  const v = useContext(PaletteContext);
  if (!v) throw new Error("usePalette must be inside <PaletteRoot>");
  return v;
}

// ────────────────────────────────────────────────────────────────────
// Facets — derived live from the current workspace's tasks
// ────────────────────────────────────────────────────────────────────

function useTaskFacets(tasks: Task[]): ScopeFacet[] {
  return useMemo(() => {
    const assigneeIds = new Set<string>();
    const tagSet = new Set<string>();
    for (const t of tasks) {
      t.assignees.forEach((id) => assigneeIds.add(id));
      (t.tags ?? []).forEach((tag) => tagSet.add(tag));
    }
    const assignees: ScopeOption[] = [...assigneeIds]
      .map((id) => {
        const u = USERS[id];
        return {
          value: id,
          label: u?.name ?? "Someone",
          initials: u?.initials ?? "?",
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
    const tags: ScopeOption[] = [...tagSet]
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => ({ value: tag, label: tag }));
    const statuses: ScopeOption[] = LANE_ORDER.map((id) => ({
      value: id,
      label: LANES[id].name,
      dot: LANES[id].dot,
    }));
    return [
      {
        key: "assignee",
        label: "Assignee",
        prompt: "Filter by assignee",
        kind: "person",
        options: assignees,
        triggers: ["assignee", "owner"],
        sigil: "@",
      },
      {
        key: "tag",
        label: "Tag",
        prompt: "Filter by tag",
        kind: "plain",
        options: tags,
        triggers: ["tag", "label"],
        sigil: "#",
      },
      {
        key: "status",
        label: "Status",
        prompt: "Filter by status",
        kind: "dot",
        options: statuses,
        triggers: ["status", "is"],
      },
    ];
  }, [tasks]);
}

// ────────────────────────────────────────────────────────────────────
// Palette UI
// ────────────────────────────────────────────────────────────────────

function Palette({
  open,
  onClose,
  onDismiss,
  query,
  onQueryChange,
  chips,
  onChipsChange,
  active,
  onActiveChange,
}: {
  open: boolean;
  onClose: () => void;
  onDismiss: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  chips: ScopeChip[];
  onChipsChange: (chips: ScopeChip[]) => void;
  active: number;
  onActiveChange: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();
  const state = useTasksState();
  const { openTask } = useTaskPanel();
  // "…or create": the palette is the Studio Bar's universal field (T·94),
  // so creating is a first-class exit. AddTaskRoot wraps PaletteRoot.
  const { openDialog } = useAddTask();
  const createTask = useCallback(() => {
    onDismiss();
    openDialog();
  }, [onDismiss, openDialog]);

  // Isolate the app while the modal is open. aria-modal alone does not remove
  // the background from keyboard or assistive-technology navigation.
  useEffect(() => {
    if (!open) return;
    const layer = document.querySelector<HTMLElement>(
      "[data-tasks-command-palette-layer]",
    );
    const isolated = Array.from(document.body.children)
      .filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement &&
          child !== layer &&
          !["SCRIPT", "STYLE", "LINK"].includes(child.tagName),
      )
      .map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute("aria-hidden"),
      }));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    for (const snapshot of isolated) {
      snapshot.element.inert = true;
      snapshot.element.setAttribute("aria-hidden", "true");
    }
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      for (const snapshot of isolated) {
        snapshot.element.inert = snapshot.inert;
        if (snapshot.ariaHidden === null) {
          snapshot.element.removeAttribute("aria-hidden");
        } else {
          snapshot.element.setAttribute("aria-hidden", snapshot.ariaHidden);
        }
      }
    };
  }, [open]);

  const facets = useTaskFacets(state.tasks);
  const { pending, options } = useScopeSearch(facets, chips, query);

  const results = useMemo(
    () => filterTasks(state.tasks, chips, query, Boolean(pending)),
    [state.tasks, chips, query, pending],
  );

  // In facet mode the list is options; otherwise it's task results. One
  // active index serves both; it resets to the top whenever the visible
  // list changes (query, chips, or the mode itself).
  const listLength = pending ? options.length : results.length;
  const activeIdx = Math.min(active, Math.max(0, listLength - 1));

  const addChip = useCallback(
    (facet: ScopeFacet, option: ScopeOption) => {
      onChipsChange([...chips, optionToChip(facet, option)]);
      onQueryChange("");
      onActiveChange(0);
    },
    [chips, onChipsChange, onQueryChange, onActiveChange],
  );

  const removeChip = useCallback(
    (index: number) => {
      onChipsChange(chips.filter((_, i) => i !== index));
      onActiveChange(0);
    },
    [chips, onChipsChange, onActiveChange],
  );

  const commit = useCallback(
    (taskId?: string) => {
      const id = taskId ?? results[activeIdx]?.id;
      if (!id) return;
      onDismiss();
      openTask(id);
    },
    [activeIdx, onDismiss, openTask, results],
  );

  const onArrow = useCallback(
    (dir: 1 | -1) => {
      if (listLength === 0) return;
      onActiveChange((activeIdx + dir + listLength) % listLength);
    },
    [activeIdx, listLength, onActiveChange],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onArrow(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        onArrow(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (pending) {
          const option = options[activeIdx];
          if (option) addChip(pending.facet, option);
        } else {
          commit();
        }
      } else if (e.key === "Backspace" && query === "" && chips.length > 0) {
        e.preventDefault();
        removeChip(chips.length - 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (query !== "") onQueryChange("");
        else onClose();
      }
    },
    [
      pending,
      options,
      activeIdx,
      addChip,
      commit,
      query,
      chips.length,
      removeChip,
      onArrow,
      onQueryChange,
      onClose,
    ],
  );

  // Keep the active row in view inside the capped list.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open, pending]);

  const showTasks = !pending;

  // The listbox owns one active descendant across both modes.
  const activeOptionId =
    listLength > 0 ? `${listboxId}-option-${activeIdx}` : undefined;

  const palette = (
    <AnimatePresence>
      {open ? (
        <motion.div
          data-tasks-command-palette-layer
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
          transition={{ duration: 0 }}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/15 px-4 pt-[14vh] backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0 }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onClose();
                return;
              }
              if (event.key !== "Tab") return;
              const focusable = Array.from(
                dialogRef.current?.querySelectorAll<HTMLElement>(
                  'input:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
                ) ?? [],
              ).filter((element) => !element.hidden);
              if (focusable.length === 0) return;
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
            className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-line-soft bg-bg-elevated shadow-[0_36px_80px_-30px_rgba(20,21,26,0.4)]"
          >
            <ScopeChipRow
              facets={facets}
              chips={chips}
              query={query}
              onQueryChange={(v) => {
                onQueryChange(v);
                onActiveChange(0);
              }}
              onRemoveChip={removeChip}
              onKeyDown={onKeyDown}
              inputRef={inputRef}
              listId={listboxId}
              activeOptionId={activeOptionId}
              placeholder="Search, jump or create…"
              trailing={
                <kbd className="inline-flex h-5 flex-none select-none items-center rounded border border-line-soft bg-white px-1.5 text-[10.5px] font-mono text-ink-quiet">
                  Esc
                </kbd>
              }
            />

            {/* The listbox always renders, empty or not: the field's
                aria-controls points at this id, and a dangling reference is
                an invalid ARIA value. Empty copy sits beside the list. */}
            <div className="thin-scroll max-h-[60vh] overflow-y-auto py-1">
              <ul
                id={listboxId}
                role="listbox"
                aria-label={pending ? pending.facet.prompt : "Task results"}
                ref={listRef}
              >
                {pending
                  ? options.map((option, idx) => (
                      <ScopeOptionRow
                        id={`${listboxId}-option-${idx}`}
                        key={option.value}
                        facet={pending.facet}
                        option={option}
                        active={idx === activeIdx}
                        onHover={() => onActiveChange(idx)}
                        onClick={() => addChip(pending.facet, option)}
                      />
                    ))
                  : results.map((task, idx) => (
                      <ResultRow
                        id={`${listboxId}-option-${idx}`}
                        key={task.id}
                        task={task}
                        query={query}
                        active={idx === activeIdx}
                        onHover={() => onActiveChange(idx)}
                        onClick={() => commit(task.id)}
                      />
                    ))}
              </ul>
              {pending && options.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12.5px] text-ink-faint">
                  No {pending.facet.label.toLowerCase()} matches.
                </div>
              ) : null}
              {showTasks && results.length === 0 ? (
                <Empty query={query} chips={chips} onCreate={createTask} />
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-line-soft bg-bg-sunken/30 px-4 py-2 text-[10.5px] text-ink-quiet">
              <span className="flex items-center gap-3">
                <Hint kbd="↑↓">navigate</Hint>
                <Hint kbd="↵">{pending ? "add filter" : "open"}</Hint>
                <Hint kbd="esc">{query ? "clear" : "close"}</Hint>
              </span>
              <span className="tabular-nums">
                {pending
                  ? `${options.length} ${options.length === 1 ? "option" : "options"}`
                  : `${results.length} ${results.length === 1 ? "match" : "matches"}`}
              </span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
  if (typeof document === "undefined") return null;
  return createPortal(palette, document.body);
}

function CreateRow({ onCreate }: { onCreate: () => void }) {
  return (
    <button
      type="button"
      onClick={onCreate}
      className="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-bg-sunken/50"
    >
      <span className="flex h-5 w-5 flex-none items-center justify-center rounded border border-line-soft text-ink-quiet">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </span>
      <span className="flex-1 text-[13px] text-ink">Add task</span>
      <kbd className="inline-flex h-[15px] select-none items-center rounded border border-line-soft bg-white px-1 font-mono text-[9.5px] text-ink-quiet">
        C
      </kbd>
    </button>
  );
}

function Empty({
  query,
  chips,
  onCreate,
}: {
  query: string;
  chips: ScopeChip[];
  onCreate: () => void;
}) {
  const q = query.trim();
  if (!q) {
    // Chips applied but nothing under them: a real empty result, not a prompt.
    if (chips.length > 0) {
      return (
        <div className="px-4 py-8 text-center">
          <div className="text-[13.5px] font-medium text-ink-soft">
            Nothing under these filters.
          </div>
          <div className="mx-auto mt-1 max-w-[36ch] text-[12px] leading-[1.5] text-ink-faint">
            Backspace removes the last filter, or type to search across them.
          </div>
        </div>
      );
    }
    return (
      <div className="py-1.5">
        <div className="px-4 pt-2 pb-1 text-[13px] font-medium text-ink-soft">
          Type to search.
        </div>
        <div className="px-4 text-[11.5px] leading-[1.5] text-ink-faint">
          Searches title, tags, and description across every task in the
          workspace.
        </div>
        <div className="px-4 pt-1.5 text-[11.5px] leading-[1.5] text-ink-faint">
          Add a filter: <ScopeFacetLegend facets={FACET_LEGEND} />
        </div>
        <div className="mt-2 border-t border-line-soft/70 pt-1.5">
          <CreateRow onCreate={onCreate} />
        </div>
        <SuiteJumps />
      </div>
    );
  }
  const matches = SUITE_JUMPS.filter((j) =>
    j.word.toLowerCase().startsWith(q.toLowerCase()),
  );
  return (
    <div className="px-4 py-8 text-center">
      <div className="text-[13.5px] font-medium text-ink-soft">
        No tasks match.
      </div>
      <div className="mx-auto mt-1 max-w-[36ch] text-[12px] leading-[1.5] text-ink-faint">
        Searches title, tags, and description across every task in the
        workspace.
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-ink px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-ink-soft"
      >
        Add task
      </button>
      {matches.length > 0 ? (
        <div className="mx-auto mt-4 max-w-[300px] text-left">
          <SuiteJumps only={matches} />
        </div>
      ) : null}
    </div>
  );
}

// Legend uses the same shapes the palette derives; kept static so the empty
// state renders identical triggers even before any task carries the facet.
const FACET_LEGEND: ScopeFacet[] = [
  { key: "assignee", label: "Assignee", prompt: "", kind: "person", options: [], triggers: ["assignee"], sigil: "@" },
  { key: "tag", label: "Tag", prompt: "", kind: "plain", options: [], triggers: ["tag"], sigil: "#" },
  { key: "status", label: "Status", prompt: "", kind: "dot", options: [], triggers: ["status"] },
];

const SUITE_JUMPS: { word: string; tagline: string; path: string }[] = [
  {
    word: "home",
    tagline: "What matters now",
    path: HOME_APP_PATH,
  },
  {
    word: "timeline",
    tagline: "Direction clarity",
    path: PRODUCT_APP_PATHS.timeline,
  },
  {
    word: "notes",
    tagline: "Capture clarity",
    path: PRODUCT_APP_PATHS.notes,
  },
  {
    word: "briefing",
    tagline: "The full read",
    path: BRIEFING_APP_PATH,
  },
];

function SuiteJumps({ only }: { only?: typeof SUITE_JUMPS }) {
  const items = only ?? SUITE_JUMPS;
  const suiteContext = useSuiteContext();
  return (
    <div className="mt-4 border-t border-line-soft/70 pt-2">
      <div className="px-4 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
        Jump to
      </div>
      <ul role="list" className="px-1">
        {items.map((j) => (
          <li key={j.word}>
            <a
              href={withSuiteContext(j.path, suiteContext)}
              className="flex items-center justify-between gap-3 rounded-md px-3 py-2 no-underline transition-colors hover:bg-bg-sunken/50"
            >
              <div>
                <div className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
                  {j.word}
                  <span style={{ color: "#4f46e5" }}>·</span>
                </div>
                <div className="text-[11px] font-normal text-ink-quiet">
                  {j.tagline}
                </div>
              </div>
              <span className="text-ink-faint">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7 17L17 7M17 7H8M17 7v9" />
                </svg>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Hint({ kbd, children }: { kbd: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="inline-flex h-[15px] select-none items-center rounded border border-line-soft bg-white px-1 font-mono text-[9.5px] text-ink-soft">
        {kbd}
      </kbd>
      {children}
    </span>
  );
}

function ResultRow({
  id,
  task,
  query,
  active,
  onHover,
  onClick,
}: {
  id: string;
  task: Task;
  query: string;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  const lane = LANES[task.lane];
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      tabIndex={-1}
      className={
        "flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors " +
        (active ? "bg-brand-soft/40" : "hover:bg-bg-sunken/40")
      }
    >
      <span
        className="block h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ background: lane.dot }}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] text-ink">
          <Highlighted text={task.title} query={query} />
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-quiet">
          <span style={{ color: lane.ink }}>{lane.name}</span>
          {task.tags?.[0] ? (
            <>
              <span>·</span>
              <span className="rounded bg-bg-sunken px-1.5 py-px font-medium">
                {task.tags[0]}
              </span>
            </>
          ) : null}
          {task.due ? (
            <>
              <span>·</span>
              <span className="tabular-nums">{task.due}</span>
            </>
          ) : null}
        </div>
      </div>
      <AvatarStack users={task.assignees} size={16} />
      <span
        className={
          "text-[10px] font-mono tabular-nums transition-opacity " +
          (active ? "text-brand opacity-100" : "text-ink-faint opacity-0")
        }
      >
        ↵
      </span>
    </li>
  );
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-brand-soft/80 px-0.5 text-ink">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Search ranking
// ────────────────────────────────────────────────────────────────────

type Scored = { task: Task; score: number };

function score(task: Task, q: string): number {
  if (!q) return 1; // no query → list all (but we'll show empty state instead)
  const ql = q.toLowerCase();
  const title = task.title.toLowerCase();
  // Tier 1: prefix match on title
  if (title.startsWith(ql)) return 100;
  // Tier 2: contains in title
  if (title.includes(ql)) return 80;
  // Tier 3: tag exact match
  if (task.tags?.some((t) => t.toLowerCase() === ql)) return 60;
  // Tier 4: tag contains
  if (task.tags?.some((t) => t.toLowerCase().includes(ql))) return 40;
  // Tier 5: description contains
  if (task.description?.toLowerCase().includes(ql)) return 20;
  return 0;
}

/**
 * Filter by the applied chips first (AND across facets, OR within one),
 * then rank the remainder by the free-text query. Chips alone are enough
 * to produce a list; with no chips and no query the palette shows its
 * prompt instead. `pending` suppresses task results while the user is
 * still choosing a facet's value.
 */
function filterTasks(
  tasks: Task[],
  chips: ScopeChip[],
  query: string,
  pending: boolean,
): Task[] {
  if (pending) return [];
  const pred = chipsPredicate<Task>(chips, (facetKey, t) => {
    if (facetKey === "assignee") return t.assignees;
    if (facetKey === "tag") return t.tags ?? [];
    if (facetKey === "status") return [t.lane];
    return [];
  });
  const scoped = tasks.filter(pred);
  const q = query.trim();
  if (!q) {
    if (chips.length === 0) return [];
    return scoped
      .slice()
      .sort(
        (a, b) =>
          LANE_ORDER.indexOf(a.lane) - LANE_ORDER.indexOf(b.lane) ||
          b.updatedAt.getTime() - a.updatedAt.getTime(),
      )
      .slice(0, 20);
  }
  const ranked: Scored[] = scoped
    .map((task) => ({ task, score: score(task, q) }))
    .filter((s) => s.score > 0);
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, 20).map((s) => s.task);
}
