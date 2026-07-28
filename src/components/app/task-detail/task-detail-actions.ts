"use client";

/**
 * buildTaskDetailActions — action registry for the task detail composition.
 *
 * Groups mirror the board card registry (open → workflow → organisation →
 * destructive), labels follow brand-voice plain English, same ActionItem
 * contract from ContextActions.
 */

import type { ActionItem } from "@/components/primitives/context-actions";
import type { Task } from "@/lib/data";
import { LANES, LANE_ORDER, PRIORITY_LABEL } from "@/lib/data";
import type { TasksDispatchers } from "@/lib/tasks/tasks-context";

export type TaskDetailActionDeps = {
  dispatchers: TasksDispatchers;
  isFocus: boolean;
  onOpenFocus: () => void;
  onClosePanel: () => void;
};

export function buildTaskDetailActions(
  task: Task,
  deps: TaskDetailActionDeps,
): ActionItem[] {
  const { dispatchers, isFocus, onOpenFocus, onClosePanel } = deps;

  // ── open ──────────────────────────────────────────────────────────────────
  const displayId = task.id.replace(/^t-/, "T-").toUpperCase();
  const openItems: ActionItem[] = [
    ...(!isFocus
      ? [
          {
            id: "open-focus",
            label: "Open focus mode",
            group: "open" as const,
            shortcutHint: "E",
            onSelect: onOpenFocus,
          },
        ]
      : []),
    {
      id: "copy-link",
      label: "Copy link",
      group: "open" as const,
      onSelect: () => {
        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        navigator.clipboard
          ?.writeText(`${origin}/app/task/${task.id}`)
          .catch(() => undefined);
      },
    },
    {
      id: "copy-id",
      label: "Copy ID",
      group: "open" as const,
      onSelect: () => {
        navigator.clipboard?.writeText(displayId).catch(() => undefined);
      },
    },
  ];

  // ── workflow ───────────────────────────────────────────────────────────────
  const statusSubmenu: ActionItem[] = LANE_ORDER.map((laneId) => ({
    id: `status-${laneId}`,
    label: LANES[laneId].name,
    group: "workflow" as const,
    disabled: task.lane === laneId,
    onSelect: () => dispatchers.updateTask(task.id, { lane: laneId }),
  }));

  const prioritySubmenu: ActionItem[] = (
    ["p0", "p1", "p2", "p3"] as const
  ).map((p) => ({
    id: `priority-${p}`,
    label: `${p.toUpperCase()} · ${PRIORITY_LABEL[p].label}`,
    group: "workflow" as const,
    disabled: task.priority === p,
    onSelect: () => dispatchers.updateTask(task.id, { priority: p }),
  }));

  const workflowItems: ActionItem[] = [
    {
      id: "toggle-complete",
      label: task.lane === "done" ? "Reopen" : "Mark done",
      group: "workflow" as const,
      onSelect: () => dispatchers.toggleComplete(task.id),
    },
    {
      id: "change-status",
      label: "Change status",
      group: "workflow" as const,
      submenu: statusSubmenu,
      onSelect: () => undefined,
    },
    {
      id: "set-priority",
      label: "Set priority",
      group: "workflow" as const,
      submenu: prioritySubmenu,
      onSelect: () => undefined,
    },
    {
      id: "focus-session",
      label: "Focus session",
      group: "workflow" as const,
      onSelect: () => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("focus-mode:open", {
              detail: { id: task.id, title: task.title },
            }),
          );
        }
      },
    },
  ];

  // ── organisation ──────────────────────────────────────────────────────────
  const organisationItems: ActionItem[] = [
    {
      id: "duplicate",
      label: "Duplicate",
      group: "organisation" as const,
      onSelect: () => dispatchers.duplicateTask(task.id),
    },
    {
      id: "milestone",
      label: task.isMilestone ? "Remove milestone" : "Mark as milestone",
      group: "organisation" as const,
      onSelect: () => {
        // Optimistic via the dedicated dispatcher — the fire-and-forget
        // server action gave no visual feedback until the next refetch.
        dispatchers.setMilestone(task.id, !task.isMilestone);
      },
    },
    {
      id: "archive",
      label: "Archive",
      group: "organisation" as const,
      onSelect: () => {
        dispatchers.archiveTask(task.id);
        onClosePanel();
      },
    },
  ];

  // ── destructive ───────────────────────────────────────────────────────────
  const destructiveItems: ActionItem[] = [
    {
      id: "delete",
      label: "Delete",
      group: "destructive" as const,
      onSelect: () => {
        dispatchers.removeTask(task.id);
        onClosePanel();
      },
    },
  ];

  return [
    ...openItems,
    ...workflowItems,
    ...organisationItems,
    ...destructiveItems,
  ];
}
