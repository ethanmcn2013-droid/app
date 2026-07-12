import { redirect } from "next/navigation";
import { ContextualOnboarding } from "@/components/welcome/contextual-onboarding";
import { resolvePlanningFeatureFlags } from "@/lib/planning/flags";
import {
  isPlanningPeriodContext,
  type PlanningPeriodContext,
} from "@/lib/planning/context";
import {
  getPlanningOnboardingDraftAction,
} from "@/server/actions/planning";
import { getCurrentUser } from "@/server/auth";
import { ensureUserProvisioned } from "@/server/db/ensure-user";
import { detectVenueWelcome } from "@/server/db/venue-welcome";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shape your work · Tasks",
};

type SearchParams = Promise<{ context?: string }>;

export default async function PlanningWelcomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!resolvePlanningFeatureFlags().contextualOnboarding) redirect("/welcome");
  const actorUserId = await getCurrentUser();
  await ensureUserProvisioned(actorUserId);
  const [params, draft, venueWelcome] = await Promise.all([
    searchParams,
    getPlanningOnboardingDraftAction(),
    detectVenueWelcome(actorUserId),
  ]);
  const requestedContext = isPlanningPeriodContext(params.context)
    ? (params.context as PlanningPeriodContext)
    : null;
  return (
    <ContextualOnboarding
      initialContext={draft?.contextType ?? requestedContext}
      initialDraft={draft}
      venueSponsor={
        venueWelcome
          ? {
              id: venueWelcome.sponsorSlug,
              name: venueWelcome.sponsorName,
            }
          : null
      }
    />
  );
}
