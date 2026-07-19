"use client";

import { useMemo, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { useLabStore } from "../../store";
import { STATUS_LABELS, TASK_STATUSES, type LabTask, type TaskStatus } from "../../types";
import { Icon } from "../../shared/icons";
import { TaskContextMenu, useTaskContextMenu } from "../../shared/task-context-menu";
import {
  AvatarStack,
  IconButton,
  LabelList,
  PriorityMark,
  ScheduleText,
  TaskSelection,
  TaskSignals,
} from "../../shared/task-ui";
import { focusSpatialTask, InlineTaskTitle, isInteractiveTarget } from "./spatial-task";
import styles from "./option-c.module.css";

const WIP_LIMITS: Partial<Record<TaskStatus, number>> = {
  active: 8,
  review: 6,
  waiting: 5,
};

type DropTarget = { status: TaskStatus; index: number } | null;

function nextLaneTask(tasks: LabTask[], status: TaskStatus, index: number): string | null {
  const lane = tasks.filter((task) => task.status === status);
  if (lane.length === 0) return null;
  return lane[Math.min(index, lane.length - 1)]?.id ?? null;
}

export function BoardView({ tasks }: { tasks: LabTask[] }) {
  const store = useLabStore();
  const menu = useTaskContextMenu();
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [doneCollapsed, setDoneCollapsed] = useState(true);
  const orderedIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const lanes = useMemo(() => new Map(TASK_STATUSES.map((status) => [
    status,
    tasks.filter((task) => task.status === status),
  ])), [tasks]);

  const setTarget = (status: TaskStatus, index: number) => {
    setDropTarget((current) => current?.status === status && current.index === index ? current : { status, index });
    if (store.drag?.kind === "board" && (store.drag.overStatus !== status || store.drag.overIndex !== index)) {
      store.setDrag({ ...store.drag, overStatus: status, overIndex: index });
    }
  };

  const finishDrag = () => {
    setDropTarget(null);
    store.setDrag(null);
  };

  const drop = (event: DragEvent, status: TaskStatus, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    const taskId = store.drag?.kind === "board" ? store.drag.taskId : event.dataTransfer.getData("text/task-id");
    if (taskId && !store.readOnly) store.moveStatus(taskId, status, index);
    finishDrag();
  };

  const onCardKeyDown = (event: KeyboardEvent<HTMLElement>, task: LabTask, laneTasks: LabTask[], index: number) => {
    if (event.target !== event.currentTarget) return;
    const statusIndex = TASK_STATUSES.indexOf(task.status);
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
    if (event.key === "Escape" && store.drag) {
      event.preventDefault();
      finishDrag();
      return;
    }
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();

    if (event.altKey && !store.readOnly) {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        const nextIndex = Math.max(0, Math.min(laneTasks.length - 1, index + (event.key === "ArrowUp" ? -1 : 1)));
        if (nextIndex !== index) store.moveStatus(task.id, task.status, nextIndex);
        focusSpatialTask(task.id);
        return;
      }
      const nextStatusIndex = Math.max(0, Math.min(TASK_STATUSES.length - 1, statusIndex + (event.key === "ArrowLeft" ? -1 : 1)));
      const nextStatus = TASK_STATUSES[nextStatusIndex];
      if (nextStatus !== task.status) store.moveStatus(task.id, nextStatus, Math.min(index, lanes.get(nextStatus)?.length ?? 0));
      focusSpatialTask(task.id);
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const next = laneTasks[Math.max(0, Math.min(laneTasks.length - 1, index + (event.key === "ArrowUp" ? -1 : 1)))];
      if (next) focusSpatialTask(next.id);
      return;
    }
    const nextStatusIndex = Math.max(0, Math.min(TASK_STATUSES.length - 1, statusIndex + (event.key === "ArrowLeft" ? -1 : 1)));
    const targetId = nextLaneTask(tasks, TASK_STATUSES[nextStatusIndex], index);
    if (targetId) focusSpatialTask(targetId);
  };

  const card = (task: LabTask, laneTasks: LabTask[], index: number) => (
    <article
      aria-label={`${task.title}, ${STATUS_LABELS[task.status]}`}
      className={styles.boardCard}
      data-active={store.activeId === task.id || undefined}
      data-c-task={task.id}
      data-dragging={store.drag?.kind === "board" && store.drag.taskId === task.id || undefined}
      data-selected={store.selectedIds.includes(task.id) || undefined}
      data-task-id={task.id}
      draggable={!store.readOnly}
      onClick={(event) => {
        if (store.selectedIds.length > 0 && !isInteractiveTarget(event.target)) store.toggleSelected(task.id, orderedIds, event.shiftKey);
      }}
      onContextMenu={(event: MouseEvent<HTMLElement>) => menu.openMenu(task.id, event)}
      onDragEnd={finishDrag}
      onDragStart={(event) => {
        if (store.readOnly) { event.preventDefault(); return; }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/task-id", task.id);
        store.setDrag({ kind: "board", taskId: task.id, fromStatus: task.status, overStatus: task.status, overIndex: index });
        setDropTarget({ status: task.status, index });
      }}
      onFocus={() => store.setActive(task.id)}
      onKeyDown={(event) => onCardKeyDown(event, task, laneTasks, index)}
      tabIndex={0}
    >
      <div className={styles.boardCardTopline}>
        <TaskSelection orderedIds={orderedIds} task={task} />
        <PriorityMark task={task} />
        <span className={styles.boardCardSpacer} />
        <IconButton
          icon="more"
          label={`Open menu for ${task.title}`}
          onClick={(event) => { event.stopPropagation(); menu.openMenuAt(task.id, event.currentTarget); }}
        />
      </div>
      <InlineTaskTitle className={styles.boardCardTitle} task={task} />
      <div className={styles.boardCardMeta}><ScheduleText compact task={task} /><TaskSignals task={task} /></div>
      <div className={styles.boardCardFooter}><LabelList limit={2} task={task} /><AvatarStack limit={3} task={task} /></div>
    </article>
  );

  return (
    <div aria-label="Status board" className={styles.boardViewport}>
      <div className={styles.boardLanes}>
        {TASK_STATUSES.map((status) => {
          const laneTasks = lanes.get(status) ?? [];
          const limit = WIP_LIMITS[status];
          const overLimit = limit !== undefined && laneTasks.length > limit;
          const collapsed = status === "done" && doneCollapsed;
          return (
            <section
              aria-labelledby={`c-lane-${status}`}
              className={styles.boardLane}
              data-collapsed={collapsed || undefined}
              data-drop-target={dropTarget?.status === status || undefined}
              data-status={status}
              key={status}
              onDragOver={(event) => {
                if (store.drag?.kind !== "board" || store.readOnly) return;
                event.preventDefault();
                setTarget(status, laneTasks.length);
              }}
              onDrop={(event) => drop(event, status, laneTasks.length)}
            >
              <header className={styles.boardLaneHeader}>
                <div>
                  <span aria-hidden="true" className={styles.statusSignal} data-status={status} />
                  <h2 id={`c-lane-${status}`}>{STATUS_LABELS[status]}</h2>
                  <strong>{laneTasks.length}</strong>
                </div>
                <div>
                  {limit !== undefined ? <span className={styles.wipSignal} data-over={overLimit || undefined}>{overLimit ? `${laneTasks.length - limit} over` : `${limit} max`}</span> : null}
                  {status === "done" ? (
                    <button aria-expanded={!doneCollapsed} aria-label={`${doneCollapsed ? "Expand" : "Collapse"} Done lane`} onClick={() => setDoneCollapsed((value) => !value)} type="button">
                      <Icon name={doneCollapsed ? "chevron-right" : "chevron-down"} size={14} />
                    </button>
                  ) : null}
                </div>
              </header>
              {!collapsed ? (
                <>
                  <ul className={styles.boardTaskList}>
                    {laneTasks.map((task, index) => (
                      <li
                        key={task.id}
                        onDragOver={(event) => {
                          if (store.drag?.kind !== "board" || store.readOnly) return;
                          event.preventDefault();
                          event.stopPropagation();
                          const rect = event.currentTarget.getBoundingClientRect();
                          setTarget(status, event.clientY < rect.top + rect.height / 2 ? index : index + 1);
                        }}
                        onDrop={(event) => drop(event, status, dropTarget?.status === status ? dropTarget.index : index)}
                      >
                        {dropTarget?.status === status && dropTarget.index === index ? <span aria-hidden="true" className={styles.boardInsertion} /> : null}
                        {card(task, laneTasks, index)}
                      </li>
                    ))}
                    {dropTarget?.status === status && dropTarget.index === laneTasks.length ? <li aria-hidden="true" className={styles.boardInsertionEnd}><span className={styles.boardInsertion} /></li> : null}
                  </ul>
                  {laneTasks.length === 0 ? (
                    <div className={styles.boardEmpty}>
                      <span>Nothing in {STATUS_LABELS[status].toLowerCase()}</span>
                      <small>Drop work here or add a task.</small>
                    </div>
                  ) : null}
                  <button className={styles.laneAdd} disabled={store.readOnly} onClick={() => store.addTask(status)} type="button"><Icon name="add" size={14} />Add task</button>
                </>
              ) : <button className={styles.doneSummary} onClick={() => setDoneCollapsed(false)} type="button">{laneTasks.length} completed tasks</button>}
            </section>
          );
        })}
      </div>
      <TaskContextMenu menu={menu.menu} onClose={menu.closeMenu} />
    </div>
  );
}
