import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Purpose-specific transport, never accepted by the issuance service. */
export const USAGE_PATHS = {
  ingest: "/api/internal/sponsored-use/ingest",
  provenance: "/api/internal/sponsored-use/provenance",
  erase: "/api/internal/sponsored-use/erase",
} as const;
export const MAX_BODY_BYTES = 16_384;
export const MAX_SKEW_MS = 300_000;
export const RETENTION_MS = 35 * 86_400_000;

export function hashEpoch(salt: string): string {
  return createHash("sha256").update("venue-usage-salt:" + salt).digest("hex").slice(0, 8);
}
export function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function validSecret(secret: string | undefined, issuanceSecret?: string): secret is string {
  return typeof secret === "string" && secret.length >= 32 && secret !== issuanceSecret;
}
function signature(secret: string, path: string, timestamp: string, epoch: string, body: string): string {
  return createHmac("sha256", secret)
    .update(["usage.v1", "POST", path, timestamp, epoch, digest(body)].join("\n")).digest("hex");
}
export function signedUsageRequest(
  url: string, payload: unknown, secret: string, epoch: string, now = Date.now(),
): Request {
  const target = new URL(url);
  if (!Object.values(USAGE_PATHS).includes(target.pathname as typeof USAGE_PATHS.ingest) ||
      target.search || !validSecret(secret) || !/^[a-f0-9]{8}$/.test(epoch)) throw new Error("Usage configuration unavailable");
  const body = JSON.stringify(payload);
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new Error("Usage request too large");
  const timestamp = String(now);
  return new Request(target, { method: "POST", body, headers: {
    "content-type": "application/json",
    "x-sponsored-use-timestamp": timestamp,
    "x-sponsored-use-epoch": epoch,
    "x-sponsored-use-signature": signature(secret, target.pathname, timestamp, epoch, body),
  } });
}
export async function authenticateUsageRequest(
  request: Request, path: string,
  config: { secret?: string; issuanceSecret?: string; epoch: string; now?: number },
): Promise<{ ok: true; payload: unknown } | { ok: false }> {
  const url = new URL(request.url);
  const stamp = request.headers.get("x-sponsored-use-timestamp") ?? "";
  const epoch = request.headers.get("x-sponsored-use-epoch") ?? "";
  const supplied = request.headers.get("x-sponsored-use-signature") ?? "";
  if (!validSecret(config.secret, config.issuanceSecret) || request.method !== "POST" ||
      url.pathname !== path || url.search || !/^[0-9]{13}$/.test(stamp) ||
      Math.abs(Number(stamp) - (config.now ?? Date.now())) > MAX_SKEW_MS ||
      epoch !== config.epoch || !/^[a-f0-9]{8}$/.test(epoch) || !/^[a-f0-9]{64}$/.test(supplied)) return { ok: false };
  // Limit bytes while reading, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return { ok: false };
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > MAX_BODY_BYTES) { await reader.cancel(); return { ok: false }; }
      chunks.push(part.value);
    }
    const body = Buffer.concat(chunks).toString("utf8");
    const expected = signature(config.secret, path, stamp, epoch, body);
    if (!timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex"))) return { ok: false };
    return { ok: true, payload: JSON.parse(body) as unknown };
  } catch { return { ok: false }; }
}
export function usageResponse(status: number, result: unknown): Response {
  return Response.json(result, { status, headers: { "cache-control": "no-store" } });
}
