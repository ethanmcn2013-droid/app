import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/access-mode";
import {
  beginGoogleDriveConnection,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE_PATH,
  googleDriveReturnOriginFromEnv,
} from "@/server/connections/drive-connections";
import { authorizeProjectDrive } from "@/server/connections/project-drive-authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function settingsRedirect(request: NextRequest, status: string): NextResponse {
  const url = new URL(
    "/app/settings",
    googleDriveReturnOriginFromEnv(request.nextUrl.origin),
  );
  url.searchParams.set("drive", status);
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

/** Start one session-bound, Project-authorized Google Drive consent. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (isDemoMode()) return settingsRedirect(request, "review");

  const { userId, sessionId } = await auth();
  if (!userId || !sessionId) {
    const signIn = new URL(
      "/sign-in",
      googleDriveReturnOriginFromEnv(request.nextUrl.origin),
    );
    signIn.searchParams.set(
      "redirect_url",
      "/api/connections/google/start",
    );
    return NextResponse.redirect(signIn, 303);
  }

  const projectIds = request.nextUrl.searchParams.getAll("projectId");
  const projectId = projectIds.length === 1 ? projectIds[0] : null;
  try {
    const authorization = await authorizeProjectDrive(projectId);
    const begun = await beginGoogleDriveConnection(authorization, {
      clerkUserId: userId,
      sessionId,
    });
    const response = NextResponse.redirect(begun.authorizationUrl, 303);
    response.cookies.set({
      name: GOOGLE_OAUTH_STATE_COOKIE,
      value: begun.stateCookie,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: GOOGLE_OAUTH_STATE_COOKIE_PATH,
      maxAge: begun.cookieMaxAgeSeconds,
      priority: "high",
    });
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return settingsRedirect(request, "unavailable");
  }
}
