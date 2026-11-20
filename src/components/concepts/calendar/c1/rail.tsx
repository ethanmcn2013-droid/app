"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  PROJECT,
  type Task,
} from "./data";
import { AvatarStack } from "./bits";
import { Grip } from "./icons";
import styles from "./cal.module.css";

type Props = {
  tasks: Task[];
  dragId: string | null;
  railOver: boolean;
  settleId: string | null;
  onDown: (e: ReactPointerEvent<HTMLElement>, task: Task) => void;
  onOpen: (task: Task) => void;
};

export function Rail({ tasks, dragId, railOver, settleId, onDown, onOpen }: Props) {
  const undated = tasks.filter((t) => !t.start);
  const draggingDated = !!dragId && !!tasks.find((t) => t.id === dragId)?.start;

  return (
    <aside className={styles.rail} aria-label="Needs a date">
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

    </aside>
  );
}
