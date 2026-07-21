"use client";

import type { DragEvent, KeyboardEvent, MouseEvent } from "react";
import { useLabStore } from "../../store";
import { STATUS_LABELS, TASK_STATUSES, type LabTask, type TaskStatus } from "../../types";
import { ActionsDropdown, ContextActions, type ActionItem } from "@/components/primitives/context-actions";
import { Icon } from "../../shared/icons";
import {
  AvatarStack,
  LabelList,
  PriorityMark,
  ScheduleText,
  TaskOpenButton,
  TaskSelection,
  TaskSignals,
} from "../../shared/task-ui";
import { InlineTaskTitle, KeyboardLegend } from "./quiet-command-components";
import { focusTask } from "./quiet-command-model";
import styles from "./option-a.module.css";

const WIP_LIMITS: Partial<Record<TaskStatus, number>> = {
  queued: 12,
  active: 8,
  review: 6,
  waiting: 6,
};

function statusOffset(status: TaskStatus, amount: number): TaskStatus {
  const index = TASK_STATUSES.indexOf(status);
  return TASK_STATUSES[Math.max(0, Math.min(TASK_STATUSES.length - 1, index + amount))];
}

/**
 * Build the action registry for a task card.
 *
 * Groups: open → workflow → organisation → destructive
 * Labels: plain brand-voice per brief ("Open", "Copy link", "Change status",
 *   "Assign", "Set priority", "Move to", "Make subtask of", "Archive", "Delete").
 *
 * In demo/lab contexts the store's readOnly flag is respected — mutations
 * no-op exactly as they did in the old hand-rolled menu.
 */
function buildTaskActions(
  task: LabTask,
  store: ReturnType<typeof useLabStore>,
): ActionItem[] {
  const ro = store.readOnly;

  // ── open ──────────────────────────────────────────────────────────────────
  const openItems: ActionItem[] = [
    {
      id: "open",
      label: "Open",
      icon: <Icon name="focus" size={14} />,
      group: "open",
      shortcutHint: "↵",
      onSelect: () => store.openTask(task.id),
    },
    {
      id: "copy-link",
      label: "Copy link",
      group: "open",
      onSelect: () => {
        const url = `${typeof window !== "undefined" ? window.location.origin : ""}/app/board?task=${task.id}`;
        navigator.clipboard?.writeText(url).catch(() => undefined);
      },
    },
  ];

  // ── workflow ───────────────────────────────────────────────────────────────
  const statusSubmenu: ActionItem[] = TASK_STATUSES.map((status) => ({
    id: `status-${status}`,
    label: STATUS_LABELS[status],
    icon: <span style={{ background: "var(--x-task-text-muted)", borderRadius: "50%", display: "inline-block", height: 7, width: 7 }} data-status={status} />,
    group: "workflow" as ActionItem["group"],
    disabled: ro || status === task.status,
    disabledReason: ro ? "Read-only workspace" : undefined,
    onSelect: () => { if (!ro) store.moveStatus(task.id, status); },
  }));

  const prioritySubmenu: ActionItem[] = (
    [
      { value: "urgent" as const, label: "Urgent" },
      { value: "high" as const, label: "High" },
      { value: "normal" as const, label: "Normal" },
      { value: "low" as const, label: "Low" },
    ] as const
  ).map(({ value, label }) => ({
    id: `priority-${value}`,
    label,
    group: "workflow" as ActionItem["group"],
    disabled: ro || task.priority === value,
    disabledReason: ro ? "Read-only workspace" : undefined,
    onSelect: () => { if (!ro) store.updatePriority(task.id, value); },
  }));

  const workflowItems: ActionItem[] = [
    // One-click complete/reopen stays first — it was the old menu's primary
    // action and the most common thing anyone does from a card.
    {
      id: "toggle-complete",
      label: task.completed ? "Reopen" : "Mark done",
      icon: <Icon name="check" size={14} />,
      group: "workflow",
      disabled: ro,
      disabledReason: ro ? "Read-only workspace" : undefined,
      onSelect: () => { if (!ro) store.toggleComplete(task.id); },
    },
    {
      id: "change-status",
      label: "Change status",
      group: "workflow",
      disabled: ro,
      disabledReason: ro ? "Read-only workspace" : undefined,
      submenu: statusSubmenu,
      onSelect: () => undefined,
    },
    {
      id: "set-priority",
      label: "Set priority",
      group: "workflow",
      disabled: ro,
      disabledReason: ro ? "Read-only workspace" : undefined,
      submenu: prioritySubmenu,
      onSelect: () => undefined,
    },
  ];

  // ── organisation ──────────────────────────────────────────────────────────
  // "Move to" — available statuses excluding current
  const moveToSubmenu: ActionItem[] = TASK_STATUSES.filter((s) => s !== task.status).map((status) => ({
    id: `move-to-${status}`,
    label: STATUS_LABELS[status],
    group: "organisation" as ActionItem["group"],
    disabled: ro,
    disabledReason: ro ? "Read-only workspace" : undefined,
    onSelect: () => { if (!ro) store.moveStatus(task.id, status); },
  }));

  const organisationItems: ActionItem[] = [
    {
      id: "move-to",
      label: "Move to",
      group: "organisation",
      disabled: ro,
      disabledReason: ro ? "Read-only workspace" : undefined,
      submenu: moveToSubmenu,
      onSelect: () => undefined,
    },
    {
      id: "duplicate",
      label: "Duplicate",
      group: "organisation",
      disabled: ro,
      disabledReason: ro ? "Read-only workspace" : undefined,
      onSelect: () => { if (!ro) store.duplicateTask(task.id); },
    },
  ];

  // ── destructive ───────────────────────────────────────────────────────────
  // Archive is handled through the production store's archiveTask dispatcher
  // where available. In lab/demo mode (LabStoreProvider), archiveTask does not
  // exist on the LabStore contract — fall back to deleteTask for session cleanup.
  // The store shape is checked at runtime so this is safe in both contexts.
  const storeAsAny = store as Record<string, unknown>;
  const hasArchive = typeof storeAsAny["archiveTask"] === "function";

  const destructiveItems: ActionItem[] = [
    ...(hasArchive
      ? [
          {
            id: "archive",
            label: "Archive",
            group: "destructive" as ActionItem["group"],
            disabled: ro,
            disabledReason: ro ? "Read-only workspace" : undefined,
            onSelect: () => {
              if (!ro) (storeAsAny["archiveTask"] as (id: string) => void)(task.id);
            },
          },
        ]
      : []),
    {
      id: "delete",
      label: "Delete",
      icon: <Icon name="trash" size={14} />,
      group: "destructive",
      disabled: ro,
      disabledReason: ro ? "Read-only workspace" : undefined,
      onSelect: () => { if (!ro) store.deleteTask(task.id); },
    },
  ];

  return [...openItems, ...workflowItems, ...organisationItems, ...destructiveItems];
}

