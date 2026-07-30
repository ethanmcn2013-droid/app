"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { addDays, asCalendarDate, formatDateLong, formatSchedule } from "../dates";
import { LAB_PEOPLE, personById } from "../fixtures";
import { useLabStore } from "../store";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type LabTask,
  type TaskSchedule,
} from "../types";
import { Icon } from "./icons";
import { AvatarStack, LabelList, ScheduleText, TaskSignals } from "./task-ui";
import styles from "./shared.module.css";

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={wide ? styles.inspectorFieldWide : styles.inspectorField}><span>{label}</span>{children}</label>;
}

function EditableText({ value, onCommit, multiline = false, label, disabled = false }: {
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  label: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else setDraft(value);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setDraft(value);
      event.currentTarget.blur();
    }
    if (!multiline && event.key === "Enter") {
      event.preventDefault();
      commit();
      event.currentTarget.blur();
    }
  };
  return multiline ? (
    <textarea aria-label={label} data-editing="true" disabled={disabled} onBlur={commit} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} rows={4} value={draft} />
  ) : (
    <input aria-label={label} data-editing="true" disabled={disabled} onBlur={commit} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} value={draft} />
  );
}

function ScheduleEditor({ task }: { task: LabTask }) {
  const store = useLabStore();
  const calendar = useCalendarFrame();
  const schedule = task.schedule;
  const changeKind = (kind: TaskSchedule["kind"]) => {
    const next: TaskSchedule = kind === "unscheduled" ? { kind: "unscheduled" }
      : kind === "due" ? { kind: "due", dueOn: calendar.today }
        : kind === "milestone" ? { kind: "milestone", on: calendar.today }
          : { kind: "range", startOn: calendar.today, dueOn: addDays(calendar.today, 2) };
    store.scheduleTask(task.id, next);
  };
  return (
    <div className={styles.scheduleEditor}>
      <Field label="Schedule">
        <select disabled={store.readOnly} onChange={(event) => changeKind(event.target.value as TaskSchedule["kind"])} value={schedule.kind}>
          <option value="unscheduled">Unscheduled</option>
          <option value="due">Due date only</option>
          <option value="range">Start and due</option>
          <option value="milestone">Milestone</option>
        </select>
      </Field>
      {schedule.kind === "due" ? (
        <Field label="Due">
          <input disabled={store.readOnly} onChange={(event) => { if (event.target.value) store.scheduleTask(task.id, { kind: "due", dueOn: asCalendarDate(event.target.value) }); }} type="date" value={schedule.dueOn} />
        </Field>
      ) : null}
      {schedule.kind === "milestone" ? (
        <Field label="Date">
          <input disabled={store.readOnly} onChange={(event) => { if (event.target.value) store.scheduleTask(task.id, { kind: "milestone", on: asCalendarDate(event.target.value) }); }} type="date" value={schedule.on} />
        </Field>
      ) : null}
      {schedule.kind === "range" ? (
        <>
          <Field label="Starts">
            <input disabled={store.readOnly} max={schedule.dueOn} onChange={(event) => { if (event.target.value) store.scheduleTask(task.id, { ...schedule, startOn: asCalendarDate(event.target.value) }); }} type="date" value={schedule.startOn} />
          </Field>
          <Field label="Due">
            <input disabled={store.readOnly} min={schedule.startOn} onChange={(event) => { if (event.target.value) store.scheduleTask(task.id, { ...schedule, dueOn: asCalendarDate(event.target.value) }); }} type="date" value={schedule.dueOn} />
          </Field>
        </>
      ) : null}
    </div>
  );
}

