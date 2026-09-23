import { parseProjectId } from "../../lib/projects/project-ref";
import { conversationAvailability, type ConversationControls } from "../../lib/conversations/flags";
import { validMessageBody, validRequestId, validSequence, type ConversationFailure } from "../../lib/conversations/contracts";
import { isCalendarDate } from "../../lib/planning/dates";
import type { createConversationService } from "./service";
import type { createConversationTaskOutcomeService } from "./work-links";

type Service = ReturnType<typeof createConversationService>;
type TaskOutcomes = ReturnType<typeof createConversationTaskOutcomeService>;
type Dependencies = {
  authenticate: () => Promise<string | null>;
  controls: () => ConversationControls;
  service: () => Promise<Service>;
  taskOutcomes?: () => Promise<TaskOutcomes>;
};
const MAX_JSON_BYTES = 48_000;
const headers = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const status: Record<ConversationFailure["code"], number> = {
  unauthenticated: 401, unavailable: 404, archived: 409, audience_changed: 409,
  consent_required: 403, read_only: 403, invalid_input: 400, request_conflict: 409,
  revision_conflict: 409, temporarily_unavailable: 503, resync_required: 409, rate_limited: 429,
};
function response(result: { ok: boolean; code?: ConversationFailure["code"]; retryAfterMs?: number }) {
  return Response.json(result, {
    status: result.ok ? 200 : status[result.code ?? "temporarily_unavailable"],
    headers: { ...headers, ...(result.retryAfterMs ? { "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)) } : {}) },
  });
}
const fail = (code: ConversationFailure["code"]) => response({ ok: false, code });
const id = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f]/.test(value);
const positive = (value: unknown): value is number => validSequence(value) && value > 0;
const taskTitle = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 &&
  Array.from(value).length <= 1_000 && new TextEncoder().encode(value).byteLength <= 4_000 && !/[\u0000-\u001f]/.test(value);
const PROMOTE_FIELDS = new Set(["action", "projectId", "conversationId", "messageId", "clientRequestId",
  "expectedRevision", "expectedAudienceEpoch", "destinationProjectId", "title", "ownerUserId", "dueDate"]);
const DM_REQUEST_FIELDS = new Set(["action", "projectId", "recipientId", "clientRequestId"]);
const DM_TRANSITION_FIELDS = new Set(["action", "projectId", "conversationId", "clientRequestId", "expectedAudienceEpoch", "operation"]);

async function boundedJson(request: Request): Promise<Record<string, unknown> | null> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return null;
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_JSON_BYTES)) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_JSON_BYTES) { await reader.cancel(); return null; }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; } finally { reader.releaseLock(); }
}

