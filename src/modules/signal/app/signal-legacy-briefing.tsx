import "server-only";

import { redirect } from "next/navigation";
import { BriefingView } from "../components/brief/briefing-view";
import { SignalScopeSwitcher } from "../components/brief/scope-switcher";
import { isDemoMode } from "@/lib/access-mode";
import { planningPeriodsEnabled } from "../lib/planning-periods/scope";
import type { SignalScope } from "../lib/planning-periods/scope";
import { buildBriefingForUser } from "../server/briefing/signal-build-for-user";
import { isOnboarded } from "../server/onboarding/signal-onboarding-queries";
import { requireSignalUser } from "../server/signal-auth";
import { recordPlanningEvent } from "../server/signal-planning-events";

/**
 * Legacy briefing — ported from signal/src/app/app/(signal)/legacy-briefing.tsx.
 *
 * S1: redirects updated from /app/onboarding → /app/brief/onboarding.
 * Auth: uses requireSignalUser() (module auth with demo + dev-fallback policy).
 * Demo: isDemoMode() short-circuits auth and DB reads.
 */
export async function SignalLegacyBriefing({
  searchParams = {},
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const demo = isDemoMode();
  const userId = demo ? null : await requireSignalUser();

  if (!demo) {
    if (!userId) redirect("/sign-in");
    const onboarded = await isOnboarded(userId);
    if (!onboarded) redirect("/app/brief/onboarding");
  }

  const hintedScope: SignalScope | undefined =
    planningPeriodsEnabled() && typeof searchParams.workspaceId === "string"
      ? { kind: "workspace", workspaceId: searchParams.workspaceId }
      : planningPeriodsEnabled() &&
          typeof searchParams.planningPeriodId === "string"
        ? {
            kind: "planningPeriod",
            planningPeriodId: searchParams.planningPeriodId,
          }
        : undefined;

  const result = await buildBriefingForUser({
    clerkId: userId ?? "demo-user",
    cadence: "daily",
    scope: hintedScope,
  });
  if (result.kind === "no-workspace") redirect("/app/brief/onboarding");

  if (result.authorizedScope.scope.kind === "planningPeriod") {
    await recordPlanningEvent({
      eventName: "period_signal_viewed",
      scopeKind: "planningPeriod",
      workspaceCount: result.authorizedScope.workspaces.length,
    });
  }

  return (
    <div data-signal-module>
      {planningPeriodsEnabled() ? (
        <SignalScopeSwitcher
          catalog={result.catalog}
          activeScope={result.authorizedScope.scope}
          demo={demo}
        />
      ) : null}
      <BriefingView
        briefing={result.briefing}
        firstName={null}
        scopeLabel={result.authorizedScope.label}
        scopeKind={result.authorizedScope.scope.kind}
      />
    </div>
  );
}
