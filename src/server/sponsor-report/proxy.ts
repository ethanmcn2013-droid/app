import "server-only";
import { createHmac } from "node:crypto";

const AUDIENCE = "signal-studio.sponsor-report";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
type ProxyConfig = { origin: string; secret: string; enabled: boolean; usageSecret?: string; issuanceSecret?: string;
  now?: number; send?: (request: Request) => Promise<Response> };
export function reportAssertion(subject: string, secret: string, now = Date.now()): string {
  if (!subject || subject.length > 200 || secret.length < 32) throw new Error("Reporting unavailable");
  const seconds = Math.floor(now / 1000);
  const encoded = Buffer.from(JSON.stringify({ v: 1, aud: AUDIENCE, sub: subject,
    iat: seconds, exp: seconds + 300 })).toString("base64url");
  return `${encoded}.${createHmac("sha256", secret).update(encoded).digest("base64url")}`;
}
export function reportProxyConfig(): ProxyConfig {
  return { origin: process.env.SPONSOR_REPORT_STUDIO_ORIGIN ?? "",
    secret: process.env.SPONSOR_REPORT_ASSERTION_SECRET ?? "",
    enabled: process.env.SPONSOR_REPORTS_ENABLED === "1" && process.env.SPONSOR_USAGE_ENVIRONMENT === "internal_test",
    usageSecret: process.env.SPONSOR_USAGE_SERVICE_SECRET, issuanceSecret: process.env.VENUE_ISSUANCE_SECRET };
}
export async function readInvitationBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength; if (size > 2048) return null;
      chunks.push(part.value);
    }
    const body = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
    JSON.parse(body);
    return body;
  } catch { return null; }
  finally { void reader.cancel().catch(() => {}); }
}
export function sameOriginJsonPost(request: Request): boolean {
  const origin = request.headers.get("origin");
  const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!origin || type !== "application/json") return false;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}
function targetOrigin(config: ProxyConfig): URL {
  const url = new URL(config.origin);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Reporting unavailable");
  return url;
}
async function boundedResponseBody(response: Response): Promise<Uint8Array<ArrayBuffer>> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty reporting response");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 256_000) throw new Error("Reporting response too large");
      chunks.push(part.value);
    }
    const body = new Uint8Array(size);
    body.set(Buffer.concat(chunks));
    return body;
  } finally { void reader.cancel().catch(() => {}); }
}
/** Browser sessions reach Studio through a fresh purpose-bound actor assertion. */
export async function proxySponsorReport(input: { actor: string; programmeId: string; month?: string;
  kind: "report" | "invitations"; format?: string | null; method: "GET" | "POST"; body?: string },
  config = reportProxyConfig()): Promise<Response> {
  if (!input.actor) return Response.json({ state: "forbidden" }, { status: 401, headers });
  if (!config.enabled || config.secret.length < 32 || config.secret === config.usageSecret ||
      config.secret === config.issuanceSecret) return Response.json({ state: "unavailable" }, { status: 503, headers });
  if (!/^[A-Za-z0-9_-]{1,96}$/.test(input.programmeId) ||
      (input.kind === "report" && (!/^\d{4}-\d{2}$/.test(input.month ?? "") ||
        (input.format != null && !["json", "csv", "html"].includes(input.format)))) ||
      (input.kind === "invitations" && (input.month !== undefined || input.format != null)) ||
      (input.kind === "report" && input.method !== "GET") ||
      (input.method === "POST" && (input.body === undefined || Buffer.byteLength(input.body) > 2048)))
    return Response.json({ state: "conflict" }, { status: 400, headers });
  try {
    const origin = targetOrigin(config);
    const path = `/api/sponsor-programmes/${input.programmeId}/` +
      (input.kind === "report" ? `reports/${input.month}` : "invitations");
    const destination = new URL(path, origin);
    if (input.format != null) destination.searchParams.set("format", input.format);
    const upstream = await (config.send ?? ((request) => fetch(request, { redirect: "error", signal: AbortSignal.timeout(5000) })))(
      new Request(destination, { method: input.method, headers: {
        Authorization: `Bearer ${reportAssertion(input.actor, config.secret, config.now)}`,
        ...(input.method === "POST" ? { "Content-Type": "application/json" } : {}),
      }, body: input.method === "POST" ? input.body : undefined }));
    if (upstream.redirected || ![200, 403, 404, 409, 410, 503].includes(upstream.status)) throw new Error("Unexpected reporting response");
    const type = upstream.headers.get("content-type") ?? "";
    const allowedType = type.startsWith("application/json") || type.startsWith("text/csv") || type.startsWith("text/html");
    if (!allowedType) throw new Error("Unexpected reporting content");
    const body = await boundedResponseBody(upstream);
    const responseHeaders = new Headers({ ...headers, "Content-Type": type });
    if (type.startsWith("text/html")) responseHeaders.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    if (type.startsWith("text/csv")) responseHeaders.set("Content-Disposition", `attachment; filename="sponsor-report-${input.month}.csv"`);
    return new Response(body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ state: "unavailable" }, { status: 503, headers });
  }
}
