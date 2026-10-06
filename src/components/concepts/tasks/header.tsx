/**
 * The Tasks header, shared by the views: title and project, one summary line,
 * one health sentence that ends in the thing to do, the team, Stuck and the
 * primary action. Styled to match the board exactly.
 */

import type { CSSProperties, ReactNode } from "react";
import styles from "./tasks.module.css";

export function TasksHeader({
  title = "Tasks",
  project,
  summary,
  health,
  actions,
  pinned,
}: {
  /** Every surface uses this header; Tasks is the default title. */
  title?: string;
  project?: ReactNode;
  summary?: ReactNode;
  health?: ReactNode;
  actions?: ReactNode;
  /**
   * Keep the actions pinned top right and give the lines under the title the
   * full width. The Tasks views use it so the header is the same height on
   * the board, the list and the calendar, whatever each one's own action is.
   */
  pinned?: boolean;
}) {
  return (
    <header className={styles.header} data-pinned={pinned ? "" : undefined}>
      <div className={styles.headerMain}>
        <div className={styles.titleRow}>
          <h1 className={styles.h1}>{title}</h1>
          {project}
        </div>
        {summary}
        {health}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}

export function ProjectPill({ name, kind, tone }: { name: string; kind: string; tone: string }) {
  return (
    <span className={styles.projectPill}>
      <span className={styles.projectDot} style={{ "--dot": tone } as CSSProperties} aria-hidden="true" />
      <span className={styles.projectName}>{name}</span>
      <span className={styles.projectKind}>{kind}</span>
    </span>
  );
}

/** "9 done this week · 13 open · 2 late", with late as a filter toggle. */
export function SummaryLine({
  doneWeek,
  open,
  late,
  donePct,
  lateOnly,
  onLate,
}: {
  doneWeek: number;
  open: number;
  late: number;
  donePct: number;
  lateOnly: boolean;
  onLate: () => void;
}) {
  return (
    <p className={styles.summary}>
      <span className={styles.ring} style={{ "--p": `${donePct}%` } as CSSProperties} aria-hidden="true" />
      <span>
        <strong className={styles.strong}>{doneWeek}</strong> done this week
      </span>
      <span className={styles.sep} aria-hidden="true">
        ·
      </span>
      <span>
        <strong className={styles.strong}>{open}</strong> open
      </span>
      {late ? (
        <>
          <span className={styles.sep} aria-hidden="true">
            ·
          </span>
          <button type="button" className={styles.late} aria-pressed={lateOnly} onClick={onLate} title={lateOnly ? "Show everything" : "Show only late tasks"}>
            {late} late
          </button>
        </>
      ) : null}
    </p>
  );
}

const hourglass = (
  <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 2.5h7M4.5 13.5h7M5.25 2.5c0 3 5.5 3.25 5.5 5.5s-5.5 2.5-5.5 5.5M10.75 2.5c0 3-5.5 3.25-5.5 5.5s5.5 2.5 5.5 5.5" />
  </svg>
);
const tick = (
  <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="m3.5 8.25 3 3 6-6.5" />
  </svg>
);

/**
 * One sentence about the work, ending in an action. `stuck` leads with the
 * oldest stuck task; `healthy` says nothing needs attention.
 */
export function HealthSentence({
  kind,
  children,
  action,
  onAction,
  actionDone,
  more,
  onMore,
}: {
  kind: "stuck" | "healthy";
  children: ReactNode;
  action?: string;
  onAction?: () => void;
  /** Shown in place of the action once it has been taken. */
  actionDone?: string;
  more?: string;
  onMore?: () => void;
}) {
  return (
    <p className={styles.health} data-kind={kind}>
      {kind === "stuck" ? hourglass : tick}
      <span>
        {children}
        {" "}
        {/* The action and "3 more stuck" stay together when the sentence wraps. */}
        <span className={styles.inlineTail}>
          {actionDone ? (
            <span className={styles.inlineDone}>{actionDone}</span>
          ) : action && onAction ? (
            <button type="button" className={styles.inlineAction} onClick={onAction}>
              {action}
            </button>
          ) : null}
          {more && onMore ? (
            <>
              <span className={styles.inlineSep} aria-hidden="true">
                ·
              </span>
              <button type="button" className={styles.inlineQuiet} onClick={onMore}>
                {more}
              </button>
            </>
          ) : null}
        </span>
      </span>
    </p>
  );
}

export function StuckButton({ count, pressed, onToggle }: { count: number; pressed: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={styles.chip} aria-pressed={pressed} onClick={onToggle} title="Show only work that has sat longer than usual">
      {hourglass}
      Stuck
      <span className={styles.chipCount}>{count}</span>
    </button>
  );
}

export function PrimaryButton({ children, onClick, className, shortcut }: { children: ReactNode; onClick: () => void; className?: string; shortcut?: string }) {
  return (
    <button type="button" className={[styles.primary, className].filter(Boolean).join(" ")} onClick={onClick} aria-keyshortcuts={shortcut}>
      <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
        <path d="M8 3v10M3 8h10" />
      </svg>
      {children}
      {shortcut ? (
        <kbd className={styles.kbdOnAccent} aria-hidden="true">
          {shortcut}
        </kbd>
      ) : null}
    </button>
  );
}

export function TeamFaces({ people }: { people: { id: string; name: string; initials: string; tone: string }[] }) {
  return (
    <span className={styles.faces} role="img" aria-label={`${people.map((p) => p.name).join(", ")} are on this project`}>
      {people.map((p) => (
        <span key={p.id} className={styles.face} style={{ background: p.tone }} title={p.name}>
          {p.initials}
        </span>
      ))}
    </span>
  );
}

/** The same header under its general name, for surfaces other than Tasks. */
export { TasksHeader as PageHeader };
