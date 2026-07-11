import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
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
 * Notes calls this with a short-lived audience-bound assertion. Email is
 * never accepted as an authorization key.
 *
 * GET (Authorization: Bearer <signed assertion>)
 * Auth: Bearer NOTES_TO_TASKS_SECRET
 */
export async function GET(req: Request) {
  const expected = process.env.NOTES_TO_TASKS_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (!expected || !auth.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const presented = auth.slice("Bearer ".length).trim();
  const [encoded, signature] = presented.split(".");
  if (!encoded || !signature) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  let claims: { v?: number; iss?: string; aud?: string; sub?: string; iat?: number; exp?: number; jti?: string; traceId?: string };
  try {
    const expectedSignature = createHmac("sha256", expected).update(encoded).digest();
    const receivedSignature = Buffer.from(signature, "base64url");
    if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(expectedSignature, receivedSignature)) {
      throw new Error("invalid signature");
    }
    claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as typeof claims;
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.v !== 1 || claims.iss !== "signal-notes" ||
    claims.aud !== "signal-tasks.workspace-personalization" ||
    typeof claims.sub !== "string" || !claims.sub ||
    typeof claims.iat !== "number" || typeof claims.exp !== "number" ||
    typeof claims.jti !== "string" || typeof claims.traceId !== "string" ||
    claims.exp <= now || claims.iat > now + 30 || claims.exp - claims.iat > 300
  ) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const [userRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, claims.sub))
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
