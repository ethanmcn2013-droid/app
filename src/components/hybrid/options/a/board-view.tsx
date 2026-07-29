"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DragEvent, KeyboardEvent, MouseEvent } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useLabStore } from "../../store";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { STATUS_LABELS, TASK_STATUSES, type CalendarDate, type LabTask, type TaskStatus } from "../../types";
import { ActionsDropdown, ContextActions, type ActionItem } from "@/components/primitives/context-actions";
import { Icon } from "../../shared/icons";
import {
  AvatarStack,
  LabelList,
  PriorityMark,
  ScheduleText,
  TaskCompletion,
  TaskOpenButton,
  TaskSignals,
} from "../../shared/task-ui";
import { InlineTaskTitle, KeyboardLegend } from "./quiet-command-components";
import { focusTask } from "./quiet-command-model";
import styles from "./option-a.module.css";
import { labelById, listPeople, personById } from "../../fixtures";
import { addDays } from "../../dates";

// The board's "today" comes from the server calendar frame, never the
// browser clock (see lib/calendar-frame.ts). Reading the wall clock here made
// the Today/Tomorrow presets disagree with the same card's own due label,
// which is only invisible in production because the frame tracks real time.

const WIP_LIMITS: Partial<Record<TaskStatus, number>> = {
  queued: 12,
  active: 8,
  review: 6,
  waiting: 6,
};

/**
 * The schedule a milestone toggle produces.
 *
 * A milestone is a dated thing, so toggling it on keeps the task's own date
 * when it has one and anchors to today when it doesn't; toggling it off
 * demotes back to an ordinary due date rather than losing the date. The
 * hybrid store persists the structural isMilestone flag as part of applying
 * a milestone-kind schedule, so this is the complete toggle.
 */
function toggledMilestoneSchedule(task: LabTask, today: CalendarDate) {
  const schedule = task.schedule;
  if (schedule.kind === "milestone") return { kind: "due", dueOn: schedule.on } as const;
  if (schedule.kind === "due") return { kind: "milestone", on: schedule.dueOn } as const;
  if (schedule.kind === "range") return { kind: "milestone", on: schedule.dueOn } as const;
  return { kind: "milestone", on: today } as const;
}

/** Collapsed lanes are a view preference, not workspace data, so one key. */
const COLLAPSE_STORAGE_KEY = "signal-tasks.board.collapsed";

type CollapsedLanes = Partial<Record<TaskStatus, boolean>>;

const NO_COLLAPSED_LANES: CollapsedLanes = {};

// Parsed-snapshot cache: useSyncExternalStore requires getSnapshot to return
// a stable reference for an unchanged store, so the JSON parse is memoised
// on the raw string.
let collapsedCache: { raw: string | null; value: CollapsedLanes } = {
  raw: null,
  value: NO_COLLAPSED_LANES,
};

function readCollapsedSnapshot(): CollapsedLanes {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
  } catch {
    /* private mode — every lane reads expanded */
  }
  if (raw !== collapsedCache.raw) {
    let value: CollapsedLanes = NO_COLLAPSED_LANES;
    if (raw) {
      try {
        value = JSON.parse(raw) as CollapsedLanes;
      } catch {
        /* malformed value — every lane reads expanded */
      }
    }
    collapsedCache = { raw, value };
  }
  return collapsedCache.value;
}

const collapsedListeners = new Set<() => void>();

function subscribeCollapsed(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === COLLAPSE_STORAGE_KEY) listener();
  };
  collapsedListeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    collapsedListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Which lanes are folded to a rail, persisted across sessions.
 *
 * An external-store read rather than effect-synced state: `localStorage`
 * does not exist on the server (the server snapshot is the empty set), and
 * useSyncExternalStore gives the post-hydration client read without a
 * cascading setState-in-effect. The storage event keeps two tabs agreeing.
 */
