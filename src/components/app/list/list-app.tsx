"use client";

import { motion } from "motion/react";
import {
  LANES,
  LANE_ORDER,
  PRIORITY_LABEL,
} from "@/lib/data";
import { AvatarStack } from "@/components/showcase/avatar";
import {
  useTasksDispatch,
  useTasksState,
} from "@/lib/tasks/tasks-context";
import { groupByLane } from "@/lib/tasks/selectors";

export function ListApp() {
  const state = useTasksState();
  const { toggleComplete } = useTasksDispatch();
  const grouped = groupByLane(state);

  return (
    <div className="thin-scroll flex-1 overflow-auto px-8 py-5">
      <div className="overflow-hidden rounded-xl border border-line-soft bg-white">
        <div className="grid grid-cols-[1.7fr_0.7fr_0.6fr_0.6fr_0.5fr_0.4fr] items-center gap-3 border-b border-line-soft bg-bg-sunken/60 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-quiet">
          <span>Task</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Due</span>
          <span>Estimate</span>
          <span className="text-right">Assignees</span>
        </div>
        {LANE_ORDER.map((laneId) => {
          const lane = LANES[laneId];
          return (
            <div key={laneId}>
              <div className="flex items-center gap-2 border-b border-line-soft bg-bg-sunken/30 px-4 py-1.5">
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
                    className="grid grid-cols-[1.7fr_0.7fr_0.6fr_0.6fr_0.5fr_0.4fr] items-center gap-3 border-b border-line-soft px-4 py-2 text-[12.5px] transition-colors last:border-b-0 hover:bg-bg-sunken/40"
                  >
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => toggleComplete(task.id)}
                        aria-pressed={isDone}
                        aria-label={
                          isDone
                            ? `Mark "${task.title}" not done`
                            : `Mark "${task.title}" done`
                        }
                        className={
                          "flex h-4 w-4 items-center justify-center rounded border transition-colors " +
                          (isDone
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-line-soft text-transparent hover:border-ink-soft hover:text-ink-soft")
                        }
                      >
                        <svg
                          width="9"
                          height="9"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                      <span
                        className={
                          "line-clamp-1 flex-1 " +
                          (isDone
                            ? "text-ink-quiet line-through decoration-ink-faint"
                            : "")
                        }
                      >
                        {task.title}
                      </span>
                      {task.tags?.[0] ? (
                        <span className="rounded-md border border-line-soft bg-bg-sunken/60 px-1.5 py-0.5 text-[10px] font-medium text-ink-quiet">
                          {task.tags[0]}
                        </span>
                      ) : null}
                    </div>
                    <span
                      className="inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium"
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
                    <span className="text-[11.5px] text-ink-quiet">
                      {task.estimate ? `${task.estimate}h` : "—"}
                    </span>
                    <div className="flex justify-end">
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
