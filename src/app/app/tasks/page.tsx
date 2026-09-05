import { Suspense } from "react";
import { HybridWorkspace } from "@/components/hybrid/hybrid-workspace";
import { TasksRuntimePageMount } from "@/components/app/tasks-runtime-mount";
import { TemplatedToast } from "@/components/app/templated-toast";
import { VenueWelcomeCard } from "@/components/welcome/venue-welcome-card";
import {
  detectVenueWelcome,
  markVenueEntitlementReached,
} from "@/server/db/venue-welcome";
import { getCurrentUser } from "@/server/auth";
import { isDemoMode } from "@/lib/access-mode";
import { resolveTasksArrival, TasksArrivalRefusal } from "@/components/app/tasks-project-arrival";
import {
  DEMO_SPONSOR_NAME,
  DEMO_WORKSPACE_SLUG,
} from "@/server/demo/tasks-demo";

export const metadata = { title: "Board · Tasks · Signal Studio" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; workspaceId?: string | string[]; task?: string }>;
}) {
  const sp = await searchParams;

  const arrival = await resolveTasksArrival(sp.workspaceId);
  if (arrival.kind !== "ready") {
    return <TasksArrivalRefusal arrival={arrival} requested={sp.workspaceId} surface="tasks" taskId={sp.task} />;
  }

  let venue: { sponsorName: string; sponsorSlug: string } | null = null;
  if (sp.welcome === "venue") {
    if (isDemoMode()) {
      venue = {
        sponsorName: DEMO_SPONSOR_NAME,
        sponsorSlug: DEMO_WORKSPACE_SLUG,
      };
    } else {
      const me = await getCurrentUser();
      const project = arrival.project;
      if (project.kind === "ready") {
        const welcome = await detectVenueWelcome(me, project.workspaceId);
        venue = welcome;
        if (welcome) {
          await markVenueEntitlementReached(me, project.workspaceId, welcome.code);
        }
      }
    }
  }

  return (
    <TasksRuntimePageMount searchParams={searchParams}>
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
    </TasksRuntimePageMount>
  );
}
