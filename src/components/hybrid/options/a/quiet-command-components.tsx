"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { LAB_TODAY } from "../../dates";
import { useLabStore } from "../../store";
import { STATUS_LABELS, type CalendarDate, type LabTask } from "../../types";
import { Icon } from "../../shared/icons";
import {
  AvatarStack,
  PriorityMark,
  ScheduleText,
  TaskOpenButton,
  TaskSignals,
} from "../../shared/task-ui";
import styles from "./option-a.module.css";

export function InlineTaskTitle({ task, className = "" }: { task: LabTask; className?: string }) {
  const store = useLabStore();
  const [draft, setDraft] = useState(task.title);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    if (cancelled.current) return;
    const title = draft.trim();
    if (!title) {
      setError("A task title is required");
      return;
    }
    if (title !== task.title) store.updateTitle(task.id, title);
    store.clearEditing();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelled.current = true;
      setDraft(task.title);
      setError("");
      store.clearEditing();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      commit();
    }
  };

  return (
    <span className={`${styles.inlineEdit} ${className}`}>
      <input
        aria-describedby={error ? `${task.id}-title-error` : undefined}
        aria-invalid={Boolean(error)}
        aria-label={`Edit title for ${task.title}`}
        data-task-id={task.id}
        onBlur={commit}
        onChange={(event) => { setDraft(event.target.value); setError(""); }}
        onKeyDown={onKeyDown}
        ref={inputRef}
        value={draft}
      />
      {error ? <small id={`${task.id}-title-error`} role="alert">{error}</small> : null}
    </span>
  );
}

export function TaskPeek() {
  const store = useLabStore();
  const task = store.previewId ? store.taskById(store.previewId) : undefined;
  if (!task || store.inspectedId === task.id) return null;
  return (
    <aside aria-label={`Task preview: ${task.title}`} className={styles.taskPeek}>
      <header>
        <span>Quick peek</span>
        <button aria-label="Close task preview" onClick={() => store.setPreview(null)} type="button">
          <Icon name="close" size={14} />
        </button>
      </header>
      <div className={styles.peekMeta}>
        <span className={styles.statusText} data-status={task.status}>{STATUS_LABELS[task.status]}</span>
        <PriorityMark task={task} withLabel />
        <ScheduleText task={task} />
      </div>
      <TaskOpenButton className={styles.peekTitle} task={task}>{task.title}</TaskOpenButton>
      <p>{task.description}</p>
      <footer>
        <AvatarStack task={task} limit={4} />
        <TaskSignals task={task} />
        <TaskOpenButton className={styles.peekOpen} task={task}>Open inspector</TaskOpenButton>
      </footer>
    </aside>
  );
}

function readDate(value: string): CalendarDate | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value as CalendarDate : null;
}

