"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { LaneId, Task } from "@/lib/data";
import { useCurrentUser } from "@/lib/auth-context";
import type { CalendarFrame } from "@/lib/calendar-frame";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { generateNudges } from "@/lib/nudges/generate-nudges";
import { NudgesRail } from "@/components/app/my-week/nudges-rail";
import { AppPageHeader } from "@/components/app/page-header";
import { ShellIcon } from "@/components/shell/shell-icons";
import { useTasksDispatch, useTasksState } from "@/lib/tasks/tasks-context";
import { bucketMyWeek, splitTodayDayparts } from "@/lib/tasks/selectors";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { EmptyStateOverlay } from "@/components/app/empty-state/empty-state-overlay";
import { ListGhost } from "@/components/app/empty-state/ghost-views";
import {
  useActiveWorkspace,
  useColumnConfig,
  useDomain,
  usePersonalization,
} from "@/lib/domain-context";
import { PRODUCT_APP_PATHS } from "@/lib/product-urls";
import { parseProjectId } from "@/lib/projects/project-ref";
import { withActiveProject } from "@/lib/projects/project-url";
import {
  columnDisplayName,
  effectiveColumnKey,
  isTaskDone,
  resolveBoardColumns,
  type BoardColumn,
} from "@/lib/board-columns";
import type { ColumnConfig } from "@/lib/board-config";
import {
  calendarDateInTimeZone,
  calendarDaysBetween,
  formatCalendarDate,
} from "@/lib/planning/dates";
import { tagDisplayName } from "@/lib/tags";
import styles from "./my-tasks.module.css";

/**
 * My tasks v3: the personal task list.
 *
 * Everything assigned to the current member in the active Project, grouped by
 * when it needs them (Overdue, Today, In review, Upcoming, No date) in one
 * list card, with What's stuck and Done this week in a rail beside it. Rows
 * share Home's anatomy: lane circle, title, meta, status pill, due date.
 *
 * Home owns the greeting and the date; this page leads with the list. The
 * circle is the completion control: checking a task holds the tick for a
 * beat before it moves to Done this week, so the action reads as finished
 * rather than vanished.
 */

type Filter = "all" | "today" | "upcoming";

type GroupId =
  | "overdue"
  | "today"
  | "evening"
  | "attention"
  | "waiting"
  | "upcoming"
  | "undated";

type Tone = "danger" | "warning" | "accent" | "review" | "success";

type GroupSpec = {
  id: GroupId;
  title: string;
  icon: ReactNode;
  tone?: Tone;
  tasks: Task[];
  /** Shown when the group is empty; without it an empty group is silent. */
  empty?: string;
  hint?: string;
};

const SETTLE_MS = 520;
const DONE_PREVIEW = 5;
/** The page column AppPageHeader and Inbox use, class for class. */
const PAGE_COLUMN = "mx-auto w-full max-w-[1180px] px-4 md:px-8";

