"use client";

import { motion } from "motion/react";
import { LANES, type Task } from "@/lib/data";
import { Avatar } from "./avatar";

const TOTAL_DAYS = 10;
const DAY_LABELS = ["M", "T", "W", "T", "F", "M", "T", "W", "T", "F"];

export function TimelineView({
  tasks,
  cardRefs,
}: {
  tasks: Task[];
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  const sorted = [...tasks].sort((a, b) => {
    const aStart = a.startDay ?? 0;
    const bStart = b.startDay ?? 0;
    return aStart - bStart;
  });

  return (
    <div className="px-5 pt-4">
      <div className="overflow-hidden rounded-xl border border-line-soft bg-white">
        {/* Header with day grid */}
        <div className="grid grid-cols-[200px_1fr] border-b border-line-soft bg-bg-sunken/40">
          <div className="border-r border-line-soft px-4 py-2 text-[10.5px] font-medium uppercase tracking-wider text-ink-quiet">
            Task
          </div>
          <div className="grid grid-cols-10 text-center text-[10.5px] font-medium text-ink-quiet">
            {DAY_LABELS.map((d, i) => (
              <div
                key={i}
                className={
                  "py-2 " +
                  (i === 0 ? "" : "border-l border-line-soft/70 ") +
                  (i === 4 || i === 9
                    ? "bg-bg-sunken/70 text-ink-soft "
                    : "")
                }
              >
                {d}
                <span className="ml-1 text-ink-faint">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          {sorted.map((task) => {
            const lane = LANES[task.lane];
            const start = task.startDay ?? 0;
            const dur = task.durationDays ?? 1;
            const left = (start / TOTAL_DAYS) * 100;
            const width = (dur / TOTAL_DAYS) * 100;
            const completed = task.lane === "done";
            return (
              <div
                key={task.id}
                className="grid grid-cols-[200px_1fr] items-center border-b border-line-soft last:border-b-0"
              >
                <div className="flex items-center gap-2 truncate border-r border-line-soft px-4 py-2.5 text-[12.5px]">
                  <span
                    className="block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ background: lane.dot }}
                  />
                  <span className="truncate">{task.title}</span>
                </div>
                <div className="relative h-12">
                  {/* Day grid backdrop */}
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-10">
                    {Array.from({ length: TOTAL_DAYS }).map((_, i) => (
                      <div
                        key={i}
                        className={
                          (i === 0 ? "" : "border-l border-line-soft/60 ") +
                          (i === 4 || i === 9 ? "bg-bg-sunken/40 " : "")
                        }
                      />
                    ))}
                  </div>

                  <motion.div
                    layoutId={`task-${task.id}`}
                    ref={(el) => {
                      if (el) cardRefs.current.set(task.id, el);
                      else cardRefs.current.delete(task.id);
                    }}
                    transition={{
                      layout: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
                    }}
                    className="absolute top-1/2 flex -translate-y-1/2 cursor-grab items-center gap-1.5 overflow-hidden rounded-md border px-2 py-1.5 text-[11px] font-medium shadow-sm"
                    style={{
                      left: `calc(${left}% + 4px)`,
                      width: `calc(${width}% - 8px)`,
                      background: completed ? "#fff" : lane.bg,
                      borderColor: completed
                        ? lane.dot
                        : "rgba(255,255,255,0.6)",
                      color: lane.ink,
                    }}
                  >
                    <Avatar user={task.assignees[0]} size={14} />
                    <span className="truncate">{task.title}</span>
                  </motion.div>
                </div>
              </div>
            );
          })}

          {/* Today indicator */}
          <div
            className="pointer-events-none absolute top-0 z-20 h-full w-px"
            style={{
              left: `calc(200px + ${(2 / TOTAL_DAYS) * 100}%)`,
              background:
                "linear-gradient(to bottom, transparent, var(--brand) 12%, var(--brand) 88%, transparent)",
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
