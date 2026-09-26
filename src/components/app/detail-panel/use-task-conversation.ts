"use client";

/**
 * The task's conversation, loaded with the same scope fence the full-page
 * detail uses (src/components/app/task-detail/task-detail.tsx): a denial
 * clears authorised content at once, a slow read shows a retry, and every
 * callback that outlives its task is ignored. Compatibility history is
 * re-read on a timer so a removed member does not keep a mounted copy.
 *
 * Moved here, unchanged in behaviour, so the task sheet can compose it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/data";
import { loadTaskConversationAction } from "@/server/actions/task-conversation";
import type { TaskConversationSurface } from "@/server/conversations/task-history-loader";
import { readTaskConversationWithSoftDeadline } from "@/components/app/task-detail/conversation-read";

export function useTaskConversation(task: Task) {
  const [resolved, setResolved] = useState<{ taskId: string; value: TaskConversationSurface } | null>(null);
  const surface = resolved?.taskId === task.id ? resolved.value : null;
  const [loading, setLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const activeTaskRef = useRef<string | null>(task.id);
  const requestGenerationRef = useRef(0);

  const refreshKey = task.updatedAt?.getTime();

  const beginRequest = useCallback((taskId: string) => {
    if (activeTaskRef.current !== taskId) return null;
    return ++requestGenerationRef.current;
  }, []);

  const isCurrentRequest = useCallback((taskId: string, generation: number) =>
    activeTaskRef.current === taskId && requestGenerationRef.current === generation, []);

  const refuseCurrentRequest = useCallback((taskId: string, generation: number) => {
    if (!isCurrentRequest(taskId, generation)) return false;
    // A denial is a fence, not just an empty render. Invalidate every older
    // callback before clearing its authorized content.
    requestGenerationRef.current++;
    return true;
  }, [isCurrentRequest]);

  const fetchConversation = useCallback(
    (taskId: string, signal: { ignored: boolean }) => {
      const generation = beginRequest(taskId);
      if (generation === null) return;
      setLoading(true);
      setTimedOut(false);

      void readTaskConversationWithSoftDeadline({
        taskId,
        load: loadTaskConversationAction,
        isCurrent: () => !signal.ignored && isCurrentRequest(taskId, generation),
        onEvent: (event) => {
          if (event.kind === "slow") {
            setLoading(false);
            setTimedOut(true);
          } else if (event.kind === "success") {
            setResolved({ taskId, value: event.surface });
            setLoading(false);
            setTimedOut(false);
          } else {
            // A real denial or failure clears authorized content. A slow cue
            // alone does not, so the eventual result can still settle.
            refuseCurrentRequest(taskId, generation);
            setResolved(null);
            setLoading(false);
            setTimedOut(false);
            console.warn("conversation: fetch failed");
          }
        },
      });
    },
    [beginRequest, isCurrentRequest, refuseCurrentRequest],
  );

  // This is the scope fence for every bootstrap, manual retry and background
  // read. Cleanup invalidates callbacks that outlive a task or unmount.
  useEffect(() => {
    activeTaskRef.current = task.id;
    return () => {
      if (activeTaskRef.current === task.id) activeTaskRef.current = null;
      // This mutable counter is the intentional cross-request fence.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestGenerationRef.current++;
    };
  }, [task.id]);

  useEffect(() => {
    const signal = { ignored: false };
    const timer = window.setTimeout(
      () => fetchConversation(task.id, signal),
      0,
    );
    return () => {
      signal.ignored = true;
      window.clearTimeout(timer);
    };
  }, [task.id, refreshKey, fetchConversation]);

  // Compatibility history is read-only, but authorization is still live.
  // Re-read only this mode so a removed Project member does not retain a
  // mounted copy. Canonical Discussion owns its own epoch-aware poller.
  useEffect(() => {
    if (surface?.mode !== "existing_history") return;
    const signal = { ignored: false };
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      const generation = beginRequest(task.id);
      if (generation === null) return;
      inFlight = true;
      try {
        const result = await loadTaskConversationAction(task.id);
        if (signal.ignored || !isCurrentRequest(task.id, generation)) return;
        setLoading(false);
        if (result.ok) setResolved({ taskId: task.id, value: result.value });
        else if (result.code === "unavailable" || result.code === "unauthenticated") {
          if (refuseCurrentRequest(task.id, generation)) setResolved(null);
        }
      } catch {
        // Keep the authorized snapshot across a transient read failure. The
        // next tick rechecks access; denials above clear it immediately.
        if (!signal.ignored && isCurrentRequest(task.id, generation)) setLoading(false);
      } finally {
        inFlight = false;
      }
    };
    const timer = window.setInterval(() => void refresh(), 2_500);
    return () => {
      signal.ignored = true;
      window.clearInterval(timer);
    };
  }, [beginRequest, isCurrentRequest, refuseCurrentRequest, surface?.mode, task.id]);

  return { surface, loading, timedOut, retry: () => {
    const signal = { ignored: false };
    fetchConversation(task.id, signal);
  }};
}
