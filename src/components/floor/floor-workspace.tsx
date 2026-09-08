"use client";

/**
 * Studio Floor — the Tasks workspace.
 *
 * The whole page, 1:1 with the design master at
 * `docs/design/labs/tasks-2026-08/floor.html`: the ink ground, one white
 * sheet lifted off it, the capsule spine on the left, the header, the view
 * switcher, the ruled trays and the floating dock. The master was taken
 * through eleven rounds of a seven-seat panel (350 findings, 243 confirmed
 * and fixed) and remains the reference — the stylesheet beside this file is
 * generated from it by `scripts/design/extract-floor-css.mjs`, so the shipped
 * page and the design cannot drift apart.
 *
 * This replaces the Studio Bar and the product rail on Tasks, which is why
 * `/app/tasks` is a bare-chrome path: the spine here is the one spine.
 */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TASKS_VIEW_PATHS } from "@/lib/product-urls";
import { useSuiteContext } from "@/components/app/use-suite-context";
import { withSuiteContext } from "@/lib/suite-context";
import { useLabStore } from "@/components/hybrid/store";
import { useBoardColumns } from "@/components/hybrid/columns-context";
import type { LabTask, LabView } from "@/components/hybrid/types";
import { FloorBoard, timeOf } from "./floor-board";
import { FLOOR_PRESET } from "./floor-preset";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import styles from "./floor.module.css";

/* ── the spine ─────────────────────────────────────────────────── */

const RailIcon = {
  more: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="7" cy="7" r="2.1" /><circle cx="17" cy="7" r="2.1" />
      <circle cx="7" cy="17" r="2.1" /><circle cx="17" cy="17" r="2.1" />
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20h13V9.5" />
    </svg>
  ),
  notes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" />
    </svg>
  ),
  tasks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3.5" /><path d="M8.5 12.2l2.4 2.4 4.6-5" />
    </svg>
  ),
  timeline: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 17h4V9h8V4" /><path d="M16 4h4" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 13h5l1.5 2.5h3L15 13h5" /><path d="M4 13 6.5 5h11L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" /><path d="M9.8 9.6a2.3 2.3 0 1 1 3 2.2v1.4" /><path d="M12.8 16.6h.01" />
    </svg>
  ),
} as const;

const ViewIcon = {
  board: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="4.5" width="5.5" height="15" rx="1.4" /><rect x="14.5" y="4.5" width="5.5" height="9" rx="1.4" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  ),
  timeline: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h11M4 12h16M4 17h7" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="5.5" width="16" height="14" rx="2.4" /><path d="M4 10h16M9 4v3M15 4v3" />
    </svg>
  ),
} as const;

const Search = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="6.4" /><path d="m16 16 4 4" />
  </svg>
);
const Share = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="17.5" cy="6" r="2.4" /><circle cx="6.5" cy="12" r="2.4" /><circle cx="17.5" cy="18" r="2.4" />
    <path d="m8.7 10.8 6.6-3.6M8.7 13.2l6.6 3.6" />
  </svg>
);
const Panel = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="5" width="16" height="14" rx="2.4" /><path d="M14.5 5v14" />
  </svg>
);
const DotsIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
  </svg>
);
const PlusIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const VIEW_LABEL: Record<LabView, string> = {
  board: "Board",
  list: "List",
  timeline: "Schedule",
  calendar: "Calendar",
};

/* What each of the shipped lanes is for, in the product's own voice. A
   workspace that has never renamed or described a column has no description
   at all, and the line under the column name is part of the design — it is
   what tells a first-time venue owner what the column is holding. An owner's
   own description always wins. */
