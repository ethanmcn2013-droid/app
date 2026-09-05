import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { VENUE_ISSUANCE_PATH } from "./protocol";

export type IssuanceAuth = { secret: string; keyEpoch: string; usageSecret?: string };
export function validIssuanceAuth(config: IssuanceAuth): boolean {
  return config.secret.length >= 32 && /^[A-Za-z0-9_-]{1,32}$/.test(config.keyEpoch) &&
    (!config.usageSecret || config.secret !== config.usageSecret);
}
function signedBytes(body: string, timestamp: string, epoch: string): string {
  return ["venue-issuance.v1", "POST", VENUE_ISSUANCE_PATH, timestamp, epoch,
    createHash("sha256").update(body).digest("hex")].join("\n");
}
export function signIssuanceRequest(body: string, config: IssuanceAuth, now = Date.now()): Record<string, string> {
  if (!validIssuanceAuth(config)) throw new Error("Issuance service is not configured.");
  const timestamp = String(now);
  return { "content-type": "application/json", "x-venue-issuance-timestamp": timestamp,
    "x-venue-issuance-epoch": config.keyEpoch,
    "x-venue-issuance-signature": createHmac("sha256", config.secret).update(signedBytes(body, timestamp, config.keyEpoch)).digest("hex") };
}
export function verifyIssuanceRequest(request: Request, body: string, config: IssuanceAuth, now = Date.now()): boolean {
  const url = new URL(request.url);
  if (!validIssuanceAuth(config) || request.method !== "POST" || url.pathname !== VENUE_ISSUANCE_PATH || url.search) return false;
  const timestamp = request.headers.get("x-venue-issuance-timestamp") ?? "";
  const epoch = request.headers.get("x-venue-issuance-epoch") ?? "";
  const signature = request.headers.get("x-venue-issuance-signature") ?? "";
  if (!/^\d{13}$/.test(timestamp) || !Number.isSafeInteger(Number(timestamp)) ||
      Math.abs(now - Number(timestamp)) > 300_000 || epoch !== config.keyEpoch || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", config.secret).update(signedBytes(body, timestamp, epoch)).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
