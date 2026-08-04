"use server";

import { auth } from "@clerk/nextjs/server";
import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  authorizeSignalScope,
  listPlanningCatalogForUser,
  type SignalScope,
} from "../lib/planning-periods/scope";
import { signalAnalyticsDb as db } from "./db/signal-analytics-client";
import { analyticsUsers } from "./db/signal-analytics-schema";
import { recordPlanningEvent } from "./signal-planning-events";
import { isDemoMode } from "@/lib/access-mode";

/**
 * Server action: save the chosen scope for the signed-in user and redirect
 * to /app/brief with the scope params.
 *
 * Ported from signal/src/server/planning-scope-actions.ts.
 * Redirects updated to /app/brief (S1 route rename; was /app in source).
 * Demo guard added (S8): isDemoMode short-circuits — action never writes DB
 * in demo mode; the UI switches scope via URL instead.
 */
export async function setSignalScope(formData: FormData): Promise<void> {
  // Demo mode: don't touch the DB; the picker handles URL-only switches.
  if (isDemoMode()) {
    const key = String(formData.get("scope") ?? "");
    const [kind, id] = key.split(":", 2);
    const params = new URLSearchParams({ contextVersion: "2" });
    if (kind === "workspace" && id) params.set("workspaceId", id);
    else if (kind === "planningPeriod" && id)
      params.set("planningPeriodId", id);
    redirect(`/app/home/briefing?${params.toString()}`);
  }

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const key = String(formData.get("scope") ?? "");
  const [kind, id] = key.split(":", 2);
  const scope: SignalScope | null =
    kind === "workspace" && id
      ? { kind: "workspace", workspaceId: id }
      : kind === "planningPeriod" && id
        ? { kind: "planningPeriod", planningPeriodId: id }
        : null;
  if (!scope) throw new Error("Choose a valid Signal scope");

  const catalog = await listPlanningCatalogForUser({
    clerkId: userId,
    email: null,
  });
  const authorized = authorizeSignalScope(catalog, scope);
  if (!authorized)
    throw new Error(
      "That scope is no longer available to your account",
    );
  const fallbackWorkspaceId = authorized.workspaces[0]?.id ?? null;

  await db
    .insert(analyticsUsers)
    .values({
      clerkId: userId,
      linkedWorkspaceId: fallbackWorkspaceId,
      scopeKind: scope.kind,
      planningPeriodId:
        scope.kind === "planningPeriod" ? scope.planningPeriodId : null,
    })
    .onConflictDoUpdate({
      target: analyticsUsers.clerkId,
      set: {
        linkedWorkspaceId: fallbackWorkspaceId,
        scopeKind: scope.kind,
        planningPeriodId:
          scope.kind === "planningPeriod" ? scope.planningPeriodId : null,
        updatedAt: sql`(unixepoch())`,
      },
    });

  await recordPlanningEvent({
    eventName: "signal_scope_changed",
    scopeKind: scope.kind,
    workspaceCount: authorized.workspaces.length,
  });

  const params = new URLSearchParams({ contextVersion: "2" });
  if (scope.kind === "workspace") params.set("workspaceId", scope.workspaceId);
  else params.set("planningPeriodId", scope.planningPeriodId);
  redirect(`/app/home/briefing?${params.toString()}`);
}
