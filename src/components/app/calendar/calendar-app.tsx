"use client";

// Calendar — the Option B lab grammar on production machinery (T·95 lab
// parity). Month table with lab cells and task chips, paired with the
// lab's selected-day agenda pane. Production's schedule model is
// startDay offsets over a fixed five-week window, so the lab's
// month/week/agenda navigation and per-day create (which need real
// calendar dates) are deliberately absent — no dead controls. Mobile
// keeps the day-list below md; the lab specifies desktop only.

import { useCallback, useEffect, useRef, useState } from "react";
import { LANES, type Task } from "@/lib/data";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { useActiveWorkspace, usePersonalization } from "@/lib/domain-context";
import { EmptyStateOverlay } from "@/components/app/empty-state/empty-state-overlay";
import { CalendarGhost } from "@/components/app/empty-state/ghost-views";
import { useToast } from "@/components/primitives/toast";
import { Icon } from "@/components/app/room/room-icons";
import {
  RoomAvatarStack,
  ScheduleText,
  TaskCompleteBox,
  TaskSignals,
} from "@/components/app/room/room-task-ui";
import { useRoomVisibleTasks } from "@/components/app/room/room-tools-context";
import styles from "@/components/app/room/option-b.module.css";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Build a 5-week grid (35 cells). Today is row 1, col 2 (Wed).
const TODAY_INDEX = 9; // 0-indexed cell of "today"
const MONTH_DAYS = 35;

function dayLabel(i: number) {
  const num = i - 2; // offset so we land on Mon-1 etc
  if (num < 1) return ["Aug", 31 + num].join(" ");
  if (num > 31) return ["Oct", num - 31].join(" ");
  return num.toString();
}

type Cell = { i: number; tasks: Task[] };

/** Chip kind in the lab grammar: milestone > range > due. */
function chipKind(task: Task): "milestone" | "range" | "due" {
  if (task.isMilestone) return "milestone";
  if ((task.durationDays ?? 1) > 1) return "range";
  return "due";
}

