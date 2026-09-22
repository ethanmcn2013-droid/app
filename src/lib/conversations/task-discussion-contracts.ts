import type { ConversationResult, ObservedRange } from "./contracts";

export const TASK_DISCUSSION_LIMITS = Object.freeze({
  bodyCharacters: 8_000,
  bodyBytes: 32_768,
  pageDefault: 50,
  pageMaximum: 100,
  mentionsMaximum: 50,
});

export type TaskDiscussionMember = Readonly<{ id: string; name: string }>;

export type TaskCommentRecord = Readonly<{
  id: string;
  taskId: string;
  authorId: string | null;
  authorName: string;
  rootCommentId: string | null;
  createSeq: number;
  revision: number;
  body: string | null;
  createdAt: number;
  editedAt: number | null;
  deletedAt: number | null;
  mentionUserIds: readonly string[];
}>;

export type TaskDiscussionSnapshot = Readonly<{
  taskId: string;
  projectId: string;
  projectName: string;
  lifecycle: "active" | "archived";
  audienceEpoch: number;
  throughChangeSeq: number;
  members: readonly TaskDiscussionMember[];
  comments: readonly TaskCommentRecord[];
  hasOlder: boolean;
  beforeCreateSeq: number | null;
}>;

export type TaskDiscussionDelta = Readonly<{
  audienceEpoch: number;
  throughChangeSeq: number;
  hasMore: boolean;
  comments: readonly TaskCommentRecord[];
}>;

export type TaskCommentPage = Readonly<{
  audienceEpoch: number;
  throughChangeSeq: number;
  comments: readonly TaskCommentRecord[];
  hasOlder: boolean;
  beforeCreateSeq: number | null;
}>;

export type TaskCommentReceipt = Readonly<{
  commentId: string;
  clientRequestId: string;
  createSeq: number;
  changeSeq: number;
  revision: number;
  committedAt: number;
}>;

export type TaskCommentMutationReceipt = Omit<TaskCommentReceipt, "createSeq">;

export type TaskCommentReceiptLookup = ConversationResult<
  | { state: "committed"; receipt: TaskCommentReceipt }
  | { state: "absent" }
>;

export type SendTaskCommentInput = Readonly<{
  taskId: string;
  clientRequestId: string;
  expectedAudienceEpoch: number;
  body: string;
  rootCommentId: string | null;
  mentionUserIds: readonly string[];
}>;

export type EditTaskCommentInput = Readonly<{
  taskId: string;
  commentId: string;
  clientRequestId: string;
  expectedRevision: number;
  expectedAudienceEpoch: number;
  body: string;
  mentionUserIds: readonly string[];
}>;

export type TombstoneTaskCommentInput = Readonly<
  Omit<EditTaskCommentInput, "body" | "mentionUserIds">
>;

export type ObserveTaskCommentRangeInput = Readonly<{
  taskId: string;
  range: ObservedRange;
}>;

export function normalizeTaskCommentBody(body: string): string {
  return body.replace(/\r\n?/g, "\n");
}

export function validTaskCommentBody(body: unknown): body is string {
  return typeof body === "string" && body.trim().length > 0 &&
    Array.from(body).length <= TASK_DISCUSSION_LIMITS.bodyCharacters &&
    new TextEncoder().encode(body).byteLength <= TASK_DISCUSSION_LIMITS.bodyBytes &&
    !body.includes("\u0000");
}
