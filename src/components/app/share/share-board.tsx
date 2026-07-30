"use client";

import { motion } from "motion/react";
import { PRIORITY_LABEL, type PublicTask } from "@/lib/data";
import { publicLane, publicLaneOrder } from "@/lib/public-board-lanes";
import { useGuestAuth } from "@/components/app/guest/guest-auth-context";

/**
 * Read-only board for /share/[token]. Same visual as the live BoardApp
 * but every interactive surface raises the progressive auth modal
 * instead of mutating. Drag is disabled.
 */
export function ShareBoard({ tasks }: { tasks: PublicTask[] }) {
  const { promptSignUp } = useGuestAuth();
  return (
    <div className="thin-scroll flex h-full flex-1 gap-3 overflow-x-auto overflow-y-hidden px-8 pb-8 pt-5">
      {publicLaneOrder(tasks).map((laneId, idx) => {
        const lane = publicLane(laneId);
        const laneTasks = tasks.filter((t) => t.lane === laneId);
        return (
          <motion.div
            key={laneId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.55,
              delay: idx * 0.06,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="flex w-[298px] flex-shrink-0 flex-col rounded-xl p-2.5"
            style={{ background: `${lane.bg}E6` }}
          >
            <div className="flex items-center justify-between px-1.5 pb-2 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="block h-2 w-2 rounded-full"
                  style={{ background: lane.dot }}
                />
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: lane.ink }}
                >
                  {lane.name}
                </span>
                <span className="text-[11.5px] text-ink-quiet">
                  {laneTasks.length}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto pr-0.5 thin-scroll">
              {laneTasks.map((task) => (
                <ReadCard
                  key={task.id}
                  task={task}
                  onClick={() => promptSignUp("edit")}
                />
              ))}
              <button
                type="button"
                onClick={() => promptSignUp("addTask")}
                className="mt-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[12px] text-ink-quiet transition-colors hover:bg-white/60 hover:text-ink-soft"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add task
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function ReadCard({
  task,
  onClick,
}: {
  task: PublicTask;
  onClick: () => void;
}) {
  const prio = PRIORITY_LABEL[task.priority];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      whileHover={{ y: -1 }}
      className="group cursor-pointer rounded-[10px] border border-line-soft bg-white px-3 py-2.5 text-[13px] leading-snug shadow-[0_1px_2px_rgba(20,21,26,0.04)] transition-shadow hover:shadow-[0_6px_18px_-6px_rgba(20,21,26,0.16)]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2">{task.title}</span>
        {task.priority === "p0" ? (
          <span className="flex-shrink-0 rounded-md border border-red-200 bg-red-50 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wider text-red-600">
            P0
          </span>
        ) : null}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded bg-bg-sunken px-1.5 py-0.5 text-[10.5px] font-medium text-ink-soft"
            title={prio.label}
          >
            <span
              className="block h-1.5 w-1.5 rounded-full"
              style={{ background: prio.color }}
            />
            {task.priority.toUpperCase()}
          </span>
          {task.due ? (
            <span className="text-[10.5px] text-ink-quiet">{task.due}</span>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
