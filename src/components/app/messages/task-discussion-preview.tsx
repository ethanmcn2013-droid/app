"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConversationFeed } from "@/components/app/detail-panel/conversation-feed";
import type { TaskDiscussionSnapshot } from "@/lib/conversations/task-discussion-contracts";
import type { ConversationResult } from "@/lib/conversations/contracts";
import { conversationHeaders } from "./conversation-client-model";

/** Synthetic fixture transport is enabled only by the separate local preview server. */
export function TaskDiscussionPreview({ actor, task }: { actor: string; task: string }) {
  const [snapshot, setSnapshot] = useState<TaskDiscussionSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/task-discussion?${new URLSearchParams({ action: "open", taskId: task })}`, {
      headers: conversationHeaders(actor, false), cache: "no-store", signal: controller.signal,
    }).then((response) => response.json()).then((result: ConversationResult<TaskDiscussionSnapshot>) => {
      if (!controller.signal.aborted) { if (result.ok) setSnapshot(result.value); else setFailed(true); }
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [actor, task]);
  return <main style={{ background: "#fff", color: "#1c1917", minHeight: "100dvh", padding: "clamp(16px, 4vw, 48px)" }}>
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <Link href={`/lab/project-conversation/live?actor=${actor.replace("synthetic_", "")}`} style={{ color: "#4f46e5" }}>Messages</Link>
      <p style={{ marginTop: 24, fontSize: 13 }}>{snapshot?.projectName ?? "Project"}</p>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>{task === "synthetic_task_a" ? "Prepare the launch brief" : "Confirm exhibition lighting"}</h1>
      <h2 style={{ fontSize: 16, fontWeight: 600, borderBottom: "1px solid #e7e5e4", paddingBottom: 12, marginBottom: 20 }}>Discussion</h2>
      {snapshot ? <ConversationFeed taskId={task} initialDiscussion={snapshot} fixtureActor={actor} /> : <p role="status">{failed ? "Discussion is unavailable." : "Opening discussion…"}</p>}
    </div>
  </main>;
}
