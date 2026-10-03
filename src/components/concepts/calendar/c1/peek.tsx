"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  PERSON,
  PROJECT,
  STATUS_LABEL,
  TODAY,
  WEEKDAYS,
  covers,
  dayLoad,
  dayMonth,
  diffDays,
  isOverdue,
  isSpan,
  relativeDay,
  shortDay,
  taskOrder,
  weekday,
  type Status,
  type Task,
} from "./data";
import { AvatarStack, LoadBar, loadSentence } from "./bits";
import { Check, ClockAlert, Close, Diamond, Plus, Return, StatusGlyph } from "./icons";
import { parseSentence } from "./parse";
import styles from "./cal.module.css";

type Props = {
  date: string;
  anchor: DOMRect;
  tasks: Task[];
  focusId: string | null;
  settleId: string | null;
  onClose: () => void;
  onToggle: (id: string) => void;
  onStatus: (id: string, status: Status) => void;
  onRename: (id: string, title: string) => void;
  onAdd: (text: string, date: string) => void;
};

const WIDTH = 368;

export function DayPeek(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const here = p.tasks.filter((t) => covers(t, p.date));
  const milestones = here.filter((t) => t.milestone);
  const list = here.filter((t) => !t.milestone).sort(taskOrder);
  const load = dayLoad(here, p.date);
  const people = new Set(here.filter((t) => t.status !== "done").flatMap((t) => t.people));
  const rel = relativeDay(p.date);
  const parsed = parseSentence(draft);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const a = p.anchor;
    const side = a.right + 10 + WIDTH < vw - 12 ? "right" : "left";
    const left = side === "right" ? a.right + 10 : Math.max(12, a.left - 10 - WIDTH);
    const top = Math.min(Math.max(12, a.top - 8), vh - h - 12);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.dataset.side = side;
    el.style.visibility = "visible";
  }, [p.anchor, p.date]);

  useLayoutEffect(() => {
    const target = p.focusId ? ref.current?.querySelector<HTMLElement>(`[data-row="${p.focusId}"]`) : null;
    (target ?? ref.current)?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest" });
  }, [p.focusId, p.date]);

  return (
    <div
      ref={ref}
      className={styles.peek}
      role="dialog"
      aria-label={`${WEEKDAYS[weekday(p.date)]} ${dayMonth(p.date)}`}
      tabIndex={-1}
      style={{ left: -9999, top: 0, visibility: "hidden" }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          if (editing) setEditing(null);
          else p.onClose();
        }
      }}
    >
      <header className={styles.peekHead}>
        <div>
          <p className={styles.peekDay}>
            {WEEKDAYS[weekday(p.date)]}
            {rel ? <span className={styles.peekRel}>{rel}</span> : null}
          </p>
          <h2 className={styles.peekDate}>{dayMonth(p.date)}</h2>
        </div>
        <button type="button" className={styles.iconBtn} onClick={p.onClose} aria-label="Close day">
          <Close />
        </button>
      </header>
      <div className={styles.peekLoad}>
        <LoadBar open={load.open} />
        <span>{loadSentence(load.open, load.done, people.size)}</span>
        {people.size ? <AvatarStack people={[...people]} size={20} max={5} /> : null}
      </div>

      <div className={styles.peekBody}>
        {milestones.map((m) => (
          <div key={m.id} className={styles.peekMilestone} style={{ "--p": PROJECT[m.project].color } as CSSProperties} data-row={m.id}>
            <Diamond size={12} color="var(--p)" />
            <div>
              <strong>{m.title}</strong>
              <span>
                Milestone · {PROJECT[m.project].short}
              </span>
            </div>
          </div>
        ))}
        {list.length === 0 && milestones.length === 0 ? (
          <div className={styles.peekEmpty}>
            <p>Nothing on this day{p.date < TODAY ? "." : " yet."}</p>
            <p>{p.date < TODAY ? "Pick another day, or add something that already happened." : "Type below, or drag a task here from the list on the right."}</p>
          </div>
        ) : null}
        <ul className={styles.peekList}>
          {list.map((task) => {
            const focus = p.focusId === task.id;
            const overdue = isOverdue(task);
            const spanInfo = isSpan(task) ? `Day ${diffDays(task.start as string, p.date) + 1} of ${diffDays(task.start as string, task.end as string) + 1}` : null;
            return (
              <li
                key={task.id}
                className={styles.peekRow}
                data-row={task.id}
                tabIndex={-1}
                data-focus={focus ? "" : undefined}
                data-done={task.status === "done" ? "" : undefined}
                data-settle={p.settleId === task.id ? "" : undefined}
                style={{ "--p": PROJECT[task.project].color } as CSSProperties}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={task.status === "done"}
                  aria-label={`Done: ${task.title}`}
                  className={styles.check}
                  onClick={() => p.onToggle(task.id)}
                >
                  <Check size={12} />
                </button>
                <div className={styles.peekMain}>
                  {editing === task.id ? (
                    <input
                      className={styles.renameInput}
                      defaultValue={task.title}
                      aria-label="Task name"
                      autoFocus
                      onBlur={(e) => {
                        p.onRename(task.id, e.currentTarget.value.trim() || task.title);
                        setEditing(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                    />
                  ) : (
                    <button type="button" className={styles.peekTitle} onDoubleClick={() => setEditing(task.id)} title="Double-click to rename">
                      {task.title}
                    </button>
                  )}
                  <span className={styles.peekMeta}>
                    <span className={styles.projDot} aria-hidden />
                    {PROJECT[task.project].short}
                    {overdue ? (
                      <span className={styles.lateTag}>
                        <ClockAlert /> Late since {shortDay(task.end ?? (task.start as string))}
                      </span>
                    ) : null}
                    {spanInfo ? <span>· {spanInfo}</span> : null}
                    {task.priority === "urgent" ? <span className={styles.urgentTag}>Urgent</span> : task.priority === "high" ? <span>· High priority</span> : null}
                  </span>
                  {focus ? (
                    <div className={styles.peekDetail}>
                      {task.note ? <p>{task.note}</p> : null}
                      <div className={styles.statusRow} role="radiogroup" aria-label="Status">
                        {(["todo", "doing", "review", "blocked", "done"] as Status[]).map((s) => (
                          <button
                            key={s}
                            type="button"
                            role="radio"
                            aria-checked={task.status === s}
                            className={styles.statusOpt}
                            onClick={() => p.onStatus(task.id, s)}
                          >
                            <StatusGlyph status={s} />
                            {STATUS_LABEL[s]}
                          </button>
                        ))}
                      </div>
                      <p className={styles.peekPeople}>
                        {task.people.map((id) => PERSON[id].name).join(", ")}
                        {task.guests?.length ? ` · guests: ${task.guests.map((id) => PERSON[id].name).join(", ")}` : ""}
                      </p>
                    </div>
                  ) : null}
                </div>
                <span className={styles.peekSide}>
                  <span className={styles.srOnly}>{STATUS_LABEL[task.status]}</span>
                  <StatusGlyph status={task.status} />
                  <AvatarStack people={task.people} guests={task.guests} size={20} max={2} />
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <form
        className={styles.peekAdd}
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          p.onAdd(draft, p.date);
          setDraft("");
        }}
      >
        <Plus size={14} />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Add on ${shortDay(p.date)}`}
          aria-label={`Add a task on ${shortDay(p.date)}`}
        />
        {draft ? (
          <span className={styles.peekAddHint}>
            {parsed.date && parsed.date !== p.date ? `Goes to ${shortDay(parsed.date)}` : parsed.people.length ? parsed.people.map((id) => PERSON[id].name).join(", ") : ""}
            <Return size={13} />
          </span>
        ) : null}
      </form>
    </div>
  );
}
