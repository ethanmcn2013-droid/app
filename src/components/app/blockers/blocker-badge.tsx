"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";

type Props = {
  blockedBy: string[];
  /** Visual scale. Cards use "sm"; the detail-panel relation row uses "md". */
  size?: "sm" | "md";
};

/**
 * Tiny chip that surfaces "this task is waiting on N other tasks."
 * Hover/click → popover lists the blockers as buttons that open
 * the detail panel for the upstream task. Color stays restrained
 * (amber, not red) — blockers are friction, not failure.
 */
export function BlockerBadge({ blockedBy, size = "sm" }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const state = useTasksState();
  const { openTask } = useTaskPanel();

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

  if (blockedBy.length === 0) return null;

  const blockers = blockedBy
    .map((id) => state.tasks.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  // Done blockers don't actually block. Surface a softer "cleared" tone.
  const allCleared =
    blockers.length > 0 && blockers.every((b) => b.lane === "done");

  const fontSize = size === "sm" ? "text-[10px]" : "text-[11px]";
  const padding = size === "sm" ? "px-1 py-0.5" : "px-1.5 py-0.5";

  return (
    <div ref={wrap} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={
          "inline-flex items-center gap-1 rounded font-medium transition-colors " +
          padding +
          " " +
          fontSize +
          " " +
          (allCleared
            ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100")
        }
        aria-label={`Blocked by ${blockedBy.length} task${blockedBy.length === 1 ? "" : "s"}`}
      >
        <svg
          width={size === "sm" ? "9" : "11"}
          height={size === "sm" ? "9" : "11"}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        {allCleared ? "Cleared" : `Blocked · ${blockedBy.length}`}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full z-50 mt-1.5 w-[280px] rounded-lg border border-line-soft bg-white p-2 shadow-[0_18px_42px_-18px_rgba(20,21,26,0.32)]"
          >
            <div className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
              {allCleared ? "Was blocked by" : "Blocked by"}
            </div>
            <ul className="space-y-px">
              {blockers.map((b) => {
                const cleared = b.lane === "done";
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpen(false);
                        openTask(b.id);
                      }}
                      className={
                        "flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[12px] transition-colors hover:bg-bg-sunken/60 " +
                        (cleared ? "text-ink-quiet line-through" : "text-ink")
                      }
                    >
                      <span
                        className="block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{
                          background: cleared ? "#10b981" : "#d97706",
                        }}
                      />
                      <span className="line-clamp-1 flex-1">{b.title}</span>
                      <span
                        className="flex-shrink-0 font-mono text-[10px]"
                        style={{
                          color: cleared
                            ? "var(--ink-faint)"
                            : "var(--ink-quiet)",
                        }}
                      >
                        {b.id.replace(/^t-/, "T-").toUpperCase()}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
