"use client";

import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { personById } from "../../fixtures";
import { useLabStore } from "../../store";
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES, type LabTask, type TaskStatus } from "../../types";
import { Icon } from "../../shared/icons";
import { TaskContextMenu, useTaskContextMenu } from "../../shared/task-context-menu";
import { AvatarStack, ScheduleText, TaskSelection, TaskSignals } from "../../shared/task-ui";
import { InlineTaskTitle } from "./task-edit";
import { completedChecks, focusTaskElement, isInteractiveTarget } from "./option-b-utils";
import styles from "./option-b.module.css";

export type ListFieldId = "task" | "status" | "people" | "schedule" | "priority" | "signals";
export type ListFieldConfig = { id: ListFieldId; label: string; visible: boolean; width: number };

export const DEFAULT_LIST_FIELDS: ListFieldConfig[] = [
  { id: "task", label: "Task and purpose", visible: true, width: 340 },
  { id: "status", label: "Status", visible: true, width: 132 },
  { id: "people", label: "People", visible: true, width: 180 },
  { id: "schedule", label: "Schedule", visible: true, width: 150 },
  { id: "priority", label: "Priority", visible: true, width: 116 },
  { id: "signals", label: "Context", visible: true, width: 132 },
];

const GROUP_NOTES: Record<TaskStatus, string> = {
  queued: "Work with a clear reason, waiting for room to begin.",
  active: "The current centre of gravity for the workspace.",
  review: "Read, decide, and leave the next handoff unambiguous.",
  waiting: "Dependencies are named so the pause can be resolved.",
  done: "Completed work stays visible as evidence, not clutter.",
};