export function DateCommand({ task, label = "Date controls" }: { task: LabTask | undefined; label?: string }) {
  const store = useLabStore();
  const [draftSchedule, setDraftSchedule] = useState<{ taskId: string; date: CalendarDate } | null>(null);
  const draftDate = task && draftSchedule?.taskId === task.id ? draftSchedule.date : LAB_TODAY;

  if (!task) {
    return <div className={styles.dateCommandEmpty}><Icon name="calendar" size={14} />Focus a task for explicit date controls</div>;
  }

  return (
    <form aria-label={`${label} for ${task.title}`} className={styles.dateCommand} onSubmit={(event) => event.preventDefault()}>
      <div className={styles.dateCommandTask}>
        <span>{label}</span>
        <strong title={task.title}>{task.title}</strong>
      </div>
      {task.schedule.kind === "unscheduled" ? (
        <>
          <label>
            <span>Schedule on</span>
            <input
              aria-label={`Schedule ${task.title} on`}
              disabled={store.readOnly}
              onChange={(event) => { const date = readDate(event.target.value); if (date) setDraftSchedule({ taskId: task.id, date }); }}
              type="date"
              value={draftDate}
            />
          </label>
          <button disabled={store.readOnly} onClick={() => store.scheduleOn(task.id, draftDate)} type="button">Schedule</button>
        </>
      ) : null}
      {task.schedule.kind === "due" ? (
        <label>
          <span>Due</span>
          <input
            aria-label={`Due date for ${task.title}`}
            disabled={store.readOnly}
            onChange={(event) => { const dueOn = readDate(event.target.value); if (dueOn) store.scheduleTask(task.id, { kind: "due", dueOn }); }}
            type="date"
            value={task.schedule.dueOn}
          />
        </label>
      ) : null}
      {task.schedule.kind === "milestone" ? (
        <label>
          <span>Milestone</span>
          <input
            aria-label={`Milestone date for ${task.title}`}
            disabled={store.readOnly}
            onChange={(event) => { const on = readDate(event.target.value); if (on) store.scheduleTask(task.id, { kind: "milestone", on }); }}
            type="date"
            value={task.schedule.on}
          />
        </label>
      ) : null}
      {task.schedule.kind === "range" ? (
        <>
          <label>
            <span>Starts</span>
            <input
              aria-label={`Start date for ${task.title}`}
              disabled={store.readOnly}
              max={task.schedule.dueOn}
              onChange={(event) => {
                const startOn = readDate(event.target.value);
                if (startOn && task.schedule.kind === "range") {
                  store.scheduleTask(task.id, { kind: "range", startOn, dueOn: task.schedule.dueOn });
                }
              }}
              type="date"
              value={task.schedule.startOn}
            />
          </label>
          <label>
            <span>Due</span>
            <input
              aria-label={`End date for ${task.title}`}
              disabled={store.readOnly}
              min={task.schedule.startOn}
              onChange={(event) => {
                const dueOn = readDate(event.target.value);
                if (dueOn && task.schedule.kind === "range") {
                  store.scheduleTask(task.id, { kind: "range", startOn: task.schedule.startOn, dueOn });
                }
              }}
              type="date"
              value={task.schedule.dueOn}
            />
          </label>
        </>
      ) : null}
      {task.schedule.kind !== "unscheduled" ? (
        <div aria-label="Move schedule" className={styles.dateStep} role="group">
          <button aria-label={`Move ${task.title} one day earlier`} disabled={store.readOnly} onClick={() => store.moveScheduleByDays(task.id, -1)} type="button"><Icon name="arrow-left" size={14} /></button>
          <button aria-label={`Move ${task.title} one day later`} disabled={store.readOnly} onClick={() => store.moveScheduleByDays(task.id, 1)} type="button"><Icon name="arrow-right" size={14} /></button>
        </div>
      ) : null}
      {task.schedule.kind === "range" ? (
        <div aria-label="Change range end" className={styles.dateStep} role="group">
          <button disabled={store.readOnly} onClick={() => store.resizeScheduleByDays(task.id, -1)} type="button">Shorten</button>
          <button disabled={store.readOnly} onClick={() => store.resizeScheduleByDays(task.id, 1)} type="button">Extend</button>
        </div>
      ) : null}
      {task.schedule.kind !== "unscheduled" ? <button className={styles.unscheduleButton} disabled={store.readOnly} onClick={() => store.unscheduleTask(task.id)} type="button">Unschedule</button> : null}
    </form>
  );
}

export function SurfaceEmpty({ title, body, onAdd }: { title: string; body: string; onAdd?: () => void }) {
  const store = useLabStore();
  return (
    <div className={styles.surfaceEmpty}>
      <Icon name="inbox" size={20} />
      <strong>{title}</strong>
      <span>{body}</span>
      {onAdd ? <button disabled={store.readOnly} onClick={onAdd} type="button"><Icon name="add" size={14} />Add task</button> : null}
    </div>
  );
}

export function KeyboardLegend({ children }: { children: React.ReactNode }) {
  return <div className={styles.keyboardLegend}><Icon name="command" size={13} />{children}</div>;
}
