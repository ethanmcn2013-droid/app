"use client";

import { useState, type DragEvent } from "react";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { useLabStore } from "../../store";
import type { CalendarDate, LabTask } from "../../types";
import { Icon } from "../../shared/icons";
import { AvatarStack, PriorityMark, TaskOpenButton } from "../../shared/task-ui";
import styles from "./option-b.module.css";

function UnscheduledItem({ task, source }: { task: LabTask; source: "timeline-tray" | "calendar" }) {
  const store = useLabStore();
  const calendar = useCalendarFrame();
  const [date, setDate] = useState<CalendarDate>(
    () => calendar.today as CalendarDate,
  );
  const startDrag = (event: DragEvent<HTMLElement>) => {
    if (store.readOnly) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/x-signal-task", task.id);
    event.dataTransfer.setData("application/x-signal-schedule-operation", "schedule");
    store.setDrag({ kind: "schedule", taskId: task.id, source, targetDate: null });
  };
  return (
    <article
      aria-label={`Unscheduled task: ${task.title}`}
      className={styles.trayTask}
      data-task-id={task.id}
      data-unscheduled-task-id={task.id}
      draggable={!store.readOnly}
      onDragEnd={() => store.setDrag(null)}
      onDragStart={startDrag}
    >
      <div className={styles.trayTaskTop}>
        <PriorityMark task={task} />
        <AvatarStack limit={2} task={task} />
      </div>
      <TaskOpenButton className={styles.trayTaskTitle} task={task} />
      <p>{task.description}</p>
      <div className={styles.trayScheduleForm}>
        <label>
          <span className={styles.srOnly}>Schedule {task.title} on</span>
          <input
            aria-label={`Schedule date for ${task.title}`}
            disabled={store.readOnly}
            onChange={(event) => setDate(event.target.value as CalendarDate)}
            type="date"
            value={date}
          />
        </label>
        <button disabled={store.readOnly} onClick={() => store.scheduleOn(task.id, date)} type="button">
          <Icon name="calendar" size={14} />Schedule
        </button>
      </div>
    </article>
  );
}

export function UnscheduledTray({ tasks, source, compact = false }: {
  tasks: LabTask[];
  source: "timeline-tray" | "calendar";
  compact?: boolean;
}) {
  return (
    <section aria-label="Unscheduled tasks" className={`${styles.unscheduledTray} ${compact ? styles.unscheduledTrayCompact : ""}`}>
      <header>
        <div>
          <span>Unscheduled</span>
          <strong>{tasks.length} task{tasks.length === 1 ? "" : "s"} need a date</strong>
        </div>
        <p>Nothing is placed on the plan until you choose a date.</p>
      </header>
      {tasks.length === 0 ? (
        <div className={styles.trayEmpty}><Icon name="check" size={16} />Every visible task has an explicit schedule.</div>
      ) : (
        <div className={styles.trayTaskList}>
          {tasks.map((task) => <UnscheduledItem key={task.id} source={source} task={task} />)}
        </div>
      )}
    </section>
  );
}