function FieldPanel({ fields, onChange, onClose }: {
  fields: ListFieldConfig[];
  onChange: (fields: ListFieldConfig[]) => void;
  onClose: () => void;
}) {
  const move = (index: number, amount: number) => {
    const target = index + amount;
    if (index <= 0 || target <= 0 || target >= fields.length) return;
    const next = [...fields];
    const [field] = next.splice(index, 1);
    next.splice(target, 0, field);
    onChange(next);
  };
  const update = (id: ListFieldId, patch: Partial<ListFieldConfig>) => onChange(fields.map((field) => field.id === id ? { ...field, ...patch } : field));
  return (
    <aside aria-label="Table field settings" className={styles.fieldPanel}>
      <header><div><strong>Table fields</strong><span>Session-only layout</span></div><button aria-label="Close table field settings" onClick={onClose} type="button"><Icon name="close" size={15} /></button></header>
      <p>Choose what the list says, then set its reading order and width.</p>
      <ol>
        {fields.map((field, index) => (
          <li key={field.id}>
            <label className={styles.fieldVisibility}>
              <input checked={field.visible} disabled={field.id === "task"} onChange={(event) => update(field.id, { visible: event.target.checked })} type="checkbox" />
              <span>{field.label}</span>
            </label>
            <div className={styles.fieldOrderControls}>
              <button aria-label={`Move ${field.label} left`} disabled={index <= 1 || field.id === "task"} onClick={() => move(index, -1)} type="button"><Icon name="arrow-left" size={13} /></button>
              <button aria-label={`Move ${field.label} right`} disabled={index === fields.length - 1 || field.id === "task"} onClick={() => move(index, 1)} type="button"><Icon name="arrow-right" size={13} /></button>
            </div>
            <label className={styles.fieldWidthControl}>
              <span>Width <b>{field.width}px</b></span>
              <input aria-label={`${field.label} width`} max="360" min="96" onChange={(event) => update(field.id, { width: Number(event.target.value) })} step="8" type="range" value={field.width} />
            </label>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function TaskCell({ task }: { task: LabTask }) {
  return (
    <div className={styles.listTaskCell}>
      <InlineTaskTitle task={task} />
      <p>{task.description}</p>
    </div>
  );
}

function PeopleCell({ task }: { task: LabTask }) {
  const names = task.assigneeIds.map(personById).filter(Boolean).map((person) => person?.name);
  return (
    <div className={styles.listPeopleCell}>
      <AvatarStack limit={3} task={task} />
      <span>{names.length === 0 ? "Unassigned" : names.slice(0, 2).join(", ")}{names.length > 2 ? ` and ${names.length - 2} more` : ""}</span>
    </div>
  );
}

function EditableFieldCell({ field, task }: { field: ListFieldId; task: LabTask }) {
  const store = useLabStore();
  if (field === "task") return <TaskCell task={task} />;
  if (field === "status") return (
    <select aria-label={`Status for ${task.title}`} disabled={store.readOnly} onChange={(event) => store.moveStatus(task.id, event.target.value as TaskStatus)} value={task.status}>
      {TASK_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
    </select>
  );
  if (field === "people") return <PeopleCell task={task} />;
  if (field === "schedule") return <ScheduleText task={task} />;
  if (field === "priority") return (
    <select aria-label={`Priority for ${task.title}`} disabled={store.readOnly} onChange={(event) => store.updatePriority(task.id, event.target.value as LabTask["priority"])} value={task.priority}>
      {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>)}
    </select>
  );
  return <TaskSignals task={task} />;
}

function ListTaskRows({
  task,
  fields,
  visibleIds,
  expanded,
  onToggleExpanded,
  onOpenMenu,
}: {
  task: LabTask;
  fields: ListFieldConfig[];
  visibleIds: string[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onOpenMenu: ReturnType<typeof useTaskContextMenu>["openMenuAt"];
}) {
  const store = useLabStore();
  const selected = store.selectedIds.includes(task.id);
  const visibleFields = fields.filter((field) => field.visible);
  const rowIndex = visibleIds.indexOf(task.id);

  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    const target = event.target as HTMLElement;
    if (target.matches("input, select, textarea") || target.isContentEditable) return;
    if (event.shiftKey && event.key === "F10") {
      event.preventDefault();
      onOpenMenu(task.id, event.currentTarget);
      return;
    }
    if (event.key === "F2" && !store.readOnly) {
      event.preventDefault();
      store.setEditing(task.id, "title");
      return;
    }
    if (event.key === "Enter" && event.target === event.currentTarget) {
      event.preventDefault();
      store.openTask(task.id);
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      store.toggleSelected(task.id, visibleIds, event.shiftKey);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = visibleIds[Math.max(0, Math.min(visibleIds.length - 1, rowIndex + (event.key === "ArrowUp" ? -1 : 1)))];
      if (next) focusTaskElement(next, "[data-list-row]");
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-list-cell-control], button:not([disabled]), select:not([disabled]), input:not([disabled])")];
      const current = controls.indexOf(target);
      const next = controls[Math.max(0, Math.min(controls.length - 1, (current < 0 ? 0 : current) + (event.key === "ArrowLeft" ? -1 : 1)))];
      next?.focus();
    }
  };

  return (
    <>
      <tr
        aria-label={`${task.title}. ${STATUS_LABELS[task.status]}`}
        className={styles.listTaskRow}
        data-active={store.activeId === task.id || undefined}
        data-list-row="true"
        data-selected={selected || undefined}
        data-task-id={task.id}
        onClick={(event: MouseEvent<HTMLTableRowElement>) => {
          if (isInteractiveTarget(event.target)) return;
          if (store.selectedIds.length > 0 || event.ctrlKey || event.metaKey || event.shiftKey) store.toggleSelected(task.id, visibleIds, event.shiftKey);
        }}
        onContextMenu={(event) => { event.preventDefault(); onOpenMenu(task.id, event.currentTarget); }}
        onFocus={() => store.setActive(task.id)}
        onKeyDown={onKeyDown}
        tabIndex={0}
      >
        <td className={styles.listSelectionCell}><TaskSelection disabled={store.readOnly} orderedIds={visibleIds} task={task} /></td>
        <td className={styles.listExpandCell}>
          {task.subtasks.length > 0 ? <button aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} subtasks for ${task.title}`} onClick={onToggleExpanded} type="button"><Icon name={expanded ? "chevron-down" : "chevron-right"} size={14} /></button> : null}
        </td>
        {visibleFields.map((field) => {
          const Cell = field.id === "task" ? "th" : "td";
          return (
            <Cell className={field.id === "task" ? styles.listFrozenTask : styles.listDataCell} data-field={field.id} key={field.id} scope={field.id === "task" ? "row" : undefined}>
              <div data-list-cell-control={field.id === "task" ? "true" : undefined}><EditableFieldCell field={field.id} task={task} /></div>
            </Cell>
          );
        })}
      </tr>
      {expanded ? task.subtasks.map((subtask, index) => (
        <tr className={styles.subtaskRow} key={subtask.id}>
          <td aria-hidden="true" />
          <td aria-hidden="true" />
          <td className={styles.subtaskCell} colSpan={visibleFields.length}>
            <label>
              <input
                aria-label={`${subtask.completed ? "Reopen" : "Complete"} subtask ${subtask.title}`}
                checked={subtask.completed}
                disabled={store.readOnly}
                onChange={() => store.updateTask(task.id, { subtasks: task.subtasks.map((item, itemIndex) => itemIndex === index ? { ...item, completed: !item.completed } : item) }, "Subtask updated")}
                type="checkbox"
              />
              <span>{subtask.title}</span>
            </label>
          </td>
        </tr>
      )) : null}
    </>
  );
}

export function ListView({
  tasks,
  fields,
  onFieldsChange,
  fieldsOpen,
  onFieldsClose,
}: {
  tasks: LabTask[];
  fields: ListFieldConfig[];
  onFieldsChange: (fields: ListFieldConfig[]) => void;
  fieldsOpen: boolean;
  onFieldsClose: () => void;
}) {
  const store = useLabStore();
  const contextMenu = useTaskContextMenu();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<TaskStatus>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const visibleFields = fields.filter((field) => field.visible);
  const visibleIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const totalColumns = 2 + visibleFields.length;

  const toggleGroup = (status: TaskStatus) => setCollapsedGroups((current) => {
    const next = new Set(current);
    if (next.has(status)) next.delete(status); else next.add(status);
    return next;
  });
  const toggleTask = (id: string) => setExpandedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <section aria-label="Workspace List" className={styles.listView}>
      {fieldsOpen ? <FieldPanel fields={fields} onChange={onFieldsChange} onClose={onFieldsClose} /> : null}
      <div className={styles.listTableScroller}>
        <table className={styles.taskTable}>
          <caption>Launch workspace tasks grouped by status. Task titles remain frozen while fields scroll.</caption>
          <colgroup>
            <col style={{ width: 42 }} />
            <col style={{ width: 34 }} />
            {visibleFields.map((field) => <col key={field.id} style={{ width: field.width }} />)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col"><span className={styles.srOnly}>Select</span></th>
              <th scope="col"><span className={styles.srOnly}>Subtasks</span></th>
              {visibleFields.map((field) => <th className={field.id === "task" ? styles.listFrozenHeader : undefined} data-field={field.id} key={field.id} scope="col">{field.label}<span>{field.width}px</span></th>)}
            </tr>
          </thead>
          {tasks.length === 0 ? (
            <tbody><tr><td colSpan={totalColumns}><div className={styles.listEmpty}><Icon name="list" size={21} /><strong>No work matches this list</strong><p>Clear the room filters or add a task to Queued.</p><button disabled={store.readOnly} onClick={() => store.addTask("queued")} type="button"><Icon name="add" size={14} />Add task</button></div></td></tr></tbody>
          ) : TASK_STATUSES.map((status) => {
            const groupTasks = tasks.filter((task) => task.status === status);
            if (groupTasks.length === 0) return null;
            const checks = groupTasks.reduce((total, task) => {
              const current = completedChecks(task);
              return { done: total.done + current.done, total: total.total + current.total };
            }, { done: 0, total: 0 });
            const collapsed = collapsedGroups.has(status);
            return (
              <tbody data-group={status} key={status}>
                <tr className={styles.listGroupRow}>
                  <th colSpan={totalColumns} scope="rowgroup">
                    <div className={styles.listGroupHeading}>
                      <button aria-expanded={!collapsed} aria-label={`${collapsed ? "Expand" : "Collapse"} ${STATUS_LABELS[status]} group`} onClick={() => toggleGroup(status)} type="button"><Icon name={collapsed ? "chevron-right" : "chevron-down"} size={14} /></button>
                      <div><strong>{STATUS_LABELS[status]}</strong><span>{GROUP_NOTES[status]}</span></div>
                      <span className={styles.groupCount}>{groupTasks.length} task{groupTasks.length === 1 ? "" : "s"}</span>
                      <label className={styles.groupProgress}><span>{checks.done} of {checks.total} checks</span><progress aria-label={`${STATUS_LABELS[status]} progress`} max={checks.total} value={checks.done} /></label>
                      <button className={styles.groupAdd} disabled={store.readOnly} onClick={() => store.addTask(status)} type="button"><Icon name="add" size={13} />Add task</button>
                    </div>
                  </th>
                </tr>
                {collapsed ? null : groupTasks.map((task) => (
                  <ListTaskRows
                    expanded={expandedIds.has(task.id)}
                    fields={fields}
                    key={task.id}
                    onOpenMenu={contextMenu.openMenuAt}
                    onToggleExpanded={() => toggleTask(task.id)}
                    task={task}
                    visibleIds={visibleIds}
                  />
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
      <TaskContextMenu menu={contextMenu.menu} onClose={contextMenu.closeMenu} />
    </section>
  );
}
