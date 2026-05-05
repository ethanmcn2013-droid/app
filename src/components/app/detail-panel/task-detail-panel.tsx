"use client";

import { useEffect, useState } from "react";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { getCommentsForTaskAction } from "@/server/actions/comments";
import { getActivitiesForTaskAction } from "@/server/actions/activity";
import type { Activity, Comment } from "@/lib/data";
import { PanelShell } from "./panel-shell";
import { PanelHeader } from "./panel-header";
import { FieldRows } from "./field-rows";
import { CommentThread } from "./comment-thread";
import { DescriptionEditor } from "./description-editor";
import { ActivityFeed } from "./activity-feed";

export function TaskDetailPanel() {
  const { taskId, closeTask } = useTaskPanel();
  const state = useTasksState();
  const task = taskId ? state.tasks.find((t) => t.id === taskId) : null;

  // Per-task comment thread + activity feed. Re-fetches when taskId
  // OR task.updatedAt changes (any mutation refreshes both).
  const [initialComments, setInitialComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [initialActivities, setInitialActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const refreshKey = task?.updatedAt?.getTime();

  useEffect(() => {
    if (!task) return;
    let ignore = false;
    setCommentsLoading(true);
    setActivitiesLoading(true);

    getCommentsForTaskAction(task.id)
      .then((rows) => {
        if (!ignore) {
          setInitialComments(rows);
          setCommentsLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          // eslint-disable-next-line no-console
          console.warn("comments: fetch failed", err);
          setInitialComments([]);
          setCommentsLoading(false);
        }
      });

    getActivitiesForTaskAction(task.id)
      .then((rows) => {
        if (!ignore) {
          setInitialActivities(rows);
          setActivitiesLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          // eslint-disable-next-line no-console
          console.warn("activity: fetch failed", err);
          setInitialActivities([]);
          setActivitiesLoading(false);
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
            <Section title="Comments">
              {commentsLoading ? (
                <CommentSkeleton />
              ) : (
                <CommentThread
                  key={task.id}
                  taskId={task.id}
                  initialComments={initialComments}
                />
              )}
            </Section>
            <Section title="Activity">
              {activitiesLoading ? (
                <ActivitySkeleton />
              ) : (
                <ActivityFeed
                  key={task.id}
                  taskId={task.id}
                  initialActivities={initialActivities}
                />
              )}
            </Section>
          </div>
        </>
      ) : taskId ? (
        <EmptyState />
      ) : null}
    </PanelShell>
  );
}

function CommentSkeleton() {
  return (
    <div className="space-y-4 pb-6">
      {[
        { name: "60%", body: "100%" },
        { name: "32%", body: "75%" },
      ].map((s, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className="h-[22px] w-[22px] flex-shrink-0 rounded-full bg-bg-sunken" />
          <div className="flex-1 space-y-1.5">
            <div
              className="h-3 rounded-full bg-bg-sunken"
              style={{ width: s.name }}
            />
            <div
              className="h-3 rounded-full bg-bg-sunken"
              style={{ width: s.body }}
            />
          </div>
        </div>
      ))}
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

function ActivitySkeleton() {
  return (
    <ul className="space-y-2 pb-2">
      {[
        { width: "70%" },
        { width: "55%" },
      ].map((s, i) => (
        <li key={i} className="flex items-center gap-2">
          <div className="h-4 w-4 flex-shrink-0 rounded-full bg-bg-sunken" />
          <div
            className="h-3 rounded-full bg-bg-sunken"
            style={{ width: s.width }}
          />
        </li>
      ))}
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
