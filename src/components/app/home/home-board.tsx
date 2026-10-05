"use client";

/**
 * Home (5 October 2026): the page that opens on what needs you today.
 *
 * Home and Overview are two tabs of one place (`home-tabs.tsx`); this is the
 * Home tab. A count line, one sentence about the work that has sat longest in Waiting
 * (with a nudge when someone else holds it), then your late and due-today
 * tasks with a tick each, what is waiting to be checked and what you are
 * waiting on; beside them the next big day and every Project with how it is
 * doing. All of it is drawn from `HomeBoard`, which the server built from
 * Projects the reader can open.
 *
 * Ticking a task calls the same `toggleCompleteAction` the board uses and
 * shows what the server answered, never a guess; Undo calls it again. Nudge
 * is the same `sendNudgeAction` as the task panel and the Projects page.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { projectColor } from "@/components/shell/app-sidebar";
import { ShellIcon } from "@/components/shell/shell-icons";
import { StatusGlyph } from "@/components/tasks/atoms";
import { greetingForHour, type HomeBoard, type HomeProjectRow, type HomeRow } from "@/lib/home/home-board";
import type { ConsoleMark } from "@/lib/projects/project-console";
import { sendNudgeAction } from "@/server/actions/nudge";
import { toggleCompleteAction } from "@/server/actions/tasks";
import { HomeViewedPing } from "./home-analytics";
import { HOME_TABPANEL_ID, HomeTabs, homeTabId } from "./home-tabs";
import styles from "./home.module.css";

// ── The reader's own clock ─────────────────────────────────────────────────

const subscribeClock = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 5 * 60_000);
  return () => window.clearInterval(timer);
};

/**
 * The greeting follows the reader's own clock, wherever they are. The server
 * paints the greeting for the hour in their saved time zone; once the browser
 * loads, its local hour takes over, so "Good evening" is never said at 9am.
 */
function useGreeting(pinned: string | null, server: string): string {
  return useSyncExternalStore(
    subscribeClock,
    () => pinned ?? greetingForHour(new Date().getHours()),
    () => pinned ?? server,
  );
}

const subscribeMac = () => () => {};
function useModKey(): string {
  return useSyncExternalStore(
    subscribeMac,
    () => (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}

const INTRO_KEY = "signal:home-intro";
const INTRO_EVENT = "signal:home-intro";
const subscribeIntro = (onChange: () => void) => {
  window.addEventListener(INTRO_EVENT, onChange);
  return () => window.removeEventListener(INTRO_EVENT, onChange);
};
const readIntroHidden = () => {
  try {
    return localStorage.getItem(INTRO_KEY) === "hidden";
  } catch {
    return false;
  }
};

// ── Small parts ────────────────────────────────────────────────────────────

function StandingMark({ mark, label }: { mark: ConsoleMark; label: string }) {
  return (
    <svg className={styles.mark} data-mark={mark} width={14} height={14} viewBox="0 0 16 16" role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} focusable="false">
      {mark === "on_track" ? (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="m5.4 8.2 1.8 1.8 3.4-3.7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : mark === "at_risk" ? (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" />
        </>
      ) : mark === "past_date" ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M8 4.4v4.1M8 11.1v.3" stroke="var(--v3-surface)" strokeWidth="1.7" strokeLinecap="round" />
        </>
      ) : mark === "paused" ? (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6.4 5.6v4.8M9.6 5.6v4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2.2" />
      )}
    </svg>
  );
}

function ProjectDot({ id }: { id: string }) {
  return <span className={styles.dot} style={{ "--dot": projectColor(id) } as CSSProperties} aria-hidden="true" />;
}

const DONE_COLUMN = { key: "done", isDone: true, isSystem: true, color: "emerald" } as const;
const TODO_COLUMN = { key: "todo", isDone: false, isSystem: true, color: "neutral" } as const;

type Toast = { id: number; text: string; undo?: HomeRow };

type RowTools = {
  /** What the server last answered for a task, until the page reads again. */
  answered: Readonly<Record<string, boolean>>;
  busy: ReadonlySet<string>;
  onTick: (row: HomeRow, done: boolean) => void;
};

