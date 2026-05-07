"use client";

import { useEffect, useState } from "react";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { getTaskConversationAction } from "@/server/actions/conversation";
import type { ConversationItem } from "@/server/db/queries";
import { PanelShell } from "./panel-shell";
import { PanelHeader } from "./panel-header";
import { FieldRows } from "./field-rows";
import { ConversationFeed } from "./conversation-feed";
import { ContactEditor } from "./contact-editor";
import { CentsEditor } from "./cents-editor";
import { DescriptionEditor } from "./description-editor";
import { RepeatButton } from "./repeat-button";
import { SubtasksSection } from "./subtasks-section";
import { AttachmentsSection } from "./attachments-section";
import type { Task } from "@/lib/data";

export function TaskDetailPanel() {
  const { taskId, closeTask } = useTaskPanel();
  const state = useTasksState();
  const task = taskId ? state.tasks.find((t) => t.id === taskId) : null;

  // Per-task unified conversation history (comments + activity merged).
  // Re-fetches when taskId OR task.updatedAt changes.
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshKey = task?.updatedAt?.getTime();

  useEffect(() => {
    if (!task) return;
    let ignore = false;
    setLoading(true);

    getTaskConversationAction(task.id)
      .then((rows) => {
        if (!ignore) {
          setItems(rows);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          // eslint-disable-next-line no-console
          console.warn("conversation: fetch failed", err);
          setItems([]);
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, refreshKey]);

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
            <Section title="Description">
              <DescriptionEditor key={task.id} task={task} />
            </Section>
            <Section title="Contact">
              <ContactEditor key={task.id} task={task} />
            </Section>
            <Section title="Amount">
              <CentsEditor key={task.id} task={task} />
            </Section>
            <SubtasksSection key={`subtasks-${task.id}`} task={task} />
            <AttachmentsSection key={`attachments-${task.id}`} task={task} />
            <Section title="Conversation">
              {loading ? (
                <ConversationSkeleton />
              ) : (
                <ConversationFeed
                  key={task.id}
                  taskId={task.id}
                  initialItems={items}
                />
              )}
            </Section>
          </div>
          <PanelFooter task={task} />
        </>
      ) : taskId ? (
        <EmptyState />
      ) : null}
    </PanelShell>
  );
}

function ConversationSkeleton() {
  // Mix one comment-shaped row with one activity-shaped row so the
  // skeleton hints at the unified feed shape.
  return (
    <div className="space-y-3 pb-6">
      <div className="flex items-start gap-2.5 px-1 py-1">
        <div className="h-[22px] w-[22px] flex-shrink-0 rounded-full bg-bg-sunken" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-1/3 rounded-full bg-bg-sunken" />
          <div className="h-3 w-3/4 rounded-full bg-bg-sunken" />
        </div>
      </div>
      <div className="flex items-center gap-2 px-1">
        <div className="h-3.5 w-3.5 flex-shrink-0 rounded-full bg-bg-sunken" />
        <div className="h-2.5 w-2/5 rounded-full bg-bg-sunken" />
      </div>
      <div className="flex items-start gap-2.5 px-1 py-1">
        <div className="h-[22px] w-[22px] flex-shrink-0 rounded-full bg-bg-sunken" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-1/4 rounded-full bg-bg-sunken" />
          <div className="h-3 w-2/3 rounded-full bg-bg-sunken" />
        </div>
      </div>
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

/**
 * Bottom row of the panel. Quiet by design — sibling buttons only.
 * "Repeat" opens the chain-duplicate popover; "Focus" dispatches
 * `focus-mode:open` so the global FocusMode overlay picks it up.
 * Sits below Contact + Cents so it never collides with those sections.
 */
function PanelFooter({ task }: { task: Task }) {
  return (
    <div className="flex items-center justify-end gap-1 border-t border-line-soft px-6 py-3">
      <RepeatButton task={task} />
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(
            new CustomEvent("focus-mode:open", {
              detail: { id: task.id, title: task.title },
            }),
          );
        }}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink-soft"
        aria-label="Open focus mode for this task"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Focus
      </button>
    </div>
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
