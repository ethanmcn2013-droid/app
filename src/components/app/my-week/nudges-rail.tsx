"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { Nudge } from "@/lib/nudges/generate-nudges";

/**
 * What's stuck — a low-density nudges rail for My Week.
 *
 * The inbox carries the loud version (rose/amber cards, per-kind icons).
 * My Week is the calm front door, so this rail is deliberately quieter:
 * a small-caps header matching the other sections, compact rows, a single
 * severity dot instead of iconography, capped at three, and silent on a
 * quiet week. It shares the inbox's localStorage dismissal key so a nudge
 * dismissed in one surface stays dismissed in the other.
 *
 * Nudges are computed client-side from the same context task list the rest
 * of My Week reads (generateNudges is a pure function), so this rail needs
 * no server seam — it cannot break the front door.
 */

const DISMISSED_KEY = "tasks_dismissed_nudges";
const MAX_VISIBLE = 3;

export function NudgesRail({
  nudges,
  onOpen,
}: {
  nudges: Nudge[];
  onOpen: (taskId: string) => void;
}) {
  const reduce = useReducedMotion();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      if (raw) setDismissed(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignore — a corrupt list just means nothing is pre-dismissed.
    }
  }, []);

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Rules-based only (the llm-narration kind is produced elsewhere and never
  // reaches this client rail), highest-severity first, capped.
  const visible = useMemo(
    () =>
      nudges
        .filter((n) => n.kind !== "llm-narration" && !dismissed.has(n.id))
        .sort((a, b) => b.severity - a.severity)
        .slice(0, MAX_VISIBLE),
    [nudges, dismissed],
  );

  // SSR + quiet-week discipline: render nothing until mounted (localStorage
  // is client-only) and nothing when there is nothing stuck.
  if (!mounted || visible.length === 0) return null;

  return (
    <section className="mt-7">
      <div className="flex items-baseline justify-between border-b border-line-soft pb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
          What&rsquo;s stuck
        </h3>
        <span className="text-[11px] tabular-nums text-ink-quiet">
          {visible.length}
        </span>
      </div>
      <ul className="mt-1">
        <AnimatePresence initial={false}>
          {visible.map((n) => {
            const dotColor =
              n.severity >= 75
                ? "var(--status-flight, #f59e0b)"
                : n.severity >= 50
                  ? "#d97706"
                  : "var(--ink-quiet, #71717a)";
            const clickable = !!n.taskId;
            return (
              <motion.li
                key={n.id}
                layout={reduce ? false : "position"}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 3 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="group flex items-start gap-3 border-b border-line-soft/60 px-1 py-2.5 last:border-b-0"
              >
                <span
                  aria-hidden
                  className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: dotColor }}
                />
                <button
                  type="button"
                  onClick={() => clickable && onOpen(n.taskId!)}
                  disabled={!clickable}
                  className={
                    "min-w-0 flex-1 text-left " +
                    (clickable ? "cursor-pointer" : "cursor-default")
                  }
                >
                  <div className="line-clamp-1 text-[13.5px] text-ink">
                    {n.headline}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11.5px] leading-[1.5] text-ink-quiet">
                    {n.body}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss(n.id);
                  }}
                  aria-label="Dismiss"
                  className="ml-2 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-ink-quiet opacity-0 transition-opacity hover:bg-bg-sunken hover:text-ink-soft group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  >
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="6" y1="18" x2="18" y2="6" />
                  </svg>
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
}
