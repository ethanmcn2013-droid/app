"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { formatSchedule, formatScheduleForTask, isTaskDueToday, isTaskOverdue } from "../dates";
import { labelById, personById } from "../fixtures";
import { useLabStore } from "../store";
import { PRIORITY_LABELS, type LabTask } from "../types";
import { Icon } from "./icons";
import styles from "./shared.module.css";

export function TaskSelection({ task, orderedIds, ...props }: {
  task: LabTask;
  orderedIds: string[];
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "checked" | "onChange">) {
  const store = useLabStore();
  const checked = store.selectedIds.includes(task.id);
  return (
    <label className={styles.selectionTarget} onClick={(event) => event.stopPropagation()}>
      <input
        {...props}
        aria-label={checked ? "Deselect this task" : "Select this task"}
        checked={checked}
        className={styles.controlInput}
        disabled={store.readOnly || props.disabled}
        onChange={(event) => store.toggleSelected(task.id, orderedIds, event.nativeEvent instanceof MouseEvent && event.nativeEvent.shiftKey)}
        onClick={(event) => event.stopPropagation()}
        type="checkbox"
      />
      <span className={styles.selectionGlyph} aria-hidden="true" />
    </label>
  );
}

export function TaskOpenButton({ task, children, className, ...props }: {
  task: LabTask;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  const store = useLabStore();
  return (
    <button
      {...props}
      className={className}
      data-completed={task.completed || undefined}
      data-task-id={task.id}
      onClick={(event) => {
        event.stopPropagation();
        store.setActive(task.id);
        store.openTask(task.id);
      }}
      onFocus={() => store.setActive(task.id)}
      type="button"
    >
      {children ?? task.title}
    </button>
  );
}

export function PriorityMark({ task, withLabel = false }: { task: LabTask; withLabel?: boolean }) {
  return (
    <span className={styles.priority} data-priority={task.priority} title={`${PRIORITY_LABELS[task.priority]} priority`}>
      <span className={styles.priorityDot} />
      {withLabel ? PRIORITY_LABELS[task.priority] : <span className={styles.srOnly}>{PRIORITY_LABELS[task.priority]} priority</span>}
    </span>
  );
}

export function ScheduleText({ task, compact = false }: { task: LabTask; compact?: boolean }) {
  const calendar = useCalendarFrame();
  const overdue = isTaskOverdue(task, calendar.today);
  const dueToday = isTaskDueToday(task, calendar.today);
  // Compact is the card context, where a date the reader has to compare
  // against today is a date the reader has to do arithmetic on. The absolute
  // date stays on the tooltip so nothing is lost. The sentence is
  // task-aware (formatScheduleForTask): a completed card never reads
  // "overdue", however far past its date it finished.
  const label = compact
    ? formatScheduleForTask(task, calendar.today)
    : task.completed
      ? formatScheduleForTask(task, calendar.today)
      : formatSchedule(task.schedule);
  return (
    <span
      className={styles.schedule}
      data-due-today={dueToday || undefined}
      data-overdue={overdue || undefined}
      data-unscheduled={task.schedule.kind === "unscheduled" || undefined}
      title={task.completed ? label : formatSchedule(task.schedule)}
    >
      {task.schedule.kind === "milestone" ? <Icon name="milestone" size={compact ? 12 : 14} /> : null}
      {compact && task.schedule.kind === "unscheduled" ? "No date" : label}
    </span>
  );
}

/**
 * Completion checkbox for a task card.
 *
 * Deliberately distinct from `TaskSelection`: a checkbox on a task card
 * reads as "mark this done" everywhere else in software, and the board used
 * to spend that affordance on multi-select — which is why a completed card
 * showed a struck-through title above an empty box. Selection keeps its
 * keyboard path (Space) and its modifier-click path on the card body.
 */
export function TaskCompletion({ task, disabled, tabIndex }: { task: LabTask; disabled?: boolean; tabIndex?: number }) {
  const store = useLabStore();
  return (
    <label
      className={styles.completionTarget}
      data-completion-event={store.recentlyCompletedId === task.id || undefined}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        aria-label={task.completed ? "Reopen this task" : "Mark this task done"}
        checked={task.completed}
        className={styles.controlInput}
        disabled={disabled || store.readOnly}
        onChange={() => { if (!store.readOnly) store.toggleComplete(task.id); }}
        onClick={(event) => event.stopPropagation()}
        /* -1 on the board: the card is a composite item, so its own
           controls are reached from the card rather than each costing a
           Tab stop of their own. Everywhere else the default applies. */
        tabIndex={tabIndex}
        type="checkbox"
      />
      <span className={styles.completionGlyph} aria-hidden="true" />
    </label>
  );
}

export function AvatarStack({ task, limit = 3, showUnassigned = true }: { task: LabTask; limit?: number; showUnassigned?: boolean }) {
  const people = task.assigneeIds.map(personById).filter(Boolean);
  if (people.length === 0) return showUnassigned ? <span className={styles.unassigned}>Unassigned</span> : null;
  const visible = people.slice(0, limit);
  return (
    <span className={styles.avatarStack}>
      <span className={styles.srOnly}>Owner: {people.map((person) => person?.name).filter(Boolean).join(", ")}</span>
      {visible.map((person) => person ? (
        <span aria-hidden="true" className={styles.avatar} key={person.id} style={{ "--avatar-color": person.color } as React.CSSProperties} title={person.name}>
          {person.initials}
        </span>
      ) : null)}
      {people.length > limit ? <span aria-hidden="true" className={styles.avatarMore}>+{people.length - limit}</span> : null}
    </span>
  );
}

export function TaskSignals({ task }: { task: LabTask }) {
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.completed).length;
  return (
    <span className={styles.signals}>
      {task.subtasks.length > 0 ? <span title={`${completedSubtasks} of ${task.subtasks.length} subtasks complete`}><Icon name="check" size={13} />{completedSubtasks}/{task.subtasks.length}</span> : null}
      {task.comments.length > 0 ? <span title={`${task.comments.length} comments`}><Icon name="comment" size={13} />{task.comments.length}</span> : null}
      {task.attachments.length > 0 ? <span title={`${task.attachments.length} attachments`}><Icon name="attachment" size={13} />{task.attachments.length}</span> : null}
      {task.blockedByIds.length > 0 || task.blockerIds.length > 0 ? <span title="Has dependencies"><Icon name="dependency" size={13} />{task.blockedByIds.length + task.blockerIds.length}</span> : null}
    </span>
  );
}

export function LabelList({ task, limit = 2 }: { task: LabTask; limit?: number }) {
  const labels = task.labelIds.map(labelById).filter(Boolean);
  return (
    <span className={styles.labels}>
      {labels.slice(0, limit).map((label) => label ? <span data-tone={label.tone} key={label.id}>{label.name}</span> : null)}
      {labels.length > limit ? <span>+{labels.length - limit}</span> : null}
    </span>
  );
}

