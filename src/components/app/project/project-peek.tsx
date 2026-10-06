"use client";

/**
 * A project peek: one Project as a record, over the Projects page, without
 * opening it (founder reference 24, sprint item 5, 6 Oct 2026).
 *
 * Opening a Project switches the whole app to it, so a plain click on a row
 * now shows this first: previous and next with "3 of 12", Open, the
 * Project's tile and name, one row per field, its progress, what it is for,
 * and what got done in the last fourteen days. Open (or Enter on the panel's
 * Open button) is the switch the row used to make; Escape closes and hands
 * focus back to the row.
 *
 * Every figure is one the Projects page already reads (the card stats and
 * the console facts). Who is in the Project, its recent activity and its
 * files are read only for the open Project, so the peek does not show them;
 * "Open its tasks", "See the timeline" and "Files" go there instead.
 */

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { projectColor } from "@/components/shell/app-sidebar";
import { hasOpenLayer } from "@/components/primitives/open-layer";
import { useHydrated } from "@/lib/use-hydrated";
import type { ProjectCardStats } from "@/lib/projects/project-hub";
import { CONSOLE_DAYS, formatConsoleDate, type ConsoleFacts, type ConsoleRow } from "@/lib/projects/project-console";
import { Mark, type ConsoleSurface } from "./project-console";
import styles from "./project-peek.module.css";

export type ProjectPeekProps = Readonly<{
  row: ConsoleRow;
  stats: ProjectCardStats | null;
  facts: ConsoleFacts | null;
  today: string;
  /** "3 of 12" in the list's own order, or null for a single Project. */
  position: string | null;
  /** The Project whose overview is on this page. */
  isOpenProject: boolean;
  hrefFor: (projectId: string, surface: ConsoleSurface) => string;
  filesHref: string;
  onStep: (direction: "prev" | "next") => void;
  onGo: (projectId: string, surface: ConsoleSurface) => void;
  onClose: () => void;
}>;

const plainClick = (event: React.MouseEvent) => !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0);

export function ProjectPeek(props: ProjectPeekProps) {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return createPortal(<PeekFrame {...props} />, document.body);
}

