"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { formatSchedule, isTaskOverdue } from "../dates";
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
    <input
      {...props}
      aria-label={`${checked ? "Deselect" : "Select"} ${task.title}`}
      checked={checked}
      className={styles.selectionBox}
      disabled={store.readOnly && props.disabled}
      onChange={(event) => store.toggleSelected(task.id, orderedIds, event.nativeEvent instanceof MouseEvent && event.nativeEvent.shiftKey)}
      onClick={(event) => event.stopPropagation()}
      type="checkbox"
    />
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
  return (
    <span
      className={styles.schedule}
      data-overdue={isTaskOverdue(task) || undefined}
      data-unscheduled={task.schedule.kind === "unscheduled" || undefined}
      title={formatSchedule(task.schedule)}
    >
      {task.schedule.kind === "milestone" ? <Icon name="milestone" size={compact ? 12 : 14} /> : null}
      {compact && task.schedule.kind === "unscheduled" ? "No date" : formatSchedule(task.schedule)}
    </span>
  );
}

export function AvatarStack({ task, limit = 3, showUnassigned = true }: { task: LabTask; limit?: number; showUnassigned?: boolean }) {
  const people = task.assigneeIds.map(personById).filter(Boolean);
  if (people.length === 0) return showUnassigned ? <span className={styles.unassigned}>Unassigned</span> : null;
  const visible = people.slice(0, limit);
  return (
    <span className={styles.avatarStack} aria-label={`Assigned to ${people.map((person) => person?.name).join(", ")}`}>
      {visible.map((person) => person ? (
        <span className={styles.avatar} key={person.id} style={{ "--avatar-color": person.color } as React.CSSProperties} title={person.name}>
          {person.initials}
        </span>
      ) : null)}
      {people.length > limit ? <span className={styles.avatarMore}>+{people.length - limit}</span> : null}
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

export function IconButton({ label, icon, ...props }: {
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button aria-label={label} className={styles.iconButton} title={label} type="button" {...props}>
      <Icon name={icon} size={16} />
    </button>
  );
}
