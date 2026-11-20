"use client";

/**
 * Board, List and Calendar: one switch, the same in every Tasks view, so the
 * three read as one product. In the demo each tab stays in the demo; in the
 * gallery it opens the chosen concept.
 */

import Link from "next/link";
import { useSurfaceHref, type Surface } from "../demo/links";
import { useTaskScope } from "./scope";
import styles from "./tasks.module.css";

export type TaskView = "board" | "list" | "calendar";

const VIEWS: readonly { key: TaskView; name: string; surface: Surface }[] = [
  { key: "board", name: "Board", surface: "tasks/board" },
  { key: "list", name: "List", surface: "tasks/list" },
  { key: "calendar", name: "Calendar", surface: "tasks/calendar" },
];

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function ViewIcon({ view }: { view: TaskView }) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true" focusable="false" {...stroke}>
      {view === "board" ? (
        <>
          <rect x="2.5" y="2.75" width="4.25" height="10.5" rx="1.2" />
          <rect x="9.25" y="2.75" width="4.25" height="6.5" rx="1.2" />
        </>
      ) : view === "list" ? (
        <>
          <path d="M5.5 4h8M5.5 8h8M5.5 12h8" />
          <circle cx="2.75" cy="4" r=".6" fill="currentColor" />
          <circle cx="2.75" cy="8" r=".6" fill="currentColor" />
          <circle cx="2.75" cy="12" r=".6" fill="currentColor" />
        </>
      ) : (
        <>
          <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="1.75" />
          <path d="M2.25 6.5h11.5M5.5 2v2.5M10.5 2v2.5" />
        </>
      )}
    </svg>
  );
}

export function ViewSwitch({
  current,
  className,
  row,
}: {
  current: TaskView;
  className?: string;
  /** In a view's toolbar: the switch sets the row, so it sits at the same place on the board, the list and the calendar. */
  row?: boolean;
}) {
  const href = useSurfaceHref();
  // The scope travels with the switch, so Board, List and Calendar show the same work.
  const { project, owner } = useTaskScope();
  return (
    <nav className={[styles.switch, row ? styles.switchRow : "", className].filter(Boolean).join(" ")} aria-label="View">
      {VIEWS.map((v) => (
        <Link key={v.key} href={href(v.surface, undefined, { project, owner })} className={styles.view} aria-current={v.key === current ? "page" : undefined} prefetch={false}>
          <ViewIcon view={v.key} />
          {v.name}
        </Link>
      ))}
    </nav>
  );
}