function useCollapsedLanes() {
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsedSnapshot,
    () => NO_COLLAPSED_LANES,
  );

  const toggle = useCallback((status: TaskStatus) => {
    const next = { ...readCollapsedSnapshot(), [status]: !readCollapsedSnapshot()[status] };
    try {
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* persistence failed — still fold for this session via the cache */
      collapsedCache = { raw: collapsedCache.raw, value: next };
    }
    collapsedListeners.forEach((notify) => notify());
  }, []);

  return [collapsed, toggle] as const;
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
  today: CalendarDate,
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
        const url = `${typeof window !== "undefined" ? window.location.origin : ""}/app/tasks?task=${task.id}`;
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

  // ── assign submenu ────────────────────────────────────────────────────────
  const assignSubmenu: ActionItem[] = listPeople().map((person) => {
    const assigned = task.assigneeIds.includes(person.id);
    return {
      id: `assign-${person.id}`,
      label: person.name,
      icon: assigned ? <Icon name="check" size={14} /> : undefined,
      group: "workflow" as ActionItem["group"],
      disabled: ro,
      disabledReason: ro ? "Read-only workspace" : undefined,
      onSelect: () => {
        if (ro) return;
        const next = assigned
          ? task.assigneeIds.filter((id) => id !== person.id)
          : [...task.assigneeIds, person.id];
        store.updateAssignees(task.id, next);
      },
    };
  });

  // ── due-date submenu ──────────────────────────────────────────────────────
  // Quick presets only — the full calendar picker lives in the task panel DueRow.
  const hasSchedule = (store.taskById(task.id)?.schedule ?? task.schedule).kind !== "unscheduled";
  const dueDateSubmenu: ActionItem[] = [
    {
      id: "due-today",
      label: "Today",
      group: "workflow" as ActionItem["group"],
      disabled: ro,
      disabledReason: ro ? "Read-only workspace" : undefined,
      onSelect: () => { if (!ro) store.scheduleOn(task.id, today); },
    },
    {
      id: "due-tomorrow",
      label: "Tomorrow",
      group: "workflow" as ActionItem["group"],
      disabled: ro,
      disabledReason: ro ? "Read-only workspace" : undefined,
      onSelect: () => { if (!ro) store.scheduleOn(task.id, addDays(today, 1)); },
    },
    {
      id: "due-next-week",
      label: "Next week",
      group: "workflow" as ActionItem["group"],
      disabled: ro,
      disabledReason: ro ? "Read-only workspace" : undefined,
      onSelect: () => { if (!ro) store.scheduleOn(task.id, addDays(today, 7)); },
    },
    ...(hasSchedule
      ? [
          {
            id: "due-clear",
            label: "Clear due date",
            group: "workflow" as ActionItem["group"],
            disabled: ro,
            disabledReason: ro ? "Read-only workspace" : undefined,
            onSelect: () => { if (!ro) store.unscheduleTask(task.id); },
          },
        ]
      : []),
  ];

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
    {
      id: "assign",
      label: "Assign",
      group: "workflow",
      disabled: ro,
      disabledReason: ro ? "Read-only workspace" : undefined,
      submenu: assignSubmenu,
      onSelect: () => undefined,
    },
    {
      id: "set-due-date",
      label: "Set due date",
      group: "workflow",
      disabled: ro,
      disabledReason: ro ? "Read-only workspace" : undefined,
      submenu: dueDateSubmenu,
      onSelect: () => undefined,
    },
    {
      id: "toggle-milestone",
      label: task.schedule.kind === "milestone" ? "Remove milestone" : "Make milestone",
      icon: <Icon name="milestone" size={14} />,
      group: "workflow",
      disabled: ro,
      disabledReason: ro ? "Read-only workspace" : undefined,
      onSelect: () => { if (!ro) store.scheduleTask(task.id, toggledMilestoneSchedule(task, today)); },
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

  // ── make subtask of ───────────────────────────────────────────────────────
  // Production only (makeSubtaskOf absent from LabStore). One-level cap:
  // hide the item entirely when the task already has subtasks of its own.
  const storeAsAny = store as Record<string, unknown>;
  const hasArchive = typeof storeAsAny["archiveTask"] === "function";
  const canMakeSubtask = typeof storeAsAny["makeSubtaskOf"] === "function" && task.subtasks.length === 0;
  const makeSubtaskSubmenu: ActionItem[] = canMakeSubtask
    ? store.tasks
        .filter((t) => t.id !== task.id)
        .slice(0, 15)
        .map((candidate) => ({
          id: `subtask-of-${candidate.id}`,
          label: candidate.title.length > 40 ? `${candidate.title.slice(0, 40)}…` : candidate.title,
          group: "organisation" as ActionItem["group"],
          disabled: ro,
          disabledReason: ro ? "Read-only workspace" : undefined,
          onSelect: () => {
            if (!ro) (storeAsAny["makeSubtaskOf"] as (id: string, parentId: string) => void)(task.id, candidate.id);
          },
        }))
    : [];
  // An empty submenu would render an empty popout on a one-task board.
  const hasMakeSubtask = canMakeSubtask && makeSubtaskSubmenu.length > 0;

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
    ...(hasMakeSubtask
      ? [
          {
            id: "make-subtask-of",
            label: "Make subtask of",
            group: "organisation" as ActionItem["group"],
            disabled: ro,
            disabledReason: ro ? "Read-only workspace" : undefined,
            submenu: makeSubtaskSubmenu,
            onSelect: () => undefined,
          },
        ]
      : []),
  ];

  // ── destructive ───────────────────────────────────────────────────────────
  // Archive is handled through the production store's archiveTask dispatcher
  // where available. In lab/demo mode (LabStoreProvider), archiveTask does not
  // exist on the LabStore contract — fall back to deleteTask for session cleanup.
  // The store shape is checked at runtime so this is safe in both contexts.

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

