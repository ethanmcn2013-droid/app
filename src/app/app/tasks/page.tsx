import { Suspense } from "react";
import Link from "next/link";
import { PROJECT_APP_PATH } from "@/lib/product-urls";
import { withActiveProject } from "@/lib/projects/project-url";
import { readSponsoredWeddingDate } from "@/server/db/sponsored-wedding-date";
import { db } from "@/server/db";
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
  const weddingDate = isDemoMode() ? null : await readSponsoredWeddingDate(db, {
    actorUserId: await getCurrentUser(), projectId: arrival.project.workspaceId,
  });
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
      <div className="flex h-full min-h-0 flex-col">
        {weddingDate ? <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line-soft bg-bg-elevated px-4 py-2 text-[13px] text-ink-soft">
          <span>Wedding date{weddingDate.weddingDate ? "" : " not set yet"}</span>
          <Link href={withActiveProject(`${PROJECT_APP_PATH}#wedding-date`, arrival.project.workspaceId)} className="inline-flex min-h-[44px] items-center font-medium text-brand underline underline-offset-4">
            {weddingDate.canManage ? (weddingDate.weddingDate ? "View or update wedding date" : "Add your wedding date") : "View wedding date"}
          </Link>
        </div> : null}
        <div className="min-h-0 flex-1"><HybridWorkspace view="board" /></div>
      </div>
      <Suspense fallback={null}>
        <TemplatedToast />
      </Suspense>
      {venue ? (
        <VenueWelcomeCard
          sponsorName={venue.sponsorName}
          sponsorSlug={venue.sponsorSlug}
          projectId={arrival.project.workspaceId}
          canManageWeddingDate={weddingDate?.canManage ?? false}
        />
      ) : null}
    </TasksRuntimePageMount>
  );
}
