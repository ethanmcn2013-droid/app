"use client";

import s from "./ledger.module.css";
import {
  ME,
  PEOPLE,
  STATUS_LABEL,
  capFirst,
  daysFromToday,
  fmtAgo,
  fmtDaysCount,
  dayDate as fmtDay,
  fmtShort,
  type Activity,
  type LinkRef,
  type Milestone,
  roleOf,
  type PersonId,
  type Project,
  type StatusChange,
  type Task,
} from "./data";
import { Avatar, Icon, MilestoneWhen, StatusGlyph } from "./parts";

const who = (id: PersonId) => (id === ME ? "you" : (PEOPLE[id]?.short ?? id));

/**
 * Health over time, newest first, with real dates from the store's project
 * history: "At risk since Thu 24 Sep · Aoife: Final numbers and the marquee
 * sides are late." Older steps read "Off track, Wed 23 Sep · Tomás". `limit`
 * keeps the newest few, with "Show all" when there are more.
 */
export function StatusHistory({ history, limit, now = true }: { history: StatusChange[]; limit?: number; now?: boolean }) {
  const all = [...history].reverse();
  const items = limit ? all.slice(0, limit) : all;
  return (
    <ol className={s.history}>
      {items.map((h, i) => {
        const current = now && i === 0;
        const word = STATUS_LABEL[h.status];
        const by = h.by === ME ? "you" : (PEOPLE[h.by]?.short ?? h.by);
        return (
          <li key={`${h.date}-${i}`} className={s.historyItem} data-first={i === 0 || undefined} data-now={current || undefined}>
            <span className={s.historyDot} data-status={h.status}>
              <StatusGlyph status={h.status} />
            </span>
            <div className={s.historyBody}>
              <p className={s.historyLine}>
                <span className={s.historyStatus} data-status={h.status}>
                  {h.kind === "start" && !current ? "Started" : word}
                </span>{" "}
                <span className={s.historyMeta}>
                  {current && h.status !== "wrapped" ? "since " : h.kind === "reason" && !current ? "reason updated " : ""}
                  <time dateTime={h.date}>{fmtDay(h.date)}</time> · {capFirst(by)}
                </span>
              </p>
              {h.reason && <p className={s.historyReason}>{h.reason}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Open tasks, late first, then by date. */
export function nextUp(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => t.state !== "done")
    .sort((a, b) => Number(b.late) - Number(a.late) || (a.due ?? "9999").localeCompare(b.due ?? "9999"));
}

export function TaskList({ tasks, limit = 5 }: { tasks: Task[]; limit?: number }) {
  const open = nextUp(tasks);
  if (!open.length) return <p className={s.muted}>{tasks.length ? "Every task is done." : "No tasks yet."}</p>;
  return (
    <ul className={s.taskList}>
      {open.slice(0, limit).map((t) => {
        const n = t.due ? daysFromToday(t.due) : null;
        return (
          <li key={t.id} className={s.taskItem}>
            <span className={s.taskRing} aria-hidden="true" />
            <span className={s.taskTitle}>{t.title}</span>
            <span className={s.taskDue} data-late={t.late || undefined} data-soon={(n !== null && n >= 0 && n <= 2) || undefined}>
              {t.late && n !== null ? `${fmtDaysCount(-n)} late` : t.state === "waiting" && t.waitingOn ? `Waiting on ${t.waitingOn}` : t.due ? fmtShort(t.due) : "No date"}
            </span>
            <Avatar who={t.who} size={18} />
          </li>
        );
      })}
    </ul>
  );
}

export function MilestoneList({ milestones, onToggle }: { milestones: Milestone[]; onToggle?: (id: string) => void }) {
  return (
    <ol className={s.msList}>
      {milestones.map((m) => {
        const late = !m.done && daysFromToday(m.date) < 0;
        return (
          <li key={m.id} className={s.msItem} data-done={m.done || undefined} data-late={late || undefined}>
            {onToggle ? (
              <button
                type="button"
                className={s.msCheck}
                role="checkbox"
                aria-checked={m.done}
                aria-label={`${m.name}, ${m.done ? "done" : "not done"}`}
                onClick={() => onToggle(m.id)}
              >
                {m.done && <Icon.check size={12} />}
              </button>
            ) : (
              <span className={s.msCheck} data-done={m.done || undefined} aria-hidden="true">
                {m.done && <Icon.check size={12} />}
              </span>
            )}
            <span className={s.msName}>{m.name}</span>
            <MilestoneWhen m={m} className={s.msDate} />
          </li>
        );
      })}
    </ol>
  );
}

export function PeopleList({ project }: { project: Project }) {
  return (
    <ul className={s.peopleList}>
      {project.people.map((p) => (
        <li key={p} className={s.personItem}>
          <Avatar who={p} size={24} />
          <span className={s.personName}>{PEOPLE[p]?.short}</span>
          <span className={s.personRole}>{roleOf(project, p)}</span>
        </li>
      ))}
    </ul>
  );
}

export function LinkList({ links }: { links: LinkRef[] }) {
  if (!links.length) return <p className={s.muted}>No files yet.</p>;
  return (
    <ul className={s.linkList}>
      {links.slice(0, 5).map((l) => (
        <li key={l.id}>
          <span className={s.linkItem}>
            <span className={s.linkIcon} data-kind={l.kind}>
              <Icon.doc size={12} />
            </span>
            <span className={s.linkLabel}>{l.label}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ActivityList({ activity, limit = 4 }: { activity: Activity[]; limit?: number }) {
  return (
    <ul className={s.actList}>
      {activity.slice(0, limit).map((a) => (
        <li key={a.id} className={s.actItem} data-kind={a.kind}>
          <Avatar who={a.who} size={20} />
          <div className={s.actBody}>
            <p className={s.actText}>
              <strong>{capFirst(who(a.who))}</strong>{" "}
              {a.kind === "status" ? (
                <>
                  posted an update: <span className={s.actQuote}>{a.text}</span>
                </>
              ) : (
                a.text.charAt(0).toLowerCase() + a.text.slice(1)
              )}
            </p>
            <span className={s.actWhen}>{capFirst(fmtAgo(a.date))}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
