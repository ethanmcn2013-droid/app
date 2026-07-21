"use server";

import { currentUser } from "@clerk/nextjs/server";
import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/access-mode";
import { signalAnalyticsDb as db } from "../../server/db/signal-analytics-client";
import { analyticsUsers } from "../../server/db/signal-analytics-schema";
import { dataSource } from "../../lib/data/source";
import { requireSignalUser, UnauthorizedError } from "../../server/signal-auth";

/**
 * Onboarding write action — ported from signal/src/server/onboarding/actions.ts.
 *
 * Demo guard added (S8): in demo mode this action is a no-op that
 * redirects to /app/brief directly — the DB must never be written in demo.
 * Redirect target updated: /app → /app/brief (S1).
 */
export async function completeOnboarding(formData: FormData): Promise<void> {
  // Demo/Review: skip the DB write, redirect as if onboarded.
  if (isDemoMode()) {
    redirect("/app/brief");
  }

  // Module auth helper (not raw Clerk): identical in production, and the
  // keyless-dev fallback keeps the action testable outside prod (P6 QA gap).
  let userId: string;
  try {
    userId = await requireSignalUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect("/sign-in");
    }
    throw err;
  }

  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();

  if (!workspaceId) {
    throw new Error("Pick a workspace.");
  }
  if (!timezone) {
    throw new Error("Time zone is required.");
  }

  // Verify the workspace is one the user can actually brief.
  const me = await currentUser();
  const email = me?.primaryEmailAddress?.emailAddress ?? null;
  const candidates = await dataSource.listForUser({ clerkId: userId, email });
  const allowed = candidates.some((c) => c.workspaceId === workspaceId);
  if (!allowed) {
    throw new Error("That workspace isn't linked to your account.");
  }

  await db
    .insert(analyticsUsers)
    .values({
      clerkId: userId,
      linkedWorkspaceId: workspaceId,
      scopeKind: "workspace",
      planningPeriodId: null,
      timezone,
    })
    .onConflictDoUpdate({
      target: analyticsUsers.clerkId,
      set: {
        linkedWorkspaceId: workspaceId,
        scopeKind: "workspace",
        planningPeriodId: null,
        timezone,
        updatedAt: sql`(unixepoch())`,
      },
    });

  redirect("/app/brief");
}
