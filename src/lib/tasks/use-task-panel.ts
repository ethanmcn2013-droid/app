"use client";

// App-only hook, do not import from /showcase or the marketing site.
// The panel is mounted in /app/layout.tsx and reads `?task=<id>`.

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

type TaskPanelFocusOrigin = {
  element: HTMLElement;
  taskId: string;
};

// `openTask` and `closeTask` are consumed by different hook instances (the
// workspace and the globally-mounted detail panel), so the return target must
// live at module scope rather than in a hook-local ref.
let taskPanelFocusOrigin: TaskPanelFocusOrigin | null = null;

function restoreTaskPanelFocus(): void {
  const origin = taskPanelFocusOrigin;
  taskPanelFocusOrigin = null;
  if (!origin) return;

  window.requestAnimationFrame(() => {
    const fallback = document.querySelector<HTMLElement>(
      `button[data-task-id="${CSS.escape(origin.taskId)}"]`,
    );
    const target = origin.element.isConnected ? origin.element : fallback;
    target?.focus({ preventScroll: true });
  });
}

export function useTaskPanel() {
  const sp = useSearchParams();
  const taskId = sp?.get("task") ?? null;

  const openTask = useCallback(
    (id: string) => {
      // Preserve the source only when entering the inspector. j/k navigation
      // and subtask traversal must not replace it with a control inside the
      // panel, otherwise close would return focus to a disappearing element.
      if (!taskId && document.activeElement instanceof HTMLElement) {
        taskPanelFocusOrigin = {
          element: document.activeElement,
          taskId: id,
        };
      }
      const params = new URLSearchParams(sp?.toString() ?? "");
      params.set("task", id);
      // pushState, back-button closes the panel, which is the intent.
      window.history.pushState(
        null,
        "",
        `${window.location.pathname}?${params}`,
      );
      // Force-fire a popstate so any listeners (e.g. Next's router)
      // rehydrate `useSearchParams` immediately. Some Next 16 versions
      // need this nudge.
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    [sp, taskId],
  );

  const closeTask = useCallback(() => {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.delete("task");
    const qs = params.toString();
    // replaceState, close shouldn't add a history entry.
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
    restoreTaskPanelFocus();
  }, [sp]);

  return { taskId, openTask, closeTask };
}
