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
import { recordSponsoredUse } from "@/lib/account/instrumentation/call-site";

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

  // Signal's one honest deliberate-open moment.
  //
  // The dictionary excludes automatic landings, prefetch, refresh, and
  // operator view-as, and every other candidate in this module is one of
  // those: the page render is automatic, `recordSurfaced` records what the
  // system showed, and the planning event is literally a view. Opening a
  // ledger entry cannot happen without a person choosing it, and reaching this
  // line proves the briefing resolved and the scope was authorised — the
  // guards above redirect away otherwise.
  //
  // Demo and review sessions are excluded: `clerkId` is a placeholder there and
  // attribution would be meaningless.
  if (!demoMode) {
    const openedWorkspaceId =
      result.authorizedScope.scope.kind === "workspace"
        ? result.authorizedScope.scope.workspaceId
        : result.authorizedScope.workspaces[0]?.id;
    await recordSponsoredUse(
      {
        product: "signal",
        kind: "briefing_deliberately_opened",
        objectKey: "briefing",
        subjectId: clerkId,
        workspaceId: openedWorkspaceId,
      },
      true,
    );
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
