"use client";

import { useEffect } from "react";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { PanelShell } from "./panel-shell";
import { PanelHeader } from "./panel-header";
import { FieldRows } from "./field-rows";
import { CommentThread } from "./comment-thread";

export function TaskDetailPanel() {
  const { taskId, closeTask } = useTaskPanel();
  const state = useTasksState();
  const task = taskId ? state.tasks.find((t) => t.id === taskId) : null;

  // Stale id (e.g. task was deleted) — clear the param after a beat
  // so a deep-link to a no-longer-existing task degrades gracefully.
  useEffect(() => {
    if (taskId && !task) {
      const timer = window.setTimeout(closeTask, 1200);
      return () => window.clearTimeout(timer);
    }
  }, [taskId, task, closeTask]);

  return (
    <PanelShell open={!!taskId} onClose={closeTask}>
      {task ? (
        <>
          <PanelHeader task={task} onClose={closeTask} />
          <div className="thin-scroll flex-1 overflow-y-auto">
            <FieldRows task={task} />
            <Description />
            <Section title="Comments">
              <CommentThread taskId={task.id} />
            </Section>
            <Section title="Activity">
              <ActivityPlaceholder />
            </Section>
          </div>
        </>
      ) : taskId ? (
        <EmptyState />
      ) : null}
    </PanelShell>
  );
}

function Description() {
  return (
    <div className="border-t border-line-soft px-6 py-5">
      <div className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
        Description
      </div>
      <p className="text-[13.5px] leading-[1.6] text-ink-soft">
        Plain prose lives here — links, formatted lists, and inline
        media land in cycle 6 alongside real comments. For now this is
        a placeholder so the panel reads as a complete document, not a
        form.
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-line-soft px-6 py-5">
      <div className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
        {title}
      </div>
      {children}
    </div>
  );
}

function ActivityPlaceholder() {
  return (
    <ul className="space-y-2 text-[12px] text-ink-quiet">
      <li>
        <span className="font-medium text-ink-soft">David</span> moved this to
        In progress · <span className="tabular-nums">14:22</span>
      </li>
      <li>
        <span className="font-medium text-ink-soft">Chloe</span> set priority to
        P1 · <span className="tabular-nums">11:08</span>
      </li>
      <li>
        <span className="font-medium text-ink-soft">Alex</span> created this
        task · <span className="tabular-nums">Mon</span>
      </li>
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <div className="text-[14.5px] font-medium text-ink">
        Task not found
      </div>
      <div className="max-w-[28ch] text-[12.5px] text-ink-soft">
        It may have been deleted or this link is stale. Closing in a moment.
      </div>
    </div>
  );
}
