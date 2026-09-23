import type { ConversationFailure } from "../../lib/conversations/contracts";
import type { createMessageAttentionService } from "./attention";

type AttentionService = ReturnType<typeof createMessageAttentionService>;

const headers = { "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const status: Record<ConversationFailure["code"], number> = {
  unauthenticated: 401, unavailable: 404, archived: 409, audience_changed: 409,
  consent_required: 403, read_only: 403, invalid_input: 400, request_conflict: 409,
  revision_conflict: 409, temporarily_unavailable: 503, resync_required: 409, rate_limited: 429,
};
function response(result: { ok: boolean; code?: ConversationFailure["code"] }) {
  return Response.json(result, { status: result.ok ? 200 : status[result.code ?? "temporarily_unavailable"], headers });
}
const fail = (code: ConversationFailure["code"]) => response({ ok: false, code });

async function boundedJson(request: Request): Promise<Record<string, unknown> | null> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return null;
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 48_000)) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 48_000) { await reader.cancel(); return null; }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; } finally { reader.releaseLock(); }
}

export function createMessageAttentionHttp(dependencies: {
  authenticate: () => Promise<string | null>;
  service: () => Promise<AttentionService>;
}) {
async function GET(request: Request) {
  try {
    const actorId = await dependencies.authenticate();
    if (!actorId) return fail("unauthenticated");
    const url = new URL(request.url);
    if ([...url.searchParams.keys()].some(key => key !== "action" && key !== "limit")) return fail("invalid_input");
    if (url.searchParams.get("action") !== "list") return fail("invalid_input");
    const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined;
    return response(await (await dependencies.service()).listDirected({ actorId, limit }));
  } catch {
    return fail("temporarily_unavailable");
  }
}

async function POST(request: Request) {
  try {
    const actorId = await dependencies.authenticate();
    if (!actorId) return fail("unauthenticated");
    if (request.headers.get("origin") !== new URL(request.url).origin ||
        request.headers.get("sec-fetch-site") === "cross-site") return fail("unavailable");
    const body = await boundedJson(request);
    if (!body || typeof body.action !== "string") return fail("invalid_input");
    const service = await dependencies.service();
    if (body.action === "observe") {
      if (Object.keys(body).some(key => key !== "action" && key !== "items") || !Array.isArray(body.items)) return fail("invalid_input");
      return response(await service.observe({ actorId, items: body.items }));
    }
    if (body.action === "status") {
      if (Object.keys(body).some(key => key !== "action" && key !== "items") || !Array.isArray(body.items)) return fail("invalid_input");
      return response(await service.readStatus({ actorId, items: body.items }));
    }
    if (body.action === "mark-all") {
      if (Object.keys(body).some(key => key !== "action")) return fail("invalid_input");
      return response(await service.markAllObserved({ actorId }));
    }
    return fail("invalid_input");
  } catch {
    return fail("temporarily_unavailable");
  }
}
return { GET, POST };
}
