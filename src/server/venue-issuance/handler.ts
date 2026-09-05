import { MAX_ISSUANCE_BODY_BYTES, parseIssuanceCommand, VenueIssuanceError, type IssuanceEnvironment } from "@/lib/venue-issuance/protocol";
import { validIssuanceAuth, verifyIssuanceRequest, type IssuanceAuth } from "@/lib/venue-issuance/service-auth";
import { executeVenueIssuance, type VenueIssuanceDb } from "./store";

export type VenueIssuanceService = { database: VenueIssuanceDb; auth: IssuanceAuth; environment: IssuanceEnvironment; enabled: boolean; now?: () => number };
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
export async function handleVenueIssuance(request: Request, service: VenueIssuanceService): Promise<Response> {
  if (!service.enabled || !validIssuanceAuth(service.auth)) return response({ error: "unavailable" }, 503);
  try {
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_ISSUANCE_BODY_BYTES) return response({ error: "invalid" }, 413);
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return response({ error: "invalid" }, 400);
    const reader = request.body?.getReader();
    if (!reader) return response({ error: "invalid" }, 400);
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > MAX_ISSUANCE_BODY_BYTES) { await reader.cancel(); return response({ error: "invalid" }, 413); }
      chunks.push(next.value);
    }
    const body = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
    const now = service.now?.() ?? Date.now();
    if (!verifyIssuanceRequest(request, body, service.auth, now)) return response({ error: "unauthorized" }, 401);
    const command = parseIssuanceCommand(JSON.parse(body));
    return response(await executeVenueIssuance(service.database, command, service.environment, now));
  } catch (error) {
    // Never return/log raw libSQL errors, request bodies, codes or their hashes.
    if (error instanceof VenueIssuanceError) {
      return response({ error: error.code }, error.code === "invalid" ? 400 : error.code === "not_found" ? 404 : error.code === "unavailable" ? 503 : 409);
    }
    if (error instanceof SyntaxError || error instanceof TypeError) return response({ error: "invalid" }, 400);
    return response({ error: "unavailable" }, 503);
  }
}
