import {
  parseQualifiedViewPayload,
  qualifiedViewRequestEligibility,
} from "@/modules/timeline/lib/qualified-view";
import {
  checkRateLimit,
  getClientIp,
} from "@/modules/timeline/lib/rate-limit";
import { recordQualifiedAudienceView } from "@/modules/timeline/server/qualified-view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RESPONSE_HEADERS = {
  "cache-control": "no-store, max-age=0",
  "cross-origin-resource-policy": "same-origin",
  "x-content-type-options": "nosniff",
};

function emptyResponse(): Response {
  return new Response(null, { status: 204, headers: RESPONSE_HEADERS });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  // Ineligible requests receive the same empty response as duplicates and
  // expired links. The endpoint never becomes a token-validity oracle.
  if (!qualifiedViewRequestEligibility(request.headers, request.url).eligible) {
    return emptyResponse();
  }

  // Distributed abuse protection is optional because the bearer token itself
  // is high entropy. Once either Upstash value is configured, a partial or
  // unavailable limiter fails closed through checkRateLimit().
  if (
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    const rateLimit = await checkRateLimit(
      "audience-qualified-view",
      await getClientIp(),
      30,
      60,
    );
    if (!rateLimit.allowed) return emptyResponse();
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(declaredLength) || declaredLength > 512) return emptyResponse();

  try {
    const body = await request.text();
    if (body.length > 256) return emptyResponse();
    const payload = parseQualifiedViewPayload(JSON.parse(body));
    const { token } = await params;
    await recordQualifiedAudienceView(token, payload);
  } catch {
    // Malformed, revoked, or concurrently rotated receipts remain invisible.
  }
  return emptyResponse();
}
