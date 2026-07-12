import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import {
  planningPeriods,
  users,
  workspaceMembers,
  workspaces,
} from "@/server/db/schema";

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

type CatalogWorkspace = {
  id: string;
  name: string;
  role: "owner" | "member";
  planningPeriodId: string | null;
  planningPeriodName: string | null;
  contextType: string | null;
  primaryDate: string | null;
  primaryDateLabel: string | null;
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

  const contractVersion = new URL(req.url).searchParams.get("contractVersion");
  if (contractVersion !== "2") {
    return NextResponse.json({ ok: false, error: "unsupported_contract" }, { status: 400 });
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, claims.sub))
    .limit(1);
  if (!user) {
    return NextResponse.json(
      { version: 2, status: "ready", periods: [], workspaces: [] },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  const [periodRows, workspaceRows] = await Promise.all([
    db
      .select({
        id: planningPeriods.id,
        name: planningPeriods.name,
        contextType: planningPeriods.contextType,
        startDate: planningPeriods.startDate,
        endDate: planningPeriods.endDate,
        timezone: planningPeriods.timezone,
        archivedAt: planningPeriods.archivedAt,
        position: planningPeriods.position,
      })
      .from(planningPeriods)
      .where(and(eq(planningPeriods.ownerUserId, user.id), isNull(planningPeriods.archivedAt)))
      .orderBy(asc(planningPeriods.position), asc(planningPeriods.createdAt))
      .limit(200),
    db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        role: workspaceMembers.role,
        planningPeriodId: workspaces.planningPeriodId,
        planningPeriodName: planningPeriods.name,
        planningPeriodOwnerId: planningPeriods.ownerUserId,
        contextType: workspaces.contextType,
        primaryDate: workspaces.primaryDate,
        primaryDateLabel: workspaces.primaryDateLabel,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .leftJoin(planningPeriods, eq(planningPeriods.id, workspaces.planningPeriodId))
      .where(and(eq(workspaceMembers.userId, user.id), isNull(workspaces.archivedAt)))
      .orderBy(asc(workspaces.position), asc(workspaces.createdAt))
      .limit(2000),
  ]);

  const groups = new Map<string, CatalogWorkspace[]>();
  const loose: CatalogWorkspace[] = [];
  for (const row of workspaceRows) {
    const isOwnedPeriod = row.planningPeriodId && row.planningPeriodOwnerId === user.id;
    const workspace: CatalogWorkspace = {
      id: String(row.id),
      name: String(row.name),
      role: row.role === "owner" ? "owner" : "member",
      planningPeriodId: isOwnedPeriod ? String(row.planningPeriodId) : null,
      planningPeriodName: isOwnedPeriod ? String(row.planningPeriodName) : null,
      contextType: row.contextType ?? null,
      primaryDate: row.primaryDate ?? null,
      primaryDateLabel: row.primaryDateLabel ?? null,
    };
    if (isOwnedPeriod) {
      const list = groups.get(String(row.planningPeriodId)) ?? [];
      list.push(workspace);
      groups.set(String(row.planningPeriodId), list);
    } else {
      loose.push(workspace);
    }
  }

  return NextResponse.json(
    {
      version: 2,
      status: "ready",
      periods: periodRows.map((period) => ({
        period: {
          id: String(period.id),
          name: String(period.name),
          contextType: String(period.contextType),
          startDate: period.startDate,
          endDate: period.endDate,
          timezone: String(period.timezone),
        },
        workspaces: groups.get(String(period.id)) ?? [],
      })),
      workspaces: loose,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
