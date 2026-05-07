import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { compileDailyDigest } from "@/server/db/daily-digest";
import { db } from "@/server/db";
import { users, workspaceMembers } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth";
import {
  digestEmailHtml,
  emailConfigured,
  sendEmail,
} from "@/server/email";
import { type UserId } from "@/lib/data";

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
 * Lane moves, status flips, comments without @mentions — none of
 * those produce a separate email. The digest is the contract.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const expectedCronSecret = process.env.CRON_SECRET;
  // Production hardening: missing CRON_SECRET on a real deploy fails
  // closed — refuse the request rather than letting an unauthenticated
  // caller trigger the daily-digest pipeline (which sends email).
  // Dev runs (NODE_ENV !== "production") skip the check so local
  // testing doesn't need the secret configured.
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
  const overrideUser = searchParams.get("user") as UserId | null;
  const overrideWorkspace = searchParams.get("workspace");
  const send = searchParams.get("send") === "1";

  const userParam = overrideUser ?? (await getCurrentUser());

  // Resolve workspace: explicit override OR the user's first
  // workspace membership (cron is impersonal — no cookie context).
  let workspaceId: string;
  if (overrideWorkspace) {
    workspaceId = overrideWorkspace;
  } else {
    const [first] = await db
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userParam))
      .limit(1);
    workspaceId = first?.workspaceId ?? "ws-legacy";
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

  return NextResponse.json({
    ok: true,
    deliveredAt: new Date().toISOString(),
    emailConfigured,
    sent: send,
    emailResult,
    digest,
  });
}
