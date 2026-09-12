"use server";

import type {
  EditTaskCommentInput,
  SendTaskCommentInput,
  TombstoneTaskCommentInput,
} from "@/lib/conversations/task-discussion-contracts";
import {
  authenticateConversationActor,
  getTaskDiscussionService,
} from "@/server/conversations/runtime";

/** Canonical Task Discussion has no development identity fallback. */
export async function openTaskDiscussionAction(taskId: string) {
  const actorId = await authenticateConversationActor();
  if (!actorId) return { ok: false, code: "unauthenticated" } as const;
  return (await getTaskDiscussionService()).openTaskDiscussion({ actorId, taskId });
}

export async function addCommentAction(input: SendTaskCommentInput) {
  const actorId = await authenticateConversationActor();
  if (!actorId) return { ok: false, code: "unauthenticated" } as const;
  return (await getTaskDiscussionService()).sendComment({ actorId, input });
}

export async function editCommentAction(input: EditTaskCommentInput) {
  const actorId = await authenticateConversationActor();
  if (!actorId) return { ok: false, code: "unauthenticated" } as const;
  return (await getTaskDiscussionService()).editComment({ actorId, ...input });
}

export async function removeCommentAction(input: TombstoneTaskCommentInput) {
  const actorId = await authenticateConversationActor();
  if (!actorId) return { ok: false, code: "unauthenticated" } as const;
  return (await getTaskDiscussionService()).tombstoneComment({ actorId, ...input });
}

export async function getCommentReceiptAction(taskId: string, clientRequestId: string) {
  const actorId = await authenticateConversationActor();
  if (!actorId) return { ok: false, code: "unauthenticated" } as const;
  return (await getTaskDiscussionService()).getReceipt({ actorId, taskId, clientRequestId });
}
