"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { LANES, type Task } from "@/lib/data";
import { Avatar, AvatarStack } from "@/components/showcase/avatar";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { useActiveWorkspace, usePersonalization } from "@/lib/domain-context";
import { EmptyStateOverlay } from "@/components/app/empty-state/empty-state-overlay";
import { CalendarGhost } from "@/components/app/empty-state/ghost-views";
import { useToast } from "@/components/primitives/toast";

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Build a 5-week grid (35 cells). Today is row 1, col 2 (Wed).
const TODAY_INDEX = 9; // 0-indexed cell of "today"
const MONTH_DAYS = 35;

function dayLabel(i: number) {
  // Days 1..31 mapped, with -, day, etc
  const num = i - 2; // offset so we land on Mon-1 etc
  if (num < 1) return ["Aug", 31 + num].join(" "); // prev-month tail
  if (num > 31) return ["Oct", num - 31].join(" ");
  return num.toString();
}

// D4: workspaceId prop removed, read from DomainProvider context directly
// so calendar/page.tsx can be a sync server component (no Suspense boundary
// against the board-shaped parent loading.tsx).
export function CalendarApp() {
  const personalization = usePersonalization();
  const ws = useActiveWorkspace();
  const workspaceId = ws?.id ?? "";
  const state = useTasksState();
  const { taskId: openTaskId, openTask } = useTaskPanel();
  // Editorial Project Room (Option B): the month grid pairs with a
  // selected-day agenda so a dense day never hides work behind "+N more".
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

  // Map tasks to days based on startDay
  const cells: { i: number; tasks: Task[] }[] = Array.from(
    { length: MONTH_DAYS },
    (_, i) => ({ i, tasks: [] }),
  );
  for (const t of state.tasks) {
    const start = (t.startDay ?? 0) + TODAY_INDEX;
    const dur = t.durationDays ?? 1;
    for (let d = 0; d < dur; d++) {
      const idx = start + d;
      if (idx >= 0 && idx < MONTH_DAYS) {
        cells[idx].tasks.push(t);
      }
    }
  }

  return (
    <div className="thin-scroll flex-1 overflow-auto px-4 py-4 md:px-8 md:py-5">
      <div className="mb-3 flex items-center justify-end">
        <SubscribeButton workspaceId={workspaceId} />
      </div>

      {/* <md: 1-col day-list (today + next 6) */}
      <div className="md:hidden">
        <DayList cells={cells} openTaskId={openTaskId} openTask={openTask} />
      </div>

      {/* ≥md: full 7-col month grid, paired with the selected-day agenda */}
      <div className="hidden gap-4 md:grid lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="overflow-hidden rounded-xl border border-line-soft bg-white">
        <div className="grid grid-cols-7 border-b border-line-soft bg-bg-sunken/40 text-[11px] font-semibold uppercase tracking-wider text-ink-quiet">
          {DAYS_OF_WEEK.map((d) => (
            <div
              key={d}
              className={
                "border-r border-line-soft/60 px-3 py-2 last:border-r-0 " +
                (d === "Sat" || d === "Sun" ? "text-ink-quiet" : "")
              }
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 grid-rows-5">
          {cells.map((cell, i) => {
            const isToday = i === TODAY_INDEX;
            const isSelected = i === selectedDay;
            const isWeekend = i % 7 === 5 || i % 7 === 6;
            const isOutsideMonth = i < 2 || i > 32;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: (i % 7) * 0.02 }}
                onClick={() => setSelectedDay(i)}
                className={
                  "min-h-[120px] cursor-pointer border-b border-r border-line-soft/60 p-1.5 last:border-r-0 " +
                  (isWeekend ? "bg-bg-sunken/30 " : "") +
                  (isOutsideMonth ? "opacity-50 " : "")
                }
                style={{
                  background: isToday ? "var(--brand-soft)" : undefined,
                  outline: isToday
                    ? "1.5px solid var(--brand)"
                    : isSelected
                      ? "1.5px dashed var(--brand)"
                      : undefined,
                  outlineOffset: -1.5,
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={
                      "text-[11.5px] font-medium " +
                      (isToday
                        ? "text-brand"
                        : isOutsideMonth
                          ? "text-ink-faint"
                          : "text-ink-soft")
                    }
                  >
                    {dayLabel(i)}
                  </span>
                  {isToday ? (
                    <span className="rounded bg-brand px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
                      Today
                    </span>
                  ) : null}
                </div>

                <div className="mt-1 flex flex-col gap-1">
                  {cell.tasks.slice(0, 3).map((task) => {
                    const lane = LANES[task.lane];
                    const isOpen = openTaskId === task.id;
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDay(i);
                          openTask(task.id);
                        }}
                        className="flex min-h-[24px] cursor-pointer items-center gap-1 truncate rounded border-l-[2.5px] bg-white/90 px-1.5 py-1 text-left text-[10.5px] transition-colors hover:bg-white"
                        style={{
                          borderLeftColor: lane.dot,
                          outline: isOpen
                            ? "1.5px solid var(--brand)"
                            : "none",
                          outlineOffset: -1,
                          background: isOpen
                            ? "var(--brand-soft)"
                            : undefined,
                        }}
                      >
                        <Avatar user={task.assignees[0]} size={11} />
                        <span className="truncate">{task.title}</span>
                      </button>
                    );
                  })}
                  {cell.tasks.length > 3 ? (
                    <span className="px-1.5 text-[10px] text-ink-quiet">
                      +{cell.tasks.length - 3} more
                    </span>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Selected-day editorial agenda (Option B): the full day, no
          overflow truncation, plus the day's context in plain words. */}
      <DayAgenda
        cell={cells[selectedDay]}
        isToday={selectedDay === TODAY_INDEX}
        label={dayLabel(selectedDay)}
        openTask={openTask}
        openTaskId={openTaskId}
      />
      </div>
    </div>
  );
}

/**
 * The selected day as an editorial agenda beside the month grid. Dense
 * days list everything the grid truncates behind "+N more"; empty days
 * say so plainly. Desktop-wide only (lg:), the mobile day-list already
 * plays this role below md.
 */
function DayAgenda({
  cell,
  isToday,
  label,
  openTask,
  openTaskId,
}: {
  cell: { i: number; tasks: Task[] } | undefined;
  isToday: boolean;
  label: string;
  openTask: (id: string) => void;
  openTaskId: string | null;
}) {
  const tasks = cell?.tasks ?? [];
  const done = tasks.filter((t) => t.lane === "done").length;
  return (
    <aside
      aria-label="Selected day agenda"
      className="hidden h-fit rounded-xl border border-line-soft bg-white p-4 lg:block"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-quiet">
          {isToday ? "Today" : "Selected day"}
        </span>
        <span className="font-mono text-[11px] text-ink-quiet">{label}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="mt-3 text-[12px] leading-relaxed text-ink-quiet">
          Nothing scheduled. Click a day on the grid to read its agenda.
        </p>
      ) : (
        <>
          <p className="mt-1.5 text-[11px] text-ink-quiet">
            {tasks.length} task{tasks.length === 1 ? "" : "s"}
            {done > 0 ? ` · ${done} done` : ""}
          </p>
          <ol className="mt-2.5 flex flex-col gap-1">
            {tasks.map((task) => {
              const lane = LANES[task.lane];
              const isOpen = openTaskId === task.id;
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => openTask(task.id)}
                    className="flex w-full items-start gap-2 rounded-md border-l-[2.5px] px-2 py-1.5 text-left transition-colors hover:bg-bg-sunken/50"
                    style={{
                      borderLeftColor: lane.dot,
                      background: isOpen ? "var(--brand-soft)" : undefined,
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={
                          "block truncate text-[12px] font-medium " +
                          (task.lane === "done"
                            ? "text-ink-quiet line-through"
                            : "text-ink")
                        }
                      >
                        {task.title}
                      </span>
                      {task.description && task.lane !== "done" ? (
                        <span className="mt-0.5 block truncate text-[10.5px] text-ink-quiet">
                          {task.description}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className="mt-0.5 flex-shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase"
                      style={{ color: lane.ink, background: lane.bg }}
                    >
                      {lane.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </aside>
  );
}

/**
 * Mobile day-list: today + next 6, vertically scrollable. Each day card
 * shows label + tasks (or a quiet "Nothing scheduled."). Today gets the
 * brand accent; days with zero tasks dim down so the grid still has rhythm.
 */
function DayList({
  cells,
  openTaskId,
  openTask,
}: {
  cells: { i: number; tasks: Task[] }[];
  openTaskId: string | null;
  openTask: (id: string) => void;
}) {
  // Today is at TODAY_INDEX (=9). Show today + next 6.
  const window = cells.slice(TODAY_INDEX, TODAY_INDEX + 7);
  const dayShortNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <ul className="space-y-2">
      {window.map((cell, idx) => {
        const isToday = idx === 0;
        const dow = dayShortNames[cell.i % 7];
        return (
          <motion.li
            key={cell.i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.32,
              delay: idx * 0.03,
              ease: [0.16, 1, 0.3, 1],
            }}
            className={
              "overflow-hidden rounded-xl border bg-white " +
              (isToday ? "border-brand/40" : "border-line-soft")
            }
            style={
              isToday ? { background: "var(--brand-soft)" } : undefined
            }
          >
            <div className="flex items-center justify-between border-b border-line-soft/60 px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span
                  className={
                    "text-[12.5px] font-semibold uppercase tracking-wider " +
                    (isToday ? "text-brand" : "text-ink-soft")
                  }
                >
                  {isToday ? "Today" : dow}
                </span>
                <span className="text-[12px] text-ink-quiet">
                  {dayLabel(cell.i)}
                </span>
              </div>
              <span className="text-[11px] tabular-nums text-ink-quiet">
                {cell.tasks.length === 0
                  ? "Empty"
                  : `${cell.tasks.length} ${cell.tasks.length === 1 ? "task" : "tasks"}`}
              </span>
            </div>
            {cell.tasks.length === 0 ? (
              <div className="px-3 py-2.5 text-[12px] italic text-ink-faint">
                Nothing scheduled. Lovely.
              </div>
            ) : (
              <ul className="divide-y divide-line-soft/60">
                {cell.tasks.map((task) => {
                  const lane = LANES[task.lane];
                  const isOpen = openTaskId === task.id;
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => openTask(task.id)}
                        className="flex w-full items-center gap-2 border-l-[3px] bg-white/85 px-3 py-2 text-left text-[13px] transition-colors hover:bg-white"
                        style={{
                          borderLeftColor: lane.dot,
                          background: isOpen
                            ? "var(--brand-soft)"
                            : undefined,
                        }}
                      >
                        <span className="line-clamp-1 flex-1 text-ink">
                          {task.title}
                        </span>
                        <AvatarStack users={task.assignees} size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.li>
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
 *
 * The URL is built lazily once the popover opens, `window.location`
 * isn't available during SSR, so we defer until the click.
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
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(finish, () => {
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
      });
    } else {
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
    }
  }, [url, toast]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md border border-line-soft bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 11a9 9 0 0 1 9 9" />
          <path d="M4 4a16 16 0 0 1 16 16" />
          <circle cx="5" cy="19" r="1" />
        </svg>
        Sync to calendar
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Calendar subscription URL"
          className="absolute right-0 top-full z-30 mt-1.5 w-[340px] overflow-hidden rounded-lg border border-line-soft bg-white p-3 shadow-[0_18px_40px_-18px_rgba(20,21,26,0.22)]"
        >
          <div className="text-[12.5px] font-semibold text-ink">
            Subscribe in your calendar
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink-quiet">
            A live, read-only feed of every task with a due date.
          </div>
          <div className="mt-2.5 flex items-stretch gap-1.5">
            <code className="flex-1 truncate rounded border border-line-soft bg-bg-sunken/60 px-2 py-1.5 font-mono text-[11px] text-ink-soft">
              {url}
            </code>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1 rounded border border-line-soft bg-white px-2 py-1 text-[11.5px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-2 text-[11px] text-ink-quiet">
            Apple Calendar, Google Calendar, Outlook all support
            webcal:// subscriptions.
          </div>
        </div>
      ) : null}
    </div>
  );
}
