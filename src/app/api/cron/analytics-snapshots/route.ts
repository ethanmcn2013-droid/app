import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  activeSnapshotWorkspaceIds,
  captureWorkspaceSnapshots,
  lastCompletedSnapshotWorkspaceTimes,
  listEligibleSnapshotWorkspaces,
  pruneExpiredAnalyticsHistory,
} from "@/modules/signal/server/analytics/snapshots";
import { prioritizeSnapshotCandidates } from "@/modules/signal/server/analytics/snapshot-utils";

/**
 * Analytics snapshot cron — the caller `captureWorkspaceSnapshots` never had.
 *
 * The snapshot layer shipped complete in the Wave 4 analytics foundation —
 * tables, writer, receipts, retention, fairness ordering — and then nothing
 * ever invoked it, so every trend in the product resolved
 * `insufficient_history` permanently (ANALYTICS_TRUTH.md R7). Snapshot
 * history cannot be backfilled: a reading not taken is gone. This route is
 * deliberately thin — enumerate, order, capture, prune — because everything
 * with judgment in it already lives in the snapshot module and is tested
 * there.
 *
 * Receipts are first-class here by design: every capture writes an
 * `analytics_snapshot_runs` row (completed / skipped / failed), so the
 * durable evidence of a run is in the database, not in this response body.
 * The JSON summary exists for the Vercel cron log and for a human proving
 * the first execution happened (the Stage 1 exit evidence).
 *
 * Flag: SIGNAL_ANALYTICS_SNAPSHOTS_ENABLED, default off. A flag-off
 * invocation returns 200 with `skipped: "flag-off"` rather than an error —
 * the cron ran correctly and did what the configuration told it to.
 *
 * Auth: CRON_SECRET bearer, timing-safe, same contract as the digest cron.
 * Production without a configured secret refuses outright.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function snapshotsEnabled(): boolean {
  return process.env.SIGNAL_ANALYTICS_SNAPSHOTS_ENABLED === "true";
}

function authorized(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, status: 500, error: "cron-secret-not-configured" };
    }
    // Dev without a secret: allow, matching the digest route's local-preview
    // posture. This route takes no identity overrides, so there is nothing
    // to protect beyond what the flag already gates.
    return { ok: true };
  }
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const enc = new TextEncoder();
  const a = enc.encode(provided.padEnd(expected.length, "\0"));
  const b = enc.encode(expected.padEnd(provided.length, "\0"));
  const maxLen = Math.max(a.length, b.length);
  const pa = new Uint8Array(maxLen);
  const pb = new Uint8Array(maxLen);
  pa.set(a);
  pb.set(b);
  const match = timingSafeEqual(pa, pb) && provided.length === expected.length;
  return match ? { ok: true } : { ok: false, status: 401, error: "unauthorized" };
}

export async function GET(req: Request) {
  const auth = authorized(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  if (!snapshotsEnabled()) {
    return NextResponse.json({ ok: true, skipped: "flag-off" });
  }

  const now = new Date();
  const [eligible, lastCompleted, alreadyCaptured] = await Promise.all([
    listEligibleSnapshotWorkspaces(),
    lastCompletedSnapshotWorkspaceTimes(),
    activeSnapshotWorkspaceIds(now),
  ]);
  const ordered = prioritizeSnapshotCandidates(eligible, lastCompleted).filter(
    (candidate) => !alreadyCaptured.has(candidate.workspaceId),
  );

  let completed = 0;
  let skipped = 0;
  let snapshots = 0;
  const failures: string[] = [];
  for (const candidate of ordered) {
    try {
      const result = await captureWorkspaceSnapshots({
        workspaceId: candidate.workspaceId,
        timezone: candidate.timezone,
        now,
      });
      if (result.status === "completed") completed += 1;
      else skipped += 1;
      snapshots += result.snapshotCount;
    } catch {
      // The failed receipt is already durable in analytics_snapshot_runs;
      // the id here only sizes the failure for the cron log. Workspace ids
      // are opaque, but keep the body count-only to stay content-free.
      failures.push(candidate.workspaceId);
    }
  }

  const prunedBefore = await pruneExpiredAnalyticsHistory(now);

  return NextResponse.json({
    ok: failures.length === 0,
    eligible: eligible.length,
    alreadyCapturedToday: alreadyCaptured.size,
    attempted: ordered.length,
    completed,
    skipped,
    snapshots,
    failed: failures.length,
    prunedBefore: prunedBefore.toISOString(),
  });
}