function AssigneeEditor({ task }: { task: LabTask }) {
  const store = useLabStore();
  return (
    <fieldset className={styles.assigneeEditor} disabled={store.readOnly}>
      <legend>Assignees</legend>
      <div>
        {LAB_PEOPLE.map((person) => {
          const checked = task.assigneeIds.includes(person.id);
          return (
            <label key={person.id}>
              <input checked={checked} onChange={() => store.updateAssignees(task.id, checked ? task.assigneeIds.filter((id) => id !== person.id) : [...task.assigneeIds, person.id])} type="checkbox" />
              <span className={styles.personAvatar} style={{ "--avatar-color": person.color } as React.CSSProperties}>{person.initials}</span>
              <span><b>{person.name}</b><small>{person.role}</small></span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function RelationshipSection({ task }: { task: LabTask }) {
  const store = useLabStore();
  const dependencyIds = [...task.blockedByIds, ...task.blockerIds];
  return (
    <section className={styles.inspectorSection}>
      <h3>Relationships <span>{dependencyIds.length}</span></h3>
      {dependencyIds.length === 0 ? <p className={styles.sectionEmpty}>No dependencies</p> : (
        <ul className={styles.relationshipList}>
          {dependencyIds.map((id) => {
            const related = store.taskById(id);
            return <li key={id}><Icon name="dependency" size={14} /><span><b>{related?.title ?? "External dependency"}</b><small>{related ? STATUS_LABELS[related.status] : "Reference unavailable · handled safely"}</small></span></li>;
          })}
        </ul>
      )}
    </section>
  );
}

function InspectorBody({ task }: { task: LabTask }) {
  const store = useLabStore();
  const calendar = useCalendarFrame();
  const [commentDraft, setCommentDraft] = useState("");
  return (
    <div className={styles.inspectorBody}>
      <div className={styles.inspectorTitleBlock}>
        <div className={styles.inspectorEyebrow}><PriorityMarkInline task={task} /> <ScheduleText task={task} /></div>
        <EditableText disabled={store.readOnly} key={`${task.id}:title:${task.title}`} label="Task title" onCommit={(title) => store.updateTitle(task.id, title)} value={task.title} />
        <EditableText disabled={store.readOnly} key={`${task.id}:description:${task.description}`} label="Task description" multiline onCommit={(description) => store.updateTask(task.id, { description }, "Description updated")} value={task.description} />
        <div className={styles.inspectorSignals}><AvatarStack task={task} limit={5} /><TaskSignals task={task} /></div>
      </div>

      <section className={styles.inspectorFields}>
        <Field label="Status">
          <select disabled={store.readOnly} onChange={(event) => store.moveStatus(task.id, event.target.value as LabTask["status"])} value={task.status}>
            {TASK_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select disabled={store.readOnly} onChange={(event) => store.updatePriority(task.id, event.target.value as LabTask["priority"])} value={task.priority}>
            {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>)}
          </select>
        </Field>
        <Field label="Estimate"><span className={styles.readOnlyValue}>{task.estimate ?? "Not set"}</span></Field>
        <Field label="Labels"><LabelList task={task} limit={4} /></Field>
      </section>

      <ScheduleEditor task={task} />
      <AssigneeEditor task={task} />

      <section className={styles.inspectorSection}>
        <h3>Subtasks <span>{task.subtasks.filter((subtask) => subtask.completed).length}/{task.subtasks.length}</span></h3>
        {task.subtasks.length === 0 ? <p className={styles.sectionEmpty}>No subtasks</p> : (
          <ul className={styles.subtaskList}>
            {task.subtasks.map((subtask) => (
              <li key={subtask.id}><label><input checked={subtask.completed} disabled={store.readOnly} onChange={() => store.updateTask(task.id, { subtasks: task.subtasks.map((item) => item.id === subtask.id ? { ...item, completed: !item.completed } : item) }, "Subtask updated")} type="checkbox" /><span>{subtask.title}</span></label></li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.inspectorSection}>
        <h3>Attachments <span>{task.attachments.length}</span></h3>
        {task.attachments.length === 0 ? <p className={styles.sectionEmpty}>No attachments</p> : (
          <ul className={styles.attachmentList}>
            {task.attachments.map((attachment) => <li data-error={attachment.state === "error" || undefined} key={attachment.id}><Icon name="attachment" size={15} /><span><b>{attachment.name}</b><small>{attachment.state === "error" ? "Upload failed · Retry" : `${attachment.kind} · ${attachment.size}`}</small></span></li>)}
          </ul>
        )}
      </section>

      <RelationshipSection task={task} />

      <section className={styles.inspectorSection}>
        <h3>Activity <span>{task.comments.length}</span></h3>
        <form className={styles.commentComposer} onSubmit={(event) => {
          event.preventDefault();
          const body = commentDraft.trim();
          if (!body || store.readOnly) return;
          store.updateTask(task.id, { comments: [...task.comments, { id: `${task.id}-comment-${task.comments.length + 1}`, authorId: "ethan", body, createdAt: calendar.nowIso }] }, "Comment added");
          setCommentDraft("");
        }}>
          <textarea aria-label="Add a comment" disabled={store.readOnly} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Add a comment…" rows={2} value={commentDraft} />
          <button disabled={store.readOnly || !commentDraft.trim()} type="submit">Add comment</button>
        </form>
        {task.comments.length === 0 ? <p className={styles.sectionEmpty}>No activity yet</p> : (
          <ol className={styles.commentList}>
            {[...task.comments].reverse().map((comment) => {
              const author = personById(comment.authorId);
              return <li key={comment.id}><span className={styles.personAvatar} style={{ "--avatar-color": author?.color ?? "var(--x-task-accent)" } as React.CSSProperties}>{author?.initials ?? "?"}</span><div><b>{author?.name ?? "Unknown"}</b><time dateTime={comment.createdAt}>{comment.createdAt.slice(5, 10).replace("-", " ")}</time><p>{comment.body}</p></div></li>;
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function PriorityMarkInline({ task }: { task: LabTask }) {
  return <span className={styles.inspectorPriority} data-priority={task.priority}><span />{PRIORITY_LABELS[task.priority]}</span>;
}

export function TaskInspector() {
  const store = useLabStore();
  const [fullScreen, setFullScreen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const priorId = useRef<string | null>(null);
  const titleId = useId();
  const task = store.inspectedId ? store.taskById(store.inspectedId) : undefined;

  useEffect(() => {
    if (store.inspectedId && !priorId.current) previousFocus.current = document.activeElement as HTMLElement;
    priorId.current = store.inspectedId;
  }, [store.inspectedId]);

  useEffect(() => {
    if (fullScreen) closeRef.current?.focus();
  }, [fullScreen]);

  if (!store.inspectedId) return null;

  const close = () => {
    setFullScreen(false);
    store.openTask(null);
    window.setTimeout(() => previousFocus.current?.focus(), 0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (event.key === "Escape" && !target.closest('[data-editing="true"]')) {
      event.preventDefault();
      event.stopPropagation();
      if (fullScreen) setFullScreen(false);
      else close();
      return;
    }
    if (fullScreen && event.key === "Tab" && panelRef.current) {
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };

  const panel = (
    <aside
      aria-labelledby={titleId}
      aria-modal={fullScreen || undefined}
      className={`${styles.inspector} ${fullScreen ? styles.inspectorFull : ""}`}
      onKeyDown={handleKeyDown}
      ref={panelRef}
      role={fullScreen ? "dialog" : undefined}
    >
      <header className={styles.inspectorHeader}>
        <div><span>Task inspector</span><h2 id={titleId}>{task?.title ?? "Task unavailable"}</h2></div>
        <div>
          {store.readOnly ? <span className={styles.readOnlyPill}>Read-only</span> : null}
          <button aria-label={fullScreen ? "Dock task inspector" : "Open full-screen task mode"} onClick={() => setFullScreen((value) => !value)} title={fullScreen ? "Dock inspector" : "Full-screen task mode"} type="button"><Icon name="focus" size={16} /></button>
          <button aria-label="Close task inspector" onClick={close} ref={closeRef} title="Close" type="button"><Icon name="close" size={17} /></button>
        </div>
      </header>
      {task ? <InspectorBody task={task} /> : <div className={styles.inspectorMissing}><h2>Task not found</h2><p>This deep link does not match the active fixture.</p><button onClick={close} type="button">Return to project</button></div>}
      {task ? <footer className={styles.inspectorFooter}><span>{formatSchedule(task.schedule)}</span><small>{task.schedule.kind === "unscheduled" ? "No date has been inferred" : `Visible from ${formatDateLong(task.schedule.kind === "range" ? task.schedule.startOn : task.schedule.kind === "milestone" ? task.schedule.on : task.schedule.dueOn)}`}</small></footer> : null}
    </aside>
  );
  return fullScreen ? <div className={styles.inspectorBackdrop}>{panel}</div> : panel;
}
