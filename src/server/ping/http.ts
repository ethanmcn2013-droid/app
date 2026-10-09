import "server-only";
import type { PingTypedResponse } from "@/lib/ping/typed-contract";
import { PING_VOICE_VERSION, PING_VOICE_MAX_FRAME_BYTES, type PingVoiceResponse } from "@/lib/ping/voice-contract";
import { dataRecord } from "@/lib/ping/input-validation";
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
function response(result: PingTypedResponse | PingVoiceResponse): Response {
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
      return response(session ? dataRecord(value) && value.version === PING_VOICE_VERSION ?
        await session.handleVoice(actor, value, deps.authenticate) : await session.handle(actor, value) : { ok: false, code: "unavailable" });
    } catch { return response({ ok: false, code: "temporarily_unavailable" }); }
  };
}

/** The custody reservation starts before awaiting any audio body bytes. */
export function createPingAudioHttp(deps: {
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
      const declared = request.headers.get("content-length"), frame = request.headers.get("x-ping-frame");
      if (request.headers.get("content-type") !== "application/octet-stream" || request.headers.has("content-encoding") || !request.body ||
        !frame || !/^[1-9]\d{0,2}$/.test(frame) || (declared !== null && (!/^[1-9]\d{0,3}$/.test(declared) ||
          Number(declared) > PING_VOICE_MAX_FRAME_BYTES || Number(declared) % 2 !== 0))) return response({ ok: false, code: "invalid_input" });
      const session = await deps.session(); if (!session) return response({ ok: false, code: "unavailable" });
      return response(await session.acceptVoiceAudio(actor, { version: request.headers.get("x-ping-version"),
        generationId: request.headers.get("x-ping-generation"), token: request.headers.get("x-ping-token"), ordinal: Number(frame) }, async signal => {
        if (signal.aborted) return null;
        const reader = request.body!.getReader(); const chunks: Uint8Array[] = []; let size = 0, expired = false;
        const cancel = () => { expired = true; void reader.cancel().catch(() => {}); };
        signal.addEventListener("abort", cancel, { once: true });
        const deadline = setTimeout(cancel, 10_000);
        try {
          while (true) {
            const part = await reader.read(); if (part.done) break;
            size += part.value.byteLength;
            if (size > PING_VOICE_MAX_FRAME_BYTES) { await reader.cancel(); return null; }
            if (part.value.byteLength) chunks.push(part.value);
          }
          if (expired || !size || size % 2 !== 0 || (declared !== null && size !== Number(declared))) return null;
          const bytes = new Uint8Array(size); let offset = 0;
          for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
          return bytes;
        } finally { clearTimeout(deadline); signal.removeEventListener("abort", cancel); reader.releaseLock(); }
      }, deps.authenticate));
    } catch { return response({ ok: false, code: "temporarily_unavailable" }); }
  };
}
