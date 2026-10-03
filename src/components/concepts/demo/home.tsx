"use client";

/**
 * Home, the front door: what needs you today across the whole venue, the next
 * big day, and every project at a glance. Everything comes from the shared
 * store, so these numbers match every other surface.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { HealthSentence, PageHeader, PrimaryButton } from "../tasks/header";
import { StatusGlyph } from "../tasks/status";
import { useModKeys } from "../tasks/keys";
import { HEALTH_WORDS, HealthMark, HealthPill, healthKey } from "./health";
import { useDemoLinks } from "./links";
import {
  NOW,
  TODAY,
  VIEWER,
  awaitingApproval,
  activeProjects,
  countsFor,
  daysFromToday,
  dueToday,
  fmtDate,
  fmtDay,
  fmtDayLong,
  fmtRelative,
  forecast,
  isLate,
  lateTasks,
  myTasks,
  nextMilestone,
  personById,
  projectById,
  stuckSentence,
  waitingOnName,
  workspaceCounts,
  type Task,
} from "./store";
import { nudgeTask, undo, updateTask, useDemoStore } from "./store/client";
import styles from "./home.module.css";

const me = personById(VIEWER)!;

const INTRO_KEY = "signal:demo:home-intro";
const subscribeIntro = (onChange: () => void) => {
  window.addEventListener("signal:demo-intro", onChange);
  return () => window.removeEventListener("signal:demo-intro", onChange);
};
const readIntro = () => {
  try {
    return localStorage.getItem(INTRO_KEY) === "hidden";
  } catch {
    return false;
  }
};

function dueWords(task: Task) {
  if (!task.due) return "No date";
  if (isLate(task)) {
    const n = -daysFromToday(task.due);
    return `${n} ${n === 1 ? "day" : "days"} late`;
  }
  if (task.due === TODAY) return "Due today";
  return `Due ${fmtRelative(task.due)}`;
}

function ProjectDot({ hue }: { hue: number }) {
  return <span className={styles.dot} style={{ "--dot": `var(--v3-project-${hue})` } as CSSProperties} aria-hidden="true" />;
}

function TaskRow({ task, note }: { task: Task; note?: string }) {
  const to = useDemoLinks();
  const project = projectById(task.project);
  const late = isLate(task);
  const done = task.status === "done";
  return (
    <li className={styles.row} data-done={done || undefined}>
      <button
        type="button"
        className={styles.check}
        aria-label={done ? `Mark ${task.title} not done` : `Mark ${task.title} done`}
        aria-pressed={done}
        onClick={() =>
          updateTask(task.id, done ? { status: "todo", doneOn: undefined, since: TODAY } : { status: "done", doneOn: TODAY, since: TODAY, waitingOn: undefined })
        }
      >
        <StatusGlyph status={task.status} size={16} />
      </button>
      <div className={styles.rowMain}>
        <Link href={to.task(task.id)} className={styles.rowTitle} prefetch={false}>
          {task.title}
        </Link>
        <span className={styles.rowMeta}>
          {project ? (
            <>
              <ProjectDot hue={project.hue} />
              {project.short}
            </>
          ) : null}
          {note ? <span className={styles.rowNote}>{note}</span> : null}
        </span>
      </div>
      <span className={styles.due} data-late={late || undefined}>
        {done ? "Done" : dueWords(task)}
      </span>
    </li>
  );
}

function Section({ title, count, done = 0, show, empty, children }: { title: string; count: number; done?: number; show?: boolean; empty: string; children: React.ReactNode }) {
  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.h2}>
        {title}
        <span className={styles.count}>{count}</span>
        {done > 0 ? <span className={styles.count}>· {done} done</span> : null}
      </h2>
      {(show ?? count > 0) ? <ul className={styles.list}>{children}</ul> : <p className={styles.empty}>{empty}</p>}
    </section>
  );
}

export default function DemoHome() {
  const to = useDemoLinks();
  const router = useRouter();
  const { mod } = useModKeys();
  const introHidden = useSyncExternalStore(subscribeIntro, readIntro, () => false);
  const [toast, setToast] = useState<string | null>(null);

  const mine = useDemoStore((s) => myTasks(s));
  const ws = useDemoStore((s) => workspaceCounts(s));
  const allLate = useDemoStore((s) => lateTasks(s));
  const stuck = useDemoStore((s) => stuckSentence(s));
  const nudgedToday = useDemoStore((s) => (stuck ? s.history.some((e) => e.taskId === stuck.task.id && e.kind === "nudged" && e.on === TODAY) : false));
  const today = useDemoStore((s) => dueToday(s));
  const state = useDemoStore((s) => s);

  // Done today stays in the list, so a tick can be taken back.
  const myLate = mine.filter((t) => isLate(t) || (t.status === "done" && t.doneOn === TODAY && !!t.due && t.due < TODAY));
  const myToday = mine.filter((t) => t.due === TODAY);
  // Each task appears once: a late one stays under Late, with who it waits on.
  const myWaiting = mine.filter((t) => t.status === "waiting" && !isLate(t));
  const approvals = awaitingApproval(VIEWER);
  const needsYou = myLate.filter((t) => t.status !== "done").length + myToday.filter((t) => t.status !== "done").length + approvals.length;

  const projects = useMemo(
    () =>
      activeProjects(state)
        .filter((p) => p.date >= TODAY || p.health !== "on_track")
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((p) => ({ p, counts: countsFor(state, p.id), next: nextMilestone(p.id, state), fc: forecast(state, p.id) })),
    [state],
  );
  // The next big day is an event people turn up for, not the next job due.
  const isDay = (kind: string) => kind === "wedding" || kind === "event" || kind === "party" || kind === "market";
  const nextUp = projects.find(({ p }) => p.date >= TODAY && isDay(p.kind)) ?? projects.find(({ p }) => p.date >= TODAY) ?? projects[0];

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Ticking a box confirms with Undo, like everywhere else in the product.
  const onListClick = (event: React.MouseEvent) => {
    const button = (event.target as HTMLElement).closest("button[aria-pressed]");
    if (button?.hasAttribute("aria-pressed")) setToast(button.getAttribute("aria-pressed") === "true" ? "Marked not done" : "Marked done");
  };

  const hour = Number(NOW.slice(0, 2));
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className={styles.page}>
      <PageHeader
        title={`${hello}, ${me.first}`}
        project={<span className={styles.today}>{fmtDayLong(TODAY)}</span>}
        summary={
          <p className={styles.summary}>
            <strong>{needsYou}</strong> {needsYou === 1 ? "thing needs" : "things need"} you today
            <span className={styles.sep} aria-hidden="true">
              ·
            </span>
            <Link href={to.surface("tasks/list")} className={styles.summaryLink} prefetch={false}>
              <strong>{ws.late}</strong> late across the venue
            </Link>
            <span className={styles.sep} aria-hidden="true">
              ·
            </span>
            <strong>{ws.doneThisWeek}</strong> done this week
          </p>
        }
        actions={<PrimaryButton shortcut="N" onClick={() => router.push(to.surface("tasks/board", undefined, { new: "1" }))}>New task</PrimaryButton>}
        health={
          stuck ? (
            <HealthSentence
              kind="stuck"
              action={stuck.actionLabel}
              actionDone={nudgedToday ? "Nudged today" : undefined}
              onAction={() => {
                nudgeTask(stuck.task.id);
                setToast(`${stuck.actionLabel.replace(/^Nudge /, "Nudged ")}`);
              }}
              more={stuck.more || undefined}
              onMore={() => router.push(to.surface("tasks/board"))}
            >
              <Link href={to.task(stuck.task.id)} className={styles.stuckLink} prefetch={false}>
                {stuck.task.title}
              </Link>
              {stuck.sentence.slice(stuck.task.title.length)}
            </HealthSentence>
          ) : undefined
        }
      />

      {!introHidden ? (
        <div className={styles.intro}>
          <p>
            <strong>Home shows what needs you.</strong> Projects, Tasks and Files hold everything else, and {mod} K finds anything by name or answers a question.
          </p>
          <button
            type="button"
            className={styles.introClose}
            onClick={() => {
              try {
                localStorage.setItem(INTRO_KEY, "hidden");
              } catch {}
              window.dispatchEvent(new Event("signal:demo-intro"));
            }}
          >
            Got it
          </button>
        </div>
      ) : null}

      <div className={styles.grid}>
        <div className={styles.col} onClick={onListClick}>
          <Section title="Late" count={myLate.filter((t) => t.status !== "done").length} done={myLate.filter((t) => t.status === "done").length} show={myLate.length > 0} empty="Nothing of yours is late.">
            {myLate.map((t) => (
              <TaskRow key={t.id} task={t} note={waitingOnName(t) ? `waiting on ${waitingOnName(t)}` : undefined} />
            ))}
          </Section>
          <Section title="Due today" count={myToday.filter((t) => t.status !== "done").length} done={myToday.filter((t) => t.status === "done").length} show={myToday.length > 0} empty="Nothing of yours is due today.">
            {myToday.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </Section>
          <section className={styles.section} aria-label="Waiting on your approval">
            <h2 className={styles.h2}>
              Waiting on your approval
              <span className={styles.count}>{approvals.length}</span>
            </h2>
            {approvals.length ? (
              <ul className={styles.list}>
                {approvals.map((f) => (
                  <li key={f.id} className={styles.row}>
                    <span className={styles.fileIcon} aria-hidden="true">
                      <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
                        <path d="M3.5 1.75h5.5l3.5 3.5v9h-9z" />
                        <path d="M9 1.75v3.5h3.5" />
                      </svg>
                    </span>
                    <div className={styles.rowMain}>
                      <Link href={to.surface("files", undefined, { q: f.title })} className={styles.rowTitle} prefetch={false}>
                        {f.title}
                      </Link>
                      <span className={styles.rowMeta}>
                        {projectById(f.project)?.short} · from {personById(f.by)?.first}, {fmtDate(f.date)}
                      </span>
                    </div>
                    <span className={styles.due}>Approve</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>Nothing is waiting on your approval.</p>
            )}
          </section>
          <Section title="You are waiting on" count={myWaiting.length} empty="You are not waiting on anyone.">
            {myWaiting.map((t) => (
              <TaskRow key={t.id} task={t} note={waitingOnName(t) ? `on ${waitingOnName(t)}` : undefined} />
            ))}
          </Section>
        </div>

        <aside className={styles.side} aria-label="Coming up">
          {nextUp ? (
            <section className={styles.next} style={{ "--hue": `var(--v3-project-${nextUp.p.hue})` } as CSSProperties}>
              <p className={styles.nextKicker}>Next big day</p>
              <h2 className={styles.nextTitle}>
                <Link href={to.project(nextUp.p.id)} prefetch={false}>
                  {nextUp.p.name}
                </Link>
              </h2>
              <p className={styles.nextWhen}>
                <span className={styles.nextDays}>{daysFromToday(nextUp.p.date)}</span> days to go, {fmtDayLong(nextUp.p.date)}
              </p>
              <div className={styles.nextFacts}>
                <HealthPill health={healthKey(nextUp.p.health, nextUp.p.tooEarly)} />
                <span>
                  <strong>{nextUp.counts.open}</strong> open
                </span>
                {nextUp.counts.late ? (
                  <span className={styles.lateText}>
                    <strong>{nextUp.counts.late}</strong> late
                  </span>
                ) : null}
              </div>
              {nextUp.fc.spare !== null && nextUp.fc.finish ? (
                <p className={styles.nextNote}>
                  At this week&apos;s pace the work is done {fmtDay(nextUp.fc.finish)},{" "}
                  {nextUp.fc.spare > 0 ? `${nextUp.fc.spare} ${nextUp.fc.spare === 1 ? "day" : "days"} to spare.` : nextUp.fc.spare === 0 ? "with no time to spare." : `${-nextUp.fc.spare} days too late.`}
                </p>
              ) : null}
              <div className={styles.nextLinks}>
                <Link href={to.surface("overview")} prefetch={false}>
                  See the timeline
                </Link>
                <Link href={to.surface("tasks/board", undefined, { project: nextUp.p.id })} prefetch={false}>
                  Open its tasks
                </Link>
              </div>
            </section>
          ) : null}

          <section className={styles.section} aria-label="Projects">
            <h2 className={styles.h2}>
              Projects
              <Link href={to.surface("projects")} className={styles.h2Link} prefetch={false}>
                See all {activeProjects(state).length}
              </Link>
            </h2>
            <ul className={styles.list}>
              {projects.slice(0, 7).map(({ p, counts }) => (
                <li key={p.id} className={styles.projectRow}>
                  <HealthMark health={healthKey(p.health, p.tooEarly)} label={HEALTH_WORDS[healthKey(p.health, p.tooEarly)]} />
                  <Link href={to.project(p.id)} className={styles.rowTitle} prefetch={false}>
                    {p.name}
                  </Link>
                  <span className={styles.projectMeta}>
                    {p.health !== "on_track" || p.tooEarly ? <span className={styles.healthWord} data-health={healthKey(p.health, p.tooEarly)}>{HEALTH_WORDS[healthKey(p.health, p.tooEarly)]} · </span> : null}
                    {counts.late ? <span className={styles.lateText}>{counts.late} late · </span> : null}
                    {fmtDate(p.date)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {today.length ? (
            <p className={styles.footnote}>
              {today.length} {today.length === 1 ? "task is" : "tasks are"} due today across the team. {allLate.length} late in all.
            </p>
          ) : null}
        </aside>
      </div>

      {toast ? (
        <div className={styles.toast} role="status">
          {toast}
          <button
            type="button"
            onClick={() => {
              undo();
              setToast(null);
            }}
          >
            Undo
          </button>
        </div>
      ) : null}
    </div>
  );
}
