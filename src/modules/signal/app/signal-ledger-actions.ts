"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isDemoMode } from "@/lib/access-mode";
import { PRODUCT_APP_PATHS } from "@/lib/product-urls";
import {
  REVIEW_PRIMARY_PROJECT,
  REVIEW_SUITE_FIXTURE,
} from "@/lib/review-suite-fixture";
import {
  authorizedScopeTasksHref,
  legacyLedgerTasksHref,
} from "../lib/analytics/ledger-task-target";
import { planningPeriodsEnabled } from "../lib/planning-periods/scope";
import { signalScopeHintFromReferer } from "../lib/planning-periods/scope-hint";
import { buildBriefingForUser } from "../server/briefing/signal-build-for-user";
import {
  requireSignalUser,
  UnauthorizedError,
} from "../server/signal-auth";

const OPAQUE_LEDGER_ID = /^signal-[a-z0-9]+$/;

/**
 * Privacy-safe bridge from the Quiet Ledger to Tasks.
 *
 * The browser submits only the opaque ledger entry id. After authenticating,
 * the action rebuilds the current authorized briefing, maps that opaque id
 * back to its source task on the server, and emits the canonical Tasks route.
 */
export async function openSignalLedgerEntry(formData: FormData): Promise<void> {
  const entryId = String(formData.get("entryId") ?? "").trim();
  if (!OPAQUE_LEDGER_ID.test(entryId)) {
    redirect(PRODUCT_APP_PATHS.tasks);
  }

  const demoMode = isDemoMode();
  let clerkId = "demo-user";
  if (!demoMode) {
    try {
      clerkId = await requireSignalUser();
    } catch (error) {
      if (error instanceof UnauthorizedError) redirect("/sign-in");
      throw error;
    }
  }

  const scope = signalScopeHintFromReferer(
    (await headers()).get("referer"),
    planningPeriodsEnabled(),
  );
  const result = await buildBriefingForUser({
    clerkId,
    cadence: "daily",
    scope,
  });
  if (result.kind === "no-workspace") {
    redirect(PRODUCT_APP_PATHS.tasks);
  }

  const navigationContext = demoMode
    ? {
        planningPeriodId: REVIEW_SUITE_FIXTURE.workspace.planningPeriodId,
        projectId: REVIEW_PRIMARY_PROJECT.id,
      }
    : {
        planningPeriodId:
          result.authorizedScope.period?.id ??
          result.authorizedScope.workspaces.find(
            (workspace) =>
              result.authorizedScope.scope.kind !== "workspace" ||
              workspace.id === result.authorizedScope.scope.workspaceId,
          )?.planningPeriodId,
      };

  redirect(
    legacyLedgerTasksHref(
      result.briefing,
      result.authorizedScope,
      entryId,
      navigationContext,
    ) ??
      authorizedScopeTasksHref(
        result.authorizedScope,
        navigationContext,
      ),
  );
}