/**
 * Inline task composer, mounted in the lane's add-row slot.
 *
 * Typing a title and pressing Enter creates the task in place and keeps the
 * composer open for the next one — the panel does not open, because the
 * author is composing a list, not inspecting a task. Before this, "Add task"
 * spawned an "Untitled task" AND slid the full detail panel over the board:
 * every add began with a broken promise and a context switch.
 */
function LaneComposer({
  status,
  onCommit,
  onDismiss,
}: {
  status: TaskStatus;
  onCommit: (title: string) => void;
  onDismiss: () => void;
}) {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: false });
  }, []);

  const commit = () => {
    const trimmed = title.trim();
    if (trimmed) onCommit(trimmed);
    setTitle("");
  };

  return (
    <input
      aria-label={`New task title for ${STATUS_LABELS[status]}`}
      className={styles.laneComposer}
      onBlur={() => {
        const trimmed = title.trim();
        if (trimmed) onCommit(trimmed);
        onDismiss();
      }}
      onChange={(event) => setTitle(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          setTitle("");
          onDismiss();
        }
      }}
      placeholder="Task title, then Enter"
      ref={inputRef}
      value={title}
    />
  );
}

export function BoardView({ tasks }: { tasks: LabTask[] }) {
  const store = useLabStore();
  const calendar = useCalendarFrame();
  const reduceMotion = useReducedMotion();
  const [collapsed, toggleCollapsed] = useCollapsedLanes();
  const [composing, setComposing] = useState<TaskStatus | null>(null);
  const [keyboardMove, setKeyboardMove] = useState(false);
  const orderedIds = tasks.map((task) => task.id);

  const tasksInLane = (status: TaskStatus) => tasks
    .filter((task) => task.status === status)
    .sort((a, b) => a.order - b.order);

  /**
   * Walk to the next lane that is actually on screen.
   *
   * Both arrow navigation and Alt+arrow moves use this. Landing focus in a
   * folded lane would put the caret somewhere with no rendered card, and
   * moving a card into one would make it vanish without explanation.
   */
  const nextVisibleStatus = (status: TaskStatus, direction: 1 | -1): TaskStatus => {
    let index = TASK_STATUSES.indexOf(status);
    for (let step = 0; step < TASK_STATUSES.length; step += 1) {
      index += direction;
      if (index < 0 || index >= TASK_STATUSES.length) return status;
      const candidate = TASK_STATUSES[index];
      if (!collapsed[candidate]) return candidate;
    }
    return status;
  };

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
      setKeyboardMove(true);
      const nextIndex = event.key === "ArrowUp" ? laneIndex - 1 : laneIndex + 1;
      store.moveStatus(task.id, task.status, Math.max(0, Math.min(laneTasks.length - 1, nextIndex)));
      focusTask(task.id);
      requestAnimationFrame(() => setKeyboardMove(false));
      return;
    }
    if (event.altKey && !store.readOnly && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      setKeyboardMove(true);
      const targetStatus = nextVisibleStatus(task.status, event.key === "ArrowLeft" ? -1 : 1);
      if (targetStatus !== task.status) store.moveStatus(task.id, targetStatus);
      focusTask(task.id);
      requestAnimationFrame(() => setKeyboardMove(false));
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
      const targetStatus = nextVisibleStatus(task.status, event.key === "ArrowLeft" ? -1 : 1);
      const targetLane = tasksInLane(targetStatus);
      const target = targetLane[Math.min(laneIndex, Math.max(0, targetLane.length - 1))];
      if (target) focusTask(target.id);
    }
  };

  /**
   * The card checkbox now completes a task rather than selecting it, so the
   * card body carries selection: modifier-click starts or extends a set, and
   * a plain click continues to extend one that is already open. Space on a
   * focused card does the same thing from the keyboard.
   */
  const cardClick = (event: MouseEvent<HTMLElement>, task: LabTask) => {
    const modifier = event.shiftKey || event.metaKey || event.ctrlKey;
    if (store.selectedIds.length === 0 && !modifier) return;
    if ((event.target as Element).closest("button, input, select, textarea")) return;
    store.toggleSelected(task.id, orderedIds, event.shiftKey);
  };

  return (
    <div aria-label="Board lanes" className={styles.boardSurface}>
      <LayoutGroup id="tasks-board">
      <div className={styles.boardScroll}>
        {TASK_STATUSES.map((status) => {
          const laneTasks = tasksInLane(status);
          const limit = WIP_LIMITS[status];
          const overLimit = limit !== undefined && laneTasks.length > limit;
          const nearLimit = limit !== undefined && !overLimit && laneTasks.length >= Math.ceil(limit * 0.8);
          const isCollapsed = Boolean(collapsed[status]);
          const label = STATUS_LABELS[status];
          // The backlog lane carries no tone. Emitting the attribute with a
          // key the stylesheet does not define would still match the
          // tinted-pip rule and blank the pip to transparent.
          const tone = status === "queued" ? undefined : status;
          const countLabel = limit !== undefined
            ? `${laneTasks.length} of ${limit} tasks in ${label}`
            : `${laneTasks.length} tasks in ${label}`;

          if (isCollapsed) {
            return (
              <section
                aria-labelledby={`a-lane-${status}`}
                className={styles.boardLane}
                data-collapsed=""
                data-done={status === "done" || undefined}
                data-lane-tone={tone}
                data-status={status}
                key={status}
              >
                <button
                  aria-expanded={false}
                  className={styles.laneRail}
                  onClick={() => toggleCollapsed(status)}
                  title={`Expand ${label}`}
                  type="button"
                >
                  <Icon name="chevron-right" size={14} />
                  <span className={styles.statusPip} data-status={status} />
                  <span className={styles.railName} id={`a-lane-${status}`}>{label}</span>
                  <span aria-label={countLabel} className={styles.railCount}>{laneTasks.length}</span>
                </button>
              </section>
            );
          }

          return (
            <section aria-labelledby={`a-lane-${status}`} className={styles.boardLane} data-done={status === "done" || undefined} data-lane-tone={tone} data-status={status} key={status}>
              <header className={styles.laneHeader}>
                <div className={styles.laneIdentity}>
                  <button
                    aria-expanded
                    className={`${styles.laneIconButton} ${styles.laneCollapse}`}
                    onClick={() => toggleCollapsed(status)}
                    title={`Collapse ${label}`}
                    type="button"
                  >
                    <Icon name="chevron-right" size={14} />
                  </button>
                  <span className={styles.statusPip} data-status={status} />
                  <h2 id={`a-lane-${status}`}>{label}</h2>
                </div>
                <div className={styles.laneActions}>
                  <span aria-label={countLabel} className={styles.wipCount} data-near={nearLimit || undefined} data-over={overLimit || undefined}>
                    {limit !== undefined ? `${laneTasks.length}/${limit}` : laneTasks.length}
                  </span>
                  <button
                    className={styles.laneIconButton}
                    disabled={store.readOnly}
                    onClick={() => setComposing(status)}
                    title={`Add a task to ${label}`}
                    type="button"
                  >
                    <Icon name="add" size={14} />
                  </button>
                </div>
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
                  const actions = buildTaskActions(task, store, calendar.today as CalendarDate);
                  const hasPriority = task.priority === "urgent" || task.priority === "high";
                  // Same trap as the footer below: LabelList drops ids it
                  // cannot resolve, so counting raw ids reserved a 24px band
                  // under every card title and rendered nothing into it.
                  // That empty band was the board's "unfinished card" look.
                  const hasLabels = task.labelIds.some((id) => labelById(id));
                  const hasSchedule = task.schedule.kind !== "unscheduled";
                  const hasSignals = task.subtasks.length > 0 ||
                    task.comments.length > 0 ||
                    task.attachments.length > 0 ||
                    task.blockedByIds.length > 0 ||
                    task.blockerIds.length > 0;
                  // AvatarStack drops assignee ids it cannot resolve to a
                  // person, so counting raw ids rendered a footer — and its
                  // border — above nothing at all whenever an id was stale.
                  const shownAssignees = task.assigneeIds.filter((id) => personById(id));
                  const hasFooter = shownAssignees.length > 0 || Boolean(task.estimate);
                  return (
                    <motion.li
                      initial={false}
                      key={task.id}
                      layout
                      layoutId={`tasks-board-${task.id}`}
                      transition={reduceMotion || keyboardMove
                        ? { duration: 0 }
                        : { layout: { duration: 0.22, ease: [0.23, 1, 0.32, 1] } }}
                    >
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
                            data-inspected={store.inspectedId === task.id || undefined}
                            data-recently-placed={store.recentlyPlacedId === task.id || undefined}
                            data-recently-updated={store.recentlyUpdatedId === task.id || undefined}
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
                              <TaskCompletion disabled={store.readOnly} task={task} />
                              {hasPriority ? <PriorityMark task={task} /> : null}
                              <span className={styles.cardSpacer} />
                              {/*
                                Milestone toggle. Quiet like the ••• trigger
                                until the card is hovered — except when the
                                task IS a milestone, where the filled diamond
                                stays on as the card's badge of it.
                              */}
                              <button
                                aria-label={task.schedule.kind === "milestone" ? `Remove milestone from ${task.title}` : `Make ${task.title} a milestone`}
                                aria-pressed={task.schedule.kind === "milestone"}
                                className={styles.cardMilestone}
                                data-active={task.schedule.kind === "milestone" || undefined}
                                disabled={store.readOnly}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!store.readOnly) store.scheduleTask(task.id, toggledMilestoneSchedule(task, calendar.today as CalendarDate));
                                }}
                                title={task.schedule.kind === "milestone" ? "Remove milestone" : "Make milestone"}
                                type="button"
                              >
                                <Icon name="milestone" size={13} />
                              </button>
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
                            {hasLabels ? <div className={styles.cardLabels}><LabelList task={task} /></div> : null}
                            {hasSchedule || hasSignals ? (
                              <div className={styles.cardSchedule}>
                                {hasSchedule ? <ScheduleText compact task={task} /> : <span />}
                                {hasSignals ? <TaskSignals task={task} /> : null}
                              </div>
                            ) : null}
                            {hasFooter ? (
                              <footer>
                                <AvatarStack showUnassigned={false} task={task} />
                                {task.estimate ? <span>{task.estimate}</span> : null}
                              </footer>
                            ) : null}
                          </article>
                        }
                      />
                    </motion.li>
                  );
                })}
                {store.drag?.kind === "board" && store.drag.overStatus === status && store.drag.overIndex === laneTasks.length ? <li aria-hidden="true"><div className={styles.boardInsertion} /></li> : null}
                {laneTasks.length === 0 ? (
                  <li className={styles.emptyLane}>
                    <Icon name="inbox" size={18} />
                    <span>Nothing here yet</span>
                    <small>Drag a task across, or add one below.</small>
                  </li>
                ) : null}
                {/*
                  The add row lives inside the scroll region, directly under
                  the last card. Pinned to the bottom of the lane it could sit
                  600px from the work it was adding to, so the new card
                  appeared nowhere near the click that made it. Clicking it
                  swaps in the inline composer rather than spawning an
                  "Untitled task" and opening the panel.
                */}
                <li className={styles.laneAddRow}>
                  {composing === status ? (
                    <LaneComposer
                      onCommit={(title) => store.addTask(status, undefined, title)}
                      onDismiss={() => setComposing(null)}
                      status={status}
                    />
                  ) : (
                    <button className={styles.laneAdd} disabled={store.readOnly} onClick={() => setComposing(status)} type="button"><Icon name="add" size={14} />Add task</button>
                  )}
                </li>
              </ul>
            </section>
          );
        })}
      </div>
      </LayoutGroup>
      <KeyboardLegend>Arrow keys navigate. Alt + arrows move or reorder. F2 edits title.</KeyboardLegend>
    </div>
  );
}
