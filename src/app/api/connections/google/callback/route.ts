import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/access-mode";
import {
  completeGoogleDriveConnection,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE_PATH,
  googleDriveReturnOriginFromEnv,
} from "@/server/connections/drive-connections";
import {
  googleOAuthStateSecretFromEnv,
  parseGoogleOAuthStateCookie,
  verifyGoogleOAuthState,
} from "@/server/connections/google-oauth-state";
import { authorizeProjectDrive } from "@/server/connections/project-drive-authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function callbackRedirect(
  request: NextRequest,
  status: string,
): NextResponse {
  const url = new URL(
    "/app/settings",
    googleDriveReturnOriginFromEnv(request.nextUrl.origin),
  );
  url.searchParams.set("drive", status);
  const response = NextResponse.redirect(url, 303);
  response.cookies.set({
    name: GOOGLE_OAUTH_STATE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: GOOGLE_OAUTH_STATE_COOKIE_PATH,
    maxAge: 0,
    priority: "high",
  });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

/** Finish a state-bound consent without trusting a callback query as identity. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (isDemoMode()) return callbackRedirect(request, "review");

  const { userId, sessionId } = await auth();
  if (!userId || !sessionId) {
    return callbackRedirect(request, "unavailable");
  }

  const binding = parseGoogleOAuthStateCookie(
    request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value,
  );
  const states = request.nextUrl.searchParams.getAll("state");
  const state = states.length === 1 ? states[0] : null;
  if (!binding || !state) {
    return callbackRedirect(request, "invalid-state");
  }

  try {
    verifyGoogleOAuthState(
      state,
      {
        nonce: binding.nonce,
        userId,
        sessionId,
        projectId: binding.projectId,
        intent: binding.intent,
      },
      googleOAuthStateSecretFromEnv(),
    );
    const authorization = await authorizeProjectDrive(binding.projectId);

    const providerErrors = request.nextUrl.searchParams.getAll("error");
    if (providerErrors.length > 0) {
      return callbackRedirect(
        request,
        providerErrors.length === 1 && providerErrors[0] === "access_denied"
          ? "cancelled"
          : "failed",
      );
    }
    const codes = request.nextUrl.searchParams.getAll("code");
    if (codes.length !== 1 || !codes[0]) {
      return callbackRedirect(request, "invalid-code");
    }

    const completed = await completeGoogleDriveConnection(authorization, {
      code: codes[0],
      intent: binding.intent,
    });
    return callbackRedirect(
      request,
      completed.accountChanged ? "account-changed" : "connected",
    );
  } catch {
    return callbackRedirect(request, "failed");
  }
}
