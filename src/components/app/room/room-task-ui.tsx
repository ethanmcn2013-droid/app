"use client";

/**
 * Room task grammar — the lab's shared task-ui adapted to the
 * production Task shape (T·95 lab parity). Same classes, same
 * proportions; the data underneath is real:
 *
 *   checkbox   completes the task (production's one-click done, the
 *              lab's multi-select has no production counterpart)
 *   priority   p0→urgent · p1→high · p2→medium · p3→low dot tones
 *   schedule   due / overdue / no date from the live store
 *   avatars    muted-wash initials from the workspace user registry
 *   signals    comments · dependencies (subtask receipts live in the
 *              detail panel; the board keeps the quiet counts)
 *   labels     production tags, quiet neutral tone
 */

import { PRIORITY_LABEL, USERS, type Priority, type Task } from "@/lib/data";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import { Icon } from "./room-icons";
import styles from "./room-shared.module.css";

const PRIORITY_TONE: Record<Priority, string> = {
  p0: "urgent",
  p1: "high",
  p2: "medium",
  p3: "low",
};

export function TaskCompleteBox({ task }: { task: Task }) {
  const { toggleComplete } = useTasksDispatch();
  const done = task.lane === "done";
  return (
    <input
      aria-label={`${done ? "Reopen" : "Complete"} ${task.title}`}
      checked={done}
      className={styles.selectionBox}
      onChange={() => toggleComplete(task.id)}
      onClick={(event) => event.stopPropagation()}
      type="checkbox"
    />
  );
}

export function PriorityMark({ task, withLabel = false }: { task: Task; withLabel?: boolean }) {
  const label = PRIORITY_LABEL[task.priority].label;
  return (
    <span
      className={styles.priority}
      data-priority={PRIORITY_TONE[task.priority]}
      title={`${label} priority`}
    >
      <span className={styles.priorityDot} />
      {withLabel ? label : <span className={styles.srOnly}>{label} priority</span>}
    </span>
  );
}

export function ScheduleText({ task, now }: { task: Task; now: number }) {
  const overdue = Boolean(task.dueAt && task.dueAt.getTime() < now && task.lane !== "done");
  const unscheduled = !task.due;
  return (
    <span
      className={styles.schedule}
      data-overdue={overdue || undefined}
      data-unscheduled={unscheduled || undefined}
      title={task.due ?? "No date"}
    >
      {task.isMilestone ? <Icon name="milestone" size={14} /> : null}
      {task.due ?? "No date"}
    </span>
  );
}

export function RoomAvatarStack({
  task,
  limit = 3,
  showUnassigned = true,
}: {
  task: Task;
  limit?: number;
  showUnassigned?: boolean;
}) {
  const people = task.assignees.map((id) => ({ id, meta: USERS[id] }));
  if (people.length === 0) {
    return showUnassigned ? <span className={styles.unassigned}>Unassigned</span> : null;
  }
  const visible = people.slice(0, limit);
  return (
    <span
      aria-label={`Assigned to ${people.map((p) => p.meta.name).join(", ")}`}
      className={styles.avatarStack}
    >
      {visible.map((p) => (
        <span
          className={styles.avatar}
          key={p.id}
          style={{ "--avatar-color": p.meta.color } as React.CSSProperties}
          title={p.meta.name}
        >
          {p.meta.initials}
        </span>
      ))}
      {people.length > limit ? (
        <span className={styles.avatarMore}>+{people.length - limit}</span>
      ) : null}
    </span>
  );
}

export function TaskSignals({ task }: { task: Task }) {
  const blocked = task.blockedBy?.length ?? 0;
  const idle = task.idleDays ?? 0;
  if (!task.comments && !blocked && !idle) return null;
  return (
    <span className={styles.signals}>
      {task.comments ? (
        <span title={`${task.comments} comments`}>
          <Icon name="comment" size={13} />
          {task.comments}
        </span>
      ) : null}
      {blocked > 0 ? (
        <span title="Has dependencies">
          <Icon name="dependency" size={13} />
          {blocked}
        </span>
      ) : null}
      {idle > 0 ? (
        <span title={`Idle ${idle} days`}>
          <Icon name="redo" size={13} />
          {idle}d
        </span>
      ) : null}
    </span>
  );
}

export function LabelList({ task, limit = 2 }: { task: Task; limit?: number }) {
  const tags = task.tags ?? [];
  if (tags.length === 0) return null;
  return (
    <span className={styles.labels}>
      {tags.slice(0, limit).map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
      {tags.length > limit ? <span>+{tags.length - limit}</span> : null}
    </span>
  );
}
