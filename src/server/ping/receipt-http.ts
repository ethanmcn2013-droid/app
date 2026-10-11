import "server-only";
import { normalizePingCommandId, validPingId } from "@/lib/ping/command";
import { dataRecord, exactKeys } from "@/lib/ping/input-validation";
import type { PingTypedActor } from "./typed-session";
import type { PingReceipt } from "./command-service";
import { boundedPingJson } from "./http";

/** Restart recovery is read-only: absent or inaccessible never grants mutation retry. */
export function createPingReceiptHttp(deps: {
  authenticate: () => Promise<PingTypedActor | null>;
  receipt: (actorId: string, commandId: string, projectId: string) => Promise<PingReceipt | null>;
}) {
  const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
  const fail = (status: number) => Response.json({ ok: false, code: "unavailable" }, { status, headers });
  return async (request: Request) => {
    try {
      if (request.method !== "POST" || request.headers.get("origin") !== new URL(request.url).origin ||
          request.headers.get("sec-fetch-site") === "cross-site") return fail(404);
      const actor = await deps.authenticate(); if (!actor) return fail(401);
      const value = await boundedPingJson(request, 1024);
      if (!dataRecord(value) || !exactKeys(value, ["version", "commandId", "projectId"]) ||
          value.version !== "ping.receipt.lookup.v1" || normalizePingCommandId(value.commandId) !== value.commandId ||
          !validPingId(value.projectId)) return fail(400);
      const found = await deps.receipt(actor.actorId, value.commandId as string, value.projectId as string);
      return found ? Response.json({ ok: true, knowledge: "committed", receipt: found }, { headers }) : fail(404);
    } catch { return fail(503); }
  };
}
