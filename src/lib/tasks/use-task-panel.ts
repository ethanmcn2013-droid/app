"use client";

// App-only hook — do not import from /showcase or the marketing site.
// The panel is mounted in /app/layout.tsx and reads `?task=<id>`.

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function useTaskPanel() {
  const sp = useSearchParams();
  const taskId = sp?.get("task") ?? null;

  const openTask = useCallback(
    (id: string) => {
      const params = new URLSearchParams(sp?.toString() ?? "");
      params.set("task", id);
      // pushState — back-button closes the panel, which is the intent.
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
    [sp],
  );

  const closeTask = useCallback(() => {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.delete("task");
    const qs = params.toString();
    // replaceState — close shouldn't add a history entry.
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [sp]);

  return { taskId, openTask, closeTask };
}
