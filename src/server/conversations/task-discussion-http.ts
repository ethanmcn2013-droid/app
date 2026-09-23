import { conversationAvailability, type ConversationControls } from "@/lib/conversations/flags";
import { validRequestId, validSequence, type ConversationFailure } from "@/lib/conversations/contracts";
import {
  TASK_DISCUSSION_LIMITS,
  validTaskCommentBody,
} from "@/lib/conversations/task-discussion-contracts";
import type { createTaskDiscussionService } from "./task-discussion";

type Service = ReturnType<typeof createTaskDiscussionService>;
type Dependencies = Readonly<{
  authenticate: () => Promise<string | null>;
  controls: () => ConversationControls;
  service: () => Promise<Service>;
}>;

const MAX_JSON_BYTES = 48_000;
const headers = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const statuses: Record<ConversationFailure["code"], number> = {
  unauthenticated: 401, unavailable: 404, archived: 409, audience_changed: 409,
  consent_required: 403, read_only: 403, invalid_input: 400, request_conflict: 409,
  revision_conflict: 409, temporarily_unavailable: 503, resync_required: 409,
  rate_limited: 429,
};

function response(result: { ok: boolean; code?: ConversationFailure["code"]; retryAfterMs?: number }) {
  return Response.json(result, {
    status: result.ok ? 200 : statuses[result.code ?? "temporarily_unavailable"],
    headers: { ...headers, ...(result.retryAfterMs
      ? { "Retry-After": String(Math.ceil(result.retryAfterMs / 1_000)) }
      : {}) },
  });
}
const fail = (code: ConversationFailure["code"]) => response({ ok: false, code });
const id = (value: unknown): value is string => typeof value === "string" &&
  /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const positive = (value: unknown): value is number => validSequence(value) && value > 0;

async function boundedJson(request: Request): Promise<Record<string, unknown> | null> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return null;
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_JSON_BYTES)) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_JSON_BYTES) { await reader.cancel(); return null; }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

const GET_FIELDS: Record<string, ReadonlySet<string>> = {
  list: new Set(["action", "projectId"]),
  open: new Set(["action", "taskId", "limit"]),
  history: new Set(["action", "taskId", "afterChangeSeq", "limit"]),
  comments: new Set(["action", "taskId", "beforeCreateSeq", "limit"]),
  receipt: new Set(["action", "taskId", "clientRequestId"]),
};
const POST_FIELDS: Record<string, ReadonlySet<string>> = {
  send: new Set(["action", "taskId", "clientRequestId", "expectedAudienceEpoch", "body", "rootCommentId", "mentionUserIds"]),
  edit: new Set(["action", "taskId", "commentId", "clientRequestId", "expectedRevision", "expectedAudienceEpoch", "body", "mentionUserIds"]),
  tombstone: new Set(["action", "taskId", "commentId", "clientRequestId", "expectedRevision", "expectedAudienceEpoch"]),
  observe: new Set(["action", "taskId", "rootCommentId", "fromCreateSeq", "throughCreateSeq"]),
};

