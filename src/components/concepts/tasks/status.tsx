/**
 * One status vocabulary for every Tasks view: the same five stages, names,
 * tones and glyphs on the board, the list and the calendar, matching My tasks.
 */

import type { CSSProperties } from "react";

export type TaskStatus = "todo" | "doing" | "waiting" | "review" | "done";

export const TASK_STATUSES: readonly { key: TaskStatus; name: string }[] = [
  { key: "todo", name: "To do" },
  { key: "doing", name: "In progress" },
  { key: "waiting", name: "Waiting" },
  { key: "review", name: "To check" },
  { key: "done", name: "Done" },
];

export const statusName = (key: TaskStatus) => TASK_STATUSES.find((s) => s.key === key)?.name ?? "No status";

export const STATUS_TONE: Record<TaskStatus, string> = {
  todo: "var(--v3-control-border)",
  // Ink, not amber: work under way is the normal state, and amber means at risk.
  doing: "var(--v3-text)",
  review: "var(--v3-review)",
  waiting: "var(--v3-text-2)",
  done: "var(--v3-success)",
};

/** Stages where work has started. A task in To do is queued, not stuck. */
export const STARTED_STATUSES: readonly TaskStatus[] = ["doing", "waiting", "review"];

export function StatusGlyph({
  status,
  size = 16,
  label,
  className,
  tickClassName,
}: {
  status: TaskStatus;
  size?: number;
  /** Set to announce the status; leave out when the name is shown beside it. */
  label?: string;
  className?: string;
  tickClassName?: string;
}) {
  const style: CSSProperties = { color: STATUS_TONE[status], display: "block", flexShrink: 0 };
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={style}
    >
      {status === "done" ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path
            className={tickClassName}
            d="M5 8.3 7.1 10.4 11 6"
            pathLength={1}
            fill="none"
            stroke="var(--v3-canvas)"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth={1.5} />
          {status === "doing" ? <path d="M8 3.25a4.75 4.75 0 0 1 0 9.5Z" fill="currentColor" /> : null}
          {status === "review" ? <path d="M8 3.25a4.75 4.75 0 1 1-4.75 4.75H8Z" fill="currentColor" /> : null}
          {status === "waiting" ? (
            <path d="M8 5v3.2l2 1.3" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </>
      )}
    </svg>
  );
}
