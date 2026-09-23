/** Project Conversation v1. Transport data only; these types never grant access. */
import type { ProjectId } from "../projects/project-ref";

export const CONVERSATION_LIMITS = Object.freeze({
  bodyCharacters: 8_000,
  bodyBytes: 32_768,
  pageDefault: 50,
  pageMaximum: 100,
});

export type ConversationKind = "project" | "dm";
export type PairState = "pending" | "active" | "declined" | "blocked" | "left" | "membership_lost" | "rejoin_pending";
export type SourceRef = Readonly<
  | { kind: "message"; projectId: ProjectId; conversationId: string; messageId: string; revision: number }
  | { kind: "task_comment"; projectId: ProjectId; taskId: string; commentId: string; revision: number }
>;
export type ConversationFailure = Readonly<{
  ok: false;
  code: "unauthenticated" | "unavailable" | "archived" | "audience_changed" | "consent_required" | "read_only" | "invalid_input" | "request_conflict" | "revision_conflict" | "temporarily_unavailable" | "resync_required" | "rate_limited";
  retryAfterMs?: number;
}>;
export type ConversationResult<T> = Readonly<{ ok: true; value: T }> | ConversationFailure;

export type SendInput = Readonly<{
  projectId: ProjectId;
  conversationId: string;
  clientRequestId: string;
  expectedAudienceEpoch: number;
  body: string;
  rootId: string | null;
  mentionUserIds: readonly string[];
}>;
/** Only a committed record is a receipt. Unknown network outcomes remain uncertain. */
export type MessageReceipt = Readonly<{
  messageId: string;
  clientRequestId: string;
  createSeq: number;
  changeSeq: number;
  revision: number;
  committedAt: number;
}>;
export type ReceiptLookup = ConversationResult<
  | { state: "committed"; receipt: MessageReceipt }
  | { state: "absent" }
>;
export type MessageRecord = Readonly<{
  id: string;
  authorId: string | null;
  rootId: string | null;
  createSeq: number;
  revision: number;
  body: string | null;
  createdAt: number;
  editedAt: number | null;
  deletedAt: number | null;
  /** Present on root pages; thread replies never contribute to observation implicitly. */
  replyCount?: number;
  replyCountChangeSeq?: number;
}>;
export type ConversationDelta = Readonly<{
  audienceEpoch: number;
  throughChangeSeq: number;
  hasMore: boolean;
  messages: readonly MessageRecord[];
}>;
/** No sender-visible read receipts. Root and opened-thread coverage are separate. */
export type MessagePage = Readonly<{
  audienceEpoch: number;
  throughChangeSeq: number;
  messages: readonly MessageRecord[];
  hasOlder: boolean;
  beforeCreateSeq: number | null;
}>;
export type ObservedRange = Readonly<{
  rootId: string | null;
  fromCreateSeq: number;
  throughCreateSeq: number;
}>;
export type WorkOperationState = "pending" | "committed" | "needs_review" | "source_changed" | "unavailable";

/** The only body normalization before validation, review and request hashing. */
export function normalizeMessageBody(body: string): string {
  return body.replace(/\r\n?/g, "\n");
}

/** Validation preserves reviewed whitespace; hashing must not trim it later. */
export function validMessageBody(body: unknown): body is string {
  return typeof body === "string" && body.trim().length > 0 &&
    Array.from(body).length <= CONVERSATION_LIMITS.bodyCharacters &&
    new TextEncoder().encode(body).byteLength <= CONVERSATION_LIMITS.bodyBytes &&
    !body.includes("\u0000");
}

export function validRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(value);
}

export function validSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Stable tuple; JSON framing prevents separator collisions in identities. */
export function pairIdentity(projectId: ProjectId, firstUserId: string, secondUserId: string): string {
  if (!firstUserId || !secondUserId || firstUserId === secondUserId) throw new Error("invalid_pair");
  return JSON.stringify([projectId, ...[firstUserId, secondUserId].sort()]);
}
