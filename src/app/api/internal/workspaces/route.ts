import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users, workspaceMembers, workspaces } from "@/server/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const seenJtis = new Map<string, number>();

type Claims = {
  v?: number;
  iss?: string;
  aud?: string;
  sub?: string;
  iat?: number;
  exp?: number;
  jti?: string;
  traceId?: string;
};

/** Return the caller's explicit Tasks destinations, never email-matched. */
export async function GET(req: Request) {
  const secret = process.env.NOTES_TO_TASKS_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const [encoded, signature] = presented.split(".");
  if (!secret || !encoded || !signature) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let claims: Claims;
  try {
    const expected = createHmac("sha256", secret).update(encoded).digest();
    const received = Buffer.from(signature, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(expected, received)) throw new Error("bad signature");
    claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Claims;
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    claims.v !== 1 || claims.iss !== "signal-notes" ||
    claims.aud !== "signal-tasks.workspace-list" ||
    typeof claims.sub !== "string" || !claims.sub ||
    typeof claims.iat !== "number" || typeof claims.exp !== "number" ||
    typeof claims.jti !== "string" || typeof claims.traceId !== "string" ||
    claims.exp <= now || claims.iat > now + 30 || claims.exp - claims.iat > 300
  ) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  for (const [jti, expiry] of seenJtis) {
    if (expiry <= now) seenJtis.delete(jti);
  }
  if (seenJtis.has(claims.jti)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  seenJtis.set(claims.jti, claims.exp);

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, claims.sub))
    .limit(1);
  if (!user) return NextResponse.json({ ok: true, workspaces: [] });

  const rows = await db
    .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, user.id));

  return NextResponse.json({
    ok: true,
    workspaces: rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      role: row.role === "owner" ? "owner" : "member",
    })),
  });
}
