import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { workspaceMembers, workspaces } from "@/server/db/schema";
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  getCurrentUser,
} from "@/server/auth";
import { isSuiteContextId } from "@/lib/suite-context";

export const dynamic = "force-dynamic";

/**
 * Resolve an incoming suite context hint. The URL does not authorize access:
 * membership is checked before the active-workspace cookie is written.
 */
export async function GET(request: NextRequest) {
  const actorUserId = await getCurrentUser();
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  const planningPeriodId = request.nextUrl.searchParams.get("planningPeriodId");
  const projectId = request.nextUrl.searchParams.get("projectId");
  const version = request.nextUrl.searchParams.get("contextVersion");
  const target = new URL("/app/your-work", request.url);
  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");

  if (
    version !== "2" ||
    !isSuiteContextId(workspaceId) ||
    (planningPeriodId !== null && !isSuiteContextId(planningPeriodId))
  ) {
    return response;
  }

  const membershipPredicate = planningPeriodId
    ? and(
        eq(workspaceMembers.userId, actorUserId),
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaces.planningPeriodId, planningPeriodId),
      )
    : and(
        eq(workspaceMembers.userId, actorUserId),
        eq(workspaceMembers.workspaceId, workspaceId),
      );

  const [membership] = await db
    .select({ id: workspaces.id })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(membershipPredicate)
    .limit(1);
  if (!membership) return response;

  const authorizedTarget = new URL("/app/your-work", request.url);
  if (isSuiteContextId(projectId)) {
    authorizedTarget.searchParams.set("projectId", projectId);
  }
  const authorizedResponse = NextResponse.redirect(authorizedTarget, 303);
  authorizedResponse.headers.set("Cache-Control", "private, no-store, max-age=0");
  authorizedResponse.cookies.set(ACTIVE_WORKSPACE_COOKIE_NAME, workspaceId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  return authorizedResponse;
}