export function BoardView({ tasks }: { tasks: LabTask[] }) {
  const store = useLabStore();
  const orderedIds = tasks.map((task) => task.id);

  const tasksInLane = (status: TaskStatus) => tasks
    .filter((task) => task.status === status)
    .sort((a, b) => a.order - b.order);

  const dropTask = (event: DragEvent, status: TaskStatus, index: number) => {
    event.preventDefault();
    if (store.readOnly) return;
    const taskId = event.dataTransfer.getData("text/task-id") || (store.drag?.kind === "board" ? store.drag.taskId : "");
    if (!taskId) return;
    store.moveStatus(taskId, status, index);
    store.setDrag(null);
    focusTask(taskId);
  };

  const keyCard = (
    event: KeyboardEvent<HTMLElement>,
    task: LabTask,
    laneTasks: LabTask[],
    laneIndex: number,
  ) => {
    if (event.target !== event.currentTarget) return;
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
    if (event.altKey && !store.readOnly && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      const nextIndex = event.key === "ArrowUp" ? laneIndex - 1 : laneIndex + 1;
      store.moveStatus(task.id, task.status, Math.max(0, Math.min(laneTasks.length - 1, nextIndex)));
      focusTask(task.id);
      return;
    }
    if (event.altKey && !store.readOnly && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      const targetStatus = statusOffset(task.status, event.key === "ArrowLeft" ? -1 : 1);
      if (targetStatus !== task.status) store.moveStatus(task.id, targetStatus);
      focusTask(task.id);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = laneTasks[event.key === "ArrowUp" ? laneIndex - 1 : laneIndex + 1];
      if (next) focusTask(next.id);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const targetStatus = statusOffset(task.status, event.key === "ArrowLeft" ? -1 : 1);
      const targetLane = tasksInLane(targetStatus);
      const target = targetLane[Math.min(laneIndex, Math.max(0, targetLane.length - 1))];
      if (target) focusTask(target.id);
    }
  };

  const cardClick = (event: MouseEvent<HTMLElement>, task: LabTask) => {
    if (store.selectedIds.length === 0) return;
    if ((event.target as Element).closest("button, input, select, textarea")) return;
    store.toggleSelected(task.id, orderedIds, event.shiftKey);
  };

  return (
    <div aria-label="Board lanes" className={styles.boardSurface}>
      <div className={styles.boardScroll}>
        {TASK_STATUSES.map((status) => {
          const laneTasks = tasksInLane(status);
          const limit = WIP_LIMITS[status];
          const overLimit = limit !== undefined && laneTasks.length > limit;
          return (
            <section aria-labelledby={`a-lane-${status}`} className={styles.boardLane} data-done={status === "done" || undefined} data-status={status} key={status}>
              <header className={styles.laneHeader}>
                <div>
                  <span className={styles.statusPip} data-status={status} />
                  <h2 id={`a-lane-${status}`}>{STATUS_LABELS[status]}</h2>
                  <span className={styles.laneCount}>{laneTasks.length}</span>
                </div>
                {limit !== undefined ? <span aria-label={`${laneTasks.length} of ${limit} work in progress`} className={styles.wipCount} data-over={overLimit || undefined}>WIP {laneTasks.length}/{limit}</span> : <span className={styles.wipCount}>Archive</span>}
              </header>
              <ul
                aria-label={`${STATUS_LABELS[status]} tasks`}
                className={styles.laneList}
                onDragOver={(event) => {
                  if (store.readOnly || store.drag?.kind !== "board") return;
                  event.preventDefault();
                  store.setDrag({ ...store.drag, overStatus: status, overIndex: laneTasks.length });
                }}
                onDrop={(event) => dropTask(event, status, laneTasks.length)}
              >
                {laneTasks.map((task, index) => {
                  const actions = buildTaskActions(task, store);
                  return (
                    <li key={task.id}>
                      {store.drag?.kind === "board" && store.drag.overStatus === status && store.drag.overIndex === index ? <div aria-hidden="true" className={styles.boardInsertion} /> : null}
                      {/*
                        ContextActions wraps the card: right-click on the article
                        and the visible ••• button are driven by the same action
                        registry (Principle 1, D-005); the previous hand-rolled
                        card menu is fully replaced on this surface.
                      */}
                      <ContextActions
                        items={actions}
                        target={
                          <article
                            aria-label={`${task.title}, ${STATUS_LABELS[task.status]}`}
                            className={styles.boardCard}
                            data-active={store.activeId === task.id || undefined}
                            data-completed={task.completed || undefined}
                            data-dragging={store.drag?.kind === "board" && store.drag.taskId === task.id || undefined}
                            data-selected={store.selectedIds.includes(task.id) || undefined}
                            data-task-id={task.id}
                            draggable={!store.readOnly}
                            onClick={(event) => cardClick(event, task)}
                            onDragEnd={() => store.setDrag(null)}
                            onDragOver={(event) => {
                              if (store.readOnly || store.drag?.kind !== "board") return;
                              event.preventDefault();
                              event.stopPropagation();
                              store.setDrag({ ...store.drag, overStatus: status, overIndex: index });
                            }}
                            onDragStart={(event) => {
                              if (store.readOnly) return;
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/task-id", task.id);
                              store.setDrag({ kind: "board", taskId: task.id, fromStatus: task.status, overStatus: task.status, overIndex: index });
                            }}
                            onDrop={(event) => { event.stopPropagation(); dropTask(event, status, index); }}
                            onFocus={() => { store.setActive(task.id); store.setPreview(task.id); }}
                            onKeyDown={(event) => keyCard(event, task, laneTasks, index)}
                            onMouseEnter={() => store.setPreview(task.id)}
                            onMouseLeave={() => { if (store.previewId === task.id) store.setPreview(null); }}
                            tabIndex={0}
                          >
                            <div className={styles.cardTopline}>
                              <TaskSelection disabled={store.readOnly} orderedIds={orderedIds} task={task} />
                              <PriorityMark task={task} />
                              <span className={styles.cardSpacer} />
                              <ActionsDropdown
                                items={actions}
                                trigger={<Icon name="more" size={15} />}
                                triggerLabel={`Actions for ${task.title}`}
                                triggerClassName={styles.cardMenuTrigger}
                              />
                            </div>
                            {store.editing?.taskId === task.id && store.editing.field === "title" ? (
                              <InlineTaskTitle className={styles.boardTitleEdit} task={task} />
                            ) : (
                              <TaskOpenButton className={styles.boardTitle} onDoubleClick={() => { if (!store.readOnly) store.setEditing(task.id, "title"); }} task={task}>{task.title}</TaskOpenButton>
                            )}
                            <div className={styles.cardLabels}><LabelList task={task} /></div>
                            <div className={styles.cardSchedule}><ScheduleText compact task={task} /><TaskSignals task={task} /></div>
                            <footer><AvatarStack task={task} /><span>{task.estimate ?? "No estimate"}</span></footer>
                          </article>
                        }
                      />
                    </li>
                  );
                })}
                {store.drag?.kind === "board" && store.drag.overStatus === status && store.drag.overIndex === laneTasks.length ? <li aria-hidden="true"><div className={styles.boardInsertion} /></li> : null}
                {laneTasks.length === 0 ? (
                  <li className={styles.emptyLane}>
                    <Icon name="inbox" size={18} />
                    <span>No tasks here</span>
                    <small>Move work here or add a task.</small>
                  </li>
                ) : null}
              </ul>
              <button className={styles.laneAdd} disabled={store.readOnly} onClick={() => store.addTask(status)} type="button"><Icon name="add" size={14} />Add task</button>
            </section>
          );
        })}
      </div>
      <KeyboardLegend>Arrow keys navigate. Alt + arrows move or reorder. F2 edits title.</KeyboardLegend>
    </div>
  );
}
