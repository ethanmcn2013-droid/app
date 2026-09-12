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

function exactKeys(value: unknown, allowed: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}

/** Canonical Task Discussion has no development identity fallback. */
export async function openTaskDiscussionAction(taskId: string) {
  if (isDemoMode()) return { ok: false, code: "unauthenticated" } as const;
  const actorId = await authenticateConversationActor();
  if (!actorId) return { ok: false, code: "unauthenticated" } as const;
  return (await getTaskDiscussionService()).openTaskDiscussion({ actorId, taskId });
}

export async function addCommentAction(input: SendTaskCommentInput) {
  if (isDemoMode()) return { ok: false, code: "unauthenticated" } as const;
  if (!exactKeys(input, ["taskId", "clientRequestId", "expectedAudienceEpoch", "body", "rootCommentId", "mentionUserIds"])) {
    return { ok: false, code: "invalid_input" } as const;
  }
  const actorId = await authenticateConversationActor("write");
  if (!actorId) return { ok: false, code: "unauthenticated" } as const;
  return (await getTaskDiscussionService()).sendComment({ actorId, input });
}

export async function editCommentAction(input: EditTaskCommentInput) {
  if (isDemoMode()) return { ok: false, code: "unauthenticated" } as const;
  if (!exactKeys(input, ["taskId", "commentId", "clientRequestId", "expectedRevision", "expectedAudienceEpoch", "body", "mentionUserIds"])) {
    return { ok: false, code: "invalid_input" } as const;
  }
  const actorId = await authenticateConversationActor("write");
  if (!actorId) return { ok: false, code: "unauthenticated" } as const;
  return (await getTaskDiscussionService()).editComment({
    taskId: input.taskId, commentId: input.commentId, clientRequestId: input.clientRequestId,
    expectedRevision: input.expectedRevision, expectedAudienceEpoch: input.expectedAudienceEpoch,
    body: input.body, mentionUserIds: input.mentionUserIds, actorId,
  });
}

export async function removeCommentAction(input: TombstoneTaskCommentInput) {
  if (isDemoMode()) return { ok: false, code: "unauthenticated" } as const;
  if (!exactKeys(input, ["taskId", "commentId", "clientRequestId", "expectedRevision", "expectedAudienceEpoch"])) {
    return { ok: false, code: "invalid_input" } as const;
  }
  const actorId = await authenticateConversationActor("write");
  if (!actorId) return { ok: false, code: "unauthenticated" } as const;
  return (await getTaskDiscussionService()).tombstoneComment({
    taskId: input.taskId, commentId: input.commentId, clientRequestId: input.clientRequestId,
    expectedRevision: input.expectedRevision, expectedAudienceEpoch: input.expectedAudienceEpoch,
    actorId,
  });
}

export async function getCommentReceiptAction(taskId: string, clientRequestId: string) {
  if (isDemoMode()) return { ok: false, code: "unauthenticated" } as const;
  const actorId = await authenticateConversationActor();
  if (!actorId) return { ok: false, code: "unauthenticated" } as const;
  return (await getTaskDiscussionService()).getReceipt({ actorId, taskId, clientRequestId });
}