/** Task identity is the only scope accepted at the boundary; the service derives its Project. */
export function createTaskDiscussionHttp(deps: Dependencies) {
  return async function handle(request: Request): Promise<Response> {
    try {
      const actorId = await deps.authenticate();
      if (!actorId) return fail("unauthenticated");
      const availability = conversationAvailability(deps.controls(), actorId);
      if (!availability.read) return fail("unavailable");
      const url = new URL(request.url);
      const service = await deps.service();
      if (request.method === "GET") {
        const action = url.searchParams.get("action") ?? "";
        const allowed = GET_FIELDS[action];
        if (!allowed || [...url.searchParams.keys()].some((key) => !allowed.has(key))) return fail("invalid_input");
        if (action === "list") {
          const projectId = url.searchParams.get("projectId");
          return id(projectId)
            ? response(await service.listProjectDiscussions({ actorId, projectId }))
            : fail("invalid_input");
        }
        const taskId = url.searchParams.get("taskId");
        if (!id(taskId)) return fail("invalid_input");
        if (action === "receipt") {
          const clientRequestId = url.searchParams.get("clientRequestId");
          return validRequestId(clientRequestId)
            ? response(await service.getReceipt({ actorId, taskId, clientRequestId }))
            : fail("invalid_input");
        }
        const limitText = url.searchParams.get("limit") ?? String(TASK_DISCUSSION_LIMITS.pageDefault);
        if (!/^\d+$/.test(limitText) || !positive(Number(limitText)) || Number(limitText) > TASK_DISCUSSION_LIMITS.pageMaximum) {
          return fail("invalid_input");
        }
        if (action === "open") return response(await service.openTaskDiscussion({ actorId, taskId, limit: Number(limitText) }));
        if (action === "comments") {
          const beforeText = url.searchParams.get("beforeCreateSeq");
          if (beforeText !== null && (!/^\d+$/.test(beforeText) || !positive(Number(beforeText)))) return fail("invalid_input");
          return response(await service.getCommentPage({ actorId, taskId, limit: Number(limitText),
            ...(beforeText === null ? {} : { beforeCreateSeq: Number(beforeText) }) }));
        }
        const afterText = url.searchParams.get("afterChangeSeq") ?? "0";
        if (!/^\d+$/.test(afterText) || !validSequence(Number(afterText))) return fail("invalid_input");
        return response(await service.getHistory({ actorId, taskId, afterChangeSeq: Number(afterText), limit: Number(limitText) }));
      }
      if (request.method !== "POST") return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, POST" } });
      if (request.headers.get("origin") !== url.origin || request.headers.get("sec-fetch-site") === "cross-site") return fail("unavailable");
      if (!availability.send) return fail("read_only");
      const body = await boundedJson(request);
      const action = typeof body?.action === "string" ? body.action : "";
      const allowed = POST_FIELDS[action];
      if (!body || !allowed || Object.keys(body).some((key) => !allowed.has(key)) || "actorId" in body || "projectId" in body || !id(body.taskId)) {
        return fail("invalid_input");
      }
      const taskId = body.taskId;
      if (action === "observe") {
        if ((body.rootCommentId !== null && !id(body.rootCommentId)) || !positive(body.fromCreateSeq) ||
            !positive(body.throughCreateSeq) || body.throughCreateSeq < body.fromCreateSeq) return fail("invalid_input");
        return response(await service.observeRange({ actorId, taskId,
          rootCommentId: body.rootCommentId as string | null,
          fromCreateSeq: body.fromCreateSeq, throughCreateSeq: body.throughCreateSeq }));
      }
      if (!validRequestId(body.clientRequestId) || !positive(body.expectedAudienceEpoch)) return fail("invalid_input");
      if (action === "tombstone") {
        if (!id(body.commentId) || !positive(body.expectedRevision)) return fail("invalid_input");
        return response(await service.tombstoneComment({ actorId, taskId, commentId: body.commentId,
          clientRequestId: body.clientRequestId, expectedRevision: body.expectedRevision,
          expectedAudienceEpoch: body.expectedAudienceEpoch }));
      }
      if (!validTaskCommentBody(body.body) || !Array.isArray(body.mentionUserIds) ||
          body.mentionUserIds.length > TASK_DISCUSSION_LIMITS.mentionsMaximum ||
          !body.mentionUserIds.every(id)) return fail("invalid_input");
      if (action === "send") {
        if (body.rootCommentId !== null && !id(body.rootCommentId)) return fail("invalid_input");
        return response(await service.sendComment({ actorId, input: { taskId,
          clientRequestId: body.clientRequestId, expectedAudienceEpoch: body.expectedAudienceEpoch,
          body: body.body, rootCommentId: body.rootCommentId as string | null,
          mentionUserIds: body.mentionUserIds } }));
      }
      if (action === "edit" && id(body.commentId) && positive(body.expectedRevision)) {
        return response(await service.editComment({ actorId, taskId, commentId: body.commentId,
          clientRequestId: body.clientRequestId, expectedRevision: body.expectedRevision,
          expectedAudienceEpoch: body.expectedAudienceEpoch, body: body.body,
          mentionUserIds: body.mentionUserIds }));
      }
      return fail("invalid_input");
    } catch {
      return fail("temporarily_unavailable");
    }
  };
}
