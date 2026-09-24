"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { Nudge } from "@/lib/nudges/generate-nudges";
import { useHydrated } from "@/lib/use-hydrated";
import styles from "./my-tasks.module.css";

/**
 * What's stuck: the low-density nudges card in the My tasks rail.
 *
 * The inbox carries the loud version (per-kind icons and tints). My tasks
 * keeps it quiet: one severity dot per row, capped at three, silent on a
 * quiet week. The header dot is Home's Today's Signal mark, because these
 * are the same proactive reading. It shares the inbox's localStorage
 * dismissal key so a nudge dismissed in one surface stays dismissed in the
 * other.
 *
 * Nudges are computed client-side from the same context task list the rest
 * of My tasks reads (generateNudges is a pure function), so this card needs
 * no server seam and cannot break the page.
 */

const DISMISSED_KEY = "tasks_dismissed_nudges";
const MAX_VISIBLE = 3;

function readDismissedNudges(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function severityTone(severity: number): "danger" | "warning" | undefined {
  if (severity >= 75) return "danger";
  if (severity >= 50) return "warning";
  return undefined;
}

export function NudgesRail({
  nudges,
  onOpen,
}: {
  nudges: Nudge[];
  onOpen: (taskId: string) => void;
}) {
  const reduce = useReducedMotion();
  const [dismissed, setDismissed] = useState(readDismissedNudges);
  const mounted = useHydrated();

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
    <section className={styles.card} aria-labelledby="my-tasks-stuck">
      <div className={styles.groupHead}>
        <span className={styles.signalDot} aria-hidden="true" />
        <h2 id="my-tasks-stuck" className={styles.groupTitle}>
          What&rsquo;s stuck
        </h2>
        <span className={styles.groupCount}>{visible.length}</span>
      </div>
      <ul className={styles.list}>
        <AnimatePresence initial={false}>
          {visible.map((n) => {
            const clickable = !!n.taskId;
            return (
              <motion.li
                key={n.id}
                className={styles.item}
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: reduce ? 0 : 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <div className={styles.nudge}>
                  <button
                    type="button"
                    className={styles.nudgeOpen}
                    onClick={() => clickable && onOpen(n.taskId!)}
                    disabled={!clickable}
                  >
                    <span className={styles.severity} data-tone={severityTone(n.severity)} aria-hidden="true" />
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{n.headline}</span>
                      <span className={styles.nudgeBody}>{n.body}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => dismiss(n.id)}
                    aria-label="Dismiss"
                    className={styles.dismiss}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                      <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
                    </svg>
                  </button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
}
