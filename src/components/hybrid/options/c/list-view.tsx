"use client";

import { Fragment, useMemo, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useLabStore } from "../../store";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type LabTask,
  type TaskPriority,
  type TaskStatus,
} from "../../types";
import { Icon } from "../../shared/icons";
import { TaskContextMenu, useTaskContextMenu } from "../../shared/task-context-menu";
import { AvatarStack, PriorityMark, ScheduleText, TaskSelection, TaskSignals } from "../../shared/task-ui";
import { focusSpatialTask, InlineTaskTitle, isInteractiveTarget } from "./spatial-task";
import type { ListField, ListFieldKey, SpatialGroup } from "./spatial-types";
import styles from "./option-c.module.css";

type Group = {
  id: string;
  label: string;
  tasks: LabTask[];
  add: () => void;
};

function fieldStyle(field: ListField): CSSProperties {
  return { width: field.width, minWidth: field.width, maxWidth: field.width };
}

function FieldValue({ field, task }: { field: ListFieldKey; task: LabTask }) {
  const store = useLabStore();
  switch (field) {
    case "status":
      return (
        <select
          aria-label={`Status for ${task.title}`}
          className={styles.inlineSelect}
          disabled={store.readOnly}
          onChange={(event) => store.moveStatus(task.id, event.target.value as TaskStatus)}
          value={task.status}
        >
          {TASK_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
        </select>
      );
    case "assignees":
      return <AvatarStack limit={3} task={task} />;
    case "schedule":
      return <ScheduleText task={task} />;
    case "priority":
      return <PriorityMark task={task} withLabel />;
    case "progress": {
      const complete = task.subtasks.filter((subtask) => subtask.completed).length;
      return task.subtasks.length > 0 ? <span className={styles.subtaskProgress}>{complete} of {task.subtasks.length}</span> : <span className={styles.mutedValue}>No subtasks</span>;
    }
    case "signals":
      return <TaskSignals task={task} />;
  }
}

export function ListView({ tasks, fields, groupBy }: { tasks: LabTask[]; fields: ListField[]; groupBy: SpatialGroup }) {
  const store = useLabStore();
  const menu = useTaskContextMenu();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const orderedIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const visibleFields = fields.filter((field) => field.visible);

  const groups = useMemo<Group[]>(() => {
    if (groupBy === "priority") {
      return TASK_PRIORITIES.map((priority) => ({
        id: `priority:${priority}`,
        label: `${PRIORITY_LABELS[priority]} priority`,
        tasks: tasks.filter((task) => task.priority === priority),
        add: () => {
          const nextNumber = store.tasks.filter((task) => task.id.startsWith("session-")).length + 1;
          const id = `session-${nextNumber}`;
          store.addTask("queued");
          store.updatePriority(id, priority as TaskPriority);
        },
      }));
    }
    return TASK_STATUSES.map((status) => ({
      id: `status:${status}`,
      label: STATUS_LABELS[status],
      tasks: tasks.filter((task) => task.status === status),
      add: () => store.addTask(status),
    }));
  }, [groupBy, store, tasks]);

  const toggleCollapsed = (id: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleExpanded = (id: string) => setExpandedTasks((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, task: LabTask) => {
    if (event.target !== event.currentTarget) return;
    const index = orderedIds.indexOf(task.id);
    if (event.shiftKey && event.key === "F10") {
      event.preventDefault();
      menu.openMenuAt(task.id, event.currentTarget);
      return;
    }
    if (event.key === "F2" && !store.readOnly) {
      event.preventDefault();
      store.setEditing(task.id, "title");
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      store.openTask(task.id);
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      store.toggleSelected(task.id, orderedIds, event.shiftKey);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = orderedIds[Math.max(0, Math.min(orderedIds.length - 1, index + (event.key === "ArrowUp" ? -1 : 1)))];
      if (next) focusSpatialTask(next);
    }
  };

  const renderTaskRow = (task: LabTask): ReactNode => {
    const expanded = expandedTasks.has(task.id);
    return (
      <Fragment key={task.id}>
        <tr
          aria-label={task.title}
          className={styles.listTaskRow}
          data-active={store.activeId === task.id || undefined}
          data-c-task={task.id}
          data-completed={task.completed || undefined}
          data-selected={store.selectedIds.includes(task.id) || undefined}
          data-task-id={task.id}
          onClick={(event) => {
            if (store.selectedIds.length > 0 && !isInteractiveTarget(event.target)) store.toggleSelected(task.id, orderedIds, event.shiftKey);
          }}
          onContextMenu={(event: MouseEvent<HTMLTableRowElement>) => menu.openMenu(task.id, event)}
          onFocus={() => store.setActive(task.id)}
          onKeyDown={(event) => onRowKeyDown(event, task)}
          tabIndex={0}
        >
          <td className={styles.listSelectCell}><TaskSelection orderedIds={orderedIds} task={task} /></td>
          <th className={styles.listTitleCell} scope="row">
            <div className={styles.listTitleWrap}>
              {task.subtasks.length > 0 ? (
                <button
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Collapse" : "Expand"} subtasks for ${task.title}`}
                  className={styles.subtaskToggle}
                  onClick={() => toggleExpanded(task.id)}
                  type="button"
                ><Icon name={expanded ? "chevron-down" : "chevron-right"} size={13} /></button>
              ) : <span className={styles.subtaskToggleSpacer} />}
              <InlineTaskTitle className={styles.listTaskTitle} task={task} />
              {task.blockedByIds.length > 0 ? <span className={styles.blockedFlag} title="Blocked by another task"><Icon name="dependency" size={13} />Blocked</span> : null}
              <button aria-label={`Open menu for ${task.title}`} className={styles.listMenuButton} onClick={(event) => menu.openMenuAt(task.id, event.currentTarget)} type="button"><Icon name="more" size={15} /></button>
            </div>
          </th>
          {visibleFields.map((field) => <td key={field.key} style={fieldStyle(field)}><FieldValue field={field.key} task={task} /></td>)}
        </tr>
        {expanded ? task.subtasks.map((subtask) => (
          <tr className={styles.listSubtaskRow} key={subtask.id}>
            <td className={styles.listSelectCell} />
            <th className={styles.listTitleCell} scope="row">
              <label>
                <input
                  checked={subtask.completed}
                  disabled={store.readOnly}
                  onChange={() => store.updateTask(task.id, {
                    subtasks: task.subtasks.map((item) => item.id === subtask.id ? { ...item, completed: !item.completed } : item),
                  }, "Subtask updated")}
                  type="checkbox"
                />
                <span>{subtask.title}</span>
              </label>
            </th>
            {visibleFields.map((field) => <td aria-hidden="true" key={field.key} style={fieldStyle(field)} />)}
          </tr>
        )) : null}
      </Fragment>
    );
  };

  return (
    <div className={styles.listViewport}>
      <table className={styles.spatialTable}>
        <caption>Launch workspace tasks grouped by {groupBy}</caption>
        <colgroup>
          <col style={{ width: 42 }} />
          <col style={{ width: 320 }} />
          {visibleFields.map((field) => <col key={field.key} style={{ width: field.width }} />)}
        </colgroup>
        <thead>
          <tr>
            <th aria-label="Selection" className={styles.listSelectCell} scope="col" />
            <th className={styles.listTitleCell} scope="col">Task</th>
            {visibleFields.map((field) => <th key={field.key} scope="col" style={fieldStyle(field)}>{field.label}</th>)}
          </tr>
        </thead>
        {tasks.length === 0 ? (
          <tbody>
            <tr><td className={styles.listEmpty} colSpan={visibleFields.length + 2}><Icon name="list" size={20} /><strong>No tasks in this view</strong><span>Change the filter or add a task to the launch workspace.</span><button disabled={store.readOnly} onClick={() => store.addTask("queued")} type="button"><Icon name="add" size={14} />Add task</button></td></tr>
          </tbody>
        ) : groups.map((group) => {
          const isCollapsed = collapsed.has(group.id);
          const completed = group.tasks.filter((task) => task.completed).length;
          return (
            <tbody aria-label={group.label} key={group.id}>
              <tr className={styles.listGroupRow}>
                <th colSpan={visibleFields.length + 2} scope="rowgroup">
                  <button aria-expanded={!isCollapsed} onClick={() => toggleCollapsed(group.id)} type="button"><Icon name={isCollapsed ? "chevron-right" : "chevron-down"} size={14} /><span>{group.label}</span><strong>{group.tasks.length}</strong></button>
                  <span>{completed} complete</span>
                  <button disabled={store.readOnly} onClick={group.add} type="button"><Icon name="add" size={13} />Add task</button>
                </th>
              </tr>
              {!isCollapsed ? group.tasks.map(renderTaskRow) : null}
            </tbody>
          );
        })}
      </table>
      <TaskContextMenu menu={menu.menu} onClose={menu.closeMenu} />
    </div>
  );
}
