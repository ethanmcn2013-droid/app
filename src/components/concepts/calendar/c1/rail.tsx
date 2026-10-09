"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  PROJECT,
  TODAY,
  addDays,
  covers,
  isOverdue,
  mondayOf,
  relativeDay,
  shortDay,
  taskOrder,
  type Task,
} from "./data";
import { AvatarStack } from "./bits";
import { Check, ClockAlert, Grip } from "./icons";
import styles from "./cal.module.css";

type Props = {
  tasks: Task[];
  dragId: string | null;
  railOver: boolean;
  settleId: string | null;
  onDown: (e: ReactPointerEvent<HTMLElement>, task: Task) => void;
  onToggle: (id: string) => void;
  onOpen: (task: Task) => void;
};

export function Rail({ tasks, dragId, railOver, settleId, onDown, onToggle, onOpen }: Props) {
  const undated = tasks.filter((t) => !t.start);
  const overdue = tasks.filter(isOverdue).sort(taskOrder);
  const weekEnd = addDays(mondayOf(TODAY), 6);
  const days: string[] = [];
  for (let d = TODAY; d <= weekEnd; d = addDays(d, 1)) days.push(d);
  const draggingDated = !!dragId && !!tasks.find((t) => t.id === dragId)?.start;

  return (
    <aside className={styles.rail} aria-label="Needs a date and this week">
      <section
        className={styles.railSection}
        data-drop-rail=""
        data-over={railOver ? "" : undefined}
        data-armed={draggingDated ? "" : undefined}
      >
        <header className={styles.railHead}>
          <h2>
            Needs a date <span className={styles.count}>{undated.length}</span>
          </h2>
          <p>{draggingDated ? "Drop here to clear the date" : "Drag onto a day to plan it"}</p>
        </header>
        {undated.length === 0 ? (
          <p className={styles.railEmpty}>Every task has a day. Nice and tidy.</p>
        ) : (
          <ul className={styles.undated}>
            {undated.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className={styles.undatedCard}
                  style={{ "--p": PROJECT[task.project].color } as CSSProperties}
                  data-lifted={dragId === task.id ? "" : undefined}
                  data-settle={settleId === task.id ? "" : undefined}
                  onPointerDown={(e) => onDown(e, task)}
                  onClick={() => onOpen(task)}
                  aria-label={`${task.title}, ${PROJECT[task.project].short}. Drag onto a day, or press Enter to put it in the add bar.`}
                >
                  <span className={styles.grip} aria-hidden>
                    <Grip size={14} />
                  </span>
                  <span className={styles.undatedText}>
                    <span className={styles.undatedTitle}>{task.title}</span>
                    <span className={styles.undatedProj}>
                      <span className={styles.projDot} aria-hidden />
                      {PROJECT[task.project].short}
                    </span>
                  </span>
                  <AvatarStack people={task.people} guests={task.guests} size={18} max={2} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.railSection}>
        <header className={styles.railHead}>
          <h2>This week</h2>
          <p>
            {shortDay(TODAY)} to {shortDay(weekEnd)}
          </p>
        </header>
        {overdue.length ? (
          <div className={styles.focusGroup}>
            <h3 className={styles.lateHead}>
              <ClockAlert /> Late · {overdue.length}
            </h3>
            <FocusList tasks={overdue} onToggle={onToggle} late />
          </div>
        ) : null}
        {days.map((d) => {
          const list = tasks.filter((t) => covers(t, d) && !t.milestone).sort(taskOrder);
          return (
            <div key={d} className={styles.focusGroup}>
              <h3>
                {relativeDay(d) ?? shortDay(d).split(" ")[0]}
                <span>{shortDay(d).split(" ").slice(1).join(" ")}</span>
              </h3>
              {list.length ? <FocusList tasks={list} onToggle={onToggle} /> : <p className={styles.railEmpty}>Nothing planned.</p>}
            </div>
          );
        })}
      </section>
    </aside>
  );
}

function FocusList({ tasks, onToggle, late }: { tasks: Task[]; onToggle: (id: string) => void; late?: boolean }) {
  return (
    <ul className={styles.focusList}>
      {tasks.map((t) => (
        <li key={t.id} data-done={t.status === "done" ? "" : undefined} style={{ "--p": PROJECT[t.project].color } as CSSProperties}>
          <button
            type="button"
            role="checkbox"
            aria-checked={t.status === "done"}
            aria-label={`Done: ${t.title}`}
            className={styles.check}
            data-small=""
            onClick={() => onToggle(t.id)}
          >
            <Check size={11} />
          </button>
          <span className={styles.focusTitle}>{t.title}</span>
          {late ? <span className={styles.lateWhen}>{shortDay(t.end ?? (t.start as string)).replace(/^\w+ /, "")}</span> : <span className={styles.projDot} aria-hidden />}
        </li>
      ))}
    </ul>
  );
}
