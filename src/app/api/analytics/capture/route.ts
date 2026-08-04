import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { captureServerEvent } from "@/lib/analytics/posthog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  event?: string;
  properties?: Record<string, unknown>;
};

/**
 * First-party analytics capture, forwards authenticated client
 * events to PostHog. Keeps the API key server-side.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const event = body.event?.trim();
  if (!event) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Analytics must never 500 the client: in demo/review mode the Clerk
  // middleware doesn't cover this route and auth() throws — capture the
  // event as anonymous instead of failing the request.
  let distinctId = "anonymous";
  try {
    const session = await auth();
    distinctId = session.userId ?? "anonymous";
  } catch {
    // no Clerk context (demo/review mode) — stay anonymous
  }

  const props: Record<string, string | number | boolean | null | undefined> =
    {};
  if (body.properties && typeof body.properties === "object") {
    for (const [k, v] of Object.entries(body.properties)) {
      if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean" ||
        v === null ||
        v === undefined
      ) {
        props[k] = v;
      } else {
        props[k] = String(v);
      }
    }
  }

  await captureServerEvent(distinctId, event, {
    ...props,
    source: "client",
  });

  return NextResponse.json({ ok: true });
}
