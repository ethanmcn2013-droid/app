import { CONVERSATION_ATTACHMENT_LIMITS as LIMIT } from "@/lib/conversations/attachment-contracts";
import { parseProjectId } from "@/lib/projects/project-ref";
import { conversationAvailability, type ConversationControls } from "@/lib/conversations/flags";
import type { ConversationAttachmentService, ConversationAttachmentRow } from "./attachments";

export const conversationFileHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
};
const codes: Record<string, number> = { invalid_input: 400, unauthenticated: 401, unavailable: 404, request_conflict: 409, rate_limited: 429, upload_too_large: 413, unsupported_file: 415, quota_exceeded: 409, upload_in_progress: 409, storage_unavailable: 503 };
export const conversationFileError = (code: string) => Response.json({ error: code }, { status: codes[code] ?? 503, headers: { ...conversationFileHeaders, ...(code === "rate_limited" ? { "Retry-After": "60" } : {}) } });

/** Bound the full multipart envelope before asking the runtime to parse it. */
async function boundedForm(request: Request): Promise<FormData | null> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("multipart/form-data;")) return null;
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > LIMIT.multipartBytes)) throw new Error("upload_too_large");
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > LIMIT.multipartBytes) { await reader.cancel(); throw new Error("upload_too_large"); }
      chunks.push(chunk.value);
    }
    const buffer = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    return await new Response(buffer, { headers: { "content-type": type } }).formData();
  } finally { reader.releaseLock(); }
}

export function createConversationAttachmentHttp(deps: {
  authenticate: (mode?: "read" | "write") => Promise<string | null>;
  controls: () => ConversationControls; service: () => Promise<ConversationAttachmentService>;
}) {
  return async (request: Request) => {
    try {
      const controls = deps.controls();
      if (!controls.internalEnabled) return conversationFileError("unavailable");
      const actor = await deps.authenticate("read");
      if (!actor) return conversationFileError("unauthenticated");
      if (!conversationAvailability(controls, actor).send) return conversationFileError("unavailable");
      const url = new URL(request.url);
      if (request.method !== "GET" && (request.headers.get("origin") !== url.origin || request.headers.get("sec-fetch-site") === "cross-site")) return conversationFileError("unavailable");
      const service = await deps.service();
      if (!await service.available()) return conversationFileError("unavailable");
      const parseScope = (values: { get: (key: string) => unknown }) => {
        const projectId = parseProjectId(values.get("projectId"));
        const conversationId = values.get("conversationId");
        const root = values.get("rootId");
        const epoch = values.get("expectedAudienceEpoch");
        if (!projectId || typeof conversationId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(conversationId) || typeof root !== "string" || (root !== "" && !/^[A-Za-z0-9_-]{1,128}$/.test(root)) || typeof epoch !== "string" || !/^[1-9][0-9]*$/.test(epoch) || !Number.isSafeInteger(Number(epoch))) return null;
        return { ownerId: actor, projectId, conversationId, rootId: root || null, expectedAudienceEpoch: Number(epoch) };
      };
      if (request.method === "GET") {
        const fields = ["projectId","conversationId","rootId","expectedAudienceEpoch"];
        if (url.searchParams.size !== fields.length || [...url.searchParams.keys()].some(key => !fields.includes(key))) return conversationFileError("invalid_input");
        const scope = parseScope(url.searchParams);
        if (!scope) return conversationFileError("invalid_input");
        const result = await service.availability(scope);
        return result.ok ? Response.json(result.value, { headers: conversationFileHeaders }) : conversationFileError(result.code);
      }
      if (request.method === "DELETE") {
        if (url.searchParams.size !== 1 || !url.searchParams.get("id")) return conversationFileError("invalid_input");
        const result = await service.cancel({ ownerId: actor, id: url.searchParams.get("id")! });
        return result.ok ? Response.json(result.value, { headers: conversationFileHeaders }) : conversationFileError(result.code);
      }
      if (request.method !== "POST") return new Response(null, { status: 405, headers: { ...conversationFileHeaders, Allow: "GET, POST, DELETE" } });
      if (url.searchParams.size) return conversationFileError("invalid_input");
      const form = await boundedForm(request);
      if (!form || [...form.keys()].length !== 6 || [...form.keys()].some(key => !["file","clientRequestId","projectId","conversationId","rootId","expectedAudienceEpoch"].includes(key))) return conversationFileError("invalid_input");
      const scope = parseScope(form);
      if (!scope) return conversationFileError("invalid_input");
      const file = form.get("file");
      const clientRequestId = form.get("clientRequestId");
      if (!file || typeof file === "string" || typeof clientRequestId !== "string") return conversationFileError("invalid_input");
      if (file.size > LIMIT.fileBytes) return conversationFileError("upload_too_large");
      const result = await service.upload({ ...scope, clientRequestId, filename: file.name, mimeType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
      return result.ok ? Response.json(result.value, { headers: conversationFileHeaders }) : conversationFileError(result.code);
    } catch (error) { return conversationFileError(error instanceof Error && error.message === "upload_too_large" ? "upload_too_large" : "storage_unavailable"); }
  };
}

export function createConversationAttachmentDownload(deps: {
  authenticate: (mode?: "read" | "write") => Promise<string | null>;
  controls: () => ConversationControls; service: () => Promise<ConversationAttachmentService>;
  open: (row: ConversationAttachmentRow) => Promise<ReadableStream<Uint8Array> | null>;
}) {
  return async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    try {
      const actor = await deps.authenticate("read");
      if (!actor) return conversationFileError("unauthenticated");
      if (!conversationAvailability(deps.controls(), actor).read) return conversationFileError("unavailable");
      const { id } = await context.params;
      const result = await (await deps.service()).read({ ownerId: actor, id });
      if (!result.ok) return conversationFileError("unavailable");
      const row = result.value.row;
      const body = await deps.open(row);
      if (!body) return conversationFileError("unavailable");
      const filename = String(row.filename).replace(/[^A-Za-z0-9._-]/g, "_");
      return new Response(body, { headers: { ...conversationFileHeaders, "Content-Type": String(row.mime_type), "Content-Length": String(row.size_bytes),
        "Content-Disposition": `attachment; filename="${filename}"`, "Content-Security-Policy": "default-src 'none'; sandbox; frame-ancestors 'none'" } });
    } catch { return conversationFileError("unavailable"); }
  };
}