export const LANE_NOTE: Record<string, string> = {
  todo: "Agreed and ready to start.",
  doing: "In motion right now.",
  review: "Being checked before it goes out.",
  waiting: "Held by a reply, a delivery, or a decision.",
  done: "Work that is finished and settled.",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type FloorWorkspaceProps = {
  view: LabView;
  /** The set the view tools have already filtered and sorted. */
  tasks: LabTask[];
  /** The project's own name, as the header states it. */
  projectName: string;
  /** The operator's initials for the dock and the spine. */
  initials: string;
  /** The four views' interiors for anything that is not the board. */
  children?: React.ReactNode;
  onOpenPlanning?: () => void;
};

export function FloorWorkspace({
  view, tasks, projectName, initials, children, onOpenPlanning,
}: FloorWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const store = useLabStore();
  const columns = useBoardColumns();
  const calendar = useCalendarFrame();

  /* The two facts a venue owner acts on. They are the loudest objects in the
     header because they are the questions the board is opened to answer, and
     they compose — pressing both is a legitimate, if usually empty, thing to
     ask. */
  const [lateOnly, setLateOnly] = useState(false);
  const [todayOnly, setTodayOnly] = useState(false);
  const clearHeaderFilters = useCallback(() => {
    setLateOnly(false);
    setTodayOnly(false);
  }, []);

  const facts = useMemo(() => {
    const total = tasks.length;
    const isDone = (t: LabTask) => t.completed || columns.find((c) => c.key === t.status)?.isDone === true;
    const done = tasks.filter(isDone).length;
    let overdue = 0;
    let dueToday = 0;
    let undated = 0;
    for (const task of tasks) {
      const time = timeOf(task, isDone(task), calendar);
      if (time.kind === "overdue") overdue += 1;
      if (time.kind === "today") dueToday += 1;
      if (time.kind === "none" && !isDone(task)) undated += 1;
    }
    return { total, done, overdue, dueToday, undated };
  }, [tasks, columns, calendar]);

  const suite = useSuiteContext();

  // Format the project's date without consulting the browser clock/timezone.
  // The same serialized frame supplies SSR, hydration, counts and card filters.
  const day = new Date(`${calendar.today}T12:00:00Z`);
  const todayLabel = `${DAYS[day.getUTCDay()]} ${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`;

  /* Crossing to another product carries the workspace with it. The suite
     sidebar did this and the spine that replaced it did not, so stepping from
     Tasks to Timeline landed a person in the right product with no idea which
     wedding they were looking at. data-product is the same contract the rest
     of the suite navigates by. */
  const product = (key: "notes" | "tasks" | "timeline", label: string, href: string) => {
    const active = key === "tasks";
    return (
      <Link
        key={key}
        href={withSuiteContext(href, suite)}
        className={styles.railTile}
        data-product={key}
        data-key={key}
        aria-label={label}
        {...(active ? { "data-active": "", "aria-current": "page", title: label } : { title: label })}
      >
        {RailIcon[key]}
      </Link>
    );
  };

  return (
    <div
      className={styles.root}
      data-cards={FLOOR_PRESET.cards}
      data-radius={FLOOR_PRESET.radius}
      data-density={FLOOR_PRESET.density}
      data-indigo={FLOOR_PRESET.indigo}
      data-type={FLOOR_PRESET.type}
    >
      {/* ── the spine ─────────────────────────────────────────── */}
      <nav className={styles.rail} data-group="rail" aria-label="Signal Studio">
        <Link href="/app/home" className={styles.railMark} aria-label="Signal Studio" title="Signal Studio">
          {RailIcon.more}<i />
        </Link>
        <span className={styles.railDivider} />
        <div className={styles.railGroup}>
          <Link href="/app/home" className={styles.railTile} data-key="home" aria-label="Home" title="Home">
            {RailIcon.home}
          </Link>
          {product("notes", "Notes", "/app/notes")}
          {product("tasks", "Tasks", "/app/tasks")}
          {product("timeline", "Timeline", "/app/timeline")}
        </div>
        <span className={styles.railSpacer} />
        <div className={styles.railUtil}>
          <Link href={withSuiteContext("/app/inbox", suite)} className={styles.railTile} data-key="inbox" aria-label="Inbox" title="Inbox">
            {RailIcon.inbox}
          </Link>
          <Link href="/app/settings" className={styles.railTile} data-key="help" aria-label="Help and settings" title="Help and settings">
            {RailIcon.help}
          </Link>
        </div>
        <button
          type="button"
          className={styles.railAdd}
          aria-label="Add task"
          onClick={() => store.addTask(columns[0]?.key ?? "todo")}
        >
          {PlusIcon}
        </button>
        <Link href="/app/settings" className={styles.railAvatar} aria-label="Your account" title="Your account">
          {initials}
        </Link>
      </nav>

      {/* ── the sheet ─────────────────────────────────────────── */}
      <div className={styles.sheet} data-sheet="">
        <div className={styles.head}>
          <span className={styles.word}>tasks</span>
          <span className={styles.headRule} />
          <h1 className={styles.headName}>{projectName}</h1>
          <div className={styles.headFacts}>
            <span className={styles.today}>{todayLabel}</span>
            {facts.total > 0 && facts.done === facts.total ? (
              <span className={styles.ratio} data-all="">Everything is done.</span>
            ) : facts.total > 0 ? (
              <span className={styles.ratio}><b>{facts.done}</b> of <b>{facts.total}</b> done</span>
            ) : null}
            {facts.dueToday > 0 && (
              <button
                type="button"
                className={styles.late}
                data-soft=""
                aria-pressed={todayOnly}
                title={todayOnly ? `Show all ${facts.total} tasks` : `Show only the ${facts.dueToday} due today`}
                onClick={() => setTodayOnly((v) => !v)}
              >
                {facts.dueToday} today
              </button>
            )}
            {(facts.overdue > 0 || lateOnly) && (
              <button
                type="button"
                className={styles.late}
                aria-pressed={lateOnly}
                title={lateOnly
                  ? `Show all ${facts.total} tasks`
                  : `Show only the ${facts.overdue} overdue ${facts.overdue === 1 ? "task" : "tasks"}`}
                onClick={() => setLateOnly((v) => !v)}
              >
                {facts.overdue} overdue
              </button>
            )}
            {facts.undated > 0 && onOpenPlanning && (
              <button
                type="button"
                className={styles.undated}
                title={`Open Planning to give these ${facts.undated} tasks a day`}
                onClick={onOpenPlanning}
              >
                {facts.undated} with no date
              </button>
            )}
          </div>
          <div className={styles.headActions}>
            <button type="button" className={`${styles.ghost} ${styles.headSearch}`} aria-label="Search">
              {Search}
            </button>
            <button type="button" className={styles.ghost}>{Share}<span>Share</span></button>
            {onOpenPlanning && (
              <button type="button" className={styles.ghost} onClick={onOpenPlanning}>
                {Panel}<span>Planning</span>
                {facts.undated > 0 && <em>{facts.undated}</em>}
              </button>
            )}
            <button type="button" className={styles.ghost} aria-label="More">{DotsIcon}</button>
          </div>
        </div>

        <div className={styles.views}>
          <nav className={styles.seg} data-group="views" aria-label="View">
            {(Object.keys(VIEW_LABEL) as LabView[]).map((key) => {
              const href = TASKS_VIEW_PATHS[key];
              const active = key === view || pathname === href;
              return (
                <Link
                  key={key}
                  href={href}
                  className={styles.segItem}
                  {...(active ? { "data-active": "", "aria-current": "page" } : {})}
                  onClick={(event) => {
                    event.preventDefault();
                    router.push(href);
                  }}
                >
                  {ViewIcon[key]}<span>{VIEW_LABEL[key]}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {view === "board" ? (
          <FloorBoard
            lateOnly={lateOnly}
            onClearHeaderFilters={clearHeaderFilters}
            tasks={tasks}
            todayOnly={todayOnly}
          />
        ) : (
          <div className={styles.otherView}>{children}</div>
        )}

        {/* ── the dock ────────────────────────────────────────── */}
        <div className={styles.dock}>
          <button type="button" className={styles.dockField} aria-label={`Search ${projectName}`}>
            {Search}<span>Search {projectName}</span>
          </button>
          <button
            type="button"
            className={styles.dockPrimary}
            onClick={() => store.addTask(columns[0]?.key ?? "todo")}
          >
            {PlusIcon}<span>Add task</span>
          </button>
          <span className={styles.dockRule} />
          <Link href="/app/settings" className={styles.dockAvatar} aria-label="Your account">
            {initials}
          </Link>
        </div>
      </div>
    </div>
  );
}
