"use client";

/**
 * List view — the Option B lab's annotated table grammar on production
 * machinery (T·95 lab parity, P3b). The lab's list-view.tsx is the
 * spec: fixed-layout table, sticky 38px uppercase header, frozen
 * title column, per-row complete box, mono meta columns, narrated
 * status groups, and the Fields configurator panel.
 *
 * Production behavior preserved exactly:
 *   row click        opens the task detail panel
 *   shift/ctrl click extends / toggles the bulk selection
 *   checkbox         completes the task (TaskCompleteBox)
 *   status select    moveTask — the same lane move as drag on the board
 *   priority select  updateTask({ priority })
 *   Esc              clears the selection; Enter on a row opens it
 *   bulk toolbar     move / mark done / delete for the selection
 *
 * Honest omissions from the lab table:
 *   subtask expander column — `getTasks` filters parented rows out of
 *   the list store, so the expander would never render a control; the
 *   frozen title column starts right after the 42px complete column
 *   (see .taskTable[data-no-expand] in option-b.module.css).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LANES,
  LANE_ORDER,
  PRIORITY_LABEL,
  USERS,
  type LaneId,
  type Priority,
  type Task,
} from "@/lib/data";
import {
  useTasksDispatch,
  useTasksState,
} from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { EmptyStateOverlay } from "@/components/app/empty-state/empty-state-overlay";
import { ListGhost } from "@/components/app/empty-state/ghost-views";
import { usePersonalization } from "@/lib/domain-context";
import { useAddTask } from "@/components/app/add-task/add-task-context";
import { Icon } from "@/components/app/room/room-icons";
import {
  RoomAvatarStack,
  ScheduleText,
  TaskCompleteBox,
  TaskSignals,
} from "@/components/app/room/room-task-ui";
import {
  useRoomTools,
  useRoomVisibleTasks,
} from "@/components/app/room/room-tools-context";
import styles from "@/components/app/room/option-b.module.css";
import shared from "@/components/app/room/room-shared.module.css";

/** Editorial Project Room (Option B): status groups narrate themselves so
 *  the list reads as an annotated table, not four bare headers. */
const GROUP_NOTES: Record<LaneId, string> = {
  todo: "Agreed and ready to start.",
  doing: "In motion right now.",
  review: "Held by a reply, a delivery, or a decision.",
  done: "Finished work stays visible.",
};

// ─── Field configuration (the lab's ListFieldConfig pattern) ─────────────────

type ListFieldId = "task" | "status" | "people" | "schedule" | "priority" | "signals";
type ListFieldConfig = { id: ListFieldId; label: string; visible: boolean; width: number };

const DEFAULT_LIST_FIELDS: ListFieldConfig[] = [
  { id: "task", label: "Task and purpose", visible: true, width: 340 },
  { id: "status", label: "Status", visible: true, width: 132 },
  { id: "people", label: "People", visible: true, width: 180 },
  { id: "schedule", label: "Schedule", visible: true, width: 150 },
  { id: "priority", label: "Priority", visible: true, width: 116 },
  { id: "signals", label: "Context", visible: true, width: 132 },
];

const PRIORITY_ORDER: Priority[] = ["p0", "p1", "p2", "p3"];

/** Clicks on embedded controls must not double as row clicks. */
function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("button, input, select, textarea, a, [contenteditable='true']"))
  );
}

// ─── Field configurator (the Fields tool) ────────────────────────────────────

