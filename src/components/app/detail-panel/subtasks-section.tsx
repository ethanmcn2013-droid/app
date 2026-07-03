"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import type { Task } from "@/lib/data";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import {
  addTaskAction,
  getSubtasksAction,
  updateTaskAction,
} from "@/server/actions/tasks";

/**
 * Nested checklist for a parent task's children. Lives in the detail
 * panel between the Cents section and the Conversation feed; subtasks
 * never appear in the board / list / timeline / calendar, those views
 * filter on `parent_task_id IS NULL`. (One-level nesting in v1.)
 *
 * State shape: this component owns its own subtask list rather than
 * piggy-backing on `useTasksState`, because the workspace-level store
 * deliberately drops parented rows. Reads come from `getSubtasksAction`;
 * mutations call `updateTaskAction` / `addTaskAction` directly and
 * apply optimistic local updates so the row reflects instantly.
 *
 * Click a subtask title → `openTask(subtaskId)` swaps the panel's
 * active id; the panel re-renders against that subtask, with its own
 * (necessarily empty in v1) SubtasksSection. The back button restores
 * the parent thanks to `useTaskPanel`'s pushState contract.
 */
export function SubtasksSection({ task }: { task: Task }) {
  const { openTask } = useTaskPanel();
  const [subtasks, setSubtasks] = useState<Task[] | null>(null);
  const [, startServerSync] = useTransition();

  // Refresh whenever the parent task or its updatedAt changes, the
  // latter catches server-side reconciliations after a child mutation
  // (revalidatePath on the parent's /app layout flips updatedAt).
  const refreshKey = task.updatedAt?.getTime();

  useEffect(() => {
    let ignore = false;
    getSubtasksAction(task.id)
      .then((rows) => {
        if (!ignore) setSubtasks(rows);
      })
      .catch((err) => {
        if (!ignore) {
          // eslint-disable-next-line no-console
          console.warn("subtasks: fetch failed", err);
          setSubtasks([]);
        }
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, refreshKey]);

  const toggle = useCallback(
    (sub: Task) => {
      const nextLane = sub.lane === "done" ? "todo" : "done";
      // Optimistic flip, the parent updatedAt won't change until the
      // server reconciles, so we patch the local list directly.
      setSubtasks((cur) =>
        cur
          ? cur.map((s) =>
              s.id === sub.id
                ? { ...s, lane: nextLane, updatedAt: new Date() }
                : s,
            )
          : cur,
      );
      startServerSync(async () => {
        try {
          await updateTaskAction(sub.id, { lane: nextLane });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("subtasks: toggle failed; reverting", err);
          setSubtasks((cur) =>
            cur
              ? cur.map((s) =>
                  s.id === sub.id ? { ...s, lane: sub.lane } : s,
                )
              : cur,
          );
        }
      });
    },
    [],
  );

  const add = useCallback(
    (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const tempId = `temp-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: Task = {
        id: tempId,
        title: trimmed,
        lane: "todo",
        priority: "p2",
        assignees: [],
        externalContactName: null,
        externalContactEmail: null,
        cents: null,
        parentTaskId: task.id,
        updatedAt: new Date(),
      };
      setSubtasks((cur) => (cur ? [...cur, optimistic] : [optimistic]));
      startServerSync(async () => {
        try {
          await addTaskAction({
            title: trimmed,
            lane: "todo",
            priority: "p2",
            parentTaskId: task.id,
          });
          // Refetch so the temp row gets replaced by the real one with
          // its server-assigned id (so subsequent toggles work).
          const fresh = await getSubtasksAction(task.id);
          setSubtasks(fresh);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("subtasks: add failed; reverting", err);
          setSubtasks((cur) =>
            cur ? cur.filter((s) => s.id !== tempId) : cur,
          );
        }
      });
    },
    [task.id],
  );

  // Loading: render nothing rather than flashing an empty header, the
  // first paint after the parent loads is fast enough that a skeleton
  // would be more distracting than helpful.
  if (subtasks === null) return null;

  const total = subtasks.length;
  const done = subtasks.filter((s) => s.lane === "done").length;

  // Empty state: a single quiet composer chip, no header.
  if (total === 0) {
    return (
      <div className="border-t border-line-soft px-6 py-5">
        <SubtaskComposer onAdd={add} compact />
      </div>
    );
  }

  return (
    <div className="border-t border-line-soft px-6 py-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
          Subtasks
        </span>
        <span className="text-[10.5px] tabular-nums text-ink-quiet">
          {done} of {total} done
        </span>
      </div>
      <ul className="flex flex-col">
        {subtasks.map((sub) => (
          <SubtaskRow
            key={sub.id}
            subtask={sub}
            onToggle={() => toggle(sub)}
            onOpen={() => openTask(sub.id)}
          />
        ))}
      </ul>
      <div className="mt-1.5">
        <SubtaskComposer onAdd={add} />
      </div>
    </div>
  );
}

function SubtaskRow({
  subtask,
  onToggle,
  onOpen,
}: {
  subtask: Task;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const isDone = subtask.lane === "done";
  // Temp (optimistic) rows aren't openable, they have no real id yet.
  const openable = !subtask.id.startsWith("temp-");
  return (
    <li className="group flex items-center gap-2 rounded-md py-[5px]">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={isDone}
        aria-label={isDone ? "Mark subtask as not done" : "Mark subtask as done"}
        className={
          isDone
            ? "flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded-[4px] border border-ink-soft bg-ink-soft text-white transition-colors"
            : "flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded-[4px] border border-line bg-white text-transparent transition-colors hover:border-ink-soft"
        }
      >
        <CheckGlyph />
      </button>
      <button
        type="button"
        onClick={onOpen}
        disabled={!openable}
        className={
          isDone
            ? "min-w-0 flex-1 truncate text-left text-[12.5px] leading-snug text-ink-quiet line-through opacity-60 transition-opacity hover:opacity-80 disabled:cursor-default"
            : "min-w-0 flex-1 truncate text-left text-[12.5px] leading-snug text-ink-soft transition-colors hover:text-ink disabled:cursor-default"
        }
      >
        {subtask.title}
      </button>
    </li>
  );
}

function CheckGlyph() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="5 12 10 17 19 7" />
    </svg>
  );
}

/**
 * Quiet ghost-row composer, single text input, Enter to submit. Stays
 * focused after submit so the user can rattle off a checklist without
 * reaching for the mouse.
 */
function SubtaskComposer({
  onAdd,
  compact,
}: {
  onAdd: (title: string) => void;
  compact?: boolean;
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const showsHint = !focused && value.length === 0;

  return (
    <div
      className={
        showsHint
          ? "flex items-center gap-2 rounded-md py-[5px] text-ink-quiet transition-colors hover:text-ink-soft"
          : "flex items-center gap-2 rounded-md border border-line-soft bg-white py-[3px] pl-1.5 pr-1.5 transition-colors focus-within:border-ink-soft/60"
      }
    >
      {showsHint ? <PlusGlyph /> : null}
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={compact ? "Add subtask" : "Add subtask"}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          // Don't auto-submit on blur; quiet drop-out preserves the
          // ghost-row aesthetic.
        }}
        onKeyDown={(e) => {
          if (
            e.key === "Enter" &&
            !e.shiftKey &&
            !e.nativeEvent.isComposing
          ) {
            e.preventDefault();
            const v = value;
            setValue("");
            onAdd(v);
            // Keep focus for the next item.
            requestAnimationFrame(() => inputRef.current?.focus());
          } else if (e.key === "Escape") {
            e.preventDefault();
            setValue("");
            inputRef.current?.blur();
          }
        }}
        autoComplete="off"
        spellCheck={false}
        className={
          showsHint
            ? "min-w-0 flex-1 cursor-text bg-transparent text-[12.5px] leading-snug text-ink-quiet placeholder:text-ink-quiet focus:outline-none"
            : "min-w-0 flex-1 bg-transparent text-[12.5px] leading-snug text-ink placeholder:text-ink-faint focus:outline-none"
        }
        aria-label="Add subtask"
      />
    </div>
  );
}

function PlusGlyph() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden
      className="flex-shrink-0"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
