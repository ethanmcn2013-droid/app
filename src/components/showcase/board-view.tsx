"use client";

import { LANES, LANE_ORDER, type Task } from "@/lib/data";
import { TaskCard } from "./task-card";
import { motion } from "motion/react";

export function BoardView({
  tasks,
  pickedTaskId,
  pickedBy,
  cardRefs,
  highlightedDeps,
  flashTaskId,
  openCommentTaskId,
  typingUser,
  postedComment,
}: {
  tasks: Task[];
  pickedTaskId: string | null;
  pickedBy: string | null;
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  highlightedDeps: [string, string] | null;
  flashTaskId: string | null;
  openCommentTaskId: string | null;
  typingUser: string | null;
  postedComment: { user: string; text: string } | null;
}) {
  return (
    <div className="grid h-full grid-cols-4 gap-3 px-5 pt-4">
      {LANE_ORDER.map((laneId, idx) => {
        const lane = LANES[laneId];
        const laneTasks = tasks.filter((t) => t.lane === laneId);
        return (
          <motion.div
            key={laneId}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: idx * 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="flex flex-col gap-2 overflow-hidden rounded-xl p-2"
            style={{ background: lane.bg }}
          >
            <div className="flex items-center justify-between px-1.5 pb-1 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="block h-2 w-2 rounded-full"
                  style={{ background: lane.dot }}
                />
                <span
                  className="text-[11.5px] font-medium"
                  style={{ color: lane.ink }}
                >
                  {lane.name}
                </span>
                <span className="text-[11px] text-ink-quiet">
                  {laneTasks.length}
                </span>
              </div>
              <button className="rounded p-0.5 text-ink-quiet hover:bg-white/60 hover:text-ink-soft">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              {laneTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  picked={pickedTaskId === task.id}
                  pickedBy={
                    pickedTaskId === task.id ? pickedBy : null
                  }
                  highlightDependency={
                    !!highlightedDeps &&
                    (highlightedDeps[0] === task.id ||
                      highlightedDeps[1] === task.id)
                  }
                  flash={flashTaskId === task.id}
                  showInlineThread={openCommentTaskId === task.id}
                  typingUser={
                    openCommentTaskId === task.id ? typingUser : null
                  }
                  postedComment={
                    openCommentTaskId === task.id ? postedComment : null
                  }
                  forwardRef={(el) => {
                    if (el) cardRefs.current.set(task.id, el);
                    else cardRefs.current.delete(task.id);
                  }}
                />
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
