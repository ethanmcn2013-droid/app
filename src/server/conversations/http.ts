import { parseProjectId } from "../../lib/projects/project-ref";
import { conversationAvailability, type ConversationControls } from "../../lib/conversations/flags";
import { validMessageBody, validRequestId, validSequence, type ConversationFailure } from "../../lib/conversations/contracts";
import type { createConversationService } from "./service";

type Service = ReturnType<typeof createConversationService>;
type Dependencies = {
  authenticate: () => Promise<string | null>;
  controls: () => ConversationControls;
  service: () => Promise<Service>;
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
      const availability = conversationAvailability(deps.controls(), actorId);
      if (!availability.read) return fail("unavailable");
      const url = new URL(request.url);
      if (request.method === "GET") {
        const projectId = parseProjectId(url.searchParams.get("projectId"));
        if (!projectId) return fail("invalid_input");
        const action = url.searchParams.get("action");
        const service = await deps.service();
        if (action === "project") return response(await service.getProjectConversation({ actorId, projectId }));
        if (action === "audience") return response(await service.listProjectAudience({ actorId, projectId }));
        const conversationId = url.searchParams.get("conversationId");
        if (!id(conversationId)) return fail("invalid_input");
        if (action === "receipt") {
          const clientRequestId = url.searchParams.get("clientRequestId");
          if (!validRequestId(clientRequestId)) return fail("invalid_input");
          return response(await service.getReceipt({ actorId, projectId, conversationId, clientRequestId }));
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
      const service = await deps.service();
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
