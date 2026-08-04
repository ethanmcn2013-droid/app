"use client";

import { motion } from "motion/react";
import { PRIORITY_LABEL, type PublicTask } from "@/lib/data";
import { publicColumnTasks, type PublicColumn } from "@/lib/public-board-lanes";

/**
 * Read-only board for /share/[token] — a finished artifact, not a
 * stripped-down app screen. It renders the operator's own columns
 * (names, order, tint) from the workspace config, and no editing
 * affordances render at all: a recipient can read the board; the single
 * "Make this yours" action lives in the page header. Priority language
 * matches the live board ("Urgent"/"High"), never internal codes.
 */
export function ShareBoard({ tasks, columns }: { tasks: PublicTask[]; columns: PublicColumn[] }) {
  return (
    // tabIndex: the horizontal scroller must be keyboard-operable — with
    // no focusable children, arrow-scrolling to the clipped Done column
    // is otherwise impossible (axe: scrollable-region-focusable).
    <div
      aria-label="Shared board columns, scrollable"
      className="thin-scroll flex h-full flex-1 gap-3 overflow-x-auto overflow-y-hidden px-8 pb-8 pt-5 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
      role="region"
      tabIndex={0}
    >
      {columns.map((column, idx) => {
        const laneTasks = publicColumnTasks(tasks, column.id);
        return (
          <motion.section
            key={column.id}
            aria-label={`${column.name}, ${laneTasks.length} ${laneTasks.length === 1 ? "task" : "tasks"}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.55,
              delay: idx * 0.06,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="flex w-[298px] flex-shrink-0 flex-col rounded-xl p-2.5"
            style={{
              background: column.accent
                ? `color-mix(in srgb, ${column.accent} 5%, var(--paper))`
                : "var(--bg-sunken, var(--paper))",
            }}
          >
            <div className="flex items-center justify-between px-1.5 pb-2 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="block h-2 w-2 rounded-full"
                  style={{ background: column.accent ?? "var(--ink-faint, currentColor)" }}
                />
                <span className="text-[12.5px] font-semibold text-ink-soft">
                  {column.name}
                </span>
                <span className="text-[11.5px] text-ink-soft">
                  {laneTasks.length}
                </span>
              </div>
            </div>
            <div className="thin-scroll flex flex-col gap-2 overflow-y-auto pr-0.5">
              {laneTasks.map((task) => (
                <ReadCard key={task.id} task={task} />
              ))}
              {laneTasks.length === 0 ? (
                <p className="px-2 py-1.5 text-[12px] text-ink-soft">
                  Nothing here yet.
                </p>
              ) : null}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}

function ReadCard({ task }: { task: PublicTask }) {
  const prio = PRIORITY_LABEL[task.priority];
  const showPriority = task.priority === "p0" || task.priority === "p1";
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-[10px] border border-line-soft bg-white px-3 py-2.5 text-[13px] leading-snug shadow-[0_1px_2px_rgba(20,21,26,0.04)]"
    >
      <span className="line-clamp-2">{task.title}</span>
      {showPriority || task.due ? (
        <div className="mt-2 flex items-center gap-2">
          {showPriority ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-soft">
              <span
                className="block h-1.5 w-1.5 rounded-full"
                style={{ background: prio.color }}
              />
              {prio.label} priority
            </span>
          ) : null}
          {task.due ? (
            task.overdue ? (
              <span
                className="text-[11px] font-medium"
                style={{ color: "var(--x-task-danger)" }}
              >
                Overdue · {task.due}
              </span>
            ) : (
              <span className="text-[11px] text-ink-quiet">{task.due}</span>
            )
          ) : null}
        </div>
      ) : null}
    </motion.article>
  );
}
