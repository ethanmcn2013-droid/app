"use server";

import { and, eq } from "drizzle-orm";
import {
  createTimelinePromotionCommand,
  timelinePromotionPreview,
  type TimelinePromotionDraft,
} from "@/modules/notes/lib/timeline-promotion";
import { requireUser } from "@/modules/notes/server/notes-auth";
import { db } from "@/modules/notes/server/db/notes-client";
import { notes } from "@/modules/notes/server/db/notes-schema";
import { authorizeTasksWorkspace } from "@/modules/notes/server/tasks-personalization";
import {
  sendTimelinePromotionCommand,
  type TimelinePromotionReceipt,
} from "@/modules/notes/server/timeline-promotion-adapter";

export async function promoteSelectedExtractToTimeline(input: {
  noteId: string;
  title: string;
  date: string;
  completion: number;
  audienceLabel: string;
}): Promise<TimelinePromotionReceipt & { preview: string }> {
  const userId = await requireUser();
  const enabled =
    process.env.SIGNAL_PLANNING_PERIODS_ENABLED === "1" ||
    process.env.SIGNAL_PLANNING_PERIODS_ENABLED === "true";
  if (!enabled) {
    return {
      status: "unavailable",
      message: "Timeline sharing is not enabled. Your note stays private.",
      preview: "",
    };
  }

  // Intentionally do not select notes.body or notes.extractBody. The private
  // source text cannot enter the adapter, a log, or a serialization path.
  const [note] = await db
    .select({ id: notes.id, workspaceId: notes.workspaceId })
    .from(notes)
    .where(and(eq(notes.id, input.noteId), eq(notes.userId, userId)))
    .limit(1);
  if (!note) throw new Error("Note not found");
  if (!note.workspaceId) throw new Error("Choose a workspace for this note first");

  const access = await authorizeTasksWorkspace(userId, note.workspaceId);
  if (access === "unavailable") {
    throw new Error("Workspaces are unavailable right now. Your note stays private.");
  }
  if (access !== "allowed") {
    throw new Error("That workspace is no longer available to your account.");
  }

  const draft: TimelinePromotionDraft = {
    noteId: note.id,
    workspaceId: note.workspaceId,
    title: input.title,
    date: input.date,
    completion: input.completion,
    audienceLabel: input.audienceLabel,
  };
  const command = createTimelinePromotionCommand(draft);
  const preview = timelinePromotionPreview(command);
  const receipt = await sendTimelinePromotionCommand(command, userId);
  return { ...receipt, preview };
}
