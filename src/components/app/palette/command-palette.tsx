"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { LANES, type Task } from "@/lib/data";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { AvatarStack } from "@/components/showcase/avatar";
import {
  SIGNAL_URL,
  NOTES_URL,
  TIMELINE_URL,
} from "@/lib/product-urls";

type Ctx = { open: boolean; openPalette: () => void; closePalette: () => void };
const PaletteContext = createContext<Ctx | null>(null);

/**
 * `<PaletteRoot>` mounts the palette and binds the global cmd+k / ctrl+k
 * shortcut. Sidebar's Search link, the page-header Search button, and
 * any future "search" affordance can call `usePalette().openPalette()`
 * to surface it without re-binding the shortcut themselves.
 *
 * The palette itself is intentionally minimal, title-substring match
 * across tasks. Tags + description match are bonuses; ranking is
 * "starts-with > contains > tag/desc match" so the typed prefix
 * jumps to the most likely target.
 */
export function PaletteRoot({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const openPalette = useCallback(() => {
    // Reset the search in the same event batch that opens the dialog so
    // stale results can never flash during the entrance animation.
    setQuery("");
    setActiveTaskId(null);
    setOpen(true);
  }, []);
  const closePalette = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      // ⌘P opens the workspace-local command palette (file-open
      // convention). ⌘K is reserved for the cross-workspace search
      // popover (cycle 24 / Phase 7), which follows the cross-app
      // convention (Slack, Notion, Linear) where ⌘K is the global
      // quick-switcher.
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
        query={query}
        onQueryChange={setQuery}
        activeTaskId={activeTaskId}
        onActiveTaskChange={setActiveTaskId}
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
// Palette UI
// ────────────────────────────────────────────────────────────────────

function Palette({
  open,
  onClose,
  query,
  onQueryChange,
  activeTaskId,
  onActiveTaskChange,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  activeTaskId: string | null;
  onActiveTaskChange: (taskId: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const state = useTasksState();
  const { openTask } = useTaskPanel();

  // Query/selection are reset by PaletteRoot in the same event batch as
  // `open`. Focus may follow after commit without exposing stale content.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  // Esc handler + backdrop click handled by the wrapper.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const results = useMemo(() => searchTasks(state.tasks, query), [
    state.tasks,
    query,
  ]);

  // Store selection by identity, not a positional index. When results
  // shrink, expand, or reorder, the effective index is always valid and
  // falls back to the first result if the selected task disappeared.
  const selectedResultIdx = activeTaskId
    ? results.findIndex((task) => task.id === activeTaskId)
    : -1;
  const activeIdx = selectedResultIdx >= 0 ? selectedResultIdx : 0;

  const onArrow = useCallback(
    (dir: 1 | -1) => {
      const n = results.length;
      if (n === 0) {
        onActiveTaskChange(null);
        return;
      }
      const next = (activeIdx + dir + n) % n;
      onActiveTaskChange(results[next].id);
    },
    [activeIdx, onActiveTaskChange, results],
  );

  const commit = useCallback(
    (taskId?: string) => {
      const id = taskId ?? results[activeIdx]?.id;
      if (!id) return;
      onClose();
      openTask(id);
    },
    [activeIdx, onClose, openTask, results],
  );

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/15 px-4 pt-[14vh] backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-line-soft bg-bg-elevated shadow-[0_36px_80px_-30px_rgba(20,21,26,0.4)]"
          >
            <div className="flex items-center gap-2 border-b border-line-soft px-4 py-3.5">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-ink-quiet"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  onQueryChange(e.target.value);
                  onActiveTaskChange(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    onArrow(1);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    onArrow(-1);
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    commit();
                  }
                }}
                placeholder="Search tasks by title, tag, or description"
                autoComplete="off"
                spellCheck={false}
                className="block w-full bg-transparent text-[15px] leading-snug text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <kbd className="inline-flex h-5 select-none items-center rounded border border-line-soft bg-white px-1.5 text-[10.5px] font-mono text-ink-quiet">
                Esc
              </kbd>
            </div>

            <div className="thin-scroll max-h-[60vh] overflow-y-auto py-1">
              {results.length === 0 ? (
                <Empty query={query} />
              ) : (
                <ul role="listbox">
                  {results.map((task, idx) => (
                    <ResultRow
                      key={task.id}
                      task={task}
                      query={query}
                      active={idx === activeIdx}
                      onHover={() => onActiveTaskChange(task.id)}
                      onClick={() => commit(task.id)}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-line-soft bg-bg-sunken/30 px-4 py-2 text-[10.5px] text-ink-quiet">
              <span className="flex items-center gap-3">
                <Hint kbd="↑↓">navigate</Hint>
                <Hint kbd="↵">open</Hint>
                <Hint kbd="esc">close</Hint>
              </span>
              <span className="tabular-nums">
                {results.length} {results.length === 1 ? "match" : "matches"}
              </span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Empty({ query }: { query: string }) {
  const q = query.trim();
  if (!q) {
    return (
      <div className="py-1.5">
        <div className="px-4 pt-2 pb-1 text-[13px] font-medium text-ink-soft">
          Type to search.
        </div>
        <div className="px-4 text-[11.5px] leading-[1.5] text-ink-faint">
          Searches title, tags, and description across every task in the
          workspace.
        </div>
        <SuiteJumps />
      </div>
    );
  }
  const matches = SUITE_JUMPS.filter((j) =>
    j.word.toLowerCase().startsWith(q.toLowerCase()),
  );
  return (
    <div className="px-4 py-10 text-center">
      <div className="text-[13.5px] font-medium text-ink-soft">
        No tasks match.
      </div>
      <div className="mx-auto mt-1 max-w-[36ch] text-[12px] leading-[1.5] text-ink-faint">
        Searches title, tags, and description across every task in the
        workspace.
      </div>
      {matches.length > 0 ? (
        <div className="mx-auto mt-4 max-w-[300px] text-left">
          <SuiteJumps only={matches} />
        </div>
      ) : null}
    </div>
  );
}

const SUITE_JUMPS: { word: string; tagline: string; url: string }[] = [
  { word: "timeline", tagline: "Direction clarity", url: TIMELINE_URL },
  { word: "notes", tagline: "Capture clarity", url: NOTES_URL },
  { word: "signal", tagline: "Attention clarity", url: SIGNAL_URL },
];

function SuiteJumps({ only }: { only?: typeof SUITE_JUMPS }) {
  const items = only ?? SUITE_JUMPS;
  return (
    <div className="mt-4 border-t border-line-soft/70 pt-2">
      <div className="px-4 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
        Jump to
      </div>
      <ul role="list" className="px-1">
        {items.map((j) => (
          <li key={j.word}>
            <a
              href={j.url}
              target="_blank"
              rel="noopener noreferrer"
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
  task,
  query,
  active,
  onHover,
  onClick,
}: {
  task: Task;
  query: string;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  const lane = LANES[task.lane];
  return (
    <li
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onClick={onClick}
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

function searchTasks(tasks: Task[], query: string): Task[] {
  const q = query.trim();
  if (!q) return [];
  const scored: Scored[] = tasks
    .map((task) => ({ task, score: score(task, q) }))
    .filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 20).map((s) => s.task);
}
