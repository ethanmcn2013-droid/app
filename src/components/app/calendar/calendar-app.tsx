"use client";

import { motion } from "motion/react";
import { LANES, type Task } from "@/lib/data";
import { Avatar } from "@/components/showcase/avatar";
import { useTasksState } from "@/lib/tasks/tasks-context";

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Build a 5-week grid (35 cells). Today is row 1, col 2 (Wed).
const TODAY_INDEX = 9; // 0-indexed cell of "today"
const MONTH_DAYS = 35;

function dayLabel(i: number) {
  // Days 1..31 mapped, with -, day, etc
  const num = i - 2; // offset so we land on Mon-1 etc
  if (num < 1) return ["Aug", 31 + num].join(" "); // prev-month tail
  if (num > 31) return ["Oct", num - 31].join(" ");
  return num.toString();
}

export function CalendarApp() {
  const state = useTasksState();
  // Map tasks to days based on startDay
  const cells: { i: number; tasks: Task[] }[] = Array.from(
    { length: MONTH_DAYS },
    (_, i) => ({ i, tasks: [] }),
  );
  for (const t of state.tasks) {
    const start = (t.startDay ?? 0) + TODAY_INDEX;
    const dur = t.durationDays ?? 1;
    for (let d = 0; d < dur; d++) {
      const idx = start + d;
      if (idx >= 0 && idx < MONTH_DAYS) {
        cells[idx].tasks.push(t);
      }
    }
  }

  return (
    <div className="thin-scroll flex-1 overflow-auto px-8 py-5">
      <div className="overflow-hidden rounded-xl border border-line-soft bg-white">
        <div className="grid grid-cols-7 border-b border-line-soft bg-bg-sunken/40 text-[11px] font-semibold uppercase tracking-wider text-ink-quiet">
          {DAYS_OF_WEEK.map((d) => (
            <div
              key={d}
              className={
                "border-r border-line-soft/60 px-3 py-2 last:border-r-0 " +
                (d === "Sat" || d === "Sun" ? "text-ink-quiet" : "")
              }
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 grid-rows-5">
          {cells.map((cell, i) => {
            const isToday = i === TODAY_INDEX;
            const isWeekend = i % 7 === 5 || i % 7 === 6;
            const isOutsideMonth = i < 2 || i > 32;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: (i % 7) * 0.02 }}
                className={
                  "min-h-[120px] border-b border-r border-line-soft/60 p-1.5 last:border-r-0 " +
                  (isWeekend ? "bg-bg-sunken/30 " : "") +
                  (isOutsideMonth ? "opacity-50 " : "")
                }
                style={{
                  background: isToday ? "var(--brand-soft)" : undefined,
                  outline: isToday
                    ? "1.5px solid var(--brand)"
                    : undefined,
                  outlineOffset: -1.5,
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={
                      "text-[11.5px] font-medium " +
                      (isToday
                        ? "text-brand"
                        : isOutsideMonth
                          ? "text-ink-faint"
                          : "text-ink-soft")
                    }
                  >
                    {dayLabel(i)}
                  </span>
                  {isToday ? (
                    <span className="rounded bg-brand px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
                      Today
                    </span>
                  ) : null}
                </div>

                <div className="mt-1 flex flex-col gap-1">
                  {cell.tasks.slice(0, 3).map((task) => {
                    const lane = LANES[task.lane];
                    return (
                      <div
                        key={task.id}
                        className="flex cursor-pointer items-center gap-1 truncate rounded border-l-[2.5px] bg-white/90 px-1.5 py-1 text-[10.5px] transition-colors hover:bg-white"
                        style={{ borderLeftColor: lane.dot }}
                      >
                        <Avatar user={task.assignees[0]} size={11} />
                        <span className="truncate">{task.title}</span>
                      </div>
                    );
                  })}
                  {cell.tasks.length > 3 ? (
                    <span className="px-1.5 text-[10px] text-ink-quiet">
                      +{cell.tasks.length - 3} more
                    </span>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
