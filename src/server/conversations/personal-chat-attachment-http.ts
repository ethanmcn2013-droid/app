import { PERSONAL_CHAT_ATTACHMENT_LIMITS as LIMIT } from "@/lib/conversations/personal-chat-contracts";
import { conversationAvailability, type ConversationControls } from "@/lib/conversations/flags";
import type { PersonalChatAttachmentService, PersonalAttachmentRow } from "./personal-chat-attachments";

export const personalFileHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
};
const codes: Record<string, number> = { invalid_input: 400, unauthenticated: 401, unavailable: 404, request_conflict: 409, rate_limited: 429, upload_too_large: 413, unsupported_file: 415, quota_exceeded: 409, upload_in_progress: 409, storage_unavailable: 503 };
export const personalFileError = (code: string) => Response.json({ error: code }, { status: codes[code] ?? 503, headers: { ...personalFileHeaders, ...(code === "rate_limited" ? { "Retry-After": "60" } : {}) } });

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

export function createPersonalChatAttachmentHttp(deps: {
  authenticate: (mode?: "read" | "write") => Promise<string | null>;
  controls: () => ConversationControls; service: () => Promise<PersonalChatAttachmentService>;
}) {
  return async (request: Request) => {
    try {
      const controls = deps.controls();
      if (!controls.internalEnabled) return personalFileError("unavailable");
      const actor = await deps.authenticate("read");
      if (!actor) return personalFileError("unauthenticated");
      if (!conversationAvailability(controls, actor).send) return personalFileError("unavailable");
      const url = new URL(request.url);
      if (request.headers.get("origin") !== url.origin || request.headers.get("sec-fetch-site") === "cross-site") return personalFileError("unavailable");
      const service = await deps.service();
      if (!await service.available()) return personalFileError("unavailable");
      if (request.method === "DELETE") {
        if (url.searchParams.size !== 1 || !url.searchParams.get("id")) return personalFileError("invalid_input");
        const result = await service.cancel({ ownerId: actor, id: url.searchParams.get("id")! });
        return result.ok ? Response.json(result.value, { headers: personalFileHeaders }) : personalFileError(result.code);
      }
      if (request.method !== "POST") return new Response(null, { status: 405, headers: { ...personalFileHeaders, Allow: "POST, DELETE" } });
      if (url.searchParams.size) return personalFileError("invalid_input");
      const form = await boundedForm(request);
      if (!form || [...form.keys()].length !== 2 || !form.has("file") || !form.has("clientRequestId")) return personalFileError("invalid_input");
      const file = form.get("file");
      const clientRequestId = form.get("clientRequestId");
      if (!file || typeof file === "string" || typeof clientRequestId !== "string") return personalFileError("invalid_input");
      if (file.size > LIMIT.fileBytes) return personalFileError("upload_too_large");
      const result = await service.upload({ ownerId: actor, clientRequestId, filename: file.name, mimeType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
      return result.ok ? Response.json(result.value, { headers: personalFileHeaders }) : personalFileError(result.code);
    } catch (error) { return personalFileError(error instanceof Error && error.message === "upload_too_large" ? "upload_too_large" : "storage_unavailable"); }
  };
}

export function createPersonalChatAttachmentDownload(deps: {
  authenticate: (mode?: "read" | "write") => Promise<string | null>;
  controls: () => ConversationControls; service: () => Promise<PersonalChatAttachmentService>;
  open: (row: PersonalAttachmentRow) => Promise<ReadableStream<Uint8Array> | null>;
}) {
  return async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    try {
      const actor = await deps.authenticate("read");
      if (!actor) return personalFileError("unauthenticated");
      if (!conversationAvailability(deps.controls(), actor).read) return personalFileError("unavailable");
      const { id } = await context.params;
      const result = await (await deps.service()).read({ ownerId: actor, id });
      if (!result.ok) return personalFileError("unavailable");
      const row = result.value.row;
      const body = await deps.open(row);
      if (!body) return personalFileError("unavailable");
      const filename = String(row.filename).replace(/[^A-Za-z0-9._-]/g, "_");
      return new Response(body, { headers: { ...personalFileHeaders, "Content-Type": String(row.mime_type), "Content-Length": String(row.size_bytes),
        "Content-Disposition": `attachment; filename="${filename}"`, "Content-Security-Policy": "default-src 'none'; sandbox; frame-ancestors 'none'" } });
    } catch { return personalFileError("unavailable"); }
  };
}
