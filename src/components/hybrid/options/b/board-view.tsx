"use client";

import { useMemo, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { useLabStore } from "../../store";
import { STATUS_LABELS, TASK_STATUSES, type LabTask, type TaskStatus } from "../../types";
import { Icon } from "../../shared/icons";
import { TaskContextMenu, useTaskContextMenu } from "../../shared/task-context-menu";
import { AvatarStack, LabelList, ScheduleText, TaskSelection, TaskSignals } from "../../shared/task-ui";
import { InlineTaskTitle } from "./task-edit";
import { focusTaskElement, isInteractiveTarget } from "./option-b-utils";
import styles from "./option-b.module.css";

const LANE_NOTES: Record<TaskStatus, string> = {
  queued: "Ready when an owner has room",
  active: "The work moving now",
  review: "Decisions waiting for a clear read",
  waiting: "Held by an explicit dependency",
  done: "Receipts from this planning period",
};

const WIP_LIMITS: Partial<Record<TaskStatus, number>> = {
  active: 8,
  review: 6,
  waiting: 5,
};

function BoardCard({
  task,
  laneTasks,
  laneIndex,
  statusIndex,
  allVisibleIds,
  onOpenMenu,
}: {
  task: LabTask;
  laneTasks: LabTask[];
  laneIndex: number;
  statusIndex: number;
  allVisibleIds: string[];
  onOpenMenu: ReturnType<typeof useTaskContextMenu>["openMenuAt"];
}) {
  const store = useLabStore();
  const selected = store.selectedIds.includes(task.id);
  const insertionBefore = store.drag?.kind === "board" && store.drag.overStatus === task.status && store.drag.overIndex === laneIndex;

  const updateDropTarget = (event: DragEvent<HTMLElement>) => {
    if (store.readOnly || store.drag?.kind !== "board") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect();
    const nextIndex = event.clientY > rect.top + rect.height / 2 ? laneIndex + 1 : laneIndex;
    if (store.drag.overStatus !== task.status || store.drag.overIndex !== nextIndex) {
      store.setDrag({ ...store.drag, overStatus: task.status, overIndex: nextIndex });
    }
  };

  const drop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const taskId = store.drag?.kind === "board" ? store.drag.taskId : event.dataTransfer.getData("text/x-signal-task");
    const moving = store.taskById(taskId);
    if (!moving || store.readOnly) return;
    let index = store.drag?.kind === "board" && store.drag.overIndex !== null ? store.drag.overIndex : laneIndex;
    const originIndex = laneTasks.findIndex((item) => item.id === taskId);
    if (moving.status === task.status && originIndex >= 0 && index > originIndex) index -= 1;
    store.moveStatus(taskId, task.status, index);
    store.setDrag(null);
    focusTaskElement(taskId, "[data-board-task]");
  };

  const moveFocus = (nextStatusIndex: number, nextLaneIndex: number) => {
    const status = TASK_STATUSES[Math.max(0, Math.min(TASK_STATUSES.length - 1, nextStatusIndex))];
    const candidates = store.tasksByStatus(status);
    const next = candidates[Math.max(0, Math.min(candidates.length - 1, nextLaneIndex))];
    if (next) focusTaskElement(next.id, "[data-board-task]");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
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
    if (event.key === " " && !event.altKey) {
      event.preventDefault();
      store.toggleSelected(task.id, allVisibleIds, event.shiftKey);
      return;
    }
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      if (store.readOnly) return;
      const nextIndex = event.key === "ArrowUp" ? Math.max(0, laneIndex - 1) : Math.min(laneTasks.length - 1, laneIndex + 1);
      store.moveStatus(task.id, task.status, nextIndex);
      focusTaskElement(task.id, "[data-board-task]");
      return;
    }
    if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      if (store.readOnly) return;
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      const nextStatus = TASK_STATUSES[Math.max(0, Math.min(TASK_STATUSES.length - 1, statusIndex + direction))];
      store.moveStatus(task.id, nextStatus, laneIndex);
      focusTaskElement(task.id, "[data-board-task]");
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(statusIndex, laneIndex + (event.key === "ArrowUp" ? -1 : 1));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      moveFocus(statusIndex + (event.key === "ArrowLeft" ? -1 : 1), laneIndex);
    }
  };

  return (
    <li
      className={styles.boardCardItem}
      data-insertion-before={insertionBefore || undefined}
      data-task-id={task.id}
      onDragOver={updateDropTarget}
      onDrop={drop}
    >
      <article
        aria-label={`${task.title}. ${STATUS_LABELS[task.status]}`}
        className={styles.boardCard}
        data-active={store.activeId === task.id || undefined}
        data-board-task="true"
        data-dragging={store.drag?.kind === "board" && store.drag.taskId === task.id || undefined}
        data-selected={selected || undefined}
        data-task-id={task.id}
        draggable={!store.readOnly}
        onClick={(event: MouseEvent<HTMLElement>) => {
          if (isInteractiveTarget(event.target)) return;
          if (store.selectedIds.length > 0 || event.ctrlKey || event.metaKey || event.shiftKey) {
            store.toggleSelected(task.id, allVisibleIds, event.shiftKey);
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          onOpenMenu(task.id, event.currentTarget);
          if (rect.width === 0) store.setActive(task.id);
        }}
        onDragEnd={() => store.setDrag(null)}
        onDragStart={(event) => {
          if (store.readOnly) return;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/x-signal-task", task.id);
          store.setDrag({ kind: "board", taskId: task.id, fromStatus: task.status, overStatus: task.status, overIndex: laneIndex });
        }}
        onFocus={() => store.setActive(task.id)}
        onKeyDown={onKeyDown}
        tabIndex={0}
      >
        <div className={styles.cardLead}>
          <TaskSelection disabled={store.readOnly} orderedIds={allVisibleIds} task={task} />
          <InlineTaskTitle task={task} />
          <button
            aria-label={`More actions for ${task.title}`}
            className={styles.cardMenuButton}
            onClick={(event) => onOpenMenu(task.id, event.currentTarget)}
            type="button"
          ><Icon name="more" size={16} /></button>
        </div>
        <p className={styles.cardPurpose}>{task.description}</p>
        <div className={styles.cardLabels}><LabelList limit={2} task={task} /></div>
        <div className={styles.cardScheduleRow}>
          <ScheduleText task={task} />
          <AvatarStack limit={3} task={task} />
        </div>
        <footer className={styles.cardFooter}>
          <TaskSignals task={task} />
          {task.blockedByIds.length > 0 ? <span className={styles.waitingReason}>Waiting on {task.blockedByIds.length} task{task.blockedByIds.length === 1 ? "" : "s"}</span> : null}
        </footer>
      </article>
    </li>
  );
}

