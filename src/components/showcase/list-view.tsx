"use client";

import { motion } from "motion/react";
import {
  LANES,
  LANE_ORDER,
  PRIORITY_LABEL,
  type Task,
} from "@/lib/data";
import { AvatarStack } from "./avatar";

export function ListView({
  tasks,
  cardRefs,
}: {
  tasks: Task[];
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  return (
    <div className="px-5 pt-4">
      <div className="overflow-hidden rounded-xl border border-line-soft bg-white">
        <div className="grid grid-cols-[1.6fr_0.7fr_0.6fr_0.6fr_0.5fr] items-center gap-3 border-b border-line-soft bg-bg-sunken/60 px-4 py-2 text-[10.5px] font-medium uppercase tracking-wider text-ink-quiet">
          <span>Task</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Due</span>
          <span className="text-right">Assignees</span>
        </div>
        {LANE_ORDER.map((laneId) => {
          const lane = LANES[laneId];
          const laneTasks = tasks.filter((t) => t.lane === laneId);
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
                  {laneTasks.length}
                </span>
              </div>
              {laneTasks.map((task) => {
                const prio = PRIORITY_LABEL[task.priority];
                return (
                  <motion.div
                    key={task.id}
                    layoutId={`task-${task.id}`}
                    ref={(el) => {
                      if (el) cardRefs.current.set(task.id, el);
                      else cardRefs.current.delete(task.id);
                    }}
                    transition={{
                      layout: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
                    }}
                    className="grid cursor-grab grid-cols-[1.6fr_0.7fr_0.6fr_0.6fr_0.5fr] items-center gap-3 border-b border-line-soft px-4 py-2 text-[12.5px] hover:bg-bg-sunken/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="block h-1.5 w-1.5 rounded-full bg-ink-faint" />
                      <span className="line-clamp-1">{task.title}</span>
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
