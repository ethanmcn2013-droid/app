"use client";

import { motion } from "motion/react";
import { LANES } from "@/lib/data";
import { Avatar } from "@/components/showcase/avatar";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { tasksSortedByStartDay } from "@/lib/tasks/selectors";

const DAYS = 14;
const DAY_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

export function TimelineApp() {
  const state = useTasksState();
  const sorted = tasksSortedByStartDay(state);

  return (
    <div className="thin-scroll flex-1 overflow-auto px-8 py-5">
      <div className="overflow-hidden rounded-xl border border-line-soft bg-white">
        {/* Header */}
        <div className="grid grid-cols-[240px_1fr] border-b border-line-soft bg-bg-sunken/40">
          <div className="border-r border-line-soft px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-quiet">
            Task
          </div>
          <div
            className="grid text-center text-[10.5px] font-medium"
            style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)` }}
          >
            {DAY_LABELS.map((d, i) => {
              const isWeekend = d === "Sat" || d === "Sun";
              return (
                <div
                  key={i}
                  className={
                    "border-r border-line-soft/60 py-2 last:border-r-0 " +
                    (isWeekend
                      ? "bg-bg-sunken/70 text-ink-quiet"
                      : "text-ink-soft")
                  }
                >
                  {d}
                  <span className="ml-1 text-ink-faint">{i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative">
          {sorted.map((task, idx) => {
            const lane = LANES[task.lane];
            const start = task.startDay ?? 0;
            const dur = task.durationDays ?? 1;
            const left = (start / DAYS) * 100;
            const width = (dur / DAYS) * 100;
            return (
              <div
                key={task.id}
                className="grid grid-cols-[240px_1fr] items-center border-b border-line-soft last:border-b-0"
              >
                <div className="flex items-center gap-2 truncate border-r border-line-soft px-4 py-2.5 text-[12.5px]">
                  <span
                    className="block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ background: lane.dot }}
                  />
                  <span className="truncate">{task.title}</span>
                </div>
                <div className="relative h-12">
                  <div
                    className="pointer-events-none absolute inset-0 grid"
                    style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)` }}
                  >
                    {Array.from({ length: DAYS }).map((_, i) => {
                      const d = DAY_LABELS[i];
                      const isWeekend = d === "Sat" || d === "Sun";
                      return (
                        <div
                          key={i}
                          className={
                            "border-r border-line-soft/60 last:border-r-0 " +
                            (isWeekend ? "bg-bg-sunken/40" : "")
                          }
                        />
                      );
                    })}
                  </div>

                  <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.35,
                      delay: Math.min(idx * 0.025, 0.2),
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="absolute top-1/2 flex -translate-y-1/2 cursor-grab items-center gap-1.5 overflow-hidden rounded-md border px-2 py-1.5 text-[11px] font-medium shadow-sm hover:shadow-md"
                    style={{
                      left: `calc(${left}% + 4px)`,
                      width: `calc(${width}% - 8px)`,
                      background: task.lane === "done" ? "#fff" : lane.bg,
                      borderColor: lane.dot,
                      color: lane.ink,
                    }}
                  >
                    <Avatar user={task.assignees[0]} size={14} />
                    <span className="truncate">{task.title}</span>
                    {task.priority === "p0" ? (
                      <span className="ml-auto rounded bg-red-100 px-1 text-[9px] font-bold uppercase tracking-wider text-red-600">
                        P0
                      </span>
                    ) : null}
                  </motion.div>
                </div>
              </div>
            );
          })}

          {/* Today marker */}
          <div
            className="pointer-events-none absolute top-0 z-20 h-full w-px"
            style={{
              left: `calc(240px + ${(2 / DAYS) * 100}%)`,
              background:
                "linear-gradient(to bottom, transparent, var(--brand) 8%, var(--brand) 92%, transparent)",
              boxShadow: "0 0 8px var(--brand-glow)",
            }}
          >
            <div
              className="absolute left-1/2 top-1 -translate-x-1/2 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white"
              style={{ background: "var(--brand)" }}
            >
              Today
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
