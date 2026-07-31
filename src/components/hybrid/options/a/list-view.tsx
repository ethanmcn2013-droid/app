"use client";

import { useMemo, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useLabStore } from "../../store";
import {
  PRIORITY_LABELS,
  TASK_PRIORITIES,
  type LabTask,
  type TaskStatus,
} from "../../types";
import type { BoardColumn } from "@/lib/board-columns";
import { useBoardColumns } from "../../columns-context";
import { TaskContextMenu, useTaskContextMenu } from "../../shared/task-context-menu";
import { Icon } from "../../shared/icons";
import {
  AvatarStack,
  PriorityMark,
  ScheduleText,
  TaskOpenButton,
  TaskSelection,
  TaskSignals,
} from "../../shared/task-ui";
import { InlineTaskTitle, KeyboardLegend, SurfaceEmpty } from "./quiet-command-components";
import {
  INITIAL_LIST_COLUMNS,
  clamp,
  focusTask,
  reorderItem,
  type ListColumn,
  type ListColumnId,
  type QuietGroup,
} from "./quiet-command-model";
import styles from "./option-a.module.css";

type ListGroup = {
  key: string;
  label: string;
  tasks: LabTask[];
  addStatus: TaskStatus;
};

function updateColumn(columns: ListColumn[], id: ListColumnId, fields: Partial<ListColumn>): ListColumn[] {
  return columns.map((column) => column.id === id ? { ...column, ...fields } : column);
}

function moveColumn(columns: ListColumn[], id: ListColumnId, direction: -1 | 1): ListColumn[] {
  const from = columns.findIndex((column) => column.id === id);
  if (from < 1) return columns;
  const to = clamp(from + direction, 1, columns.length - 1);
  return reorderItem(columns, from, to);
}

export function ListFieldsPanel({
  columns,
  setColumns,
  onClose,
}: {
  columns: ListColumn[];
  setColumns: (columns: ListColumn[]) => void;
  onClose: () => void;
}) {
  const store = useLabStore();
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      animate={{ opacity: 1, transform: "scale(1)" }}
      aria-label="List fields"
      aria-modal="false"
      className={styles.fieldsPanel}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "scale(0.985)" }}
      role="dialog"
      transition={{ duration: reduceMotion ? 0.12 : 0.16, ease: [0.23, 1, 0.32, 1] }}
    >
      <header>
        <div><strong>List fields</strong><span>Session-only column layout</span></div>
        <button aria-label="Close fields" onClick={onClose} type="button"><Icon name="close" size={15} /></button>
      </header>
      <ol>
        {columns.map((column, index) => (
          <li key={column.id}>
            <label className={styles.fieldVisibility}>
              <input
                checked={column.visible}
                disabled={store.readOnly || column.id === "title"}
                onChange={(event) => setColumns(updateColumn(columns, column.id, { visible: event.target.checked }))}
                type="checkbox"
              />
              <span>{column.label}</span>
            </label>
            <label className={styles.fieldWidth}>
              <span className={styles.srOnly}>{column.label} width</span>
              <input
                aria-label={`${column.label} column width`}
                disabled={store.readOnly}
                max="460"
                min={column.minWidth}
                onChange={(event) => setColumns(updateColumn(columns, column.id, { width: Number(event.target.value) }))}
                step="8"
                type="range"
                value={column.width}
              />
              <output>{column.width}px</output>
            </label>
            <div aria-label={`Move ${column.label} column`} className={styles.fieldOrder} role="group">
              <button aria-label={`Move ${column.label} left`} disabled={store.readOnly || index <= 1} onClick={() => setColumns(moveColumn(columns, column.id, -1))} type="button"><Icon name="arrow-left" size={13} /></button>
              <button aria-label={`Move ${column.label} right`} disabled={store.readOnly || column.id === "title" || index === columns.length - 1} onClick={() => setColumns(moveColumn(columns, column.id, 1))} type="button"><Icon name="arrow-right" size={13} /></button>
            </div>
          </li>
        ))}
      </ol>
      <footer>
        <button disabled={store.readOnly} onClick={() => setColumns(INITIAL_LIST_COLUMNS.map((column) => ({ ...column })))} type="button">Reset fields</button>
        <span>Drag headers or use these controls.</span>
      </footer>
    </motion.section>
  );
}