function TaskRow({ row, tools, tick = true, showProject }: { row: HomeRow; tools: RowTools; tick?: boolean; showProject: boolean }) {
  const done = tools.answered[row.id] ?? row.done;
  const busy = tools.busy.has(row.id);
  const column = done ? DONE_COLUMN : row.done ? TODO_COLUMN : (row.column ?? TODO_COLUMN);
  return (
    <li className={styles.row} data-done={done ? "" : undefined} data-busy={busy ? "" : undefined}>
      {tick ? (
        <button
          type="button"
          className={styles.check}
          aria-label={done ? `Mark ${row.title} not done` : `Mark ${row.title} done`}
          aria-pressed={done}
          aria-disabled={busy}
          onClick={() => {
            if (!busy) tools.onTick(row, done);
          }}
        >
          <StatusGlyph column={column} size={16} />
        </button>
      ) : (
        <span className={styles.glyph} aria-hidden="true">
          <StatusGlyph column={column} size={16} />
        </span>
      )}
      <div className={styles.rowMain}>
        <Link href={row.href} className={styles.rowTitle} prefetch={false}>
          {row.title}
        </Link>
        {showProject || row.note ? (
          <span className={styles.rowMeta}>
            {showProject ? (
              <span className={styles.rowProject}>
                <ProjectDot id={row.projectId} />
                <span className={styles.rowProjectName}>{row.projectName}</span>
              </span>
            ) : null}
            {row.note ? (
              <span className={styles.rowNote}>
                {showProject ? "· " : null}
                {row.note}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
      <span className={styles.due} data-late={!done && row.late ? "" : undefined}>
        {done ? "Done" : row.due}
      </span>
    </li>
  );
}

function Section({
  title,
  count,
  done = 0,
  more,
  empty,
  children,
}: {
  title: string;
  count: number;
  done?: number;
  more?: ReactNode;
  /** Shown when there is nothing to list. Null hides the whole section. */
  empty: string | null;
  children: ReactNode;
}) {
  const any = count + done > 0;
  if (!any && empty === null) return null;
  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.h2}>
        {title}
        <span className={styles.count}>{count}</span>
        {done > 0 ? <span className={styles.count}>· {done} done</span> : null}
      </h2>
      {any ? <ul className={styles.list}>{children}</ul> : <p className={styles.empty}>{empty}</p>}
      {more}
    </section>
  );
}

function ProjectLine({ project }: { project: HomeProjectRow }) {
  return (
    <li className={styles.projectRow}>
      <StandingMark mark={project.mark} label={project.markLabel} />
      <Link href={project.href} className={styles.rowTitle} prefetch={false}>
        {project.name}
      </Link>
      <span className={styles.projectMeta}>
        {project.word ? <span data-tone={project.tone ?? undefined}>{project.word}</span> : null}
        {project.word && (project.late > 0 || project.date) ? " · " : null}
        {project.late > 0 ? <span data-tone="late">{project.late} late</span> : null}
        {project.late > 0 && project.date ? " · " : null}
        {project.date ? <span>{project.date}</span> : null}
      </span>
    </li>
  );
}

// ── The page ───────────────────────────────────────────────────────────────

export function HomeBoardView({
  board,
  overviewHref,
  pinnedGreeting = null,
}: {
  board: HomeBoard;
  /** The Overview tab, on the Project Home was opened on. */
  overviewHref: string;
  /** Review mode runs on a fixed clock, so its greeting is fixed too. */
  pinnedGreeting?: string | null;
}) {
  const router = useRouter();
  const hello = useGreeting(pinnedGreeting, board.serverGreeting);
  const mod = useModKey();
  const introHidden = useSyncExternalStore(subscribeIntro, readIntroHidden, () => true);

  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [nudge, setNudge] = useState<"idle" | "sending" | "sent" | "limited">("idle");
  const toastSeq = useRef(0);

  // A fresh read from the server is the truth; drop what was answered before it.
  const [seenBoard, setSeenBoard] = useState(board);
  if (seenBoard !== board) {
    setSeenBoard(board);
    setAnswered({});
  }

  const say = useCallback((text: string, undo?: HomeRow) => {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, text, undo });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const tick = useCallback(
    async (row: HomeRow, wasDone: boolean, isUndo = false) => {
      if (!board.canAct) {
        say("This is a review copy, so nothing is saved.");
        return;
      }
      setBusy((current) => new Set(current).add(row.id));
      try {
        const list = await toggleCompleteAction(row.id);
        const after = list.find((task) => task.id === row.id);
        if (!after) {
          say("That did not save. Open the task to change it there.");
          return;
        }
        // Completing or reopening always lands in the board's own Done or To do.
        const nowDone = after.lane === "done";
        setAnswered((current) => ({ ...current, [row.id]: nowDone }));
        if (isUndo) setToast(null);
        else if (nowDone === wasDone && row.recurring) say("Marked done. It repeats, so it is back on your list with its next date.");
        else if (nowDone === wasDone) say("That did not save. Open the task to change it there.");
        else say(nowDone ? "Marked done" : "Marked not done", row);
      } catch {
        say("That did not save. Check your connection and try again.");
      } finally {
        setBusy((current) => {
          const next = new Set(current);
          next.delete(row.id);
          return next;
        });
      }
    },
    [board.canAct, say],
  );

  const tools: RowTools = { answered, busy, onTick: (row, done) => void tick(row, done) };

  const stuck = board.stuck;
  async function sendNudge() {
    if (!stuck?.nudge || nudge !== "idle") return;
    setNudge("sending");
    try {
      const result = await sendNudgeAction(stuck.taskId);
      if (!result.ok) {
        setNudge("idle");
        say("The reminder was not sent. Open the task to see who it is with.");
      } else if (result.nudgedCount === 0) {
        setNudge("limited");
        say(`${stuck.nudge} was already nudged today. One reminder a day at most.`);
      } else {
        setNudge("sent");
        say(`Nudged ${result.nudged.map((person) => person.name).join(" and ")}.`);
      }
    } catch {
      setNudge("idle");
      say("The reminder was not sent. Check your connection and try again.");
    }
  }

  // One create button per screen, and it is the top bar's New (founder, 5
  // October 2026), so Home has none of its own. C still starts a task: where
  // the add-task dialog is mounted it answers C itself; where it is not, this
  // takes the same route the top bar's New does.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "c" && event.key !== "C") return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      if (document.documentElement.hasAttribute("data-create-ready")) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='dialog'], [role='menu']")) return;
      event.preventDefault();
      router.push(board.newTaskHref);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, board.newTaskHref]);

  const openOf = (rows: readonly HomeRow[]) => rows.filter((row) => !(answered[row.id] ?? row.done)).length;
  const lateOpen = openOf(board.late);
  const todayOpen = openOf(board.dueToday);
  const needsYou = lateOpen + todayOpen + board.toCheck.length + board.toCheckMore;
  const several = board.projectCount > 1;
  const noProjects = board.projectCount === 0;

  return (
    <div className={`${styles.page} thin-scroll`} data-home-board="">
      <HomeViewedPing />
      <div className={styles.inner}>
        <div className={styles.tabsRow}>
          <HomeTabs current="home" overviewHref={overviewHref} />
        </div>
        <div id={HOME_TABPANEL_ID} role="tabpanel" aria-labelledby={homeTabId("home")}>
        <header className={styles.header}>
          <div className={styles.headerMain}>
            <div className={styles.titleRow}>
              <h1 className={styles.h1} data-home-greeting="">
                {board.firstName ? `${hello}, ${board.firstName}` : hello}
              </h1>
              <span className={styles.today}>{board.dateLabel}</span>
            </div>
            {noProjects ? null : (
              <p className={styles.summary}>
                <span className={styles.summaryPart}>
                  {needsYou === 0 ? (
                    "Nothing needs you today"
                  ) : (
                    <>
                      <strong>{needsYou}</strong> {needsYou === 1 ? "thing needs" : "things need"} you today
                    </>
                  )}
                </span>
                {board.lateEverywhere !== null ? (
                  <>
                    {" "}
                    <span className={styles.summaryPart}>
                      <span className={styles.sep} aria-hidden="true">{"· "}</span>
                      <Link href={board.lateHref} className={styles.summaryLink} data-late={board.lateEverywhere > 0 ? "" : undefined} prefetch={false}>
                        <strong>{board.lateEverywhere}</strong> late {board.lateWhere}
                      </Link>
                    </span>
                  </>
                ) : null}
                {board.doneThisWeek !== null ? (
                  <>
                    {" "}
                    <span className={styles.summaryPart}>
                      <span className={styles.sep} aria-hidden="true">{"· "}</span>
                      <strong>{board.doneThisWeek}</strong> done this week
                    </span>
                  </>
                ) : null}
              </p>
            )}
            {stuck ? (
              <p className={styles.stuck}>
                <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 2.5h7M4.5 13.5h7M5.25 2.5c0 3 5.5 3.25 5.5 5.5s-5.5 2.5-5.5 5.5M10.75 2.5c0 3-5.5 3.25-5.5 5.5s5.5 2.5 5.5 5.5" />
                </svg>
                <span>
                  <Link href={stuck.href} className={styles.stuckLink} prefetch={false}>
                    {stuck.title}
                  </Link>
                  {stuck.rest}{" "}
                  <span className={styles.inlineTail}>
                    {stuck.nudge ? (
                      nudge === "sent" || nudge === "limited" ? (
                        <span className={styles.inlineDone}>Nudged today</span>
                      ) : (
                        <button type="button" className={styles.inlineAction} aria-disabled={nudge === "sending"} onClick={() => void sendNudge()}>
                          Nudge {stuck.nudge}
                        </button>
                      )
                    ) : null}
                    {stuck.more > 0 ? (
                      <>
                        {stuck.nudge ? <span className={styles.inlineSep} aria-hidden="true">{" · "}</span> : null}
                        <Link href={stuck.moreHref} className={styles.inlineQuiet} prefetch={false}>
                          {stuck.more} more stuck
                        </Link>
                      </>
                    ) : null}
                  </span>
                </span>
              </p>
            ) : null}
          </div>
        </header>

        {introHidden ? null : (
          <div className={styles.intro}>
            <p>
              <strong>Home shows what needs you.</strong> Projects, Tasks and Files hold everything else, and {mod} K finds anything by name.
            </p>
            <button
              type="button"
              className={styles.introClose}
              onClick={() => {
                try {
                  localStorage.setItem(INTRO_KEY, "hidden");
                } catch {}
                window.dispatchEvent(new Event(INTRO_EVENT));
              }}
            >
              Got it
            </button>
          </div>
        )}

        {noProjects ? (
          <div className={styles.blank}>
            <h2 className={styles.blankTitle}>No projects yet</h2>
            <p className={styles.blankText}>Home fills in once there is a project with tasks in it. Start one and it shows here.</p>
            <Link href={board.projectsHref} className={styles.secondary}>
              <ShellIcon.plus size={14} />
              New project
            </Link>
          </div>
        ) : (
          <div className={styles.grid}>
            <div className={styles.col}>
              <Section title="Late" count={lateOpen} done={board.late.length - lateOpen} empty="Nothing of yours is late.">
                {board.late.map((row) => (
                  <TaskRow key={row.id} row={row} tools={tools} showProject={several} />
                ))}
              </Section>
              <Section title="Due today" count={todayOpen} done={board.dueToday.length - todayOpen} empty="Nothing of yours is due today.">
                {board.dueToday.map((row) => (
                  <TaskRow key={row.id} row={row} tools={tools} showProject={several} />
                ))}
              </Section>
              <Section
                title="Due this week"
                count={openOf(board.soon)}
                done={board.soon.length - openOf(board.soon)}
                empty={null}
                more={
                  board.soonMore > 0 ? (
                    <p className={styles.more}>
                      <Link href="/app/tasks" prefetch={false}>
                        {board.soonMore} more in Tasks
                      </Link>
                    </p>
                  ) : null
                }
              >
                {board.soon.map((row) => (
                  <TaskRow key={row.id} row={row} tools={tools} showProject={several} />
                ))}
              </Section>
              <Section
                title="Waiting to be checked"
                count={board.toCheck.length + board.toCheckMore}
                empty={null}
                more={
                  board.toCheckMore > 0 ? (
                    <p className={styles.more}>
                      <Link href="/app/tasks" prefetch={false}>
                        {board.toCheckMore} more in Tasks
                      </Link>
                    </p>
                  ) : null
                }
              >
                {board.toCheck.map((row) => (
                  <TaskRow key={row.id} row={row} tools={tools} tick={false} showProject={several} />
                ))}
              </Section>
              <Section title="You are waiting on" count={board.waiting.length} empty={null}>
                {board.waiting.map((row) => (
                  <TaskRow key={row.id} row={row} tools={tools} showProject={several} />
                ))}
              </Section>
              {board.undated > 0 ? (
                <p className={styles.footnote}>
                  <Link href={board.undatedHref} className={styles.footLink} prefetch={false}>
                    {board.undated} of your open {board.undated === 1 ? "tasks has" : "tasks have"} no date yet
                  </Link>
                </p>
              ) : null}
              {board.truncated ? <p className={styles.footnote}>There is more work than Home reads at once. Tasks has all of it.</p> : null}
            </div>

            <aside className={styles.side} aria-label="Coming up">
              {board.nextDay ? (
                <section className={styles.next} style={{ "--hue": projectColor(board.nextDay.projectId) } as CSSProperties}>
                  <p className={styles.nextKicker}>Next big day</p>
                  <h2 className={styles.nextTitle}>
                    <Link href={board.nextDay.projectHref} prefetch={false}>
                      {board.nextDay.title}
                    </Link>
                  </h2>
                  {board.nextDay.projectName ? <p className={styles.nextProject}>{board.nextDay.projectName}</p> : null}
                  <p className={styles.nextWhen}>
                    {board.nextDay.days === 0 ? (
                      <>
                        <span className={styles.nextDays}>Today</span>, {board.nextDay.dayLabel}
                      </>
                    ) : (
                      <>
                        <span className={styles.nextDays}>{board.nextDay.days}</span> {board.nextDay.days === 1 ? "day" : "days"} to go, {board.nextDay.dayLabel}
                      </>
                    )}
                  </p>
                  <div className={styles.nextFacts}>
                    <span className={styles.pill} data-mark={board.nextDay.mark}>
                      <StandingMark mark={board.nextDay.mark} label="" />
                      {board.nextDay.markLabel}
                    </span>
                    <span>
                      <strong>{board.nextDay.open}</strong> open
                    </span>
                    {board.nextDay.late > 0 ? (
                      <span className={styles.lateText}>
                        <strong>{board.nextDay.late}</strong> late
                      </span>
                    ) : null}
                  </div>
                  <div className={styles.nextLinks}>
                    <Link href={board.nextDay.timelineHref} prefetch={false}>
                      See the timeline
                    </Link>
                    <Link href={board.nextDay.tasksHref} prefetch={false}>
                      Open its tasks
                    </Link>
                  </div>
                </section>
              ) : (
                <section className={styles.nextNone}>
                  <p className={styles.nextKicker}>Next big day</p>
                  <p className={styles.nextNoneText}>
                    No big day is set. Give a project a target date, or mark a task as a big date, and the countdown shows here.
                  </p>
                  <div className={styles.nextLinks}>
                    <Link href={board.projectsHref} prefetch={false}>
                      Open Projects
                    </Link>
                  </div>
                </section>
              )}

              <section className={styles.section} aria-label="Projects">
                <h2 className={styles.h2}>
                  Projects
                  <Link href={board.projectsHref} className={styles.h2Link} prefetch={false}>
                    {board.projectCount === 1 ? "Open Projects" : `See all ${board.projectCount}`}
                  </Link>
                </h2>
                <ul className={styles.list}>
                  {board.projects.map((project) => (
                    <ProjectLine key={project.id} project={project} />
                  ))}
                </ul>
              </section>

              {board.footnote ? <p className={styles.footnote}>{board.footnote}</p> : null}
            </aside>
          </div>
        )}
        </div>
      </div>

      <div className={styles.toastSlot} role="status" aria-live="polite">
        {toast ? (
          <div className={styles.toast} key={toast.id}>
            {toast.text}
            {toast.undo ? (
              <button
                type="button"
                onClick={() => {
                  const row = toast.undo!;
                  void tick(row, answered[row.id] ?? row.done, true);
                }}
              >
                Undo
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
