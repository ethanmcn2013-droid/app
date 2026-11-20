"use client";

import s from "./ledger.module.css";
import {
  PEOPLE,
  STATUS_LABEL,
  daysFromToday,
  fmtAgo,
  fmtDate,
  fmtShort,
  type Activity,
  type LinkRef,
  type Milestone,
  type PersonId,
  type StatusChange,
  type Task,
} from "./data";
import { Avatar, Icon, MilestoneWhen, StatusGlyph } from "./parts";

export function StatusHistory({ history }: { history: StatusChange[] }) {
  const items = [...history].reverse();
  return (
    <ol className={s.history}>
      {items.map((h, i) => (
        <li key={`${h.date}-${i}`} className={s.historyItem} data-first={i === 0 || undefined}>
          <span className={s.historyDot} data-status={h.status}>
            <StatusGlyph status={h.status} />
          </span>
          <div className={s.historyBody}>
            <div className={s.historyTop}>
              <span className={s.historyStatus} data-status={h.status}>
                {STATUS_LABEL[h.status]}
              </span>
              <span className={s.historyMeta}>
                {fmtDate(h.date)} by {PEOPLE[h.by].short}
              </span>
            </div>
            {h.reason && <p className={s.historyReason}>{h.reason}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) return <p className={s.muted}>No open tasks.</p>;
  return (
    <ul className={s.taskList}>
      {tasks.slice(0, 5).map((t) => {
        const n = daysFromToday(t.due);
        return (
          <li key={t.id} className={s.taskItem}>
            <span className={s.taskRing} aria-hidden="true" />
            <span className={s.taskTitle}>{t.title}</span>
            <span className={s.taskDue} data-late={n < 0 || undefined} data-soon={(n >= 0 && n <= 2) || undefined}>
              {n < 0 ? `${-n} ${n === -1 ? "day" : "days"} late` : fmtShort(t.due)}
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

export function PeopleList({ people, owner }: { people: PersonId[]; owner: PersonId }) {
  return (
    <ul className={s.peopleList}>
      {people.map((p) => (
        <li key={p} className={s.personItem}>
          <Avatar who={p} size={24} />
          <span className={s.personName}>{PEOPLE[p].short}</span>
          <span className={s.personRole}>{p === owner ? "Owner" : PEOPLE[p].role}</span>
        </li>
      ))}
    </ul>
  );
}

export function LinkList({ links }: { links: LinkRef[] }) {
  return (
    <ul className={s.linkList}>
      {links.map((l) => (
        <li key={l.label}>
          <button type="button" className={s.linkItem}>
            <span className={s.linkIcon} data-kind={l.kind}>
              {l.kind === "link" ? <Icon.link size={12} /> : <Icon.doc size={12} />}
            </span>
            <span className={s.linkLabel}>{l.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ActivityList({ activity, limit = 4 }: { activity: Activity[]; limit?: number }) {
  return (
    <ul className={s.actList}>
      {[...activity]
        .sort((a, b) => a.minsAgo - b.minsAgo)
        .slice(0, limit)
        .map((a) => (
          <li key={a.id} className={s.actItem} data-kind={a.kind}>
            <Avatar who={a.who} size={20} />
            <div className={s.actBody}>
              <p className={s.actText}>
                <strong>{PEOPLE[a.who].short}</strong>{" "}
                {a.kind === "status" ? (
                  <>
                    posted an update: <span className={s.actQuote}>{a.text}</span>
                  </>
                ) : (
                  a.text.charAt(0).toLowerCase() + a.text.slice(1)
                )}
              </p>
              <span className={s.actWhen}>{fmtAgo(a.minsAgo)}</span>
            </div>
          </li>
        ))}
    </ul>
  );
}
