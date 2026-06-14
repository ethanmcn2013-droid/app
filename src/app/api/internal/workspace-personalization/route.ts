import "server-only";
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users, workspaces } from "@/server/db/schema";
import { getWorkspacePersonalization } from "@/lib/onboarding/personalization";
import type { DomainId } from "@/lib/domains";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Cross-repo read of workspace segment + empty-state copy.
 * Notes (and other sisters) call this with the user's email — same
 * bearer pattern as /api/notes-extract.
 *
 * GET ?email=user@example.com
 * Auth: Bearer NOTES_TO_TASKS_SECRET
 */
export async function GET(req: Request) {
  const expected = process.env.NOTES_TO_TASKS_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const bearer = `Bearer ${expected}`;
  if (
    !expected ||
    auth.length !== bearer.length ||
    !timingSafeEqual(Buffer.from(auth), Buffer.from(bearer))
  ) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!email) {
    return NextResponse.json({ ok: false, error: "missing_email" }, { status: 400 });
  }

  const [userRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!userRow) {
    return NextResponse.json({ ok: true, personalization: null });
  }

  const [wsRow] = await db
    .select({
      primaryUseCase: workspaces.primaryUseCase,
      activeDomain: workspaces.activeDomain,
    })
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, userRow.id))
    .limit(1);

  if (!wsRow) {
    return NextResponse.json({ ok: true, personalization: null });
  }

  const personalization = getWorkspacePersonalization({
    primaryUseCase: wsRow.primaryUseCase,
    activeDomain: (wsRow.activeDomain as DomainId | null) ?? null,
  });

  return NextResponse.json({
    ok: true,
    personalization: {
      ...personalization,
      primaryUseCase: wsRow.primaryUseCase,
      activeDomain: wsRow.activeDomain,
    },
  });
}