function groupsFor(tasks: LabTask[], group: QuietGroup, boardColumns: readonly BoardColumn[]): ListGroup[] {
  if (group === "priority") {
    return TASK_PRIORITIES.map((priority) => ({
      key: priority,
      label: `${PRIORITY_LABELS[priority]} priority`,
      tasks: tasks.filter((task) => task.priority === priority),
      addStatus: "todo" as TaskStatus,
    }));
  }
  if (group === "none") return [{ key: "all", label: "All tasks", tasks, addStatus: "todo" }];
  return boardColumns.map((column) => ({
    key: column.key,
    label: column.name,
    tasks: tasks.filter((task) => task.status === column.key),
    addStatus: column.key,
  }));
}

export function ListView({
  tasks,
  columns,
  setColumns,
  group,
}: {
  tasks: LabTask[];
  columns: ListColumn[];
  setColumns: (columns: ListColumn[]) => void;
  group: QuietGroup;
}) {
  const store = useLabStore();
  const boardColumns = useBoardColumns();
  const context = useTaskContextMenu();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draggedColumn, setDraggedColumn] = useState<ListColumnId | null>(null);
  const visibleColumns = columns.filter((column) => column.visible);
  const orderedIds = tasks.map((task) => task.id);
  const groups = useMemo(() => groupsFor(tasks, group, boardColumns), [boardColumns, group, tasks]);
  const allSelected = orderedIds.length > 0 && orderedIds.every((id) => store.selectedIds.includes(id));

  const toggleGroup = (key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleExpanded = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const keyRow = (event: KeyboardEvent<HTMLTableRowElement>, task: LabTask, index: number) => {
    if (event.target !== event.currentTarget) return;
    if (event.shiftKey && event.key === "F10") {
      event.preventDefault();
      context.openMenuAt(task.id, event.currentTarget);
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
      const next = tasks[event.key === "ArrowUp" ? index - 1 : index + 1];
      if (next) focusTask(next.id);
    }
  };

  const resizeColumn = (event: ReactPointerEvent<HTMLButtonElement>, column: ListColumn) => {
    if (store.readOnly) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = column.width;
    const move = (moveEvent: PointerEvent) => {
      const width = clamp(startWidth + moveEvent.clientX - startX, column.minWidth, 460);
      setColumns(updateColumn(columns, column.id, { width }));
    };
    const end = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end);
  };

  const reorderColumn = (target: ListColumnId) => {
    if (store.readOnly || !draggedColumn || draggedColumn === "title" || target === "title") return;
    const from = columns.findIndex((column) => column.id === draggedColumn);
    const to = columns.findIndex((column) => column.id === target);
    if (from >= 1 && to >= 1) setColumns(reorderItem(columns, from, to));
    setDraggedColumn(null);
  };

  const renderCell = (task: LabTask, column: ListColumn) => {
    if (column.id === "status") {
      return (
        <select aria-label={`Status for ${task.title}`} disabled={store.readOnly} onChange={(event) => store.moveStatus(task.id, event.target.value)} value={task.status}>
          {boardColumns.map((column) => <option key={column.key} value={column.key}>{column.name}</option>)}
        </select>
      );
    }
    if (column.id === "assignees") return <AvatarStack limit={3} task={task} />;
    if (column.id === "schedule") return <ScheduleText task={task} />;
    if (column.id === "priority") return <PriorityMark task={task} withLabel />;
    if (column.id === "estimate") return <span className={styles.monoValue}>{task.estimate ?? "Not set"}</span>;
    if (column.id === "progress") return <span className={styles.monoValue}>{task.subtasks.length ? `${task.subtasks.filter((subtask) => subtask.completed).length}/${task.subtasks.length}` : "None"}</span>;
    if (column.id === "activity") return <TaskSignals task={task} />;
    return null;
  };

  return (
    <div className={styles.listSurface}>
      <div className={styles.tableScroll}>
        <table className={styles.taskTable}>
          <caption>Launch project tasks. Columns can be resized, reordered, and hidden for this session.</caption>
          <colgroup>{visibleColumns.map((column) => <col key={column.id} style={{ width: column.width }} />)}</colgroup>
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th
                  data-column={column.id}
                  draggable={!store.readOnly && column.id !== "title"}
                  key={column.id}
                  onDragEnd={() => setDraggedColumn(null)}
                  onDragOver={(event) => { if (!store.readOnly && draggedColumn) event.preventDefault(); }}
                  onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggedColumn(column.id); }}
                  onDrop={() => reorderColumn(column.id)}
                  scope="col"
                  style={{ minWidth: column.minWidth, width: column.width }}
                >
                  <span className={styles.columnLabel}>
                    {column.id === "title" ? (
                      <input
                        aria-label={allSelected ? "Clear visible task selection" : "Select all visible tasks"}
                        checked={allSelected}
                        disabled={store.readOnly || orderedIds.length === 0}
                        onChange={() => {
                          if (allSelected) store.clearSelection();
                          else orderedIds.filter((id) => !store.selectedIds.includes(id)).forEach((id) => store.toggleSelected(id, orderedIds));
                        }}
                        type="checkbox"
                      />
                    ) : <Icon name="columns" size={12} />}
                    {column.label}
                  </span>
                  <button
                    aria-label={`Resize ${column.label} column`}
                    aria-valuemax={460}
                    aria-valuemin={column.minWidth}
                    aria-valuenow={column.width}
                    aria-orientation="vertical"
                    className={styles.columnResizer}
                    disabled={store.readOnly}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                      event.preventDefault();
                      const width = clamp(column.width + (event.key === "ArrowLeft" ? -16 : 16), column.minWidth, 460);
                      setColumns(updateColumn(columns, column.id, { width }));
                    }}
                    onPointerDown={(event) => resizeColumn(event, column)}
                    role="separator"
                    type="button"
                  />
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((taskGroup) => {
            const isCollapsed = collapsed.has(taskGroup.key);
            const complete = taskGroup.tasks.filter((task) => task.completed).length;
            return (
              <tbody data-group={taskGroup.key} key={taskGroup.key}>
                {/*
                  The group cell spans every column, so the band runs the full
                  row. It used to carry display:flex directly, which voids a
                  table cell's colSpan and painted the band only as wide as
                  the title column — every section header stopped partway
                  across the table with a hole to its right. The flex lives
                  on an inner div now; the cell stays a real table cell.
                  Status groups carry the board's lane tone (2px leading rule
                  + 6% wash + pip) so a lane means one colour in every view.
                */}
                <tr
                  className={styles.groupRow}
                  data-lane-tone={group === "status" && taskGroup.key !== "todo" ? taskGroup.key : undefined}
                >
                  <th colSpan={visibleColumns.length} scope="rowgroup">
                    <div className={styles.groupBand}>
                      <button aria-expanded={!isCollapsed} onClick={() => toggleGroup(taskGroup.key)} type="button">
                        <Icon name={isCollapsed ? "chevron-right" : "chevron-down"} size={14} />
                        {group === "status" ? <span className={styles.statusPip} data-status={taskGroup.key} /> : null}
                        {taskGroup.label}
                      </button>
                      <span>{taskGroup.tasks.length} tasks</span>
                      <span>{complete}/{taskGroup.tasks.length || 0} complete</span>
                      <button disabled={store.readOnly} onClick={() => store.addTask(taskGroup.addStatus)} type="button"><Icon name="add" size={13} />Add task</button>
                    </div>
                  </th>
                </tr>
                {!isCollapsed && taskGroup.tasks.length === 0 ? (
                  <tr className={styles.groupEmpty}><td colSpan={visibleColumns.length}>No tasks in this group</td></tr>
                ) : null}
                {!isCollapsed ? taskGroup.tasks.map((task) => {
                  const taskIndex = tasks.findIndex((item) => item.id === task.id);
                  const isExpanded = expanded.has(task.id);
                  return [
                    <tr
                      aria-selected={store.selectedIds.includes(task.id)}
                      className={styles.taskRow}
                      data-active={store.activeId === task.id || undefined}
                      data-completed={task.completed || undefined}
                      data-inspected={store.inspectedId === task.id || undefined}
                      data-recently-placed={store.recentlyPlacedId === task.id || undefined}
                      data-recently-updated={store.recentlyUpdatedId === task.id || undefined}
                      data-task-id={task.id}
                      key={task.id}
                      onContextMenu={(event) => context.openMenu(task.id, event)}
                      onDoubleClick={() => { if (!store.readOnly) store.setEditing(task.id, "title"); }}
                      onFocus={() => { store.setActive(task.id); store.setPreview(task.id); }}
                      onKeyDown={(event) => keyRow(event, task, taskIndex)}
                      onMouseEnter={() => store.setPreview(task.id)}
                      onMouseLeave={() => { if (store.previewId === task.id) store.setPreview(null); }}
                      tabIndex={0}
                    >
                      {visibleColumns.map((column) => column.id === "title" ? (
                        <th data-column="title" key={column.id} scope="row" style={{ minWidth: column.minWidth, width: column.width }}>
                          <div className={styles.titleCell}>
                            {task.subtasks.length ? <button aria-expanded={isExpanded} aria-label={`${isExpanded ? "Collapse" : "Expand"} subtasks for ${task.title}`} className={styles.expandButton} onClick={() => toggleExpanded(task.id)} type="button"><Icon name={isExpanded ? "chevron-down" : "chevron-right"} size={13} /></button> : <span className={styles.expandSpacer} />}
                            <TaskSelection disabled={store.readOnly} orderedIds={orderedIds} task={task} />
                            <PriorityMark task={task} />
                            {store.editing?.taskId === task.id && store.editing.field === "title" ? <InlineTaskTitle className={styles.listTitleEdit} task={task} /> : <TaskOpenButton className={styles.listTitle} task={task}>{task.title}</TaskOpenButton>}
                          </div>
                        </th>
                      ) : <td data-column={column.id} key={column.id} style={{ minWidth: column.minWidth, width: column.width }}>{renderCell(task, column)}</td>)}
                    </tr>,
                    isExpanded ? (
                      <tr className={styles.subtaskRows} key={`${task.id}-subtasks`}>
                        <td colSpan={visibleColumns.length}>
                          <ul aria-label={`Subtasks for ${task.title}`}>
                            {task.subtasks.map((subtask) => <li key={subtask.id}><Icon name={subtask.completed ? "check" : "chevron-right"} size={12} /><span data-completed={subtask.completed || undefined}>{subtask.title}</span></li>)}
                          </ul>
                        </td>
                      </tr>
                    ) : null,
                  ];
                }) : null}
              </tbody>
            );
          })}
          {tasks.length === 0 ? <tbody><tr><td colSpan={visibleColumns.length}><SurfaceEmpty body="Adjust the current filter or add the first task." onAdd={() => store.addTask("queued")} title="No tasks in this list" /></td></tr></tbody> : null}
        </table>
      </div>
      <KeyboardLegend>Up and down navigate rows. Enter opens. Space selects. F2 edits. Shift + F10 opens actions.</KeyboardLegend>
      <TaskContextMenu menu={context.menu} onClose={context.closeMenu} />
    </div>
  );
}
