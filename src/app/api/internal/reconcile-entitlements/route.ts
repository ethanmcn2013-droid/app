import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { reconcileEntitlements } from "@/server/db/reconcile-entitlements";

/**
 * Manual entitlements-reconcile trigger (E-3.3 follow-up, 2026-05-14).
 *
 *   curl -X POST https://tasks.signalstudio.ie/api/internal/reconcile-entitlements \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * The same reconcile sweep that fires from the daily digest cron,
 * exposed as a standalone Bearer-authed endpoint so an operator can
 * trigger it between daily runs, useful after a Stripe webhook
 * crash, after seeding LAMBSHIL codes, or while waiting for the
 * next daily window.
 *
 * Returns the result counts so the caller can verify the sweep did
 * something (or that the system is already converged).
 *
 * Auth: reuses CRON_SECRET. Same constant-time-compare pattern as
 * /api/cron/digest.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "cron-secret-not-configured" },
      { status: 500 },
    );
  }

  const presented = (req.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  try {
    const result = await reconcileEntitlements();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    void err;
    return NextResponse.json(
      {
        ok: false,
        error: "reconcile-failed",
      },
      { status: 500 },
    );
  }
}