// D4: workspaceId prop removed, read from DomainProvider context directly
// so calendar/page.tsx can be a sync server component (no Suspense boundary
// against the board-shaped parent loading.tsx).
export function CalendarApp() {
  const personalization = usePersonalization();
  const ws = useActiveWorkspace();
  const workspaceId = ws?.id ?? "";
  const state = useTasksState();
  const visibleTasks = useRoomVisibleTasks();
  const { taskId: openTaskId, openTask } = useTaskPanel();
  const [selectedDay, setSelectedDay] = useState(TODAY_INDEX);

  if (state.tasks.length === 0) {
    return (
      <EmptyStateOverlay
        ghost={<CalendarGhost />}
        headline={personalization.headline}
        body={personalization.body}
        primaryLabel={personalization.firstTaskExample}
      />
    );
  }

  // Map room-visible tasks to days based on startDay.
  const cells: Cell[] = Array.from({ length: MONTH_DAYS }, (_, i) => ({ i, tasks: [] }));
  for (const t of visibleTasks) {
    const start = (t.startDay ?? 0) + TODAY_INDEX;
    const dur = t.durationDays ?? 1;
    for (let d = 0; d < dur; d++) {
      const idx = start + d;
      if (idx >= 0 && idx < MONTH_DAYS) {
        cells[idx].tasks.push(t);
      }
    }
  }
  const rows = Array.from({ length: 5 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
  const maxVisible = 3;

  return (
    <section aria-label="Workspace Calendar" className={`${styles.calendarView} thin-scroll`}>
      <header className={styles.calendarToolbar}>
        <div className={styles.calendarNavigation}>
          <button
            onClick={() => setSelectedDay(TODAY_INDEX)}
            type="button"
          >
            Today
          </button>
        </div>
        <h2>This five-week window</h2>
        <SubscribeButton workspaceId={workspaceId} />
      </header>

      {/* <md: 1-col day-list (today + next 6) */}
      <div className="md:hidden">
        <DayList cells={cells} openTaskId={openTaskId} openTask={openTask} />
      </div>

      {/* ≥md: lab month table paired with the selected-day agenda */}
      <div className={`${styles.calendarWorkspace} hidden md:grid`}>
        <div className={styles.calendarPrimary}>
          <table className={styles.calendarTable}>
            <caption>
              Five-week calendar. Click a day number to read its agenda.
            </caption>
            <thead>
              <tr>
                {WEEKDAYS.map((day) => (
                  <th key={day} scope="col">
                    <span>{day}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[0].i}>
                  {row.map((cell) => {
                    const i = cell.i;
                    const isToday = i === TODAY_INDEX;
                    const isSelected = i === selectedDay;
                    const isOutsideMonth = i < 2 || i > 32;
                    const visible = cell.tasks.slice(0, maxVisible);
                    return (
                      <td
                        className={styles.calendarCell}
                        data-outside={isOutsideMonth || undefined}
                        data-selected={isSelected || undefined}
                        data-today={isToday || undefined}
                        key={i}
                        onClick={() => setSelectedDay(i)}
                      >
                        <div className={styles.calendarDayHeader}>
                          <button
                            aria-label={`Select day ${dayLabel(i)}`}
                            data-date-select="true"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDay(i);
                            }}
                            type="button"
                          >
                            {dayLabel(i)}
                          </button>
                          {isToday ? (
                            <button aria-hidden="true" tabIndex={-1} type="button">
                              Today
                            </button>
                          ) : null}
                        </div>
                        <div className={styles.calendarItems}>
                          {visible.map((task) => {
                            const kind = chipKind(task);
                            const start = (task.startDay ?? 0) + TODAY_INDEX;
                            const end = start + (task.durationDays ?? 1) - 1;
                            return (
                              <div
                                className={styles.calendarTaskWrap}
                                data-kind={kind}
                                data-range-end={kind === "range" && i === end ? "" : undefined}
                                data-range-start={kind === "range" && i === start ? "" : undefined}
                                data-selected={openTaskId === task.id || undefined}
                                data-task-id={task.id}
                                key={task.id}
                              >
                                <button
                                  aria-label={`${task.title}. ${kind === "milestone" ? "Milestone" : kind === "range" ? "Date range" : "Due"}.`}
                                  className={styles.calendarTaskChip}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDay(i);
                                    openTask(task.id);
                                  }}
                                  type="button"
                                >
                                  {kind === "milestone" ? <Icon name="milestone" size={11} /> : null}
                                  <span>{task.title}</span>
                                </button>
                              </div>
                            );
                          })}
                          {cell.tasks.length > maxVisible ? (
                            <button
                              aria-label={`Show ${cell.tasks.length - maxVisible} more tasks in the day agenda`}
                              className={styles.calendarMoreButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDay(i);
                              }}
                              type="button"
                            >
                              +{cell.tasks.length - maxVisible} more
                            </button>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DayAgenda
          cell={cells[selectedDay]}
          isToday={selectedDay === TODAY_INDEX}
          label={dayLabel(selectedDay)}
          openTask={openTask}
          openTaskId={openTaskId}
        />
      </div>
    </section>
  );
}

/**
 * The selected day as the lab's agenda pane beside the month table.
 * Dense days list everything the grid truncates behind "+N more";
 * empty days say so plainly.
 */
function DayAgenda({
  cell,
  isToday,
  label,
  openTask,
  openTaskId,
}: {
  cell: Cell | undefined;
  isToday: boolean;
  label: string;
  openTask: (id: string) => void;
  openTaskId: string | null;
}) {
  const tasks = cell?.tasks ?? [];
  const milestones = tasks.filter((t) => t.isMilestone).length;
  const waiting = tasks.filter((t) => t.lane === "review" || (t.blockedBy?.length ?? 0) > 0).length;
  // Mount-stable clock for schedule receipts.
  const [now] = useState(() => Date.now());
  return (
    <aside
      aria-label="Selected day agenda"
      className={`${styles.selectedAgenda} hidden lg:block`}
    >
      <header>
        <span>{isToday ? "Today" : "Selected day"}</span>
        <h2>{isToday ? "Today" : `Day ${label}`}</h2>
        <p>
          {tasks.length} task{tasks.length === 1 ? "" : "s"}
          {milestones > 0 ? `, ${milestones} milestone${milestones === 1 ? "" : "s"}` : ""}
          {waiting > 0 ? `, ${waiting} waiting` : ""}
        </p>
      </header>
      {tasks.length === 0 ? (
        <div className={styles.agendaEmpty}>
          <Icon name="calendar" size={18} />
          <strong>The day is open</strong>
          <p>Click a day on the grid to read its agenda.</p>
        </div>
      ) : (
        <ol className={styles.selectedAgendaList}>
          {tasks.map((task) => (
            <li data-task-id={task.id} key={task.id}>
              <article>
                <div className={styles.agendaTaskLead}>
                  <TaskCompleteBox task={task} />
                  <div>
                    <button
                      className={styles.agendaTaskTitle}
                      data-selected={openTaskId === task.id || undefined}
                      onClick={() => openTask(task.id)}
                      type="button"
                    >
                      {task.title}
                    </button>
                    <ScheduleText now={now} task={task} />
                  </div>
                  <span
                    className={styles.labels}
                    style={{ color: LANES[task.lane].ink }}
                  >
                    <span>{LANES[task.lane].name}</span>
                  </span>
                </div>
                {task.description && task.lane !== "done" ? <p>{task.description}</p> : null}
                <div className={styles.agendaTaskPeople}>
                  <RoomAvatarStack limit={4} task={task} />
                  <TaskSignals task={task} />
                </div>
                {task.blockedBy && task.blockedBy.length > 0 ? (
                  <div className={styles.agendaBlocker}>
                    <Icon name="dependency" size={13} />
                    Waiting on {task.blockedBy.length} named dependenc{task.blockedBy.length === 1 ? "y" : "ies"}
                  </div>
                ) : null}
              </article>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

/**
 * Mobile day-list: today + next 6, vertically scrollable, on the room
 * tokens. The lab specifies desktop; this keeps the mobile behavior
 * production already had, dressed in the room's quiet grammar.
 */
function DayList({
  cells,
  openTaskId,
  openTask,
}: {
  cells: Cell[];
  openTaskId: string | null;
  openTask: (id: string) => void;
}) {
  const window = cells.slice(TODAY_INDEX, TODAY_INDEX + 7);
  return (
    <ul className="space-y-2">
      {window.map((cell, idx) => {
        const isToday = idx === 0;
        const dow = DAY_SHORT[cell.i % 7];
        return (
          <li
            key={cell.i}
            className="overflow-hidden rounded-lg border border-[var(--x-task-border)] bg-[var(--x-task-raised)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--x-task-border)] px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--x-task-text-secondary)]">
                  {isToday ? "Today" : dow}
                </span>
                <span className="text-[11px] text-[var(--x-task-text-muted)]">
                  {dayLabel(cell.i)}
                </span>
              </div>
              <span className="font-mono text-[10px] tabular-nums text-[var(--x-task-text-muted)]">
                {cell.tasks.length === 0
                  ? "Empty"
                  : `${cell.tasks.length} ${cell.tasks.length === 1 ? "task" : "tasks"}`}
              </span>
            </div>
            {cell.tasks.length === 0 ? (
              <div className="px-3 py-2.5 text-[11.5px] italic text-[var(--x-task-text-muted)]">
                Nothing scheduled.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--x-task-border)]">
                {cell.tasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => openTask(task.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors hover:bg-[var(--x-task-hover)]"
                      style={{
                        background: openTaskId === task.id ? "var(--x-task-selected)" : undefined,
                      }}
                    >
                      <span className="line-clamp-1 flex-1 text-[var(--x-task-text)]">
                        {task.title}
                      </span>
                      <RoomAvatarStack limit={2} showUnassigned={false} task={task} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Calendar subscribe affordance. Surfaces a `webcal://` URL the user
 * pastes into Apple Calendar, Google Calendar, or Outlook's "Add
 * subscription" dialog. The feed itself is read-only and refreshed
 * by the client on its own cadence.
 */
function SubscribeButton({ workspaceId }: { workspaceId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState<string>("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onToggle = useCallback(() => {
    if (typeof window !== "undefined" && !url) {
      setUrl(`webcal://${window.location.host}/api/calendar/${workspaceId}`);
    }
    setOpen((v) => !v);
  }, [url, workspaceId]);

  const onCopy = useCallback(() => {
    if (!url) return;
    const finish = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
      toast("Link copied", {
        tone: "success",
        body: "Paste into Calendar's ‘Add subscription’ dialog.",
      });
    };
    const fallbackCopy = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        finish();
      } catch {
        toast("Couldn't copy the link", { tone: "warn" });
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(finish, fallbackCopy);
    } else {
      fallbackCopy();
    }
  }, [url, toast]);

  return (
    <div ref={ref} className="relative" style={{ justifySelf: "end" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icon name="dependency" size={12} />
        Sync to calendar
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Calendar subscription URL"
          className="absolute right-0 top-full z-30 mt-1.5 w-[340px] overflow-hidden rounded-lg border border-[var(--x-task-border)] bg-[var(--x-task-overlay)] p-3"
          style={{ boxShadow: "var(--x-task-shadow)" }}
        >
          <div className="text-[12.5px] font-semibold text-[var(--x-task-text)]">
            Subscribe in your calendar
          </div>
          <div className="mt-0.5 text-[11.5px] text-[var(--x-task-text-muted)]">
            A live, read-only feed of every task with a due date.
          </div>
          <div className="mt-2.5 flex items-stretch gap-1.5">
            <code className="flex-1 truncate rounded border border-[var(--x-task-border)] bg-[var(--x-task-hover)] px-2 py-1.5 font-mono text-[11px] text-[var(--x-task-text-secondary)]">
              {url}
            </code>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1 rounded border border-[var(--x-task-border)] bg-[var(--x-task-raised)] px-2 py-1 text-[11.5px] font-medium text-[var(--x-task-text-secondary)] transition-colors hover:text-[var(--x-task-text)]"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-2 text-[11px] text-[var(--x-task-text-muted)]">
            Apple Calendar, Google Calendar, Outlook all support
            webcal:// subscriptions.
          </div>
        </div>
      ) : null}
    </div>
  );
}