export function MyWeekApp({ canSetUpProject = false }: { canSetUpProject?: boolean }) {
  const personalization = usePersonalization();
  const state = useTasksState();
  const { toggleComplete } = useTasksDispatch();
  const { taskId: openTaskId, openTask } = useTaskPanel();
  const columnConfig = useColumnConfig();
  const workspace = useActiveWorkspace();
  const pack = useDomain();
  const [filter, setFilter] = useState<Filter>("all");

  const meId = useCurrentUser();
  const projectId = parseProjectId(workspace?.id);
  const tasksHref = projectId ? withActiveProject(PRODUCT_APP_PATHS.tasks, projectId) : PRODUCT_APP_PATHS.tasks;
  const projectName = pack.workspaceName?.trim() || pack.boardName || shortProjectTitle(pack.workspaceTitle);
  const description = projectName ? <>Tasks assigned to you in {projectName}.</> : <>Tasks assigned to you.</>;

  // The calendar frame is the only clock a Tasks client view may read
  // (calendar-frame.ts): SSR and hydration agree about "today", and the
  // demo stays pinned to its one anchor instead of drifting with the
  // visitor's wall clock.
  const calendar = useCalendarFrame();
  const now = useMemo(() => new Date(calendar.nowIso), [calendar.nowIso]);
  const buckets = bucketMyWeek(state.tasks, meId, now, calendar);
  // "This evening" splits out of Today only when a task carries an explicit
  // evening time. No time typed, no daypart.
  const { day: todayDay, evening } = splitTodayDayparts(buckets.today, now, calendar);
  const overdue = todayDay.filter((task) => dueOffset(task, calendar) < 0);
  const dueToday = todayDay.filter((task) => !(dueOffset(task, calendar) < 0));
  const upcoming = [...buckets.thisWeek, ...buckets.later];
  const columns = useMemo(() => resolveBoardColumns(columnConfig), [columnConfig]);

  // Nudges are computed client-side from the same task list (generateNudges
  // is pure), the proactive "what's stuck" surface folded in from the inbox.
  const nudges = useMemo(
    () => generateNudges(state.tasks, meId, columnConfig, now, calendar),
    [state.tasks, meId, columnConfig, now, calendar],
  );

  const settle = useSettlingCompletion(state.tasks, toggleComplete);

  const openCount =
    buckets.today.length +
    buckets.needsAttention.length +
    buckets.waiting.length +
    upcoming.length +
    buckets.undated.length;
  const hasAnything = openCount + buckets.doneRecently.length > 0;

  // Permission comes from this route's verified project, never from an
  // empty personal filter. The seed action independently reauthorizes it.
  if (!hasAnything && state.tasks.length === 0 && canSetUpProject) {
    return (
      <>
        <AppPageHeader description={description} />
        <EmptyStateOverlay
          ghost={<ListGhost />}
          headline={personalization.headline}
          body={personalization.body}
          primaryLabel={personalization.firstTaskExample}
          allowStarterPacks={false}
        />
      </>
    );
  }
  if (!hasAnything) {
    return (
      <>
        <AppPageHeader description={description} />
        <div className={`${styles.scroll} thin-scroll`}>
          <div className={`${styles.inner} ${PAGE_COLUMN}`}>
            <div className={styles.unassigned}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <ShellIcon.myTasks size={20} />
              </span>
              <h2 className={styles.unassignedTitle}>No tasks assigned to you yet</h2>
              <p className={styles.unassignedBody}>
                Open the project’s tasks to see what everyone is working on and where you can help.
              </p>
              <Link href={tasksHref} className={styles.buttonPrimary}>
                View project tasks
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const groups: Record<GroupId, GroupSpec> = {
    overdue: { id: "overdue", title: "Overdue", icon: <ShellIcon.alert />, tone: "danger", tasks: overdue },
    today: { id: "today", title: "Today", icon: <ShellIcon.sun />, tone: "accent", tasks: dueToday, empty: "Nothing due today." },
    evening: { id: "evening", title: "This evening", icon: <ShellIcon.moon />, tone: "review", tasks: evening },
    attention: {
      id: "attention",
      title: "Needs attention",
      icon: <ShellIcon.clock />,
      tone: "warning",
      tasks: buckets.needsAttention,
      hint: "No change in 4 days or more",
    },
    waiting: { id: "waiting", title: "In review", icon: <ReviewIcon />, tone: "review", tasks: buckets.waiting },
    upcoming: { id: "upcoming", title: "Upcoming", icon: <CalendarIcon />, tasks: upcoming, empty: "Nothing scheduled after today." },
    undated: { id: "undated", title: "No date", icon: <NoDateIcon />, tasks: buckets.undated },
  };
  const visible: GroupSpec[] =
    filter === "today"
      ? [groups.overdue, groups.today, groups.evening]
      : filter === "upcoming"
        ? [groups.upcoming]
        : [groups.overdue, groups.today, groups.evening, groups.attention, groups.waiting, groups.upcoming, groups.undated];
  const shown = visible.filter((group) => group.tasks.length > 0 || group.empty);
  const counts: Record<Filter, number> = {
    all: openCount,
    today: buckets.today.length,
    upcoming: upcoming.length,
  };

  const rowProps = {
    calendar,
    columns,
    columnConfig,
    openTaskId,
    onOpen: openTask,
  };

  return (
    <>
      <AppPageHeader
        description={description}
        // Phones get the filter above the list instead: in the title row it
        // would squeeze the description down to a few characters.
        // (Visibility sits on plain wrappers: Tailwind's layered `hidden`
        // loses to an unlayered module `display`.)
        actions={
          <span className="hidden md:inline-flex">
            <FilterControl value={filter} counts={counts} onChange={setFilter} />
          </span>
        }
      />
      <div className={`${styles.scroll} thin-scroll`}>
        <div className={`${styles.inner} ${PAGE_COLUMN}`}>
          <div className="md:hidden">
            <FilterControl value={filter} counts={counts} onChange={setFilter} className={styles.filterWide} />
          </div>
          <div className={styles.grid}>
            <section className={styles.card} aria-label="Your open tasks">
              {filter === "all" && openCount === 0 ? (
                <AllClear tasksHref={tasksHref} />
              ) : (
                shown.map((group) => (
                  <TaskGroup key={group.id} group={group}>
                    {group.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        {...rowProps}
                        checked={settle.pending.has(task.id) || isTaskDone(task, columnConfig)}
                        onToggle={() => settle.toggle(task.id)}
                      />
                    ))}
                  </TaskGroup>
                ))
              )}
            </section>

            <aside className={styles.rail} aria-label="Stuck and finished">
              <NudgesRail nudges={nudges} onOpen={openTask} />
              <DoneCard count={buckets.doneRecently.length}>
                {(limit) =>
                  buckets.doneRecently.slice(0, limit).map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      {...rowProps}
                      variant="done"
                      checked={isTaskDone(task, columnConfig)}
                      onToggle={() => toggleComplete(task.id)}
                    />
                  ))
                }
              </DoneCard>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Completion that holds the tick for a beat ───────────────────── */

