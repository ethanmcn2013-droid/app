import { Suspense } from "react";
import { HybridWorkspace } from "@/components/hybrid/hybrid-workspace";
import { TemplatedToast } from "@/components/app/templated-toast";
import { VenueWelcomeCard } from "@/components/welcome/venue-welcome-card";
import {
  detectVenueWelcome,
  markVenueEntitlementReached,
} from "@/server/db/venue-welcome";
import { getCurrentUser } from "@/server/auth";
import { isDemoMode } from "@/lib/access-mode";
import {
  DEMO_SPONSOR_NAME,
  DEMO_WORKSPACE_SLUG,
} from "@/server/demo/tasks-demo";

export const metadata = { title: "Board · Tasks · Signal Studio" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const sp = await searchParams;
  let venue: { sponsorName: string; sponsorSlug: string } | null = null;
  if (sp.welcome === "venue") {
    if (isDemoMode()) {
      venue = {
        sponsorName: DEMO_SPONSOR_NAME,
        sponsorSlug: DEMO_WORKSPACE_SLUG,
      };
    } else {
      const me = await getCurrentUser();
      venue = await detectVenueWelcome(me);
      if (venue) {
        await markVenueEntitlementReached(me);
      }
    }
  }

  return (
    <>
      <HybridWorkspace view="board" />
      <Suspense fallback={null}>
        <TemplatedToast />
      </Suspense>
      {venue ? (
        <VenueWelcomeCard
          sponsorName={venue.sponsorName}
          sponsorSlug={venue.sponsorSlug}
        />
      ) : null}
    </>
  );
}
