"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { useColumnConfig } from "@/lib/domain-context";
import { isTaskDone } from "@/lib/board-columns";

type Props = {
  blockedBy: string[];
  /** Visual scale. Cards use "sm"; the detail-panel relation row uses "md". */
  size?: "sm" | "md";
};

/**
 * Tiny chip that surfaces "this task is waiting on N other tasks."
 * Hover/click → popover lists the blockers as buttons that open
 * the detail panel for the upstream task. Color stays restrained
 * (amber, not red), blockers are friction, not failure.
 *
 * The two tones ride the board's own state tokens rather than absolute
 * Tailwind palette steps. amber-50/emerald-50 are light-palette values the
 * dark bridge has no way to remap, so the chip shipped a light-mode wash onto
 * the dark board the moment a blocker fired — invisible in the evidence
 * screenshots, because a screenshot of a calm board has no exceptions in it.
 * The tokens are the amber and green the lanes already spend, and both
 * derive through --paper and --ink, so each tone re-composes itself per
 * theme instead of needing a second definition.
 *
 * Measured ink-on-wash, rest / hover:
 *   blocked  5.36 / 4.60 light · 8.19 / 6.05 dark
 *   cleared  6.18 / 5.28 light · 8.29 / 6.68 dark
 */
type ChipTone = {
  "--x-chip-ink": string;
  "--x-chip-bg": string;
  "--x-chip-bg-hover": string;
  "--x-chip-edge": string;
};

/** Waiting: the board's amber, the same recipe --x-task-waiting is built on. */
const TONE_BLOCKED: ChipTone = {
  "--x-chip-ink": "var(--x-task-waiting)",
  "--x-chip-bg": "var(--x-task-waiting-soft)",
  "--x-chip-bg-hover": "color-mix(in srgb, var(--status-flight) 34%, var(--paper))",
  "--x-chip-edge": "color-mix(in srgb, var(--status-flight) 45%, var(--paper))",
};

/** Cleared: the one canonical done green, mixed toward ink for a label. */
const TONE_CLEARED: ChipTone = {
  "--x-chip-ink": "color-mix(in srgb, var(--x-status-done) 72%, var(--ink))",
  "--x-chip-bg": "var(--x-task-success-soft)",
  "--x-chip-bg-hover": "color-mix(in srgb, var(--x-status-done) 22%, var(--paper))",
  "--x-chip-edge": "color-mix(in srgb, var(--x-status-done) 45%, var(--paper))",
};
export function BlockerBadge({ blockedBy, size = "sm" }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const state = useTasksState();
  const { openTask } = useTaskPanel();
  const columnConfig = useColumnConfig();

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
    blockers.length > 0 && blockers.every((b) => isTaskDone(b, columnConfig));

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
        style={(allCleared ? TONE_CLEARED : TONE_BLOCKED) as React.CSSProperties}
        className={
          "inline-flex items-center gap-1 rounded border font-medium transition-colors " +
          "border-[var(--x-chip-edge)] bg-[var(--x-chip-bg)] text-[var(--x-chip-ink)] " +
          "hover:bg-[var(--x-chip-bg-hover)] " +
          padding +
          " " +
          fontSize
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
                const cleared = isTaskDone(b, columnConfig);
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
                          background: cleared
                            ? "var(--x-status-done)"
                            : "var(--x-task-waiting)",
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