/**
 * Checking an open task shows the filled circle and struck title first and
 * completes it SETTLE_MS later, so the row visibly finishes before it moves
 * to Done this week. A second click inside the beat cancels. Leaving the page
 * mid-beat still completes what was checked, and a task something else
 * completed meanwhile is never toggled back open.
 */
function useSettlingCompletion(tasks: Task[], toggleComplete: (id: string) => void) {
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; fire: () => void }>());
  const latestTasks = useRef(tasks);

  useEffect(() => {
    latestTasks.current = tasks;
  }, [tasks]);

  useEffect(() => {
    const scheduled = timers.current;
    return () => {
      for (const entry of scheduled.values()) {
        clearTimeout(entry.timer);
        entry.fire();
      }
      scheduled.clear();
    };
  }, []);

  const toggle = (id: string) => {
    const scheduled = timers.current.get(id);
    if (scheduled) {
      clearTimeout(scheduled.timer);
      timers.current.delete(id);
      setPending((prev) => withoutId(prev, id));
      return;
    }
    const task = tasks.find((item) => item.id === id);
    if (!task || task.lane === "done") {
      toggleComplete(id);
      return;
    }
    const fire = () => {
      const current = latestTasks.current.find((item) => item.id === id);
      if (current && current.lane !== "done") toggleComplete(id);
    };
    const timer = setTimeout(() => {
      timers.current.delete(id);
      fire();
      setPending((prev) => withoutId(prev, id));
    }, SETTLE_MS);
    timers.current.set(id, { timer, fire });
    setPending((prev) => new Set(prev).add(id));
  };

  return { pending, toggle };
}

function withoutId(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

/* ── Header filter ───────────────────────────────────────────────── */

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
];

function FilterControl({
  value,
  counts,
  onChange,
  className,
}: {
  value: Filter;
  counts: Record<Filter, number>;
  onChange: (next: Filter) => void;
  className?: string;
}) {
  return (
    <div className={`${styles.filter} ${className ?? ""}`} role="group" aria-label="Show tasks">
      {FILTERS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={styles.filterButton}
          aria-pressed={value === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          <span className={styles.filterCount}>{counts[item.id]}</span>
        </button>
      ))}
    </div>
  );
}

/* ── Groups and rows ─────────────────────────────────────────────── */

function TaskGroup({ group, children }: { group: GroupSpec; children: ReactNode }) {
  const headingId = `my-tasks-${group.id}`;
  return (
    <section className={styles.group} aria-labelledby={headingId} data-group={group.id}>
      <div className={styles.groupHead}>
        <span className={styles.groupIcon} data-tone={group.tone} aria-hidden="true">
          {group.icon}
        </span>
        <h2 id={headingId} className={styles.groupTitle}>
          {group.title}
        </h2>
        {group.tasks.length > 0 ? (
          <span className={styles.groupCount} data-tone={group.id === "overdue" ? "danger" : undefined}>
            {group.tasks.length}
          </span>
        ) : null}
        {group.hint && group.tasks.length > 0 ? (
          <span className={styles.groupHint}>{group.hint}</span>
        ) : null}
      </div>
      {group.tasks.length === 0 ? (
        <p className={styles.groupEmpty}>{group.empty}</p>
      ) : (
        <ul className={styles.list}>
          <AnimatePresence initial={false}>{children}</AnimatePresence>
        </ul>
      )}
    </section>
  );
}

