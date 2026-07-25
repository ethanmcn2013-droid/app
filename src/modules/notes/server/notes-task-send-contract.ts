import { createHash } from "node:crypto";

import { APP_ORIGIN } from "@/lib/product-urls";

export type TrustedTasksSendReceipt = {
  taskId: string;
  workspaceName: string;
  workspaceSlug: string;
  taskUrl: string;
  created: boolean;
};

export type ImmutableTasksSendRequest = {
  noteId: string;
  userId: string;
  sourceSelection: string;
  approvedBody: string;
  approvedBodySha256: string;
  workspaceId: string;
};

export type StoredPendingTasksSendRequest = ImmutableTasksSendRequest & {
  baseUpdatedAt: number;
  reservedUpdatedAt: number;
};

const TASK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_WORKSPACE_LABEL_CHARS = 160;
export const TASKS_SEND_LEASE_MS = 60_000;

export function approvedBodySha256(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

export function makeTasksSendOperationId(): string {
  return `o_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function makeTasksSendLeaseToken(): string {
  return `l_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function sameImmutableTasksSendRequest(
  stored: ImmutableTasksSendRequest,
  request: ImmutableTasksSendRequest,
): boolean {
  return (
    stored.noteId === request.noteId &&
    stored.userId === request.userId &&
    stored.sourceSelection === request.sourceSelection &&
    stored.approvedBody === request.approvedBody &&
    stored.approvedBodySha256 === request.approvedBodySha256 &&
    stored.workspaceId === request.workspaceId
  );
}

export function canResumePendingTasksSend(
  stored: StoredPendingTasksSendRequest,
  request: ImmutableTasksSendRequest,
  expectedUpdatedAt: number,
): boolean {
  return (
    sameImmutableTasksSendRequest(stored, request) &&
    (expectedUpdatedAt === stored.baseUpdatedAt ||
      expectedUpdatedAt === stored.reservedUpdatedAt)
  );
}

/**
 * Receiver contract rejections known to happen before a new task is inserted.
 * Timeouts, rate limits, proxy failures, and 5xx responses stay ambiguous.
 */
export function isDefinitiveTasksSendRejection(status: number): boolean {
  return [400, 401, 403, 404, 409, 413, 422].includes(status);
}

export function shouldReleaseTasksSendReservation(
  status: number,
  resumedPending: boolean,
): boolean {
  // Once a request has crossed an ambiguous boundary, a later rejection can
  // no longer prove that the original attempt did not create the task.
  return !resumedPending && isDefinitiveTasksSendRejection(status);
}

export function validateTrustedTaskId(value: unknown): string {
  if (typeof value !== "string" || !TASK_ID_PATTERN.test(value)) {
    throw new Error("Tasks returned an invalid task id, try again");
  }
  return value;
}

export function buildTrustedTaskUrl(taskId: string): string {
  const trustedId = validateTrustedTaskId(taskId);
  return `${APP_ORIGIN}/app/tasks?taskId=${encodeURIComponent(trustedId)}`;
}

function boundedLabel(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_WORKSPACE_LABEL_CHARS) return fallback;
  return trimmed;
}

/**
 * Parse only receipt metadata. The upstream taskUrl is deliberately ignored;
 * links are always rebuilt from the canonical configured Tasks origin.
 */
export function parseTrustedTasksSendReceipt(
  raw: unknown,
  expectedApprovedBodySha256: string,
): TrustedTasksSendReceipt {
  if (!raw || typeof raw !== "object") {
    throw new Error("Tasks returned an invalid response, try again");
  }
  if (!SHA256_PATTERN.test(expectedApprovedBodySha256)) {
    throw new Error("Approved wording receipt is invalid");
  }

  const value = raw as Record<string, unknown>;
  const acceptedBodySha256 = value.acceptedBodySha256;
  if (
    typeof acceptedBodySha256 !== "string" ||
    !SHA256_PATTERN.test(acceptedBodySha256) ||
    acceptedBodySha256 !== expectedApprovedBodySha256
  ) {
    throw new Error("Tasks did not confirm the exact approved wording");
  }
  if (typeof value.created !== "boolean") {
    throw new Error("Tasks returned an invalid response, try again");
  }

  const taskId = validateTrustedTaskId(value.taskId);
  return {
    taskId,
    workspaceName: boundedLabel(value.workspaceName, "Tasks"),
    workspaceSlug: boundedLabel(value.workspaceSlug, ""),
    taskUrl: buildTrustedTaskUrl(taskId),
    created: value.created,
  };
}

/**
 * Explicit rollback-only parser for the pre-v2 endpoint. It cannot prove an
 * accepted-body hash, but still bounds the task id and ignores upstream URLs.
 * Hybrid approved sends must never call this parser or the legacy endpoint.
 */
export function parseTrustedLegacyTasksSendReceipt(
  raw: unknown,
): TrustedTasksSendReceipt {
  if (!raw || typeof raw !== "object") {
    throw new Error("Tasks returned an invalid response, try again");
  }
  const value = raw as Record<string, unknown>;
  if (typeof value.created !== "boolean") {
    throw new Error("Tasks returned an invalid response, try again");
  }
  const taskId = validateTrustedTaskId(value.taskId);
  return {
    taskId,
    workspaceName: boundedLabel(value.workspaceName, "Tasks"),
    workspaceSlug: boundedLabel(value.workspaceSlug, ""),
    taskUrl: buildTrustedTaskUrl(taskId),
    created: value.created,
  };
}

export function replayedTasksSendReceipt(taskId: string): TrustedTasksSendReceipt {
  const trustedId = validateTrustedTaskId(taskId);
  return {
    taskId: trustedId,
    workspaceName: "Tasks",
    workspaceSlug: "",
    taskUrl: buildTrustedTaskUrl(trustedId),
    created: false,
  };
}
