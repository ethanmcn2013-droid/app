import { Suspense } from "react";
import { AppPageHeader } from "@/components/app/page-header";
import { BoardApp } from "@/components/app/board/board-app";
import { TemplatedToast } from "@/components/app/templated-toast";
import { VenueWelcomeCard } from "@/components/welcome/venue-welcome-card";
import {
  detectVenueWelcome,
  markVenueEntitlementReached,
} from "@/server/db/venue-welcome";
import { getCurrentUser } from "@/server/auth";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const sp = await searchParams;
  let venue: { sponsorName: string; sponsorSlug: string } | null = null;
  if (sp.welcome === "venue") {
    const me = await getCurrentUser();
    venue = await detectVenueWelcome(me);
    if (venue) {
      // Stamp the entitlement's reached_board_at on first venue-welcome
      // render. Idempotent — subsequent visits leave the original
      // timestamp in place. Fires the /hq/partners "Reached board"
      // signal without an event-log table.
      await markVenueEntitlementReached(me);
    }
  }
  return (
    <>
      <AppPageHeader />
      <BoardApp />
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
