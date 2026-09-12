"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProjectId } from "@/lib/projects/project-ref";
import type { ConversationResult } from "@/lib/conversations/contracts";
import { taskFocusPath } from "@/lib/product-urls";
import { conversationHeaders } from "./conversation-client-model";
import styles from "./conversation-workspace.module.css";

/** Navigation to canonical Tasks; never a second copy of their comments. */
export function TaskDiscussionDirectory({ projectId, fixtureActor }: Readonly<{ projectId: ProjectId; fixtureActor?: string }>) {
  const [tasks, setTasks] = useState<readonly { taskId: string; title: string }[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const query = new URLSearchParams({ action: "list", projectId });
        const response = await fetch(`/api/task-discussion?${query}`, { cache: "no-store", credentials: "same-origin", headers: conversationHeaders(fixtureActor, false), signal: controller.signal });
        const result = await response.json() as ConversationResult<readonly { taskId: string; title: string }[]>;
        if (controller.signal.aborted) return;
        if (result.ok) { setTasks(result.value); setUnavailable(false); }
        else { setTasks([]); setUnavailable(true); }
      } catch { if (!controller.signal.aborted) { setTasks([]); setUnavailable(true); } }
      finally { if (!controller.signal.aborted) timer = setTimeout(refresh, 15000); }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [projectId, fixtureActor]);
  return <section className={styles.discussionDirectory} aria-label="Task discussions"><h2>Task discussions</h2>{tasks.map((task) => <Link className={styles.roomChoice} href={fixtureActor ? `/lab/project-conversation/discussion?actor=${fixtureActor.replace("synthetic_", "")}&task=${task.taskId === "synthetic_task_b" ? "b" : "a"}` : `${taskFocusPath(task.taskId)}#discussion`} key={task.taskId}>{task.title}</Link>)}{unavailable ? <p>Discussions could not be refreshed.</p> : !tasks.length ? <p>Task discussions appear here when a conversation starts in Tasks.</p> : null}</section>;
}
