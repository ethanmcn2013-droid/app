import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { captureServerEvent } from "@/lib/analytics/posthog";
import { allow, clientIp } from "@/lib/ratelimit";
import { readBoundedRequestText } from "@/server/security/csp-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  event?: string;
  properties?: Record<string, unknown>;
};

const MAX_BODY_BYTES = 8 * 1024;
const ALLOWED_EVENTS = new Set([
  "onboarding_started",
  "onboarding_step_viewed",
  "onboarding_segment_selected",
  "onboarding_context_selected",
  "onboarding_starter_confirmed",
  "onboarding_skipped",
  "onboarding_completed",
  "signup_completed",
]);
const ALLOWED_PROPERTIES = new Set([
  "step",
  "primary_use_case",
  "domain_id",
  "template_id",
  "seed_mode",
  "source",
]);

/**
 * First-party analytics capture, forwards authenticated client
 * events to PostHog. Keeps the API key server-side.
 */
export async function POST(req: Request) {
  const session = await auth();
  const limiterId = session.userId ?? clientIp(req);
  if (!(await allow("analytics", limiterId, 60, "1 m"))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: Body;
  try {
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false }, { status: 413 });
    }
    body = JSON.parse(
      await readBoundedRequestText(req, MAX_BODY_BYTES),
    ) as Body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const event = body.event?.trim();
  if (!event || !ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const distinctId = session.userId ?? "anonymous";

  const props: Record<string, string | number | boolean | null | undefined> =
    {};
  if (body.properties && typeof body.properties === "object") {
    for (const [k, v] of Object.entries(body.properties)) {
      if (!ALLOWED_PROPERTIES.has(k)) continue;
      if (
        (typeof v === "string" && v.length <= 128) ||
        (typeof v === "number" && Number.isFinite(v)) ||
        typeof v === "boolean" ||
        v === null
      ) {
        props[k] = v;
      }
    }
  }

  await captureServerEvent(distinctId, event, {
    ...props,
    source: "client",
  });

  return NextResponse.json({ ok: true });
}
