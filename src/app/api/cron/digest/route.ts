import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { compileDailyDigest } from "@/server/db/daily-digest";
import { db } from "@/server/db";
import { users, workspaceMembers } from "@/server/db/schema";
import { getCurrentUserOrNull } from "@/server/auth";
import {
  digestEmailHtml,
  emailConfigured,
  sendEmail,
} from "@/server/email";
import { type UserId } from "@/lib/data";
import {
  reconcileEntitlements,
  type ReconcileResult,
} from "@/server/db/reconcile-entitlements";
import { pingStudio } from "@/lib/ops/ping-studio";

/**
 * Daily digest cron endpoint.
 *
 * Two modes:
 *   - GET (no `?send=1`): returns the JSON digest without dispatching
 *     email. Useful for previewing what *would* go out.
 *   - GET `?send=1`: compiles the digest AND ships it via Resend if
 *     configured. Cron secret guard required in production.
 *
 * Identity: defaults to the cookie-resolved current user when called
 * from a browser, OR `?user=<id>&workspace=<id>` when called by the
 * scheduler. Phase A.1 will iterate over all workspace_members rows
 * with a daily-digest entitlement; for now this is per-user.
 *
 * Anti-spam contract: this is the ONLY scheduled outbound channel.
 * Lane moves, status flips, comments without @mentions, none of
 * those produce a separate email. The digest is the contract.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const expectedCronSecret = process.env.CRON_SECRET;

  // Auth hardening: if CRON_SECRET is unset, reject any request that
  // uses query overrides (?user= / ?workspace=) in ALL environments.
  // Without a secret there is no safe way to validate the caller's
  // identity, so override access is closed entirely. Unauthenticated
  // plain GET (no overrides) is still allowed in dev for local preview.
  const { searchParams } = new URL(req.url);
  const rawOverrideUser = searchParams.get("user");
  const rawOverrideWorkspace = searchParams.get("workspace");
  const hasOverride = rawOverrideUser !== null || rawOverrideWorkspace !== null;

  if (!expectedCronSecret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, error: "cron-secret-not-configured" },
        { status: 500 },
      );
    }
    // Dev without a secret: block override params to prevent accidental
    // cross-user data reads during local testing.
    if (hasOverride) {
      return NextResponse.json(
        { ok: false, error: "query-overrides-require-cron-secret" },
        { status: 401 },
      );
    }
  } else {
    // Timing-safe comparison, prevents timing oracle on the secret.
    const provided = req.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "") ?? "";
    const enc = new TextEncoder();
    const a = enc.encode(provided.padEnd(expectedCronSecret.length, "\0"));
    const b = enc.encode(expectedCronSecret.padEnd(provided.length, "\0"));
    // Both buffers must be the same length for timingSafeEqual.
    const maxLen = Math.max(a.length, b.length);
    const pa = new Uint8Array(maxLen);
    const pb = new Uint8Array(maxLen);
    pa.set(a);
    pb.set(b);
    const match =
      timingSafeEqual(pa, pb) && provided.length === expectedCronSecret.length;
    if (!match) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 },
      );
    }
  }

  const overrideUser = rawOverrideUser as UserId | null;
  const overrideWorkspace = rawOverrideWorkspace;
  const send = searchParams.get("send") === "1";

  const userParam = overrideUser ?? (await getCurrentUserOrNull());

  // Impersonal scheduled cron: Vercel's cron invocation has no session,
  // so without a ?user= override there is no resolvable user. That is
  // the normal scheduled-run shape, not an error, `getCurrentUser()`
  // used to throw here and 500 the route (it never actually ran in
  // prod because CRON_SECRET was unset and the guard above 500'd
  // first). Record the cross-repo heartbeat so Signal HQ sees the job
  // ran, then exit cleanly. No user ⇒ no user-scoped digest and no
  // email; a scheduled per-user digest needs an explicit ?user=
  // override or a deliberate multi-user design.
  if (!userParam) {
    await pingStudio({ source: "tasks_digest", ranAt: Date.now(), ok: true });
    return NextResponse.json({
      ok: true,
      skipped: "no-user-in-impersonal-cron",
    });
  }

  // Resolve workspace: explicit override OR the user's first
  // workspace membership (cron is impersonal, no cookie context).
  let workspaceId: string;
  if (overrideWorkspace) {
    workspaceId = overrideWorkspace;
  } else {
    const [first] = await db
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userParam))
      .limit(1);
    if (!first) {
      return NextResponse.json(
        { ok: false, error: "digest-target-not-found" },
        { status: 404 },
      );
    }
    workspaceId = first.workspaceId;
  }

  // Bind scheduler-provided selectors to one current membership tuple.
  // A cron credential authenticates the job; it does not authorize an
  // arbitrary user/workspace pairing or a stale membership.
  const [membership] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, userParam),
        eq(workspaceMembers.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!membership) {
    return NextResponse.json(
      { ok: false, error: "digest-target-not-found" },
      { status: 404 },
    );
  }

  const digest = await compileDailyDigest(userParam, workspaceId);

  let emailResult: { ok: boolean; id?: string; error?: string } | null =
    null;
  if (send) {
    const [recipient] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userParam));
    if (recipient?.email) {
      emailResult = await sendEmail({
        to: recipient.email,
        subject: "Tasks · daily digest",
        html: digestEmailHtml(digest, recipient.name ?? ""),
      });
    } else {
      emailResult = {
        ok: false,
        error: `no email on file for user ${userParam}`,
      };
    }
  }

  // E-3.3 (2026-05-14): every daily cron run also reconciles the
  // local Tasks entitlements against the shared signal-entitlements
  // DB. Idempotent, only the rare crash-between-writes case actually
  // inserts anything. Wrapped in try/catch so a reconcile failure
  // cannot break the digest email it's piggybacked on.
  let reconcile: ReconcileResult | { error: string } | null = null;
  try {
    reconcile = await reconcileEntitlements();
  } catch (err) {
    reconcile = { error: err instanceof Error ? err.message : "unknown" };
    console.warn("[cron/digest] reconcile sweep failed:", err);
  }

  // Cross-repo heartbeat: tell Studio HQ this digest ran, so the
  // 09:00 UTC job is no longer a structural blind spot. Mirrors the
  // analytics cron→Studio ping. Fail-silent: a missing env or a slow
  // network must never break the digest. ok reflects the dispatch
  // outcome, the job ran and email (if requested) was accepted.
  const pingOk = emailResult ? emailResult.ok : true;
  await pingStudio({
    source: "tasks_digest",
    ranAt: Date.now(),
    ok: pingOk,
    considered: 1,
    sent: send && emailResult?.ok ? 1 : 0,
    skipped: send ? 0 : 1,
    failed: emailResult && !emailResult.ok ? 1 : 0,
    notes: send ? "digest dispatched" : "digest compiled (no send)",
  });

  return NextResponse.json({
    ok: true,
    deliveredAt: new Date().toISOString(),
    emailConfigured,
    sent: send,
    emailResult,
    reconcile,
    digest,
  });
}
