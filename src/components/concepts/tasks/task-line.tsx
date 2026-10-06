"use client";

/**
 * New task, the same everywhere: one line in plain words, read by the shared
 * grammar, previewed as chips, and added to the demo store. The line itself
 * is typed into the one composer (`composer.tsx`).
 */

import type { CSSProperties } from "react";
import { VIEWER, type ProjectId, type Room, type TaskStatus, type TeamPersonId } from "../demo/store";
import { addTask } from "../demo/store/client";
import { lineChips, type TaskLine } from "./grammar";
import styles from "./tasks.module.css";

export function LineChips({ line, fallbackProject, hint = true }: { line: TaskLine; fallbackProject?: ProjectId; hint?: boolean }) {
  const chips = lineChips(line, fallbackProject);
  const detail = chips.some((c) => c.key !== "project");
  return (
    <span className={styles.lineChips} aria-live="polite">
      {chips.map((c) => (
        <span key={c.key} className={styles.lineChip} style={c.hue ? ({ "--dot": `var(--v3-project-${c.hue})` } as CSSProperties) : undefined}>
          {c.key === "project" ? <span className={styles.lineDot} aria-hidden="true" /> : null}
          {c.key === "owner" ? (
            <span className={styles.lineFace} aria-hidden="true">
              {c.initials}
            </span>
          ) : null}
          {c.label}
        </span>
      ))}
      {hint && !detail ? <span className={styles.lineHint}>Add who, when and how urgent: “orla fri high”</span> : null}
    </span>
  );
}

export type NewTaskDefaults = { project?: ProjectId; owner?: TeamPersonId; status?: TaskStatus; helper?: TeamPersonId; room?: Room };

/** Add the task a line describes. Returns the new id, or null with no title. */
export function addFromLine(line: TaskLine, defaults: NewTaskDefaults = {}): string | null {
  if (!line.title) return null;
  const owner = line.owner ?? defaults.owner ?? VIEWER;
  const helpers = defaults.helper && defaults.helper !== owner ? [defaults.helper] : undefined;
  return addTask({
    title: line.title,
    project: line.project ?? defaults.project ?? "mara-finn",
    owner,
    ...(helpers ? { helpers } : {}),
    status: line.status ?? defaults.status ?? "todo",
    priority: line.priority ?? "none",
    ...(line.due ? { due: line.due } : {}),
    ...(line.supplier ? { supplier: line.supplier } : {}),
    ...(line.cost != null ? { cost: line.cost } : {}),
    ...(line.paid != null ? { paid: line.paid } : {}),
    ...(line.guests != null ? { guests: line.guests } : {}),
    ...(defaults.room ? { room: defaults.room } : {}),
  });
}
