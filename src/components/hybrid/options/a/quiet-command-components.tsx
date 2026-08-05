"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { focusTask } from "./quiet-command-model";
import { useLabStore } from "../../store";
import { type CalendarDate, type LabTask } from "../../types";
import { Icon } from "../../shared/icons";
import styles from "./option-a.module.css";

export function InlineTaskTitle({ task, className = "" }: { task: LabTask; className?: string }) {
  const store = useLabStore();
  const [draft, setDraft] = useState(task.title);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  // Where F2 came from. A keyboard commit must land back on the row/card
  // it edited — the input used to unmount and drop focus to <body>,
  // breaking the arrow-key loop mid-flight.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const restoreFocus = () => {
    const origin = returnFocusRef.current;
    window.requestAnimationFrame(() => {
      const fallback = document.querySelector<HTMLElement>(
        `[data-task-id="${CSS.escape(task.id)}"]`,
      );
      const target = origin?.isConnected ? origin : fallback;
      target?.focus({ preventScroll: true });
    });
  };

  // `viaKeyboard`: only Enter/Escape pull focus back. A commit caused by
  // clicking elsewhere (blur) must not yank the pointer user's focus.
  const commit = (viaKeyboard: boolean) => {
    if (cancelled.current) return;
    const title = draft.trim();
    if (!title) {
      setError("A task title is required");
      return;
    }
    if (title !== task.title) store.updateTitle(task.id, title);
    store.clearEditing();
    // F2 editing must hand focus back to the card it came from, or the
    // advertised arrow-key model dead-ends after every rename.
    focusTask(task.id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelled.current = true;
      setDraft(task.title);
      setError("");
      store.clearEditing();
      focusTask(task.id);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      commit(true);
    }
  };

  return (
    <span className={`${styles.inlineEdit} ${className}`}>
      <input
        aria-describedby={error ? `${task.id}-title-error` : undefined}
        aria-invalid={Boolean(error)}
        aria-label={`Edit title for ${task.title}`}
        data-task-id={task.id}
        onBlur={() => commit(false)}
        onChange={(event) => { setDraft(event.target.value); setError(""); }}
        onKeyDown={onKeyDown}
        ref={inputRef}
        value={draft}
      />
      {error ? <small id={`${task.id}-title-error`} role="alert">{error}</small> : null}
    </span>
  );
}

function readDate(value: string): CalendarDate | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value as CalendarDate : null;
}

export function DateCommand({ task, label = "Date controls" }: { task: LabTask | undefined; label?: string }) {
  const store = useLabStore();
  const calendar = useCalendarFrame();
  const [draftSchedule, setDraftSchedule] = useState<{ taskId: string; date: CalendarDate } | null>(null);
  const draftDate = task && draftSchedule?.taskId === task.id
    ? draftSchedule.date
    : calendar.today as CalendarDate;

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
      {onAdd && !store.readOnly ? <button onClick={onAdd} type="button"><Icon name="add" size={14} />Add task</button> : null}
    </div>
  );
}

