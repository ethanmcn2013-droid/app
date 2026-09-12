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
import { isDemoMode } from "@/lib/access-mode";

/** Canonical Task Discussion has no development identity fallback. */
export async function openTaskDiscussionAction(taskId: string) {
  if (isDemoMode()) return { ok: false, code: "unauthenticated" } as const;
  const actorId = await authenticateConversationActor();
  if (!actorId) return { ok: false, code: "unauthenticated" } as const;
  return (await getTaskDiscussionService()).openTaskDiscussion({ actorId, taskId });
}

export async function addCommentAction(input: SendTaskCommentInput) {
  if (isDemoMode()) return { ok: false, code: "unauthenticated" } as const;
  const actorId = await authenticateConversationActor();
  if (!actorId) return { ok: false, code: "unauthenticated" } as const;
  return (await getTaskDiscussionService()).sendComment({ actorId, input });
}

export async function editCommentAction(input: EditTaskCommentInput) {
  if (isDemoMode()) return { ok: false, code: "unauthenticated" } as const;
  const actorId = await authenticateConversationActor();
  if (!actorId) return { ok: false, code: "unauthenticated" } as const;
  return (await getTaskDiscussionService()).editComment({ actorId, ...input });
}

export async function removeCommentAction(input: TombstoneTaskCommentInput) {
  if (isDemoMode()) return { ok: false, code: "unauthenticated" } as const;
  const actorId = await authenticateConversationActor();
  if (!actorId) return { ok: false, code: "unauthenticated" } as const;
  return (await getTaskDiscussionService()).tombstoneComment({ actorId, ...input });
}

export async function getCommentReceiptAction(taskId: string, clientRequestId: string) {
  if (isDemoMode()) return { ok: false, code: "unauthenticated" } as const;
  const actorId = await authenticateConversationActor();
  if (!actorId) return { ok: false, code: "unauthenticated" } as const;
  return (await getTaskDiscussionService()).getReceipt({ actorId, taskId, clientRequestId });
}
