import { conversationAvailability, type ConversationControls } from "@/lib/conversations/flags";
import { PERSONAL_CHAT_LIMITS, validPersonalChatSend, validPersonalChatRequestId } from "@/lib/conversations/personal-chat-contracts";
import type { createPersonalChatService } from "./personal-chat";

type Service = ReturnType<typeof createPersonalChatService>;
type Dependencies = Readonly<{
  authenticate: (mode: "read" | "write") => Promise<string | null>;
  controls: () => ConversationControls;
  service: () => Promise<Service>;
}>;

const headers = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const status: Record<string, number> = {
  invalid_input: 400, request_conflict: 409, unauthenticated: 401,
  unavailable: 404, temporarily_unavailable: 503, rate_limited: 429, export_too_large: 413,
};
const json = (value: unknown, code?: string, additionalHeaders?: HeadersInit) => Response.json(code ? { error: code } : value, {
  status: code ? (status[code] ?? 503) : 200, headers: { ...headers, ...additionalHeaders },
});

async function boundedJson(request: Request): Promise<Record<string, unknown> | null> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return null;
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > PERSONAL_CHAT_LIMITS.requestBytes)) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > PERSONAL_CHAT_LIMITS.requestBytes) { await reader.cancel(); return null; }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
  finally { reader.releaseLock(); }
}

export function createPersonalChatHttp(deps: Dependencies) {
  return async function handle(request: Request): Promise<Response> {
    try {
      const controls = deps.controls();
      if (!controls.internalEnabled) return json(null, "unavailable");
      const url = new URL(request.url);
      if (request.method !== "GET" && request.method !== "POST") {
        return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, POST" } });
      }
      const writing = request.method === "POST";
      // Authenticate identity independently from send admission; otherwise a
      // sends-disabled account would look like an expired login to the client.
      const actorId = await deps.authenticate("read");
      if (!actorId) return json(null, "unauthenticated");
      const availability = conversationAvailability(controls, actorId);
      if (!availability.read) return json(null, "unavailable");
      const service = await deps.service();
      const attachmentsEnabled = await service.attachmentsEnabled();
      if (!writing) {
        const params = url.searchParams;
        const allowed = new Set(["format", "requestId", "limit", "before"]);
        const keys = [...params.keys()];
        if (keys.some(key => !allowed.has(key)) || new Set(keys).size !== keys.length) return json(null, "invalid_input");
        if (params.has("format")) {
          if (params.get("format") !== "markdown" || params.size !== 1) return json(null, "invalid_input");
          const result = await service.exportMarkdown({ ownerId: actorId });
          return result.ok ? json(result.value) : json(null, result.code === "unavailable" ? "temporarily_unavailable" : result.code);
        }
        if (params.has("requestId")) {
          const requestId = params.get("requestId");
          if (params.size !== 1 || !validPersonalChatRequestId(requestId)) return json(null, "invalid_input");
          const result = await service.getReceipt({ ownerId: actorId, clientRequestId: requestId });
          return result.ok ? json({ ...result.value, attachmentsEnabled }) : json(null, result.code === "invalid_input" ? result.code : "temporarily_unavailable");
        }
        const limitText = params.get("limit") ?? String(PERSONAL_CHAT_LIMITS.pageDefault);
        const before = params.get("before") ?? undefined;
        if (!/^\d+$/.test(limitText) || !Number.isSafeInteger(Number(limitText)) || Number(limitText) < 1 || Number(limitText) > PERSONAL_CHAT_LIMITS.pageMaximum || (before !== undefined && !/^[A-Za-z0-9_-]{8,128}$/.test(before))) return json(null, "invalid_input");
        const result = await service.list({ ownerId: actorId, limit: Number(limitText), ...(before ? { before } : {}) });
        return result.ok ? json({ ...result.value, attachmentsEnabled }) : json(null, result.code === "invalid_input" ? result.code : "temporarily_unavailable");
      }
      if (request.headers.get("origin") !== url.origin || request.headers.get("sec-fetch-site") === "cross-site") return json(null, "unavailable");
      if (!availability.send) return json(null, "unavailable");
      const input = await boundedJson(request);
      if (!input || Object.keys(input).some(key => !["clientRequestId", "body", "attachmentIds"].includes(key)) || !Object.hasOwn(input, "clientRequestId") || !Object.hasOwn(input, "body") ||
          !validPersonalChatRequestId(input.clientRequestId) || !validPersonalChatSend(input.body, input.attachmentIds ?? [])) return json(null, "invalid_input");
      const result = await service.send({ ownerId: actorId, clientRequestId: input.clientRequestId, body: input.body, attachmentIds: input.attachmentIds as string[] | undefined });
      if (result.ok) return json({ ...result.value, attachmentsEnabled });
      if (result.code === "rate_limited") return json(null, result.code, { "Retry-After": String(result.retryAfterSeconds ?? 60) });
      return json(null, result.code === "unavailable" ? "temporarily_unavailable" : result.code);
    } catch { return json(null, "temporarily_unavailable"); }
  };
}