function PeekFrame({ row, stats, facts, today, position, isOpenProject, hrefFor, filesHref, onStep, onGo, onClose }: ProjectPeekProps) {
  const ref = useRef<HTMLElement | null>(null);
  // The latest close, so the effect below runs once per opening and does not
  // pull focus back each time the page re-renders.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Focus lands on the panel; Escape closes; the opener gets focus back.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }));
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || hasOpenLayer(ref.current)) return;
      event.preventDefault();
      closeRef.current();
    };
    document.addEventListener("keydown", onKey, true);
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = body;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    const target = event.target as HTMLElement;
    // Up, down, j and k walk the list, as they do on the rows.
    if (!target.matches("input, textarea, select") && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        onStep("next");
        return;
      }
      if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        onStep("prev");
        return;
      }
    }
    if (event.key !== "Tab") return;
    const node = ref.current;
    if (!node) return;
    const items = [...node.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')].filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const go = (surface: ConsoleSurface) => (event: React.MouseEvent) => {
    if (!plainClick(event)) return;
    event.preventDefault();
    onGo(row.id, surface);
  };

  const total = stats?.total ?? 0;
  const complete = stats?.complete ?? 0;
  const doneByDay = facts?.doneByDay ?? [];
  const doneRecently = doneByDay.reduce((sum, n) => sum + n, 0);
  const peak = Math.max(1, ...doneByDay);
  const titleId = `project-peek-${row.id}`;

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <section
        ref={ref}
        className={styles.frame}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-project-peek={row.id}
      >
        <header className={styles.head}>
          <div className={styles.stepper}>
            <button type="button" className={styles.step} aria-label="Previous project (K)" title="Previous project (K)" onClick={() => onStep("prev")}>
              <Chevron up />
            </button>
            <button type="button" className={styles.step} aria-label="Next project (J)" title="Next project (J)" onClick={() => onStep("next")}>
              <Chevron />
            </button>
            {position ? <span className={styles.position}>{position}</span> : null}
          </div>
          <div className={styles.headActions}>
            {row.selectable ? (
              <a href={hrefFor(row.id, "project")} className={styles.openButton} onClick={go("project")}>
                {isOpenProject ? "See its overview" : "Open"}
              </a>
            ) : null}
            <button type="button" className={styles.close} aria-label="Close" title="Close (Esc)" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        </header>

        <div className={styles.scroll}>
          <div className={styles.identity}>
            <span className={styles.tile} style={{ backgroundColor: projectColor(row.id) }} aria-hidden="true">
              {row.name.trim().slice(0, 1).toUpperCase()}
            </span>
            <div className={styles.identityText}>
              <h2 className={styles.name} id={titleId}>
                {row.name}
              </h2>
              <p className={styles.sub} data-tone={row.selectable ? undefined : "warning"}>
                {row.selectable ? row.sub : row.blockedReason ?? row.sub}
              </p>
            </div>
          </div>

          <dl className={styles.fields}>
            <Field label="Status" icon={<Mark mark={row.mark} />}>
              {row.markLabel}
            </Field>
            <Field label="Lead" icon={<PersonIcon />}>
              <span className={styles.person}>
                <span className={styles.avatar} data-you={row.ledByYou || undefined} aria-hidden="true">
                  {row.lead.initials ?? "?"}
                </span>
                {row.lead.name}
              </span>
            </Field>
            <Field label="Target date" icon={<CalendarIcon />}>
              {stats?.targetDate ? formatConsoleDate(stats.targetDate, today) : <span className={styles.quiet}>Not set</span>}
            </Field>
            <Field label="Next big date" icon={<DiamondIcon />}>
              <span data-quiet={row.next.quiet || undefined} className={row.next.quiet ? styles.quiet : undefined}>
                {row.next.value}
              </span>
              {row.next.caption ? <span className={styles.caption}>{row.next.caption}</span> : null}
            </Field>
            <Field label="Open tasks" icon={<CheckIcon />}>
              {row.open}
            </Field>
            <Field label="Late" icon={<ClockIcon />}>
              <span className={row.late > 0 ? styles.late : styles.quiet}>{row.lateCell.value}</span>
            </Field>
            {total > 0 ? (
              <Field label="Progress" icon={<BarsIcon />}>
                <span className={styles.progress}>
                  <span
                    className={styles.track}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={complete}
                    aria-label={`${complete} of ${total} tasks done`}
                  >
                    <span className={styles.fill} style={{ width: `${Math.min(1, complete / total) * 100}%` }} />
                  </span>
                  <span className={styles.count}>
                    {complete} of {total}
                  </span>
                </span>
              </Field>
            ) : null}
          </dl>

          <section className={styles.section} aria-labelledby={`${titleId}-purpose`}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionName} id={`${titleId}-purpose`}>
                What it is for
              </h3>
              {row.selectable ? (
                <a href={hrefFor(row.id, "project")} className={styles.seeAll} onClick={go("project")}>
                  See all
                </a>
              ) : null}
            </div>
            {stats?.purpose ? <p className={styles.text}>{stats.purpose}</p> : <p className={styles.quietText}>No purpose written yet.</p>}
          </section>

          <section className={styles.section} aria-labelledby={`${titleId}-done`}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionName} id={`${titleId}-done`}>
                Done lately
              </h3>
              {row.selectable ? (
                <a href={hrefFor(row.id, "tasks")} className={styles.seeAll} onClick={go("tasks")}>
                  See all
                </a>
              ) : null}
            </div>
            {doneByDay.length === CONSOLE_DAYS ? (
              <>
                <p className={styles.text}>
                  {doneRecently === 0 ? "Nothing finished in the last two weeks." : `${doneRecently} ${doneRecently === 1 ? "task" : "tasks"} finished in the last two weeks.`}
                </p>
                <div className={styles.days} aria-hidden="true">
                  {doneByDay.map((n, i) => (
                    <span key={i} className={styles.day} data-empty={n === 0 || undefined} style={{ height: `${Math.max(8, (n / peak) * 100)}%` }} />
                  ))}
                </div>
              </>
            ) : (
              <p className={styles.quietText}>What got done could not be read just now.</p>
            )}
          </section>

          {row.selectable ? (
            <nav className={styles.links} aria-label={`More of ${row.name}`}>
              <a href={hrefFor(row.id, "tasks")} onClick={go("tasks")}>
                Open its tasks
              </a>
              <a href={hrefFor(row.id, "timeline")} onClick={go("timeline")}>
                See the timeline
              </a>
              <a href={filesHref}>Files</a>
            </nav>
          ) : null}
        </div>
      </section>
    </>
  );
}

function Field({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <dt className={styles.label}>
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
        {label}
      </dt>
      <dd className={styles.value}>{children}</dd>
    </div>
  );
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4"} />
    </svg>
  );
}
const PersonIcon = () => (
  <Svg>
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
  </Svg>
);
const CalendarIcon = () => (
  <Svg>
    <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
    <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
  </Svg>
);
const DiamondIcon = () => (
  <Svg>
    <path d="M8 2.5l5.5 5.5L8 13.5 2.5 8z" />
  </Svg>
);
const CheckIcon = () => (
  <Svg>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M5.75 8.25l1.5 1.5 3-3.25" />
  </Svg>
);
const ClockIcon = () => (
  <Svg>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 5v3.25l2 1.25" />
  </Svg>
);
const BarsIcon = () => (
  <Svg>
    <path d="M2.75 13.25h10.5M4.5 13.25V9.5M8 13.25V6.5M11.5 13.25V3.5" />
  </Svg>
);
