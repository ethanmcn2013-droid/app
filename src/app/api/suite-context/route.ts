import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { workspaceMembers, workspaces } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth";
import { isSuiteContextId } from "@/lib/suite-context";
import { PROJECT_URL_PARAM } from "@/lib/projects/project-url";

export const dynamic = "force-dynamic";

/**
 * Resolve an incoming suite context hint. The URL does not authorize access:
 * membership is proved here before the caller is sent anywhere, and proved
 * again by the destination. This handler writes no cookie at all — see D-028
 * at the redirect below.
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

  // D-021 writer #1, decided 2026-08-17 (docs/wave/DECISIONS.md D-028).
  //
  // Following a contextual link is NAVIGATION, not selection. This handler used
  // to write the last-active Project cookie, which made someone else's link —
  // a digest email, a shared URL, a cross-product jump — silently rewrite where
  // your next bare entry lands. Glance at a notification about Project B, close
  // the tab, open /app tomorrow, and you are in B. ADR 0001 §4 says only an
  // explicit Project selection may move that preference, and a link you were
  // handed is not a choice you made.
  //
  // So the Project travels in the URL instead. The destination resolves it
  // through the resolver's explicit never-substitute branch and reauthorizes it
  // there; the browser's preference is left exactly as the person last set it.
  // Removing the write WITHOUT carrying the id would have been the worse bug —
  // the link would have quietly landed back in the ambient Project, which is
  // the substitution this whole programme exists to remove.
  //
  // Taking this now rather than earlier is what WP6 bought: the Studio Bar
  // control (D-025) is resident on every surface, so a person who wants to stay
  // in B has a visible, one-click way to say so. Before that landed, the cookie
  // write was the only thing making a contextual link feel sticky.
  const authorizedTarget = new URL("/app/your-work", request.url);
  authorizedTarget.searchParams.set(PROJECT_URL_PARAM, workspaceId);
  if (isSuiteContextId(projectId)) {
    authorizedTarget.searchParams.set("projectId", projectId);
  }
  const authorizedResponse = NextResponse.redirect(authorizedTarget, 303);
  authorizedResponse.headers.set("Cache-Control", "private, no-store, max-age=0");
  return authorizedResponse;
}
