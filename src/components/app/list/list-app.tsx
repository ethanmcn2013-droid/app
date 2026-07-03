"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LANES,
  LANE_ORDER,
  PRIORITY_LABEL,
  type LaneId,
} from "@/lib/data";
import { AvatarStack } from "@/components/showcase/avatar";
import {
  useTasksDispatch,
  useTasksState,
} from "@/lib/tasks/tasks-context";
import { groupByLane, tasksSortedByStartDay } from "@/lib/tasks/selectors";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { EmptyStateOverlay } from "@/components/app/empty-state/empty-state-overlay";
import { ListGhost } from "@/components/app/empty-state/ghost-views";
import { usePersonalization } from "@/lib/domain-context";
import { DopamineCheck } from "@/components/app/done-dopamine/dopamine-check";
import { DoneTitle } from "@/components/app/done-dopamine/done-title";
import { BlockerBadge } from "@/components/app/blockers/blocker-badge";
import { RecurrenceChip } from "@/components/app/cards/recurrence-chip";

export function ListApp() {
  const personalization = usePersonalization();
  const state = useTasksState();
  const { toggleComplete, moveTask, removeTask } = useTasksDispatch();
  const { taskId: openTaskId, openTask } = useTaskPanel();
  const grouped = groupByLane(state);

  // Bulk selection. `selected` holds task ids; `anchor` is the last
  // shift-click root for range-select. `flatOrder` is the display
  // order, same lane-then-position order as the rendered rows, so
  // a shift-click range crosses lane boundaries the way the user sees.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);
  const flatOrder = useMemo(
    () => tasksSortedByStartDay(state).map((t) => t.id),
    [state],
  );

  // Esc clears the selection. Click-outside is implicit via row clicks
  // landing on either the row (selects) or the detail panel (clears).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && selected.size > 0) {
        setSelected(new Set());
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected.size]);

  const onRowClick = useCallback(
    (taskId: string, e: React.MouseEvent) => {
      // Plain click → open detail panel; only modifiers select.
      const isShift = e.shiftKey;
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isShift && !isMeta) {
        // If anything's selected, plain click clears + opens.
        if (selected.size > 0) {
          setSelected(new Set());
        }
        openTask(taskId);
        return;
      }
      e.preventDefault();
      setSelected((prev) => {
        const next = new Set(prev);
        if (isMeta) {
          // ⌘/Ctrl click: toggle just this row.
          if (next.has(taskId)) next.delete(taskId);
          else next.add(taskId);
          anchorRef.current = taskId;
          return next;
        }
        // Shift click: extend from anchor (or this row if no anchor).
        const anchor = anchorRef.current;
        if (!anchor) {
          next.add(taskId);
          anchorRef.current = taskId;
          return next;
        }
        const a = flatOrder.indexOf(anchor);
        const b = flatOrder.indexOf(taskId);
        if (a < 0 || b < 0) {
          next.add(taskId);
          return next;
        }
        const [lo, hi] = a < b ? [a, b] : [b, a];
        for (let i = lo; i <= hi; i++) next.add(flatOrder[i]);
        return next;
      });
    },
    [flatOrder, openTask, selected.size],
  );

  const moveSelected = (toLane: LaneId) => {
    selected.forEach((id) => moveTask(id, toLane));
    setSelected(new Set());
  };

  const completeSelected = () => {
    selected.forEach((id) => {
      const t = state.tasks.find((x) => x.id === id);
      if (t && t.lane !== "done") toggleComplete(id);
    });
    setSelected(new Set());
  };

  const deleteSelected = () => {
    selected.forEach((id) => removeTask(id));
    setSelected(new Set());
  };

  if (state.tasks.length === 0) {
    return (
      <EmptyStateOverlay
        ghost={<ListGhost />}
        headline={personalization.headline}
        body={personalization.body}
        primaryLabel={personalization.firstTaskExample}
      />
    );
  }

  return (
    <div className="thin-scroll flex-1 overflow-auto px-4 py-4 md:px-8 md:py-5">
      <BulkBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        onMove={moveSelected}
        onComplete={completeSelected}
        onDelete={deleteSelected}
      />
      <div className="overflow-hidden rounded-xl border border-line-soft bg-white">
        <div className="grid grid-cols-[1.7fr_24px_0.6fr_0.6fr] items-center gap-3 border-b border-line-soft bg-bg-sunken/60 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-quiet md:grid-cols-[1.7fr_0.7fr_0.6fr_0.6fr_0.5fr_0.4fr] md:px-4">
          <span>Task</span>
          <span aria-label="Status"><span className="md:hidden" aria-hidden></span><span className="hidden md:inline">Status</span></span>
          <span>Priority</span>
          <span>Due</span>
          <span className="hidden md:inline">Estimate</span>
          <span className="hidden text-right md:inline">Who</span>
        </div>
        {LANE_ORDER.map((laneId) => {
          const lane = LANES[laneId];
          return (
            <div key={laneId}>
              <div className="flex items-center gap-2 border-b border-line-soft bg-bg-sunken/30 px-3 py-1.5 md:px-4">
                <span
                  className="block h-1.5 w-1.5 rounded-full"
                  style={{ background: lane.dot }}
                />
                <span
                  className="text-[10.5px] font-semibold uppercase tracking-wider"
                  style={{ color: lane.ink }}
                >
                  {lane.name}
                </span>
                <span className="text-[10.5px] text-ink-quiet">
                  {grouped[laneId].length}
                </span>
              </div>
              {grouped[laneId].map((task, i) => {
                const prio = PRIORITY_LABEL[task.priority];
                const isDone = task.lane === "done";
                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: Math.min(i * 0.015, 0.15),
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    onClick={(e) => onRowClick(task.id, e)}
                    style={{
                      background: selected.has(task.id)
                        ? "var(--brand-soft)"
                        : openTaskId === task.id
                          ? "var(--brand-soft)"
                          : undefined,
                      boxShadow:
                        selected.has(task.id) || openTaskId === task.id
                          ? "inset 2px 0 0 var(--brand)"
                          : undefined,
                    }}
                    className={
                      "grid cursor-pointer grid-cols-[1.7fr_24px_0.6fr_0.6fr] items-center gap-3 border-b border-line-soft px-3 py-2 text-[12.5px] transition-colors last:border-b-0 hover:bg-bg-sunken/40 md:grid-cols-[1.7fr_0.7fr_0.6fr_0.6fr_0.5fr_0.4fr] md:px-4 " +
                      (selected.size > 0 ? "select-none" : "")
                    }
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <DopamineCheck
                        checked={isDone}
                        onToggle={() => toggleComplete(task.id)}
                        title={task.title}
                      />
                      <DoneTitle done={isDone} className="line-clamp-1 min-w-0 flex-1">
                        {task.title}
                      </DoneTitle>
                      {task.blockedBy && task.blockedBy.length > 0 ? (
                        <BlockerBadge blockedBy={task.blockedBy} />
                      ) : null}
                      {task.tags?.[0] ? (
                        <span className="hidden rounded-md border border-line-soft bg-bg-sunken/60 px-1.5 py-0.5 text-[10px] font-medium text-ink-quiet md:inline-flex">
                          {task.tags[0]}
                        </span>
                      ) : null}
                      <RecurrenceChip recurrence={task.recurrence} />
                    </div>
                    {/* <md: dot only */}
                    <span
                      className="block h-2 w-2 rounded-full md:hidden"
                      style={{ background: lane.dot }}
                      aria-label={lane.name}
                      title={lane.name}
                    />
                    {/* ≥md: full status pill */}
                    <span
                      className="hidden w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium md:inline-flex"
                      style={{ color: lane.ink, background: lane.bg }}
                    >
                      <span
                        className="block h-1.5 w-1.5 rounded-full"
                        style={{ background: lane.dot }}
                      />
                      {lane.name}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-ink-soft">
                      <span
                        className="block h-1.5 w-1.5 rounded-full"
                        style={{ background: prio.color }}
                      />
                      {task.priority.toUpperCase()}
                    </span>
                    <span className="text-[11.5px] text-ink-quiet">
                      {task.due ?? "—"}
                    </span>
                    <span className="hidden text-[11.5px] text-ink-quiet md:inline">
                      {task.estimate ? `${task.estimate}h` : "—"}
                    </span>
                    <div className="hidden justify-end md:flex">
                      <AvatarStack users={task.assignees} size={18} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Bulk-action bar, sticky-bottom-center, slides up when N rows are
 * selected. Action buttons are round (the brand's "clickable" shape)
 * and the toolbar itself uses the elevated chrome shadow.
 *
 * Selection mechanics: shift-click extends a range from the last
 * anchor; ⌘/Ctrl-click toggles a single row; plain click clears
 * + opens the detail panel.
 */
function BulkBar({
  count,
  onClear,
  onMove,
  onComplete,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onMove: (lane: LaneId) => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none fixed inset-x-0 bottom-[80px] z-40 flex justify-center md:bottom-6"
        >
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-line-soft bg-bg-elevated/95 px-2 py-1.5 shadow-[0_24px_60px_-24px_rgba(20,21,26,0.32)] backdrop-blur">
            <span className="px-2 text-[12.5px] font-medium tabular-nums text-ink">
              {count} selected
            </span>
            <span className="mx-1 block h-4 w-px bg-line-soft" aria-hidden />
            <BulkLaneMenu onPick={onMove} />
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Mark done
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium text-rose-700 transition-colors hover:bg-rose-50"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete
            </button>
            <span className="mx-1 block h-4 w-px bg-line-soft" aria-hidden />
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear selection"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink-soft"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="6" y1="18" x2="18" y2="6" />
              </svg>
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function BulkLaneMenu({ onPick }: { onPick: (lane: LaneId) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-[12px] font-medium text-white transition-transform hover:-translate-y-px"
      >
        Move to
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-full left-1/2 z-50 mb-2 w-[180px] -translate-x-1/2 rounded-xl border border-line-soft bg-white p-1 shadow-[0_18px_42px_-18px_rgba(20,21,26,0.32)]"
          >
            {LANE_ORDER.map((laneId) => {
              const lane = LANES[laneId];
              return (
                <button
                  key={laneId}
                  type="button"
                  onClick={() => {
                    onPick(laneId);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors hover:bg-bg-sunken/60"
                >
                  <span
                    className="block h-1.5 w-1.5 rounded-full"
                    style={{ background: lane.dot }}
                  />
                  {lane.name}
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