function FieldPanel({
  fields,
  onChange,
  onClose,
}: {
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
  const update = (id: ListFieldId, patch: Partial<ListFieldConfig>) =>
    onChange(fields.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  return (
    <aside aria-label="Table field settings" className={styles.fieldPanel}>
      <header>
        <div>
          <strong>Table fields</strong>
          <span>Session-only layout</span>
        </div>
        <button
          aria-label="Close table field settings"
          onClick={onClose}
          type="button"
        >
          <Icon name="close" size={15} />
        </button>
      </header>
      <p>Choose what the list says, then set its reading order and width.</p>
      <ol>
        {fields.map((field, index) => (
          <li key={field.id}>
            <label className={styles.fieldVisibility}>
              <input
                checked={field.visible}
                disabled={field.id === "task"}
                onChange={(event) => update(field.id, { visible: event.target.checked })}
                type="checkbox"
              />
              <span>{field.label}</span>
            </label>
            <div className={styles.fieldOrderControls}>
              <button
                aria-label={`Move ${field.label} left`}
                disabled={index <= 1 || field.id === "task"}
                onClick={() => move(index, -1)}
                type="button"
              >
                <Icon name="arrow-left" size={13} />
              </button>
              <button
                aria-label={`Move ${field.label} right`}
                disabled={index === fields.length - 1 || field.id === "task"}
                onClick={() => move(index, 1)}
                type="button"
              >
                <Icon name="arrow-right" size={13} />
              </button>
            </div>
            <label className={styles.fieldWidthControl}>
              <span>
                Width <b>{field.width}px</b>
              </span>
              <input
                aria-label={`${field.label} width`}
                max="360"
                min="96"
                onChange={(event) => update(field.id, { width: Number(event.target.value) })}
                step="8"
                type="range"
                value={field.width}
              />
            </label>
          </li>
        ))}
      </ol>
    </aside>
  );
}

// ─── Cells ───────────────────────────────────────────────────────────────────

function PeopleCell({ task }: { task: Task }) {
  const names = task.assignees.map((id) => USERS[id]?.name).filter(Boolean);
  return (
    <div className={styles.listPeopleCell}>
      <RoomAvatarStack limit={3} showUnassigned={false} task={task} />
      <span>
        {names.length === 0 ? "Unassigned" : names.slice(0, 2).join(", ")}
        {names.length > 2 ? ` and ${names.length - 2} more` : ""}
      </span>
    </div>
  );
}

function FieldCell({
  field,
  task,
  now,
}: {
  field: ListFieldId;
  task: Task;
  now: number;
}) {
  const { moveTask, updateTask } = useTasksDispatch();
  const { openTask } = useTaskPanel();
  if (field === "task") {
    return (
      <div className={styles.listTaskCell}>
        <button
          className={styles.taskTitleButton}
          onClick={() => openTask(task.id)}
          type="button"
        >
          {task.title}
        </button>
        {task.description ? <p>{task.description}</p> : null}
      </div>
    );
  }
  if (field === "status") {
    return (
      <select
        aria-label={`Status for ${task.title}`}
        onChange={(event) => moveTask(task.id, event.target.value as LaneId)}
        value={task.lane}
      >
        {LANE_ORDER.map((lane) => (
          <option key={lane} value={lane}>
            {LANES[lane].name}
          </option>
        ))}
      </select>
    );
  }
  if (field === "people") return <PeopleCell task={task} />;
  if (field === "schedule") return <ScheduleText now={now} task={task} />;
  if (field === "priority") {
    return (
      <select
        aria-label={`Priority for ${task.title}`}
        onChange={(event) => updateTask(task.id, { priority: event.target.value as Priority })}
        value={task.priority}
      >
        {PRIORITY_ORDER.map((priority) => (
          <option key={priority} value={priority}>
            {PRIORITY_LABEL[priority].label}
          </option>
        ))}
      </select>
    );
  }
  return <TaskSignals task={task} />;
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function ListRow({
  task,
  visibleFields,
  selected,
  now,
  onRowClick,
  onRowKeyDown,
}: {
  task: Task;
  visibleFields: ListFieldConfig[];
  selected: boolean;
  now: number;
  onRowClick: (taskId: string, e: React.MouseEvent) => void;
  onRowKeyDown: (taskId: string, e: React.KeyboardEvent<HTMLTableRowElement>) => void;
}) {
  return (
    <tr
      aria-label={`${task.title}. ${LANES[task.lane].name}`}
      className={styles.listTaskRow}
      data-selected={selected || undefined}
      data-task-id={task.id}
      onClick={(e) => {
        if (isInteractiveTarget(e.target)) return;
        onRowClick(task.id, e);
      }}
      onKeyDown={(e) => onRowKeyDown(task.id, e)}
      tabIndex={0}
    >
      <td className={styles.listSelectionCell}>
        <TaskCompleteBox task={task} />
      </td>
      {visibleFields.map((field) => {
        const Cell = field.id === "task" ? "th" : "td";
        return (
          <Cell
            className={field.id === "task" ? styles.listFrozenTask : styles.listDataCell}
            data-field={field.id}
            key={field.id}
            scope={field.id === "task" ? "row" : undefined}
          >
            <div>
              <FieldCell field={field.id} now={now} task={task} />
            </div>
          </Cell>
        );
      })}
    </tr>
  );
}

// ─── ListApp ─────────────────────────────────────────────────────────────────

export function ListApp() {
  const personalization = usePersonalization();
  const state = useTasksState();
  const { toggleComplete, moveTask, removeTask } = useTasksDispatch();
  const { taskId: openTaskId, openTask } = useTaskPanel();
  const { density, fieldsOpen, setFieldsOpen } = useRoomTools();
  const { openDialog } = useAddTask();
  // Room-scoped list: search / filter / sort from the view bar apply here.
  const visibleTasks = useRoomVisibleTasks();
  // Mount-stable clock for the overdue receipts (Compiler-safe).
  const [now] = useState(() => Date.now());
  const [fields, setFields] = useState<ListFieldConfig[]>(DEFAULT_LIST_FIELDS);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<LaneId>>(new Set());

  const visibleFields = fields.filter((field) => field.visible);
  const totalColumns = 1 + visibleFields.length;

  // Group the room-visible tasks by canonical lane. Custom board columns
  // deliberately don't exist here: the list reads `lane` only (see the
  // COALESCE arch note in board-app.tsx).
  const grouped = useMemo(() => {
    const map: Record<LaneId, Task[]> = { todo: [], doing: [], review: [], done: [] };
    for (const task of visibleTasks) map[task.lane].push(task);
    return map;
  }, [visibleTasks]);

  // Bulk selection. `selected` holds task ids; `anchor` is the last
  // shift-click root for range-select. `flatOrder` is the display
  // order (lane group then row order) so a shift-click range crosses
  // group boundaries the way the user sees them.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);
  const flatOrder = useMemo(
    () => LANE_ORDER.flatMap((lane) => grouped[lane].map((t) => t.id)),
    [grouped],
  );

  // Esc clears the selection. Click-outside is implicit via row clicks
  // landing on either a row (selects) or the detail panel (clears).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && selected.size > 0) {
        setSelected(new Set());
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected.size]);

  const onRowClick = useCallback(
    (taskId: string, e: React.MouseEvent) => {
      // Plain click → open detail panel; only modifiers select.
      const isShift = e.shiftKey;
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isShift && !isMeta) {
        // If anything's selected, plain click clears + opens.
        if (selected.size > 0) {
          setSelected(new Set());
        }
        openTask(taskId);
        return;
      }
      e.preventDefault();
      setSelected((prev) => {
        const next = new Set(prev);
        if (isMeta) {
          // ⌘/Ctrl click: toggle just this row.
          if (next.has(taskId)) next.delete(taskId);
          else next.add(taskId);
          anchorRef.current = taskId;
          return next;
        }
        // Shift click: extend from anchor (or this row if no anchor).
        const anchor = anchorRef.current;
        if (!anchor) {
          next.add(taskId);
          anchorRef.current = taskId;
          return next;
        }
        const a = flatOrder.indexOf(anchor);
        const b = flatOrder.indexOf(taskId);
        if (a < 0 || b < 0) {
          next.add(taskId);
          return next;
        }
        const [lo, hi] = a < b ? [a, b] : [b, a];
        for (let i = lo; i <= hi; i++) next.add(flatOrder[i]);
        return next;
      });
    },
    [flatOrder, openTask, selected.size],
  );

  const onRowKeyDown = useCallback(
    (taskId: string, e: React.KeyboardEvent<HTMLTableRowElement>) => {
      const target = e.target as HTMLElement;
      if (target.matches("input, select, textarea, button") || target.isContentEditable) return;
      if (e.key === "Enter" && e.target === e.currentTarget) {
        e.preventDefault();
        openTask(taskId);
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const index = flatOrder.indexOf(taskId);
        if (index < 0) return;
        const next =
          flatOrder[
            Math.max(0, Math.min(flatOrder.length - 1, index + (e.key === "ArrowUp" ? -1 : 1)))
          ];
        if (next) {
          document
            .querySelector<HTMLElement>(`tr[data-task-id="${next}"]`)
            ?.focus();
        }
      }
    },
    [flatOrder, openTask],
  );

  const toggleGroup = (lane: LaneId) =>
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(lane)) next.delete(lane);
      else next.add(lane);
      return next;
    });

  const moveSelected = (toLane: LaneId) => {
    selected.forEach((id) => moveTask(id, toLane));
    setSelected(new Set());
  };

  const completeSelected = () => {
    selected.forEach((id) => {
      const t = state.tasks.find((x) => x.id === id);
      if (t && t.lane !== "done") toggleComplete(id);
    });
    setSelected(new Set());
  };

  const deleteSelected = () => {
    selected.forEach((id) => removeTask(id));
    setSelected(new Set());
  };

  if (state.tasks.length === 0) {
    return (
      <EmptyStateOverlay
        ghost={<ListGhost />}
        headline={personalization.headline}
        body={personalization.body}
        primaryLabel={personalization.firstTaskExample}
      />
    );
  }

  return (
    <section
      aria-label="Workspace List"
      className={styles.listView}
      data-density={density}
    >
      {fieldsOpen ? (
        <FieldPanel
          fields={fields}
          onChange={setFields}
          onClose={() => setFieldsOpen(false)}
        />
      ) : null}
      <div className={`${styles.listTableScroller} thin-scroll`}>
        <table className={styles.taskTable} data-no-expand="true">
          <caption>
            Workspace tasks grouped by status. Task titles remain frozen while
            fields scroll.
          </caption>
          <colgroup>
            <col style={{ width: 42 }} />
            {visibleFields.map((field) => (
              <col key={field.id} style={{ width: field.width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">
                <span className={styles.srOnly}>Complete</span>
              </th>
              {visibleFields.map((field) => (
                <th
                  className={field.id === "task" ? styles.listFrozenHeader : undefined}
                  data-field={field.id}
                  key={field.id}
                  scope="col"
                >
                  {field.label}
                  <span>{field.width}px</span>
                </th>
              ))}
            </tr>
          </thead>
          {visibleTasks.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={totalColumns}>
                  <div className={styles.listEmpty}>
                    <Icon name="list" size={21} />
                    <strong>No work matches this list</strong>
                    <p>Clear the room filters or add a task.</p>
                    <button onClick={openDialog} type="button">
                      <Icon name="add" size={14} />
                      Add task
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          ) : (
            LANE_ORDER.map((laneId) => {
              const laneTasks = grouped[laneId];
              if (laneTasks.length === 0) return null;
              const dated = laneTasks.filter((t) => t.due).length;
              const collapsed = collapsedGroups.has(laneId);
              return (
                <tbody data-group={laneId} key={laneId}>
                  <tr className={styles.listGroupRow}>
                    <th colSpan={totalColumns} scope="rowgroup">
                      <div className={styles.listGroupHeading}>
                        <button
                          aria-expanded={!collapsed}
                          aria-label={`${collapsed ? "Expand" : "Collapse"} ${LANES[laneId].name} group`}
                          onClick={() => toggleGroup(laneId)}
                          type="button"
                        >
                          <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={14} />
                        </button>
                        <div>
                          <strong>{LANES[laneId].name}</strong>
                          <span>{GROUP_NOTES[laneId]}</span>
                        </div>
                        <span className={styles.groupCount}>
                          {laneTasks.length} task{laneTasks.length === 1 ? "" : "s"}
                        </span>
                        <label className={styles.groupProgress}>
                          <span>
                            {dated} of {laneTasks.length} dated
                          </span>
                          <progress
                            aria-label={`${LANES[laneId].name} dated coverage`}
                            max={laneTasks.length}
                            value={dated}
                          />
                        </label>
                        <button
                          className={styles.groupAdd}
                          onClick={openDialog}
                          type="button"
                        >
                          <Icon name="add" size={13} />
                          Add task
                        </button>
                      </div>
                    </th>
                  </tr>
                  {collapsed
                    ? null
                    : laneTasks.map((task) => (
                        <ListRow
                          key={task.id}
                          now={now}
                          onRowClick={onRowClick}
                          onRowKeyDown={onRowKeyDown}
                          selected={selected.has(task.id) || openTaskId === task.id}
                          task={task}
                          visibleFields={visibleFields}
                        />
                      ))}
                </tbody>
              );
            })
          )}
        </table>
      </div>
      <BulkBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        onMove={moveSelected}
        onComplete={completeSelected}
        onDelete={deleteSelected}
      />
    </section>
  );
}

// ─── Bulk toolbar ────────────────────────────────────────────────────────────

/**
 * Bulk-action toolbar in the lab's dark bulkToolbar grammar, sticky
 * bottom-center, slides up when N rows are selected.
 *
 * Selection mechanics: shift-click extends a range from the last
 * anchor; ⌘/Ctrl-click toggles a single row; plain click clears
 * + opens the detail panel.
 */
function BulkBar({
  count,
  onClear,
  onMove,
  onComplete,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onMove: (lane: LaneId) => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 12, x: "-50%" }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className={shared.bulkToolbar}
        >
          <strong>{count} selected</strong>
          <select
            aria-label="Move selected tasks to status"
            onChange={(e) => {
              if (e.target.value) onMove(e.target.value as LaneId);
            }}
            value=""
          >
            <option disabled value="">
              Move to…
            </option>
            {LANE_ORDER.map((laneId) => (
              <option key={laneId} value={laneId}>
                {LANES[laneId].name}
              </option>
            ))}
          </select>
          <button onClick={onComplete} type="button">
            <Icon name="check" size={13} />
            Mark done
          </button>
          <button onClick={onDelete} type="button">
            <Icon name="trash" size={13} />
            Delete
          </button>
          <span aria-hidden className={shared.toolbarDivider} />
          <button aria-label="Clear selection" onClick={onClear} type="button">
            <Icon name="close" size={13} />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