const LANE_TONE: Partial<Record<LaneId, string>> = {
  doing: "warning",
  review: "review",
};

function TaskRow({
  task,
  checked,
  onToggle,
  onOpen,
  openTaskId,
  calendar,
  columns,
  variant = "open",
}: {
  task: Task;
  checked: boolean;
  onToggle: () => void;
  onOpen: (id: string) => void;
  openTaskId: string | null;
  calendar: CalendarFrame;
  columns: BoardColumn[];
  columnConfig: ColumnConfig | null;
  variant?: "open" | "done";
}) {
  const reduce = useReducedMotion();
  const due = variant === "open" ? dueLabel(task, calendar) : null;
  const meta = metaFor(task);
  return (
    <motion.li
      className={styles.item}
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={{ duration: reduce ? 0 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div
        className={styles.row}
        data-open={openTaskId === task.id ? "" : undefined}
        data-done={checked ? "" : undefined}
      >
        <StatusCheck lane={task.lane} checked={checked} title={task.title} onToggle={onToggle} />
        <button
          type="button"
          className={styles.open}
          data-task-id={task.id}
          onClick={() => onOpen(task.id)}
        >
          <span className={styles.rowMain}>
            <span className={styles.rowTitle}>{task.title}</span>
            {meta ? <span className={styles.rowMeta}>{meta}</span> : null}
          </span>
          {variant === "open" ? (
            <>
              <span className={styles.laneCell}>
                <span className={styles.pill} data-tone={LANE_TONE[task.lane]}>
                  {columnDisplayName(columns, effectiveColumnKey(task))}
                </span>
              </span>
              <span className={styles.due} data-overdue={due?.overdue ? "" : undefined}>
                {due ? (
                  <>
                    <span className="sr-only">{due.overdue ? "Overdue, due " : "Due "}</span>
                    {due.label}
                  </>
                ) : null}
              </span>
            </>
          ) : null}
        </button>
      </div>
    </motion.li>
  );
}

/**
 * The lane at rest (Home's circle: empty, half, three-quarters), a success
 * tick on hover, filled when done. Names are kept exactly: browser tests and
 * screen readers both find the control by them.
 */
function StatusCheck({
  lane,
  checked,
  title,
  onToggle,
}: {
  lane: LaneId;
  checked: boolean;
  title: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.check}
      data-lane={lane}
      aria-pressed={checked}
      aria-label={checked ? `Mark "${title}" not done` : `Mark "${title}" done`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <span className={styles.ring} aria-hidden="true">
        <svg className={styles.glyph} viewBox="0 0 10 10" focusable="false">
          <path d="M2 5.2 4.1 7.3 8 2.9" pathLength={1} />
        </svg>
      </span>
    </button>
  );
}

function DoneCard({ count, children }: { count: number; children: (limit: number) => ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const limit = expanded ? count : DONE_PREVIEW;
  return (
    <section className={styles.card} aria-labelledby="my-tasks-done" data-group="done">
      <div className={styles.groupHead}>
        <span className={styles.groupIcon} data-tone="success" aria-hidden="true">
          <ShellIcon.checkCircle />
        </span>
        <h2 id="my-tasks-done" className={styles.groupTitle}>
          Done this week
        </h2>
        {count > 0 ? <span className={styles.groupCount}>{count}</span> : null}
      </div>
      {count === 0 ? (
        <p className={styles.railEmpty}>Tasks you finish this week collect here.</p>
      ) : (
        <>
          <ul className={styles.list}>
            <AnimatePresence initial={false}>{children(limit)}</AnimatePresence>
          </ul>
          {count > DONE_PREVIEW ? (
            <button
              type="button"
              className={styles.more}
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Show fewer" : `Show ${count - DONE_PREVIEW} more`}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

function AllClear({ tasksHref }: { tasksHref: string }) {
  return (
    <div className={styles.clear}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <ShellIcon.checkCircle size={18} />
      </span>
      <h2 className={styles.emptyTitle}>Nothing open is assigned to you</h2>
      <p className={styles.emptyBody}>
        New tasks for you will show up here. What you finished this week is under Done this week.
      </p>
      <Link href={tasksHref} className={styles.textLink}>
        View project tasks <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

/* ── Formatting ──────────────────────────────────────────────────── */

/** Days from the frame's today to the task's due date; NaN when undated or unreadable. */
function dueOffset(task: Task, calendar: CalendarFrame): number {
  const due = task.dueAt;
  if (!due || Number.isNaN(due.getTime())) return Number.NaN;
  try {
    return calendarDaysBetween(calendar.today, calendarDateInTimeZone(due, calendar.timeZone));
  } catch {
    return Number.NaN;
  }
}

/**
 * Today, Tomorrow and Yesterday by name, weekdays within the week, a short
 * date beyond it (with the year only when it differs). Unreadable dates keep
 * the task's own label rather than inventing one.
 */
function dueLabel(task: Task, calendar: CalendarFrame): { label: string; overdue: boolean } | null {
  const offset = dueOffset(task, calendar);
  if (Number.isNaN(offset) || !task.dueAt) {
    return task.due ? { label: task.due, overdue: false } : null;
  }
  const date = calendarDateInTimeZone(task.dueAt, calendar.timeZone);
  const overdue = offset < 0;
  if (offset === 0) {
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: calendar.timeZone, hour: "numeric", hourCycle: "h23" })
        .formatToParts(task.dueAt)
        .find((part) => part.type === "hour")?.value,
    );
    // An evening task carries a real time; say it.
    if (hour >= 17) {
      return {
        label: new Intl.DateTimeFormat(calendar.locale, {
          timeZone: calendar.timeZone,
          hour: "numeric",
          minute: "2-digit",
        }).format(task.dueAt),
        overdue,
      };
    }
    return { label: "Today", overdue };
  }
  if (offset === 1) return { label: "Tomorrow", overdue };
  if (offset === -1) return { label: "Yesterday", overdue };
  if (offset > 1 && offset < 7) {
    return { label: formatCalendarDate(date, calendar.locale, { weekday: "short" }), overdue };
  }
  const sameYear = date.slice(0, 4) === calendar.today.slice(0, 4);
  return {
    label: formatCalendarDate(
      date,
      calendar.locale,
      sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" },
    ),
    overdue,
  };
}

/** Readable context under the title: label, outside contact, priority, subtasks. */
function metaFor(task: Task): ReactNode {
  const parts: ReactNode[] = [];
  const [firstTag, ...moreTags] = task.tags ?? [];
  if (firstTag) {
    parts.push(moreTags.length > 0 ? `${tagDisplayName(firstTag)} +${moreTags.length}` : tagDisplayName(firstTag));
  }
  if (task.externalContactName) parts.push(task.externalContactName);
  if (task.priority === "p0") {
    parts.push(
      <span key="priority" className={styles.urgent}>
        Urgent
      </span>,
    );
  } else if (task.priority === "p1") {
    parts.push("High priority");
  }
  if (task.subtaskCount) parts.push(`${task.subtaskDone ?? 0}/${task.subtaskCount} subtasks`);
  if (parts.length === 0) return null;
  return parts.map((part, index) => (
    <span key={index}>
      {index > 0 ? " · " : null}
      {part}
    </span>
  ));
}

/** "Q3 Launch · Plays in motion" → "Q3 Launch", as the page header names it. */
function shortProjectTitle(title: string | undefined): string {
  if (!title) return "";
  const index = title.indexOf(" · ");
  return index > 0 ? title.slice(0, index) : title;
}

/* ── Local icons (16px, 1.5 stroke, the shell family) ───────────── */

function IconSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function CalendarIcon() {
  return (
    <IconSvg>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.75h11M5.5 2v3M10.5 2v3" />
    </IconSvg>
  );
}

function NoDateIcon() {
  return (
    <IconSvg>
      <circle cx="8" cy="8" r="5.5" strokeDasharray="2.2 2.2" />
    </IconSvg>
  );
}

function ReviewIcon() {
  return (
    <IconSvg>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 8V2.5A5.5 5.5 0 1 1 2.5 8Z" fill="currentColor" stroke="none" />
    </IconSvg>
  );
}
