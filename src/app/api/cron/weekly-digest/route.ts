import { NextResponse } from "next/server";
import {
  buildWeeklySnapshotFor,
  weeklyDigestNarrationFor,
} from "@/server/digest-narration";
import { aiConfigured } from "@/server/ai";

/**
 * Weekly LLM-narrated digest cron.
 *
 * Schedule: Sunday 9am (configured in `vercel.json`).
 * Mode: GET. Returns JSON with the snapshot + the narrated text.
 * The cron secret guard mirrors the daily digest endpoint.
 *
 * Anti-spam contract: this endpoint does NOT email anything. It
 * exists so the inbox's weekly recap card can be primed with a
 * server-rendered narration on Sunday mornings, OR so a future
 * delivery surface (push, in-app banner) can pull a stable
 * narration without the client having to invoke the LLM directly.
 *
 * When `ANTHROPIC_API_KEY` is unset the route returns the
 * snapshot only with `narration: null` — never crashes.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const expectedCronSecret = process.env.CRON_SECRET;
  // Production hardening: when CRON_SECRET is unset on a real deploy,
  // refuse the request rather than letting an unauthenticated GET
  // trigger the digest pipeline. Dev runs (NODE_ENV !== "production")
  // can still hit the route locally with no secret configured.
  if (!expectedCronSecret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, error: "cron-secret-not-configured" },
        { status: 500 },
      );
    }
  } else {
    const provided = req.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "");
    if (provided !== expectedCronSecret) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 },
      );
    }
  }

  const { searchParams } = new URL(req.url);
  const overrideWorkspace = searchParams.get("workspace");
  if (!overrideWorkspace) {
    return NextResponse.json(
      { ok: false, error: "workspace-id-required" },
      { status: 400 },
    );
  }

  const snapshot = await buildWeeklySnapshotFor(overrideWorkspace);

  let narration: string | null = null;
  if (aiConfigured()) {
    try {
      const stream = await weeklyDigestNarrationFor(overrideWorkspace);
      const reader = stream.getReader();
      const chunks: string[] = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (typeof value === "string") chunks.push(value);
      }
      narration = chunks.join("").trim();
    } catch (err) {
      console.error("weekly-digest cron: narration failed", err);
      narration = null;
    }
  }

  return NextResponse.json({
    ok: true,
    deliveredAt: new Date().toISOString(),
    aiConfigured: aiConfigured(),
    snapshot,
    narration,
  });
}