export function BoardView({ tasks }: { tasks: LabTask[] }) {
  const store = useLabStore();
  const [doneCollapsed, setDoneCollapsed] = useState(false);
  const contextMenu = useTaskContextMenu();
  const visibleIds = useMemo(() => tasks.map((task) => task.id), [tasks]);

  const dropAtEnd = (event: DragEvent<HTMLElement>, status: TaskStatus, laneTasks: LabTask[]) => {
    event.preventDefault();
    const taskId = store.drag?.kind === "board" ? store.drag.taskId : event.dataTransfer.getData("text/x-signal-task");
    const task = store.taskById(taskId);
    if (!task || store.readOnly) return;
    let index = laneTasks.length;
    const originIndex = laneTasks.findIndex((item) => item.id === taskId);
    if (task.status === status && originIndex >= 0) index -= 1;
    store.moveStatus(taskId, status, index);
    store.setDrag(null);
    focusTaskElement(taskId, "[data-board-task]");
  };

  return (
    <section aria-label="Workspace Board" className={styles.boardView}>
      <div className={styles.boardScroller}>
        <div className={styles.boardGrid}>
          {TASK_STATUSES.map((status, statusIndex) => {
            const laneTasks = tasks.filter((task) => task.status === status);
            const totalInLane = store.tasks.filter((task) => task.status === status).length;
            const limit = WIP_LIMITS[status];
            const overLimit = limit !== undefined && totalInLane > limit;
            const collapsed = status === "done" && doneCollapsed;
            return (
              <section aria-labelledby={`option-b-lane-${status}`} className={styles.boardLane} data-collapsed={collapsed || undefined} data-status={status} key={status}>
                <header className={styles.laneHeader}>
                  <div>
                    <span className={styles.laneStatusMark} data-status={status} />
                    <h2 id={`option-b-lane-${status}`}>{STATUS_LABELS[status]}</h2>
                    <span className={styles.laneCount}>{laneTasks.length === totalInLane ? totalInLane : `${laneTasks.length}/${totalInLane}`}</span>
                  </div>
                  {status === "done" ? (
                    <button aria-expanded={!doneCollapsed} aria-label={`${doneCollapsed ? "Expand" : "Collapse"} Done lane`} onClick={() => setDoneCollapsed((value) => !value)} type="button">
                      <Icon name={doneCollapsed ? "chevron-right" : "chevron-down"} size={14} />
                    </button>
                  ) : null}
                  <p>{LANE_NOTES[status]}</p>
                  {limit !== undefined ? <span className={styles.wipNote} data-over={overLimit || undefined}>WIP {totalInLane}/{limit}{overLimit ? " - review capacity" : ""}</span> : null}
                </header>
                {collapsed ? null : (
                  <>
                    <ul
                      aria-label={`${STATUS_LABELS[status]} tasks`}
                      className={styles.boardTaskList}
                      onDragOver={(event) => {
                        if (store.readOnly || store.drag?.kind !== "board" || laneTasks.length > 0) return;
                        event.preventDefault();
                        store.setDrag({ ...store.drag, overStatus: status, overIndex: 0 });
                      }}
                      onDrop={(event) => dropAtEnd(event, status, laneTasks)}
                    >
                      {laneTasks.map((task, laneIndex) => (
                        <BoardCard
                          allVisibleIds={visibleIds}
                          key={task.id}
                          laneIndex={laneIndex}
                          laneTasks={laneTasks}
                          onOpenMenu={contextMenu.openMenuAt}
                          statusIndex={statusIndex}
                          task={task}
                        />
                      ))}
                      {laneTasks.length === 0 ? (
                        <li className={styles.emptyLane} data-drop-active={store.drag?.kind === "board" && store.drag.overStatus === status || undefined}>
                          <strong>{totalInLane === 0 ? "A clear lane" : "No matching work"}</strong>
                          <span>{totalInLane === 0 ? "Add the next useful task when it is ready." : "Adjust the room filters to bring work back."}</span>
                        </li>
                      ) : (
                        <li
                          aria-hidden="true"
                          className={styles.boardEndDrop}
                          data-insertion={store.drag?.kind === "board" && store.drag.overStatus === status && store.drag.overIndex === laneTasks.length || undefined}
                          onDragOver={(event) => {
                            if (store.readOnly || store.drag?.kind !== "board") return;
                            event.preventDefault();
                            store.setDrag({ ...store.drag, overStatus: status, overIndex: laneTasks.length });
                          }}
                        />
                      )}
                    </ul>
                    <button className={styles.laneAddButton} disabled={store.readOnly} onClick={() => store.addTask(status)} type="button"><Icon name="add" size={14} />Add task</button>
                  </>
                )}
              </section>
            );
          })}
        </div>
      </div>
      <TaskContextMenu menu={contextMenu.menu} onClose={contextMenu.closeMenu} />
    </section>
  );
}