/** Auth comes from the server session. No body/header can substitute an actor. */
export function createConversationHttp(deps: Dependencies) {
  return async function handle(request: Request): Promise<Response> {
    try {
      const actorId = await deps.authenticate();
      if (!actorId) return fail("unauthenticated");
      const controls = deps.controls();
      const availability = conversationAvailability(controls, actorId);
      if (!availability.read) return fail("unavailable");
      const url = new URL(request.url);
      if (request.method === "GET") {
        const action = url.searchParams.get("action");
        if (action === "task-receipt") {
          const clientRequestId = url.searchParams.get("clientRequestId");
          if (!validRequestId(clientRequestId) || !deps.taskOutcomes) return fail("invalid_input");
          return response(await (await deps.taskOutcomes()).getTaskReceipt({ actorId, clientRequestId }));
        }
        if (action === "task-outcome") {
          const taskId = url.searchParams.get("taskId");
          if (!id(taskId) || !deps.taskOutcomes) return fail("invalid_input");
          return response(await (await deps.taskOutcomes()).getTaskOutcome({ actorId, taskId }));
        }
        const projectId = parseProjectId(url.searchParams.get("projectId"));
        if (!projectId) return fail("invalid_input");
        if (action === "task-destination") {
          if (!deps.taskOutcomes) return fail("invalid_input");
          return response(await (await deps.taskOutcomes()).getTaskDestination({ actorId, projectId }));
        }
        const service = await deps.service();
        if (action === "dm-list") return controls.directMessagesEnabled
          ? response(await service.listDirectMessages({ actorId, projectId })) : fail("unavailable");
        if (action === "project") return response(await service.getProjectConversation({ actorId, projectId }));
        if (action === "audience") return response(await service.listProjectAudience({ actorId, projectId }));
        const conversationId = url.searchParams.get("conversationId");
        if (!id(conversationId)) return fail("invalid_input");
        if (action === "dm-scope") return controls.directMessagesEnabled
          ? response(await service.getDirectMessage({ actorId, projectId, conversationId })) : fail("unavailable");
        if (action === "dm-audience") return controls.directMessagesEnabled
          ? response(await service.listDirectMessageAudience({ actorId, projectId, conversationId })) : fail("unavailable");
        if (action === "receipt") {
          const clientRequestId = url.searchParams.get("clientRequestId");
          if (!validRequestId(clientRequestId)) return fail("invalid_input");
          return response(await service.getReceipt({ actorId, projectId, conversationId, clientRequestId }));
        }
        if (action === "messages") {
          const beforeText = url.searchParams.get("beforeCreateSeq");
          const limitText = url.searchParams.get("limit") ?? "50";
          if (!/^\d+$/.test(limitText) || !positive(Number(limitText)) || Number(limitText) > 100 ||
            (beforeText !== null && (!/^\d+$/.test(beforeText) || !positive(Number(beforeText))))) return fail("invalid_input");
          const rootId = url.searchParams.get("rootId");
          if (rootId !== null && !id(rootId)) return fail("invalid_input");
          return response(await service.getMessagePage({ actorId, projectId, conversationId, limit: Number(limitText),
            ...(rootId !== null ? { rootId } : {}), ...(beforeText !== null ? { beforeCreateSeq: Number(beforeText) } : {}) }));
        }
        if (action !== "history") return fail("invalid_input");
        const cursorText = url.searchParams.get("afterChangeSeq") ?? "0";
        const limitText = url.searchParams.get("limit") ?? "50";
        const afterChangeSeq = Number(cursorText); const limit = Number(limitText);
        if (!/^\d+$/.test(cursorText) || !validSequence(afterChangeSeq) || !/^\d+$/.test(limitText) || !positive(limit) || limit > 100) return fail("invalid_input");
        return response(await service.getHistory({ actorId, projectId, conversationId, afterChangeSeq, limit }));
      }
      if (request.method !== "POST") return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, POST" } });
      if (request.headers.get("origin") !== url.origin || request.headers.get("sec-fetch-site") === "cross-site") return fail("unavailable");
      if (!availability.send) return fail("read_only");
      const body = await boundedJson(request);
      if (!body || "actorId" in body || "userId" in body) return fail("invalid_input");
      const projectId = typeof body.projectId === "string" ? parseProjectId(body.projectId) : null;
      if (!projectId) return fail("invalid_input");
      if (body.action === "promote-task") {
        if (!deps.taskOutcomes || Object.keys(body).some((key) => !PROMOTE_FIELDS.has(key)) ||
          !id(body.conversationId) || !id(body.messageId) || !validRequestId(body.clientRequestId) ||
          !positive(body.expectedRevision) || !positive(body.expectedAudienceEpoch) ||
          typeof body.destinationProjectId !== "string" || !parseProjectId(body.destinationProjectId) ||
          !taskTitle(body.title) || !id(body.ownerUserId) || !isCalendarDate(body.dueDate)) return fail("invalid_input");
        return response(await (await deps.taskOutcomes()).promoteMessageToTask({ actorId, input: {
          clientRequestId: body.clientRequestId, sourceProjectId: projectId,
          conversationId: body.conversationId, messageId: body.messageId,
          expectedRevision: body.expectedRevision, expectedAudienceEpoch: body.expectedAudienceEpoch,
          destinationProjectId: parseProjectId(body.destinationProjectId)!, title: body.title,
          ownerUserId: body.ownerUserId, dueDate: body.dueDate,
        } }));
      }
      const service = await deps.service();
      if (body.action === "dm-request") {
        if (!controls.directMessagesEnabled) return fail("unavailable");
        if (Object.keys(body).some((key) => !DM_REQUEST_FIELDS.has(key)) || !id(body.recipientId) || !validRequestId(body.clientRequestId)) return fail("invalid_input");
        return response(await service.requestDirectMessage({ actorId, projectId, recipientId: body.recipientId, clientRequestId: body.clientRequestId }));
      }
      if (body.action === "dm-transition") {
        if (!controls.directMessagesEnabled) return fail("unavailable");
        if (Object.keys(body).some((key) => !DM_TRANSITION_FIELDS.has(key)) || !id(body.conversationId) || !validRequestId(body.clientRequestId) ||
          !positive(body.expectedAudienceEpoch) || typeof body.operation !== "string" || !["accept","decline","block","unblock","leave","reopen"].includes(body.operation)) return fail("invalid_input");
        return response(await service.transitionDirectMessage({ actorId, projectId, conversationId: body.conversationId,
          clientRequestId: body.clientRequestId, expectedAudienceEpoch: body.expectedAudienceEpoch,
          operation: body.operation as "accept"|"decline"|"block"|"unblock"|"leave"|"reopen" }));
      }
      if (body.action === "ensure") return response(await service.ensureProjectConversation({ actorId, projectId }));
      const { conversationId, clientRequestId, expectedAudienceEpoch } = body;
      if (!id(conversationId) || !validRequestId(clientRequestId) || !positive(expectedAudienceEpoch)) return fail("invalid_input");
      const common = { actorId, projectId, conversationId, clientRequestId, expectedAudienceEpoch };
      if (body.action === "tombstone") {
        if (!id(body.messageId) || !positive(body.expectedRevision)) return fail("invalid_input");
        return response(await service.tombstoneMessage({ ...common, messageId: body.messageId, expectedRevision: body.expectedRevision }));
      }
      if (!validMessageBody(body.body) || !Array.isArray(body.mentionUserIds) || body.mentionUserIds.length > 50 || !body.mentionUserIds.every(id)) return fail("invalid_input");
      if (body.action === "send") {
        if (body.rootId !== null && !id(body.rootId)) return fail("invalid_input");
        return response(await service.sendMessage({ actorId, input: { projectId, conversationId, clientRequestId, expectedAudienceEpoch, body: body.body, rootId: body.rootId, mentionUserIds: body.mentionUserIds } }));
      }
      if (body.action === "edit" && id(body.messageId) && positive(body.expectedRevision)) {
        return response(await service.editMessage({ ...common, messageId: body.messageId, expectedRevision: body.expectedRevision, body: body.body, mentionUserIds: body.mentionUserIds }));
      }
      return fail("invalid_input");
    } catch {
      // No exception bodies, SQL text, recipients or credentials leave this boundary.
      return fail("temporarily_unavailable");
    }
  };
}
