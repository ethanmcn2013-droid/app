import "server-only";
import type { PingTypedResponse } from "@/lib/ping/typed-contract";
import type { PingTypedActor, createPingTypedSession } from "./typed-session";

const MAX_BYTES = 48_000;
const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
async function boundedJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" || !request.body) return null;
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES)) return null;
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of chunks) { bytes.set(part, offset); offset += part.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch { return null; } finally { reader.releaseLock(); }
}
function response(result: PingTypedResponse): Response {
  const status = result.ok ? 200 : result.code === "unauthenticated" ? 401 : result.code === "unavailable" ? 404 :
    ["busy", "request_conflict", "stale_capture"].includes(result.code) ? 409 : result.code === "temporarily_unavailable" ? 503 : 400;
  return Response.json(result, { status, headers });
}
/** Bounded same-origin POST only; injected authentication is labelled fixture evidence. */
export function createPingTypedHttp(deps: {
  authenticate: () => Promise<PingTypedActor | null>;
  session: () => Promise<ReturnType<typeof createPingTypedSession> | null>;
}) {
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== "POST") return response({ ok: false, code: "invalid_input" });
      if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site")
        return response({ ok: false, code: "unavailable" });
      const actor = await deps.authenticate();
      if (!actor) return response({ ok: false, code: "unauthenticated" });
      const value = await boundedJson(request);
      if (value === null) return response({ ok: false, code: "invalid_input" });
      const session = await deps.session();
      return response(session ? await session.handle(actor, value) : { ok: false, code: "unavailable" });
    } catch { return response({ ok: false, code: "temporarily_unavailable" }); }
  };
}
